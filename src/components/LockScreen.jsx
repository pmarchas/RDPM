import { useState, useRef, useEffect } from 'react';
import { verifyTOTP, totpSecondsLeft } from '../utils/totp';
import iconUrl from '../../assets/icon.png';

// ─── TOTP mode ────────────────────────────────────────────────────────────────
function TotpLock({ totpSecret, onUnlock }) {
  const [digits, setDigits]       = useState(['', '', '', '', '', '']);
  const [error, setError]         = useState('');
  const [checking, setChecking]   = useState(false);
  const [secondsLeft, setSeconds] = useState(totpSecondsLeft());
  const inputRefs = useRef([]);

  useEffect(() => {
    const t = setInterval(() => setSeconds(totpSecondsLeft()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  async function verify(code) {
    setChecking(true); setError('');
    const ok = await verifyTOTP(totpSecret, code);
    if (ok) { onUnlock(); }
    else {
      setError('Código incorrecto. Inténtalo de nuevo.');
      setDigits(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    }
    setChecking(false);
  }

  function handleChange(idx, val) {
    const v = val.replace(/\D/g, '').slice(-1);
    const next = [...digits]; next[idx] = v; setDigits(next); setError('');
    if (v && idx < 5) inputRefs.current[idx + 1]?.focus();
    if (next.every(d => d !== '')) verify(next.join(''));
  }

  function handleKeyDown(idx, e) {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) inputRefs.current[idx - 1]?.focus();
    if (e.key === 'Enter') { const c = digits.join(''); if (c.length === 6) verify(c); }
  }

  function handlePaste(e) {
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (p.length === 6) { setDigits(p.split('')); verify(p); }
  }

  const progress    = secondsLeft / 30;
  const urgentColor = secondsLeft <= 5 ? 'var(--danger)' : secondsLeft <= 10 ? 'var(--warning)' : 'var(--accent)';

  return (
    <>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6, marginBottom: 20 }}>
        Introduce el código de tu<br/>
        <strong style={{ color: 'var(--text-secondary)' }}>aplicación de autenticación</strong>
      </p>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }} onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input key={i} ref={el => inputRefs.current[i] = el}
            type="text" inputMode="numeric" maxLength={1} value={d}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            disabled={checking}
            style={{
              width: 44, height: 52, textAlign: 'center', fontSize: 22, fontWeight: 700,
              fontFamily: 'var(--font-mono)', borderRadius: 'var(--radius-sm)',
              background: d ? 'var(--accent-light)' : 'var(--bg-elevated)',
              border: `2px solid ${error ? 'var(--danger)' : d ? 'var(--accent)' : 'var(--border)'}`,
              color: d ? 'var(--accent)' : 'var(--text-primary)',
              outline: 'none', transition: 'all .15s', padding: 0,
            }}
          />
        ))}
      </div>

      {error && <ErrorMsg>{error}</ErrorMsg>}

      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Código válido por</span>
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: urgentColor }}>{secondsLeft}s</span>
        </div>
        <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 99, width: `${progress * 100}%`, background: urgentColor, transition: 'width 1s linear, background .3s' }} />
        </div>
      </div>

      {checking && <div style={{ textAlign: 'center', marginTop: 16 }}><span className="spinner" style={{ width: 20, height: 20 }} /></div>}
    </>
  );
}

// ─── Password mode ────────────────────────────────────────────────────────────
function PasswordLock({ masterPassword, onUnlock }) {
  const [pwd, setPwd]     = useState('');
  const [show, setShow]   = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function verify() {
    if (pwd === masterPassword) { onUnlock(); }
    else { setError('Contraseña incorrecta.'); setPwd(''); setTimeout(() => inputRef.current?.focus(), 50); }
  }

  return (
    <>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6, marginBottom: 20 }}>
        Introduce tu<br/>
        <strong style={{ color: 'var(--text-secondary)' }}>contraseña maestra</strong> para continuar
      </p>

      <div style={{ position: 'relative', marginBottom: 12 }}>
        <input
          ref={inputRef}
          type={show ? 'text' : 'password'}
          value={pwd}
          onChange={e => { setPwd(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && verify()}
          placeholder="Contraseña maestra…"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '12px 42px 12px 16px', fontSize: 15,
            border: `2px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)',
            color: 'var(--text-primary)', outline: 'none', transition: 'border .15s',
          }}
          autoComplete="current-password"
        />
        <button type="button" onClick={() => setShow(v => !v)}
          style={{ position: 'absolute', right: 0, top: 0, height: '100%', padding: '0 12px', background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>
          {show
            ? <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            : <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
        </button>
      </div>

      {error && <ErrorMsg>{error}</ErrorMsg>}

      <button className="btn-primary" onClick={verify} disabled={!pwd}
        style={{ width: '100%', padding: '11px', fontSize: 15, marginTop: 4 }}>
        Desbloquear
      </button>
    </>
  );
}

// ─── Shared error message ─────────────────────────────────────────────────────
function ErrorMsg({ children }) {
  return (
    <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      {children}
    </div>
  );
}

// ─── Lock screen shell ────────────────────────────────────────────────────────
export default function LockScreen({ totpSecret, masterPassword, onUnlock }) {
  const useTotp = !!totpSecret;

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', flexDirection: 'column',
    }}>
      {/* Subtle background pattern */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'radial-gradient(circle at 25% 25%, var(--accent)08 0%, transparent 50%), radial-gradient(circle at 75% 75%, var(--accent)06 0%, transparent 50%)', pointerEvents: 'none' }} />

      <div style={{
        position: 'relative', width: 380,
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
        padding: '36px 36px 32px',
      }}>
        {/* Icono de candado */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 14 }}>
            <img src={iconUrl} alt="RDPM"
              style={{ width: 64, height: 64, borderRadius: 16, display: 'block', boxShadow: '0 2px 12px #0004' }} />
            <div style={{
              position: 'absolute', bottom: -6, right: -6,
              width: 22, height: 22, borderRadius: '50%',
              background: 'var(--accent)', border: '2px solid var(--bg-surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="11" height="11" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>RDPM bloqueado</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {useTotp ? 'Verificación en dos pasos' : 'Verificación de contraseña'}
          </div>
        </div>

        {useTotp
          ? <TotpLock totpSecret={totpSecret} onUnlock={onUnlock} />
          : <PasswordLock masterPassword={masterPassword} onUnlock={onUnlock} />
        }
      </div>
    </div>
  );
}
