import { useState } from 'react';

const api = window.rm;
const DEFAULT_PORTS = { RDP: 3389, VNC: 5900, SSH: 22 };

export default function ImportModal({ groups, onImport, onClose }) {
  const [source,    setSource]    = useState(null);   // 'putty' | 'file'
  const [sessions,  setSessions]  = useState([]);
  const [selected,  setSelected]  = useState(new Set());
  const [targetGroup, setTargetGroup] = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [fileLoaded, setFileLoaded] = useState(false);

  async function loadPutty() {
    setLoading(true); setError(''); setSource('putty');
    const res = await api.import.putty();
    if (res.error) setError(res.error);
    const list = res.sessions || [];
    setSessions(list);
    setSelected(new Set(list.map((_, i) => i)));
    setLoading(false);
  }

  async function loadFile() {
    setLoading(true); setError(''); setSource('file'); setFileLoaded(false);
    const res = await api.import.file();
    if (res.canceled) { setLoading(false); setSource(null); return; }
    if (res.error) { setError(res.error); setFileLoaded(true); setLoading(false); return; }
    const list = res.servers || [];
    setSessions(list);
    setSelected(new Set(list.map((_, i) => i)));
    setFileLoaded(true);
    setLoading(false);
  }

  function toggleAll() {
    if (selected.size === sessions.length) setSelected(new Set());
    else setSelected(new Set(sessions.map((_, i) => i)));
  }

  function toggle(i) {
    const s = new Set(selected);
    s.has(i) ? s.delete(i) : s.add(i);
    setSelected(s);
  }

  function handleImport() {
    const toImport = [...selected].map(i => ({
      ...sessions[i],
      groupId: targetGroup,
      port: sessions[i].port || DEFAULT_PORTS[sessions[i].type] || 22,
    }));
    onImport(toImport);
  }

  const canImport = selected.size > 0 && sessions.length > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Importar servidores
          </h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Source selector */}
          {!sessions.length && !loading && !fileLoaded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Elige el origen de los servidores a importar:</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <button className="btn-ghost" onClick={loadPutty}
                  style={{ padding: '20px 16px', height: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, borderRadius: 'var(--radius)' }}>
                  <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>PuTTY</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>Sesiones guardadas en el registro de Windows</div>
                  </div>
                </button>
                <button className="btn-ghost" onClick={loadFile}
                  style={{ padding: '20px 16px', height: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, borderRadius: 'var(--radius)' }}>
                  <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>Fichero JSON / CSV</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>Config RDPM (.json) o tabla de servidores (.csv)</div>
                  </div>
                </button>
              </div>
              <div style={{ background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--text-secondary)' }}>Formato CSV:</strong> columnas <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-elevated)', padding: '1px 4px', borderRadius: 3 }}>name,type,host,port,username,notes</code>
              </div>
            </div>
          )}

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <span className="spinner" style={{ width: 28, height: 28 }} />
            </div>
          )}

          {error && (
            <div style={{ background: '#ef444415', border: '1px solid #ef444430', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--danger)', fontSize: 13 }}>
              {error}
            </div>
          )}

          {fileLoaded && !loading && sessions.length === 0 && !error && (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
              <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 12, opacity: 0.4 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>No se encontraron servidores</div>
              <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                Comprueba que el fichero tenga los campos <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-elevated)', padding: '1px 4px', borderRadius: 3 }}>name</code> y <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-elevated)', padding: '1px 4px', borderRadius: 3 }}>host</code> obligatorios.
              </div>
            </div>
          )}

          {sessions.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {sessions.length} servidor{sessions.length !== 1 ? 'es' : ''} encontrado{sessions.length !== 1 ? 's' : ''}
                </span>
                <button className="btn-ghost" onClick={toggleAll} style={{ fontSize: 12 }}>
                  {selected.size === sessions.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              </div>

              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', maxHeight: 300, overflowY: 'auto' }}>
                {sessions.map((s, i) => (
                  <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: selected.has(i) ? 'var(--bg-hover)' : 'transparent', transition: 'background .1s' }}>
                    <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} style={{ width: 'auto', margin: 0, flexShrink: 0 }} />
                    <span className={`badge badge-${(s.type || 'ssh').toLowerCase()}`} style={{ fontSize: 10, padding: '2px 6px', flexShrink: 0 }}>{s.type || 'SSH'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {s.username ? `${s.username}@` : ''}{s.host}{s.port && s.port !== DEFAULT_PORTS[s.type] ? `:${s.port}` : ''}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="field" style={{ marginBottom: 0 }}>
                <label>Asignar al grupo</label>
                <select value={targetGroup} onChange={e => setTargetGroup(e.target.value)}>
                  <option value="">Sin grupo</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={() => {
            if (!sessions.length && !fileLoaded) { onClose(); return; }
            setSessions([]); setSelected(new Set()); setError(''); setSource(null); setFileLoaded(false);
          }}>
            {sessions.length || fileLoaded ? 'Volver' : 'Cancelar'}
          </button>
          {canImport && (
            <button className="btn-primary" onClick={handleImport} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              Importar {selected.size} servidor{selected.size !== 1 ? 'es' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
