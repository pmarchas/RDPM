import { useState, useEffect } from 'react';
import { useT } from '../LanguageContext';

const api = window.rm;
const DEFAULT_PORTS = { RDP: 3389, VNC: 5900, SSH: 22 };
const INITIAL = {
  name: '', host: '', port: '', type: 'RDP',
  username: '', password: '', groupId: '', notes: '',
  mac: '', keyPath: '',
  jumpHost: { enabled: false, host: '', port: 22, username: '', keyPath: '' },
};

export default function ServerModal({ server, groups, onSave, onClose }) {
  const [form, setForm]       = useState(INITIAL);
  const [showPwd, setShowPwd] = useState(false);
  const [showAdv, setShowAdv] = useState(false);
  const [errors, setErrors]   = useState({});

  useEffect(() => {
    setForm(server ? { ...INITIAL, ...server, jumpHost: { ...INITIAL.jumpHost, ...(server.jumpHost || {}) } } : INITIAL);
    setErrors({});
    setShowPwd(false);
    setShowAdv(!!(server?.mac || server?.keyPath || server?.jumpHost?.enabled));
  }, [server]);

  function setJH(field, value) { setForm(f => ({ ...f, jumpHost: { ...f.jumpHost, [field]: value } })); }

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: undefined }));
  }

  function handleTypeChange(type) {
    const currentPort = form.port ? parseInt(form.port) : null;
    const isDefault = !currentPort || Object.values(DEFAULT_PORTS).includes(currentPort);
    setForm(f => ({ ...f, type, port: isDefault ? DEFAULT_PORTS[type] : f.port }));
  }

  const t = useT();

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = t('nameRequired');
    if (!form.host.trim()) errs.host = t('hostRequired');
    if (form.port && (isNaN(form.port) || form.port < 1 || form.port > 65535)) errs.port = t('invalidPort');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    const pwdChanged = form.password !== (server?.password || '');
    onSave({
      ...form,
      name:     form.name.trim(),
      host:     form.host.trim(),
      port:     form.port ? parseInt(form.port) : DEFAULT_PORTS[form.type],
      username: form.username.trim(),
      notes:    form.notes.trim(),
      updatedAt: new Date().toISOString(),
      passwordChangedAt: pwdChanged && form.password
        ? new Date().toISOString()
        : (server?.passwordChangedAt || null),
    });
  }

  const isEdit = !!server?.id;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? t('editServerTitle') : t('newServerTitle')}</h2>
          <button className="btn-icon" onClick={onClose}><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field">
              <label>{t('connectionType')}</label>
              <div className="type-selector">
                {['RDP', 'VNC', 'SSH'].map(t => (
                  <button key={t} type="button" className={`type-btn type-btn-${t.toLowerCase()} ${form.type === t ? 'active' : ''}`} onClick={() => handleTypeChange(t)}>{t}</button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>{t('name')} <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input autoFocus value={form.name} onChange={e => set('name', e.target.value)} placeholder={t('namePlaceholder')} />
              {errors.name && <div className="field-error">{errors.name}</div>}
            </div>

            <div className="field">
              <label>{t('hostIp')} <span style={{ color: 'var(--danger)' }}>*</span></label>
              <div className="field-row">
                <input value={form.host} onChange={e => set('host', e.target.value)} placeholder={t('hostPlaceholder')} />
                <input value={form.port} onChange={e => set('port', e.target.value)} placeholder={DEFAULT_PORTS[form.type]} type="number" min="1" max="65535" />
              </div>
              {(errors.host || errors.port) && <div className="field-error">{errors.host || errors.port}</div>}
              <div className="field-note">{t('defaultPortNote')} {form.type}: {DEFAULT_PORTS[form.type]}</div>
            </div>

            <div className="field">
              <label>{t('user')}</label>
              <input value={form.username} onChange={e => set('username', e.target.value)} placeholder={form.type === 'SSH' ? 'root' : 'Administrador'} autoComplete="off" />
            </div>

            <div className="field">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {t('password')}
                {form.password && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{t('encryptedNote')}</span>}
                {server?.passwordChangedAt && form.password && (() => {
                  const days = Math.floor((Date.now() - new Date(server.passwordChangedAt).getTime()) / 86_400_000);
                  return <span style={{ fontSize: 11, fontWeight: 600, color: days > 90 ? 'var(--danger)' : 'var(--text-muted)' }}>{t('changedDaysAgo')} {days}d</span>;
                })()}
              </label>
              <div style={{ position: 'relative', display: 'flex' }}>
                <input value={form.password} onChange={e => set('password', e.target.value)} type={showPwd ? 'text' : 'password'} placeholder={t('passwordOptional')} autoComplete="new-password" style={{ paddingRight: 42 }} />
                <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: 0, top: 0, height: '100%', padding: '0 12px', background: 'transparent', color: 'var(--text-muted)' }}>
                  {showPwd ? <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                </button>
              </div>
            </div>

            <div className="field">
              <label>{t('group')}</label>
              <select value={form.groupId} onChange={e => set('groupId', e.target.value)}>
                <option value="">{t('noGroupOption')}</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            <div className="field">
              <label>{t('notes')}</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder={t('notesPlaceholder')} rows={3} style={{ resize: 'vertical', minHeight: 72 }} />
            </div>

            {/* ── Avanzado ────────────────────────────────────────────────── */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
              <button type="button" onClick={() => setShowAdv(v => !v)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: 0 }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                  style={{ transform: showAdv ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
                {t('advancedOptions')}
              </button>
            </div>

            {showAdv && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>

                {/* MAC — Wake on LAN */}
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>{t('macAddress')} <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{t('wolNote')}</span></label>
                  <input value={form.mac || ''} onChange={e => set('mac', e.target.value)}
                    placeholder="AA:BB:CC:DD:EE:FF" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }} />
                </div>

                {/* SSH key */}
                {form.type === 'SSH' && (
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>{t('sshKey')} <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{t('sshKeyNote')}</span></label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input value={form.keyPath || ''} onChange={e => set('keyPath', e.target.value)}
                        placeholder="/home/user/.ssh/id_rsa" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }} />
                      <button type="button" className="btn-ghost" style={{ flexShrink: 0 }}
                        onClick={async () => { const p = await api.dialog.openKeyFile(); if (p) set('keyPath', p); }}>
                        {t('browse')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Jump host / Bastión */}
                {form.type === 'SSH' && (
                  <div style={{ background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', padding: 12, border: '1px solid var(--border)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: form.jumpHost?.enabled ? 12 : 0 }}>
                      <input type="checkbox" checked={!!form.jumpHost?.enabled} onChange={e => setJH('enabled', e.target.checked)}
                        style={{ width: 'auto', margin: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{t('jumpHost')}</span>
                    </label>
                    {form.jumpHost?.enabled && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div className="field-row" style={{ marginBottom: 0 }}>
                          <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                            <label style={{ fontSize: 12 }}>{t('bastionHost')}</label>
                            <input value={form.jumpHost?.host || ''} onChange={e => setJH('host', e.target.value)} placeholder="bastion.empresa.com" />
                          </div>
                          <div className="field" style={{ marginBottom: 0, width: 90, flexShrink: 0 }}>
                            <label style={{ fontSize: 12 }}>{t('port')}</label>
                            <input type="number" value={form.jumpHost?.port || 22} onChange={e => setJH('port', parseInt(e.target.value))} min="1" max="65535" />
                          </div>
                        </div>
                        <div className="field" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: 12 }}>{t('bastionUser')}</label>
                          <input value={form.jumpHost?.username || ''} onChange={e => setJH('username', e.target.value)} placeholder="usuario" />
                        </div>
                        <div className="field" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: 12 }}>{t('bastionKey')} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({t('optional')})</span></label>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input value={form.jumpHost?.keyPath || ''} onChange={e => setJH('keyPath', e.target.value)}
                              placeholder="/home/user/.ssh/bastion_key" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                            <button type="button" className="btn-ghost" style={{ flexShrink: 0 }}
                              onClick={async () => { const p = await api.dialog.openKeyFile(); if (p) setJH('keyPath', p); }}>
                              {t('browse')}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>{t('cancel')}</button>
            <button type="submit" className="btn-primary">{isEdit ? t('saveChanges') : t('addServerBtn')}</button>
          </div>
        </form>
      </div>

      <style>{`
        .type-selector { display: flex; gap: 8px; }
        .type-btn { flex: 1; padding: 10px; border-radius: var(--radius-sm); font-weight: 700; font-size: 13px; letter-spacing: .05em; border: 2px solid var(--border); background: var(--bg-base); color: var(--text-muted); transition: all .15s; }
        .type-btn:hover { border-color: var(--border-light); color: var(--text-primary); }
        .type-btn-rdp.active { border-color: var(--rdp); color: var(--rdp); background: #1d4ed818; }
        .type-btn-vnc.active { border-color: var(--vnc); color: var(--vnc); background: #4c1d9518; }
        .type-btn-ssh.active { border-color: var(--ssh); color: var(--ssh); background: #06503818; }
      `}</style>
    </div>
  );
}
