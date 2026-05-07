import { useState, useEffect } from 'react';
import { generateSecret, buildOTPAuthURI, verifyTOTP } from '../utils/totp';
import { useT } from '../LanguageContext';

const api = window.rm;

export default function SettingsModal({ settings, onSave, onClose }) {
  const t = useT();
  const [form, setForm] = useState({ configPath: '', homeConfigPath: '', masterPassword: '', viewMode: 'grid', totpSecret: '', lockTimeout: 0, lockOnSystemSleep: true, passwordWarningDays: 90, language: 'es', ...settings });
  const [testResult, setTestResult]         = useState(null);
  const [testing, setTesting]               = useState(false);
  const [homeTestResult, setHomeTestResult] = useState(null);
  const [homeTesting, setHomeTesting]       = useState(false);
  const [showPwd, setShowPwd]               = useState(false);
  const [settingsPath, setSettingsPath]     = useState('');
  const [defaultHomePath, setDefaultHomePath] = useState('');

  // 2FA setup state
  const [totpSetup, setTotpSetup] = useState(null); // { secret, qrDataUrl }
  const [totpConfirmCode, setTotpConfirmCode] = useState('');
  const [totpConfirmError, setTotpConfirmError] = useState('');
  const [totpConfirming, setTotpConfirming] = useState(false);

  useEffect(() => {
    api.app.settingsPath().then(setSettingsPath).catch(() => {});
    api.homeConfig.getDefaultPath().then(setDefaultHomePath).catch(() => {});
  }, []);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    if (field === 'configPath')     setTestResult(null);
    if (field === 'homeConfigPath') setHomeTestResult(null);
  }

  // ── Shared config dialogs ─────────────────────────────────────────────────
  async function browseOpen()   { const p = await api.dialog.openConfig();   if (p) { set('configPath', p); } }
  async function browseCreate() { const p = await api.dialog.saveConfig();   if (p) { set('configPath', p); setTestResult({ ok: true, exists: true }); } }

  // ── Home config dialogs ───────────────────────────────────────────────────
  async function browseOpenHome()   { const p = await api.dialog.openHomeConfig();   if (p) { set('homeConfigPath', p); } }
  async function browseCreateHome() { const p = await api.dialog.saveHomeConfig();   if (p) { set('homeConfigPath', p); setHomeTestResult({ ok: true, exists: true }); } }
  async function clearHomePath()    { set('homeConfigPath', ''); setHomeTestResult(null); }

  async function testHomePath() {
    const p = form.homeConfigPath || defaultHomePath;
    if (!p) return;
    setHomeTesting(true); setHomeTestResult(null);
    const result = await api.config.test(p);
    setHomeTestResult(result); setHomeTesting(false);
  }

  // ─── 2FA helpers ────────────────────────────────────────────────────────────
  async function startTotpSetup() {
    const secret = generateSecret();
    const uri = buildOTPAuthURI(secret, 'RDPM', 'RDPM');
    const qrDataUrl = await api.totp.generateQR(uri);
    setTotpSetup({ secret, qrDataUrl });
    setTotpConfirmCode('');
    setTotpConfirmError('');
  }

  async function confirmTotpSetup() {
    setTotpConfirming(true);
    setTotpConfirmError('');
    const ok = await verifyTOTP(totpSetup.secret, totpConfirmCode);
    if (ok) {
      set('totpSecret', totpSetup.secret);
      setTotpSetup(null);
      setTotpConfirmCode('');
    } else {
      setTotpConfirmError(t('wrongTotpCode'));
    }
    setTotpConfirming(false);
  }

  function disableTotp() {
    set('totpSecret', '');
    setTotpSetup(null);
  }

  async function testPath() {
    if (!form.configPath) return;
    setTesting(true); setTestResult(null);
    const result = await api.config.test(form.configPath);
    setTestResult(result); setTesting(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('settingsTitle')}</h2>
          <button className="btn-icon" onClick={onClose}><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

          <div className="settings-section">
            <div className="settings-section-title">
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              {t('sharedConfig')}
            </div>
            <p className="settings-desc">
              {t('sharedConfigDesc')}
            </p>
            <div className="field" style={{ marginBottom: 10 }}>
              <label>{t('filePath')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={form.configPath} onChange={e => set('configPath', e.target.value)} placeholder="C:\Compartido\remote-manager-config.json" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }} />
                <button className="btn-ghost" onClick={browseOpen} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>{t('openFile')}</button>
                <button className="btn-ghost" onClick={browseCreate} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>{t('createNew')}</button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="btn-ghost" onClick={testPath} disabled={!form.configPath || testing} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                {testing ? <span className="spinner" style={{ width: 13, height: 13 }} /> : <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
                {t('verifyAccess')}
              </button>
              {testResult && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: testResult.ok ? 'var(--success)' : 'var(--danger)' }}>
                  {testResult.ok
                    ? <><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>{testResult.exists ? t('fileFound') : t('dirAccessible')}</>
                    : <><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>{testResult.error}</>}
                </div>
              )}
            </div>
          </div>

          {/* ── Home config section ───────────────────────────────────────────── */}
          <div className="settings-section">
            <div className="settings-section-title">
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: '#f59e0b' }}>
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              {t('homeConfig')} <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', color: '#f59e0b', border: '1px solid #f59e0b40', borderRadius: 4, padding: '1px 5px', marginLeft: 4 }}>LOCAL</span>
            </div>
            <p className="settings-desc">
              {t('homeConfigDesc')}
              {defaultHomePath && !form.homeConfigPath && (
                <span style={{ display: 'block', marginTop: 6 }}>
                  {t('defaultPath')}: <code>{defaultHomePath}</code>
                </span>
              )}
            </p>
            <div className="field" style={{ marginBottom: 10 }}>
              <label>{t('homeFilePath')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={form.homeConfigPath}
                  onChange={e => set('homeConfigPath', e.target.value)}
                  placeholder={defaultHomePath || '~/.remote-manager/home.json'}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
                />
                <button className="btn-ghost" onClick={browseOpenHome}   style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>{t('openFile')}</button>
                <button className="btn-ghost" onClick={browseCreateHome} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>{t('createNew')}</button>
                {form.homeConfigPath && (
                  <button className="btn-ghost" onClick={clearHomePath} title={t('useDefault')} style={{ flexShrink: 0, color: 'var(--text-muted)' }}>✕</button>
                )}
              </div>
              {!form.homeConfigPath && defaultHomePath && (
                <div className="field-note">{t('defaultPath')}: <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{defaultHomePath}</code></div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="btn-ghost" onClick={testHomePath} disabled={homeTesting} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                {homeTesting ? <span className="spinner" style={{ width: 13, height: 13 }} /> : <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
                {t('verifyAccess')}
              </button>
              {homeTestResult && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: homeTestResult.ok ? 'var(--success)' : 'var(--danger)' }}>
                  {homeTestResult.ok
                    ? <><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>{homeTestResult.exists ? t('fileFound') : t('dirAccessible')}</>
                    : <><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>{homeTestResult.error}</>}
                </div>
              )}
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-section-title">
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              {t('security')}
            </div>
            <p className="settings-desc">{t('securityDesc')}</p>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>{t('masterPassword')}</label>
              <div style={{ position: 'relative', display: 'flex' }}>
                <input value={form.masterPassword} onChange={e => set('masterPassword', e.target.value)} type={showPwd ? 'text' : 'password'} placeholder={t('masterPwdPlaceholderSettings')} autoComplete="new-password" style={{ paddingRight: 42 }} />
                <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: 0, top: 0, height: '100%', padding: '0 12px', background: 'transparent', color: 'var(--text-muted)' }}>
                  {showPwd ? <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                </button>
              </div>
              {!form.masterPassword && <div className="field-note" style={{ color: 'var(--warning)' }}>{t('noMasterPwdWarning')}</div>}
            </div>
          </div>

          {/* ── 2FA Section ─────────────────────────────────────────────────── */}
          <div className="settings-section">
            <div className="settings-section-title">
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              {t('twoFA')}
            </div>
            <p className="settings-desc">
              {t('twoFADesc')}
            </p>

            {form.totpSecret && !totpSetup && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#10b98115', border: '1px solid #10b98130', borderRadius: 'var(--radius-sm)', marginBottom: 12 }}>
                  <svg width="16" height="16" fill="none" stroke="var(--success)" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                  <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>{t('twoFAActive')}</span>
                </div>
                <button className="btn-ghost" onClick={disableTotp} style={{ fontSize: 13, color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                  {t('disable2FA')}
                </button>
              </div>
            )}

            {!form.totpSecret && !totpSetup && (
              <button className="btn-ghost" onClick={startTotpSetup} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
                {t('setup2FA')}
              </button>
            )}

            {totpSetup && (
              <div style={{ marginTop: 4 }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
                  {t('scanQR')}
                </p>
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ background: 'white', borderRadius: 8, padding: 8, flexShrink: 0 }}>
                    <img src={totpSetup.qrDataUrl} alt="QR 2FA" style={{ width: 140, height: 140, display: 'block' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{t('manualKey')}</div>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg-elevated)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', display: 'block', wordBreak: 'break-all', color: 'var(--text-primary)', letterSpacing: '0.1em', marginBottom: 12 }}>
                      {totpSetup.secret.match(/.{1,4}/g)?.join(' ')}
                    </code>
                    <div className="field" style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 12 }}>{t('verificationCode')}</label>
                      <input
                        value={totpConfirmCode}
                        onChange={e => { setTotpConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setTotpConfirmError(''); }}
                        onKeyDown={e => e.key === 'Enter' && totpConfirmCode.length === 6 && confirmTotpSetup()}
                        placeholder="123456"
                        maxLength={6}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: 18, letterSpacing: '0.2em', textAlign: 'center', padding: '8px' }}
                      />
                      {totpConfirmError && <div className="field-error">{totpConfirmError}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-primary" onClick={confirmTotpSetup} disabled={totpConfirmCode.length !== 6 || totpConfirming} style={{ fontSize: 13, flex: 1 }}>
                        {totpConfirming ? <span className="spinner" style={{ width: 13, height: 13 }} /> : t('confirm')}
                      </button>
                      <button className="btn-ghost" onClick={() => setTotpSetup(null)} style={{ fontSize: 13 }}>{t('cancel')}</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Bloqueo automático ──────────────────────────────────────────── */}
          <div className="settings-section">
            <div className="settings-section-title">
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {t('autoLock')}
            </div>
            <p className="settings-desc">
              {t('autoLockDesc')}
            </p>

            {!(form.totpSecret || form.masterPassword) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f59e0b12', border: '1px solid #f59e0b30', borderRadius: 'var(--radius-sm)', marginBottom: 12, fontSize: 13, color: '#f59e0b' }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                {t('needAuthForLock')}
              </div>
            )}

            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 160 }}>
                <label>{t('lockAfter')}</label>
                <select
                  value={form.lockTimeout}
                  onChange={e => set('lockTimeout', Number(e.target.value))}
                  disabled={!(form.totpSecret || form.masterPassword)}
                >
                  <option value={0}>{t('disabled')}</option>
                  <option value={1}>{t('min1')}</option>
                  <option value={5}>{t('min5')}</option>
                  <option value={10}>{t('min10')}</option>
                  <option value={15}>{t('min15')}</option>
                  <option value={30}>{t('min30')}</option>
                  <option value={60}>{t('hour1')}</option>
                </select>
              </div>

              <div style={{ paddingTop: 22 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={!!form.lockOnSystemSleep}
                    onChange={e => set('lockOnSystemSleep', e.target.checked)}
                    disabled={!(form.totpSecret || form.masterPassword)}
                    style={{ width: 'auto', margin: 0, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {t('lockOnSleep')}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* ── Expiración de contraseñas ─────────────────────────────────── */}
          <div className="settings-section">
            <div className="settings-section-title">
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              {t('passwordExpiry')}
            </div>
            <p className="settings-desc">{t('passwordExpiryDesc')}</p>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>{t('warnAfter')}</label>
              <select value={form.passwordWarningDays} onChange={e => set('passwordWarningDays', Number(e.target.value))}>
                <option value={0}>{t('disabled')}</option>
                <option value={30}>{t('days30')}</option>
                <option value={60}>{t('days60')}</option>
                <option value={90}>{t('days90')}</option>
                <option value={180}>{t('days180')}</option>
                <option value={365}>{t('year1')}</option>
              </select>
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-section-title">
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              {t('interface')}
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>{t('defaultView')}</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[['grid', t('grid')], ['list', t('list')]].map(([val, label]) => (
                  <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: `2px solid ${form.viewMode === val ? 'var(--accent)' : 'var(--border)'}`, background: form.viewMode === val ? 'var(--accent-light)' : 'transparent', color: form.viewMode === val ? 'var(--accent)' : 'var(--text-secondary)', transition: 'all .15s', userSelect: 'none' }}>
                    <input type="radio" name="viewMode" value={val} checked={form.viewMode === val} onChange={() => set('viewMode', val)} style={{ display: 'none' }} />
                    {val === 'grid' ? <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> : <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/></svg>}
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>{t('language')}</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[['es', '🇪🇸 Español'], ['en', '🇬🇧 English']].map(([val, label]) => (
                  <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: `2px solid ${form.language === val ? 'var(--accent)' : 'var(--border)'}`, background: form.language === val ? 'var(--accent-light)' : 'transparent', color: form.language === val ? 'var(--accent)' : 'var(--text-secondary)', transition: 'all .15s', userSelect: 'none' }}>
                    <input type="radio" name="language" value={val} checked={form.language === val} onChange={() => set('language', val)} style={{ display: 'none' }} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {settingsPath && <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', marginTop: 4 }}>{t('machineSettings')} <code style={{ fontFamily: 'var(--font-mono)' }}>{settingsPath}</code></div>}
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>{t('cancel')}</button>
          <button className="btn-primary" onClick={() => onSave(form)} disabled={!form.configPath}>{t('saveSettings')}</button>
        </div>
      </div>

      <style>{`
        .settings-section { padding: 16px 0; border-bottom: 1px solid var(--border); }
        .settings-section:last-child { border-bottom: none; padding-bottom: 0; }
        .settings-section-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; text-transform: uppercase; letter-spacing: .04em; }
        .settings-desc { font-size: 13px; color: var(--text-muted); line-height: 1.6; margin-bottom: 12px; }
        .settings-desc code { font-family: var(--font-mono); background: var(--bg-elevated); padding: 1px 5px; border-radius: 3px; font-size: 12px; color: var(--text-secondary); }
      `}</style>
    </div>
  );
}
