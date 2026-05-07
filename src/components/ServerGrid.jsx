import { useState, useRef, useEffect } from 'react';
import { useT } from '../LanguageContext';

const TYPE_COLORS = { RDP: 'rdp', VNC: 'vnc', SSH: 'ssh' };

const TYPE_ICONS = {
  RDP: (<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>),
  VNC: (<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M8 21h8M12 17v4"/></svg>),
  SSH: (<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>),
};

const CONNECT_ICON = (<svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>);

// ─── Ping badge ───────────────────────────────────────────────────────────────
function PingDot({ ping }) {
  if (!ping) {
    // Unknown / never checked
    return (
      <span className="ping-dot ping-unknown" title="Sin datos de conectividad" />
    );
  }
  if (ping.checking) {
    return (
      <span className="ping-dot ping-checking" title="Verificando…" />
    );
  }
  const tip = ping.up
    ? `En línea · ${ping.ms} ms`
    : 'Sin respuesta';
  return (
    <span
      className={`ping-dot ${ping.up ? 'ping-up' : 'ping-down'}`}
      title={tip}
    />
  );
}

// ─── Ping badge for list view (shows latency text) ───────────────────────────
function PingBadge({ ping }) {
  if (!ping) return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>;
  if (ping.checking) return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>…</span>;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
      color: ping.up ? '#22c55e' : '#ef4444',
    }}>
      {ping.up ? `${ping.ms} ms` : 'offline'}
    </span>
  );
}

const api = window.rm;

// ─── Password expiry helpers ─────────────────────────────────────────────────
function pwdAgeDays(server) {
  if (!server.passwordChangedAt || !server.password) return null;
  return Math.floor((Date.now() - new Date(server.passwordChangedAt).getTime()) / 86_400_000);
}

function PwdWarning({ server, warningDays }) {
  if (!warningDays) return null;
  const days = pwdAgeDays(server);
  if (days === null || days < warningDays) return null;
  const critical = days >= warningDays * 2;
  return (
    <span title={`Contraseña actualizada hace ${days} días — considera cambiarla`}
      style={{ fontSize: 11, fontWeight: 700, color: critical ? 'var(--danger)' : '#f59e0b',
               display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      {days}d
    </span>
  );
}

// ─── Inline note editor ───────────────────────────────────────────────────────
function NoteEditor({ server, onSave, style }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(server.notes || '');
  const taRef                 = useRef(null);

  useEffect(() => { setVal(server.notes || ''); }, [server.notes]);
  useEffect(() => { if (editing) taRef.current?.focus(); }, [editing]);

  function commit() {
    setEditing(false);
    if (val !== (server.notes || '')) onSave(server.id, val);
  }

  if (editing) return (
    <textarea ref={taRef} value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Escape') { setVal(server.notes || ''); setEditing(false); } if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); } }}
      rows={2}
      style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '4px 6px', background: 'var(--bg-base)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', resize: 'none', outline: 'none', ...style }}
    />
  );

  return (
    <div onClick={() => setEditing(true)} title={t('editNote')}
      style={{ fontSize: 12, color: val ? 'var(--text-muted)' : 'var(--border-light)', cursor: 'text',
               overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
               minHeight: 16, ...style }}>
      {val || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>{t('addNote')}</span>}
    </div>
  );
}

// ─── Server card (grid view) ─────────────────────────────────────────────────
function ServerCard({ server, group, ping, onConnect, onEdit, onDelete, onToggleFavorite, onWol, onContextMenu, onUpdateNotes, passwordWarningDays }) {
  const t = useT();
  const [connecting, setConnecting] = useState(false);
  const [waking, setWaking]         = useState(false);

  async function handleConnect(e) {
    e.stopPropagation();
    setConnecting(true);
    await onConnect(server);
    setTimeout(() => setConnecting(false), 1200);
  }

  async function handleWol(e) {
    e.stopPropagation();
    setWaking(true);
    await onWol(server);
    setTimeout(() => setWaking(false), 2000);
  }

  const typeColor = `var(--${TYPE_COLORS[server.type] || 'accent'})`;

  return (
    <div className="server-card" onDoubleClick={handleConnect} onContextMenu={e => onContextMenu(e, server)}>
      {/* Top-right: ping dot + star */}
      <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
        <button className="btn-icon star-btn" onClick={e => { e.stopPropagation(); onToggleFavorite(server); }}
          style={{ width: 20, height: 20, padding: 0, color: server.favorite ? '#f59e0b' : 'var(--border-light)', opacity: server.favorite ? 1 : 0.4 }}
          title={server.favorite ? t('removeFavorite') : t('addFavorite')}>
          <svg width="13" height="13" fill={server.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
        <PingDot ping={ping} />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div className="server-card-icon" style={{ color: typeColor, borderColor: typeColor + '30', background: typeColor + '12' }}>
          {TYPE_ICONS[server.type] || TYPE_ICONS.SSH}
        </div>
        <div className="server-card-body">
          <div className="server-card-name" title={server.name}>{server.name}</div>
          <div className="server-card-host" title={server.host}>
            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, opacity: 0.5 }}><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            {server.host}{server.port ? `:${server.port}` : ''}
          </div>
          {server.mac && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
              <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, opacity: 0.5 }}><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{server.mac}</span>
            </div>
          )}
          <NoteEditor server={server} onSave={onUpdateNotes} />
        </div>
      </div>

      <div className="server-card-meta">
        <span className={`badge badge-${(server.type || 'ssh').toLowerCase()}`}>{server.type}</span>
        <PwdWarning server={server} warningDays={passwordWarningDays} />
        {group && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
            {group.isHome
              ? <svg width="8" height="8" fill="none" stroke="#f59e0b" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
              : <span style={{ width: 8, height: 8, borderRadius: '50%', background: group.color }} />}
            {group.name}
          </span>
        )}
        {server.jumpHost?.enabled && (
          <span title="Jump Host configurado" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
          </span>
        )}
      </div>

      <div className="server-card-actions">
        <button className="btn-primary card-connect-btn" onClick={handleConnect} disabled={connecting} style={{ padding: '6px 12px', fontSize: 13 }}>
          {connecting ? <span className="spinner" style={{ width: 14, height: 14 }} /> : CONNECT_ICON}
          {connecting ? t('connecting') : t('connect')}
        </button>
        {server.mac && (
          <button className="btn-icon" onClick={handleWol} disabled={waking} title="Wake on LAN" style={{ color: waking ? '#f59e0b' : undefined }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
          </button>
        )}
        <button className="btn-icon" onClick={e => { e.stopPropagation(); onEdit(server); }} title="Editar">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button className="btn-icon" onClick={e => { e.stopPropagation(); onDelete(server.id); }} style={{ color: 'var(--danger)' }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    </div>
  );
}

// ─── Server row (list view) ───────────────────────────────────────────────────
// Uses CSS grid — same template as the header, so columns align perfectly.
const LIST_COLS = '20px 22px 20px 1fr 180px 70px 80px 110px 140px';

function ServerRow({ server, group, ping, onConnect, onEdit, onDelete, onToggleFavorite, onWol, onContextMenu, onUpdateNotes, passwordWarningDays }) {
  const t = useT();
  const [connecting, setConnecting] = useState(false);

  async function handleConnect(e) {
    e.stopPropagation();
    setConnecting(true);
    await onConnect(server);
    setTimeout(() => setConnecting(false), 1200);
  }

  const typeColor = `var(--${TYPE_COLORS[server.type] || 'accent'})`;

  return (
    <div className="server-row" onDoubleClick={handleConnect} onContextMenu={e => onContextMenu(e, server)}
      style={{ display: 'grid', gridTemplateColumns: LIST_COLS, columnGap: 10, alignItems: 'center', padding: '8px 12px' }}>

      {/* 1 — estrella */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button className="btn-icon" onClick={e => { e.stopPropagation(); onToggleFavorite(server); }}
          style={{ width: 18, height: 18, padding: 0, color: server.favorite ? '#f59e0b' : 'var(--border)', opacity: server.favorite ? 1 : 0.5 }}>
          <svg width="11" height="11" fill={server.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
      </div>

      {/* 2 — ping dot */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <PingDot ping={ping} />
      </div>

      {/* 3 — icono tipo */}
      <div style={{ display: 'flex', alignItems: 'center', color: typeColor }}>
        {TYPE_ICONS[server.type] || TYPE_ICONS.SSH}
      </div>

      {/* 4 — nombre */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
          {server.name}
          <PwdWarning server={server} warningDays={passwordWarningDays} />
        </div>
        <NoteEditor server={server} onSave={onUpdateNotes} />
      </div>

      {/* 5 — host + mac */}
      <div style={{ overflow: 'hidden' }}>
        <div style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {server.host}{server.port ? `:${server.port}` : ''}
        </div>
        {server.mac && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3 }}>
            <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0, opacity: 0.5 }}><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>
            {server.mac}
          </div>
        )}
      </div>

      {/* 6 — tipo badge */}
      <div>
        <span className={`badge badge-${(server.type || 'ssh').toLowerCase()}`}>{server.type}</span>
      </div>

      {/* 7 — latencia */}
      <div>
        <PingBadge ping={ping} />
      </div>

      {/* 8 — grupo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
        {group
          ? (<>
              {group.isHome
                ? <svg width="8" height="8" fill="none" stroke="#f59e0b" strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink: 0 }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                : <span style={{ width: 8, height: 8, borderRadius: '50%', background: group.color, flexShrink: 0 }} />}
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</span>
            </>)
          : <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('noGroup')}</span>}
      </div>

      {/* 9 — acciones */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button className="btn-primary" onClick={handleConnect} disabled={connecting}
          style={{ padding: '5px 10px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}>
          {connecting ? <span className="spinner" style={{ width: 12, height: 12 }} /> : CONNECT_ICON}
        </button>
        {server.mac && (
          <button className="btn-icon" onClick={e => { e.stopPropagation(); onWol(server); }} title="Wake on LAN" style={{ color: 'var(--text-muted)' }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
          </button>
        )}
        <button className="btn-icon" onClick={e => { e.stopPropagation(); onEdit(server); }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button className="btn-icon" onClick={e => { e.stopPropagation(); onDelete(server.id); }} style={{ color: 'var(--danger)' }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────
export default function ServerGrid({ servers, groups, viewMode, pingResults = {}, onConnect, onEdit, onDelete, onToggleFavorite, onWol, onContextMenu, onAddNew, searchQuery, onUpdateNotes, passwordWarningDays = 90 }) {
  const t = useT();
  const groupMap = Object.fromEntries((groups || []).map(g => [g.id, g]));

  if (servers.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, color: 'var(--text-muted)' }}>
        {searchQuery ? (
          <>
            <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>{t('noResults')}</div>
              <div style={{ fontSize: 14, marginTop: 4 }}>{t('noResultsMsg')} "{searchQuery}"</div>
            </div>
          </>
        ) : (
          <>
            <svg width="56" height="56" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>{t('noServers')}</div>
              <div style={{ fontSize: 14, marginTop: 4 }}>{t('addFirstServer')}</div>
            </div>
            <button className="btn-primary" onClick={onAddNew} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
              {t('addServer')}
            </button>
          </>
        )}
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {/* Header — mismo grid que ServerRow */}
        <div style={{
          display: 'grid', gridTemplateColumns: LIST_COLS, columnGap: 10,
          alignItems: 'center', padding: '0 12px 8px',
          color: 'var(--text-muted)', fontSize: 12, fontWeight: 700,
          letterSpacing: '.05em', textTransform: 'uppercase',
          borderBottom: '1px solid var(--border)', marginBottom: 6,
        }}>
          <div />{/* estrella */}
          <div />{/* ping */}
          <div />{/* icono */}
          <div>{t('sortName')}</div>
          <div>Host</div>
          <div>{t('sortType')}</div>
          <div>{t('latency')}</div>
          <div>{t('sortGroup')}</div>
          <div>{t('actions')}</div>
        </div>
        {servers.map(s => (
          <ServerRow key={s.id} server={s} group={s.groupId ? groupMap[s.groupId] : null}
            ping={pingResults[s.id]} onConnect={onConnect} onEdit={onEdit}
            onDelete={onDelete} onToggleFavorite={onToggleFavorite} onWol={onWol} onContextMenu={onContextMenu}
            onUpdateNotes={onUpdateNotes} passwordWarningDays={passwordWarningDays} />
        ))}
        <style>{`.server-row { border-radius: var(--radius-sm); cursor: default; transition: background .1s; } .server-row:hover { background: var(--bg-hover); }`}</style>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
      <div className="server-grid">
        {servers.map(s => (
          <ServerCard key={s.id} server={s} group={s.groupId ? groupMap[s.groupId] : null}
            ping={pingResults[s.id]} onConnect={onConnect} onEdit={onEdit}
            onDelete={onDelete} onToggleFavorite={onToggleFavorite} onWol={onWol} onContextMenu={onContextMenu}
            onUpdateNotes={onUpdateNotes} passwordWarningDays={passwordWarningDays} />
        ))}
      </div>
      <style>{`
        .server-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
        .server-card { position: relative; background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; display: flex; flex-direction: column; gap: 12px; cursor: default; transition: border-color .15s, box-shadow .15s, transform .1s; }
        .server-card:hover { border-color: var(--border-light); box-shadow: var(--shadow); transform: translateY(-1px); }
        .server-card:hover .server-card-actions { opacity: 1; }
        .server-card-icon { width: 44px; height: 44px; border-radius: var(--radius-sm); border: 1px solid; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .server-card-body { flex: 1; min-width: 0; }
        .server-card-name { font-weight: 700; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .server-card-host { font-family: var(--font-mono); font-size: 12px; color: var(--text-muted); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: flex; align-items: center; gap: 4px; }
        .server-card-notes { font-size: 12px; color: var(--text-muted); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .server-card-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .server-card-actions { display: flex; align-items: center; gap: 6px; opacity: 0; transition: opacity .15s; }
        .card-connect-btn { display: flex; align-items: center; gap: 6px; flex: 1; justify-content: center; }

        /* ── Ping dots ─────────────────────────────────────────── */
        .ping-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .ping-up      { background: #22c55e; box-shadow: 0 0 0 3px #22c55e22;
                        animation: ping-pulse 2.5s ease-in-out infinite; }
        .ping-down    { background: #ef4444; box-shadow: 0 0 0 3px #ef444422; }
        .ping-unknown { background: var(--text-muted); }
        .ping-checking { background: var(--accent); animation: ping-blink .8s ease-in-out infinite; }

        @keyframes ping-pulse {
          0%, 100% { box-shadow: 0 0 0 3px #22c55e30; }
          50%       { box-shadow: 0 0 0 7px #22c55e10; }
        }
        @keyframes ping-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: .35; }
        }
      `}</style>
    </div>
  );
}
