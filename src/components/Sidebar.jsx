import { useState } from 'react';
import iconUrl from '../../assets/icon.png';

const GROUP_COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#ec4899','#06b6d4','#84cc16'];

const isMac = /Mac/.test(navigator.userAgent);

export default function Sidebar({ groups, servers, selectedGroup, onSelectGroup, onSaveGroup, onDeleteGroup, onOpenSettings, onOpenAbout, onOpenHistory, onOpenImport }) {
  const [editingGroup, setEditingGroup] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  const ungroupedCount = servers.filter(s => !s.groupId).length;

  function startNewGroup() {
    setEditingGroup({ name: '', color: GROUP_COLORS[groups.length % GROUP_COLORS.length] });
  }

  function saveGroup() {
    if (!editingGroup.name.trim()) return;
    onSaveGroup({ ...editingGroup, name: editingGroup.name.trim() });
    setEditingGroup(null);
  }

  if (collapsed) {
    return (
      <div style={{ width: 48, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0', gap: 8 }}>
        <button className="btn-icon" onClick={() => setCollapsed(false)} data-tip="Expandir panel">
          <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
        </button>
        <div style={{ width: 1, flex: 1 }} />
        <button className="btn-icon" onClick={onOpenSettings} data-tip="Ajustes">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 0-1.42-1.42M4.93 4.93a10 10 0 0 0-1.42 1.42M4.93 19.07a10 10 0 0 0 1.42 1.42M19.07 19.07a10 10 0 0 0 1.42-1.42M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>
        </button>
      </div>
    );
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header" style={{ WebkitAppRegion: 'drag', paddingTop: isMac ? 38 : 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, WebkitAppRegion: 'no-drag' }}>
          <div className="app-logo">
            <img src={iconUrl} alt="RDPM" style={{ width: 20, height: 20, objectFit: 'contain', display: 'block', filter: 'brightness(0) invert(1)' }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em' }}>RDPM</span>
        </div>
        <button className="btn-icon" onClick={() => setCollapsed(true)} data-tip="Colapsar" style={{ WebkitAppRegion: 'no-drag' }}>
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className={`nav-item ${selectedGroup === 'all' ? 'active' : ''}`} onClick={() => onSelectGroup('all')}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          <span>Todos</span>
          <span className="nav-badge">{servers.length}</span>
        </div>
        {servers.some(s => s.favorite) && (
          <div className={`nav-item ${selectedGroup === '__favorites__' ? 'active' : ''}`} onClick={() => onSelectGroup('__favorites__')}>
            <svg width="14" height="14" fill={selectedGroup === '__favorites__' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: '#f59e0b' }}>
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <span>Favoritos</span>
            <span className="nav-badge">{servers.filter(s => s.favorite).length}</span>
          </div>
        )}
      </nav>

      <div className="sidebar-section-header">
        <span>GRUPOS</span>
        <button className="btn-icon" onClick={startNewGroup} data-tip="Nuevo grupo" style={{ width: 20, height: 20, padding: 0 }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
        </button>
      </div>

      <nav className="sidebar-nav" style={{ flex: 1, overflowY: 'auto' }}>
        {groups.map(g => {
          const count = servers.filter(s => s.groupId === g.id).length;
          if (g.isHome) {
            // ─── Home group: always first, local, no edit/delete ────────────
            return (
              <div key={g.id} className={`nav-item ${selectedGroup === g.id ? 'active' : ''}`} onClick={() => onSelectGroup(g.id)}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: '#f59e0b', flexShrink: 0 }}>
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.06em', color: '#f59e0b', border: '1px solid #f59e0b40', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>LOCAL</span>
                <span className="nav-badge">{count}</span>
              </div>
            );
          }
          return (
            <div key={g.id} className={`nav-item ${selectedGroup === g.id ? 'active' : ''}`} onClick={() => onSelectGroup(g.id)} onContextMenu={e => { e.preventDefault(); setConfirmDelete(g); }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: g.color || '#3b82f6', flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
              <span className="nav-badge">{count}</span>
              <div className="nav-item-actions">
                <button className="btn-icon" style={{ width: 22, height: 22, padding: 0 }} onClick={e => { e.stopPropagation(); setEditingGroup(g); }}>
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button className="btn-icon" style={{ width: 22, height: 22, padding: 0, color: 'var(--danger)' }} onClick={e => { e.stopPropagation(); setConfirmDelete(g); }}>
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </div>
            </div>
          );
        })}

        {ungroupedCount > 0 && (
          <div className={`nav-item ${selectedGroup === 'ungrouped' ? 'active' : ''}`} onClick={() => onSelectGroup('ungrouped')}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeDasharray="4 2"/></svg>
            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin grupo</span>
            <span className="nav-badge">{ungroupedCount}</span>
          </div>
        )}

        {groups.length === 0 && (
          <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', lineHeight: 1.5 }}>
            Sin grupos aún.<br/>Crea uno para organizar tus servidores.
          </div>
        )}
      </nav>

      <div className="sidebar-footer">
        <button className="btn-ghost" onClick={onOpenHistory} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start', borderRadius: 'var(--radius-sm)' }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Historial
        </button>
        <button className="btn-ghost" onClick={onOpenImport} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start', borderRadius: 'var(--radius-sm)', marginTop: 2 }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Importar
        </button>
        <button className="btn-ghost" onClick={onOpenSettings} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start', borderRadius: 'var(--radius-sm)', marginTop: 2 }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          Ajustes
        </button>
        <button className="btn-ghost" onClick={onOpenAbout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start', borderRadius: 'var(--radius-sm)', marginTop: 2 }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Acerca de...
        </button>
      </div>

      {editingGroup && (
        <div className="modal-overlay" onClick={() => setEditingGroup(null)}>
          <div className="modal" style={{ width: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>{editingGroup.id ? 'Editar grupo' : 'Nuevo grupo'}</h2><button className="btn-icon" onClick={() => setEditingGroup(null)}>✕</button></div>
            <div className="modal-body">
              <div className="field">
                <label>Nombre del grupo</label>
                <input autoFocus value={editingGroup.name} onChange={e => setEditingGroup(g => ({ ...g, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && saveGroup()} placeholder="Ej: Producción" />
              </div>
              <div className="field">
                <label>Color</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {GROUP_COLORS.map(c => (
                    <button key={c} onClick={() => setEditingGroup(g => ({ ...g, color: c }))} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: editingGroup.color === c ? '3px solid white' : '2px solid transparent', boxShadow: editingGroup.color === c ? '0 0 0 2px var(--accent)' : 'none' }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setEditingGroup(null)}>Cancelar</button>
              <button className="btn-primary" onClick={saveGroup} disabled={!editingGroup.name.trim()}>{editingGroup.id ? 'Guardar' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" style={{ width: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>Eliminar grupo</h2><button className="btn-icon" onClick={() => setConfirmDelete(null)}>✕</button></div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>¿Eliminar el grupo <strong style={{ color: 'var(--text-primary)' }}>{confirmDelete.name}</strong>?<br/>Los servidores de este grupo pasarán a "Sin grupo".</p>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="btn-danger" onClick={() => { onDeleteGroup(confirmDelete.id); setConfirmDelete(null); }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .sidebar { width: 240px; flex-shrink: 0; background: var(--bg-surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
        .sidebar-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 14px 12px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
        .app-logo { width: 32px; height: 32px; background: var(--accent); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; }
        .sidebar-nav { display: flex; flex-direction: column; padding: 6px; gap: 2px; }
        .sidebar-section-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px 4px; font-size: 11px; font-weight: 700; letter-spacing: .08em; color: var(--text-muted); flex-shrink: 0; }
        .nav-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--radius-sm); cursor: pointer; color: var(--text-secondary); font-size: 14px; transition: background .1s, color .1s; position: relative; }
        .nav-item:hover { background: var(--bg-hover); color: var(--text-primary); }
        .nav-item:hover .nav-item-actions { opacity: 1; }
        .nav-item.active { background: var(--accent-light); color: var(--accent); font-weight: 600; }
        .nav-badge { margin-left: auto; background: var(--bg-elevated); color: var(--text-muted); font-size: 11px; padding: 1px 7px; border-radius: 20px; font-weight: 600; flex-shrink: 0; }
        .nav-item.active .nav-badge { background: var(--accent-light); color: var(--accent); }
        .nav-item-actions { display: flex; align-items: center; gap: 2px; opacity: 0; transition: opacity .1s; margin-left: auto; }
        .sidebar-footer { padding: 10px; border-top: 1px solid var(--border); flex-shrink: 0; }
      `}</style>
    </div>
  );
}
