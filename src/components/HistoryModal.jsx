import { useState, useEffect, useContext } from 'react';
import { useT, LanguageContext } from '../LanguageContext';

const api = window.rm;
const TYPE_COLOR = { RDP: 'var(--rdp)', VNC: 'var(--vnc)', SSH: 'var(--ssh)' };

export default function HistoryModal({ onClose }) {
  const t = useT();
  const lang = useContext(LanguageContext);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [clearing, setClearing] = useState(false);

  function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)   return t('justNow');
    if (m < 60)  return t('minutesAgo', { n: m });
    const h = Math.floor(m / 60);
    if (h < 24)  return t('hoursAgo', { n: h });
    const d = Math.floor(h / 24);
    return d === 1 ? t('dayAgo', { n: d }) : t('daysAgo', { n: d });
  }

  function fmtDate(iso) {
    const locale = lang === 'en' ? 'en-GB' : 'es-ES';
    return new Date(iso).toLocaleString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  useEffect(() => {
    api.history.read().then(h => { setHistory(h || []); setLoading(false); });
  }, []);

  async function handleClear() {
    if (!window.confirm('¿Borrar todo el historial de conexiones?')) return;
    setClearing(true);
    await api.history.clear();
    setHistory([]);
    setClearing(false);
  }

  const filtered = search.trim()
    ? history.filter(e => e.serverName?.toLowerCase().includes(search.toLowerCase()) || e.serverHost?.toLowerCase().includes(search.toLowerCase()))
    : history;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 680, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {t('connectionHistory')}
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-ghost" onClick={handleClear} disabled={clearing || !history.length}
              style={{ fontSize: 12, color: 'var(--danger)', borderColor: 'var(--danger)' }}>
              {t('clearAll')}
            </button>
            <button className="btn-icon" onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0 10px' }}>
            <svg width="14" height="14" fill="none" stroke="var(--text-muted)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('filterPlaceholder')}
              style={{ background: 'transparent', border: 'none', color: 'inherit', width: '100%', padding: '8px 0' }} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <span className="spinner" style={{ width: 28, height: 28 }} />
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              {history.length === 0 ? t('noConnections') : t('noResultsFilter')}
            </div>
          )}
          {!loading && filtered.map(entry => (
            <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '9px 20px', borderBottom: '1px solid var(--border)', transition: 'background .1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              <span className={`badge badge-${(entry.type || 'ssh').toLowerCase()}`} style={{ flexShrink: 0, fontSize: 10, padding: '2px 6px' }}>
                {entry.type}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.serverName}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{entry.serverHost}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{timeAgo(entry.timestamp)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(entry.timestamp)}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
          {history.length !== 1 ? t('connectionsCountPlural', { n: history.length }) : t('connectionsCount', { n: history.length })}
        </div>
      </div>
    </div>
  );
}
