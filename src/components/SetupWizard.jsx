import { useState } from 'react';
import iconUrl from '../../assets/icon.png';

const api = window.rm;
const STEPS = ['Bienvenida', 'Configuración', 'Seguridad', 'Listo'];

export default function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(0);
  const [configPath, setConfigPath] = useState('');
  const [configMode, setConfigMode] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [pwdError, setPwdError] = useState('');

  async function browseOpen() { const p = await api.dialog.openConfig(); if (p) { setConfigPath(p); setConfigMode('open'); setTestResult(null); } }
  async function browseCreate() { const p = await api.dialog.saveConfig(); if (p) { setConfigPath(p); setConfigMode('create'); setTestResult({ ok: true, exists: true }); } }

  async function testPath() {
    if (!configPath) return;
    setTesting(true); setTestResult(null);
    const result = await api.config.test(configPath);
    setTestResult(result); setTesting(false);
  }

  function nextStep() {
    if (step === 1 && !configPath) return;
    if (step === 2) {
      if (masterPassword !== confirmPwd) { setPwdError('Las contraseñas no coinciden'); return; }
      setPwdError('');
    }
    setStep(s => s + 1);
  }

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
      <div style={{ width: 540, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1, padding: '12px 0', textAlign: 'center', fontSize: 12, fontWeight: i === step ? 700 : 400, color: i === step ? 'var(--accent)' : i < step ? 'var(--success)' : 'var(--text-muted)', background: i === step ? 'var(--accent-light)' : 'transparent', borderBottom: i === step ? '2px solid var(--accent)' : '2px solid transparent', transition: 'all .2s' }}>
              {i < step ? <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ verticalAlign: 'middle', marginRight: 4 }}><polyline points="20 6 9 17 4 12"/></svg> : `${i + 1}. `}{s}
            </div>
          ))}
        </div>

        <div style={{ padding: '32px 36px' }}>
          {step === 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ background: 'var(--accent)', borderRadius: 16, padding: '14px 20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <img src={iconUrl} alt="pmarchas IT" style={{ width: 100, height: 'auto', display: 'block' }} />
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 12, letterSpacing: '-0.02em' }}>RDPM</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.7, marginBottom: 28 }}>
                Gestiona todas tus conexiones <strong style={{ color: 'var(--rdp)' }}>RDP</strong>, <strong style={{ color: 'var(--vnc)' }}>VNC</strong> y <strong style={{ color: 'var(--ssh)' }}>SSH</strong> desde un único lugar. Compatible con ficheros compartidos en red para equipos de trabajo.
              </p>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 28, flexWrap: 'wrap' }}>
                {[['var(--rdp)', 'RDP', 'Escritorio remoto Windows'], ['var(--vnc)', 'VNC', 'Control remoto multiplataforma'], ['var(--ssh)', 'SSH', 'Terminal segura']].map(([color, type, desc]) => (
                  <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                    <span style={{ fontWeight: 700, color }}>{type}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Fichero de configuración</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>Elige dónde guardar la configuración. Puedes usar una carpeta de red para que varios usuarios compartan los mismos servidores.</p>
              <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                <button onClick={browseCreate} style={{ flex: 1, padding: '20px 16px', border: `2px solid ${configMode === 'create' ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius)', background: configMode === 'create' ? 'var(--accent-light)' : 'transparent', cursor: 'pointer', transition: 'all .15s', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>✨</div>
                  <div style={{ fontWeight: 700, marginBottom: 4, color: configMode === 'create' ? 'var(--accent)' : 'var(--text-primary)' }}>Crear nuevo</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>Primera vez o instancia nueva</div>
                </button>
                <button onClick={browseOpen} style={{ flex: 1, padding: '20px 16px', border: `2px solid ${configMode === 'open' ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius)', background: configMode === 'open' ? 'var(--accent-light)' : 'transparent', cursor: 'pointer', transition: 'all .15s', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>
                  <div style={{ fontWeight: 700, marginBottom: 4, color: configMode === 'open' ? 'var(--accent)' : 'var(--text-primary)' }}>Abrir existente</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>Ya tienes un fichero (o en red)</div>
                </button>
              </div>
              {configPath && (
                <div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <input value={configPath} onChange={e => { setConfigPath(e.target.value); setTestResult(null); setConfigMode(''); }} style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                    <button className="btn-ghost" onClick={testPath} disabled={testing} style={{ flexShrink: 0, fontSize: 13 }}>
                      {testing ? <span className="spinner" style={{ width: 13, height: 13 }} /> : 'Verificar'}
                    </button>
                  </div>
                  {testResult && (
                    <div style={{ fontSize: 13, color: testResult.ok ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {testResult.ok ? <><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Acceso correcto</> : <><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> {testResult.error}</>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Contraseña maestra (opcional)</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>Si la configuras, las contraseñas se cifrarán con <strong>AES-256</strong>. Todos los usuarios del fichero compartido deben usar la misma contraseña maestra.</p>
              <div className="field">
                <label>Contraseña maestra</label>
                <div style={{ position: 'relative', display: 'flex' }}>
                  <input value={masterPassword} onChange={e => { setMasterPassword(e.target.value); setPwdError(''); }} type={showPwd ? 'text' : 'password'} placeholder="Dejar vacío para no cifrar" autoComplete="new-password" style={{ paddingRight: 42 }} />
                  <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: 0, top: 0, height: '100%', padding: '0 12px', background: 'transparent', color: 'var(--text-muted)' }}>{showPwd ? '🙈' : '👁'}</button>
                </div>
              </div>
              {masterPassword && (
                <div className="field">
                  <label>Confirmar contraseña</label>
                  <input value={confirmPwd} onChange={e => { setConfirmPwd(e.target.value); setPwdError(''); }} type={showPwd ? 'text' : 'password'} placeholder="Repite la contraseña" autoComplete="new-password" />
                  {pwdError && <div className="field-error">{pwdError}</div>}
                </div>
              )}
              {!masterPassword && <div style={{ background: '#f59e0b15', border: '1px solid #f59e0b30', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, color: 'var(--warning)', lineHeight: 1.6 }}>⚠ Sin contraseña maestra, las contraseñas se guardarán en texto plano.</div>}
            </div>
          )}

          {step === 3 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 72, height: 72, background: '#10b98120', border: '2px solid var(--success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: 'var(--success)' }}>
                <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>¡Todo listo!</h2>
              <div style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, marginBottom: 24, textAlign: 'left', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', padding: '16px 20px' }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                  <svg width="16" height="16" fill="none" stroke="var(--success)" strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 2 }}><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Fichero: <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>{configPath}</code></span>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <svg width="16" height="16" fill="none" stroke="var(--success)" strokeWidth="2.5" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 2 }}><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Cifrado: {masterPassword ? 'AES-256 activado ✓' : 'Sin cifrado'}</span>
                </div>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Puedes cambiar estos ajustes en cualquier momento desde Ajustes.</p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 36px 28px', borderTop: '1px solid var(--border)' }}>
          {step > 0 && step < 3 && <button className="btn-ghost" onClick={() => setStep(s => s - 1)}>Atrás</button>}
          {step < 3 && <button className="btn-primary" onClick={nextStep} disabled={step === 1 && !configPath}>Continuar</button>}
          {step === 3 && <button className="btn-primary" onClick={() => onComplete({ configPath, masterPassword, viewMode: 'grid' })} style={{ padding: '10px 28px' }}>Abrir Remote Manager</button>}
        </div>
      </div>
    </div>
  );
}
