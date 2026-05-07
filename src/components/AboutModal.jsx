import { useState, useEffect } from 'react';
import iconUrl from '../../assets/icon.png';

const api = window.rm;

export default function AboutModal({ onClose }) {
  const [version, setVersion] = useState('1.0.0');

  useEffect(() => {
    api.app.version().then(v => setVersion(v)).catch(() => {});
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Acerca de RDPM</h2>
          <button className="btn-icon" onClick={onClose}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="modal-body" style={{ textAlign: 'center', padding: '32px 36px' }}>

          {/* Icono de la app */}
          <div style={{ marginBottom: 20 }}>
            <img
              src={iconUrl}
              alt="RDPM"
              style={{ width: 96, height: 96, borderRadius: 22, display: 'block', margin: '0 auto', boxShadow: '0 4px 24px #0006' }}
            />
          </div>

          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>RDPM</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Gestor de conexiones RDP · VNC · SSH</div>
          <div style={{ display: 'inline-block', background: 'var(--accent-light)', color: 'var(--accent)', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', padding: '3px 10px', borderRadius: 20, marginBottom: 24 }}>
            v{version}
          </div>

          <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', padding: '14px 20px', marginBottom: 24, textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: 'var(--text-muted)' }}>Plataforma</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{navigator.platform}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: 'var(--text-muted)' }}>Cifrado</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>AES-256-CBC</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>Tecnología</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>Electron · React · Vite</span>
            </div>
          </div>

          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            Creado por <strong style={{ color: 'var(--text-primary)' }}>pmarchas</strong>
          </div>

          <a
            href="https://github.com/pmarchas"
            onClick={e => { e.preventDefault(); api.app.openExternal('https://github.com/pmarchas'); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '9px 20px',
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
              textDecoration: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <svg width="17" height="17" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
            </svg>
            github.com/pmarchas
          </a>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'center' }}>
          <button className="btn-primary" onClick={onClose} style={{ padding: '9px 32px' }}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
