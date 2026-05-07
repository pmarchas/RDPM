import { useEffect, useRef } from 'react';

export default function ContextMenu({ x, y, server, onConnect, onEdit, onDuplicate, onDelete, onToggleFavorite, onWol }) {
  const ref = useRef();

  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    if (rect.right  > window.innerWidth)  ref.current.style.left = `${x - rect.width}px`;
    if (rect.bottom > window.innerHeight) ref.current.style.top  = `${y - rect.height}px`;
  }, [x, y]);

  const typeColor = server.type === 'RDP' ? 'var(--rdp)' : server.type === 'VNC' ? 'var(--vnc)' : 'var(--ssh)';

  return (
    <div ref={ref} className="ctx-menu" style={{ left: x, top: y }} onClick={e => e.stopPropagation()}>
      <div style={{ padding: '6px 12px 8px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{server.name}</div>
        <div style={{ fontSize: 12, color: typeColor, fontFamily: 'var(--font-mono)' }}>[{server.type}] {server.host}{server.port ? `:${server.port}` : ''}</div>
      </div>

      <div className="ctx-item" onClick={onConnect}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Conectar
      </div>

      {server.mac && (
        <div className="ctx-item" onClick={onWol}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
          Wake on LAN
        </div>
      )}

      <div className="ctx-divider" />

      <div className="ctx-item" onClick={onToggleFavorite}>
        <svg width="14" height="14" fill={server.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"
          viewBox="0 0 24 24" style={{ color: server.favorite ? '#f59e0b' : undefined }}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        {server.favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
      </div>

      <div className="ctx-item" onClick={onEdit}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Editar servidor
      </div>

      <div className="ctx-item" onClick={onDuplicate}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Duplicar servidor
      </div>

      <div className="ctx-item" onClick={() => navigator.clipboard?.writeText(`${server.host}${server.port ? ':' + server.port : ''}`)}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
        Copiar host
      </div>

      {server.username && (
        <div className="ctx-item" onClick={() => navigator.clipboard?.writeText(server.username)}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Copiar usuario
        </div>
      )}

      <div className="ctx-divider" />

      <div className="ctx-item danger" onClick={onDelete}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        Eliminar servidor
      </div>
    </div>
  );
}
