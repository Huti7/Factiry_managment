import React, { useState } from 'react'
import { useLang } from '../i18n.jsx'
import { ACCOUNTS, authenticate, personOf } from '../auth.js'
import { Field } from './ui.jsx'

export function Login({ onLogin, theme, setTheme }) {
  const { t, L, lang, setLang } = useLang()
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    const personId = authenticate(user, pass)
    if (personId) onLogin(personId)
    else setError(true)
  }

  return (
    <div className="login-veil">
      <div className="login-corner">
        <div className="seg" role="group" aria-label="Language">
          <button className={lang === 'fa' ? 'on' : ''} onClick={() => setLang('fa')}>فارسی</button>
          <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
        </div>
        <button className="btn sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')}>
          {theme === 'dark' ? '☀' : '🌙'}
        </button>
      </div>

      <form className="login-card" onSubmit={submit}>
        <div className="brand" style={{ border: 0, padding: 0, marginBottom: 6 }}>
          <div className="brand-mark" style={{ width: 44, height: 44, fontSize: 22 }}>🌾</div>
          <div>
            <div className="brand-name" style={{ fontSize: 17 }}>{t('app.name')}</div>
            <div className="brand-sub">{t('app.sub')}</div>
          </div>
        </div>
        <h2 style={{ fontSize: 16, margin: '10px 0 2px' }}>{t('login.title')}</h2>
        <div className="muted small" style={{ marginBottom: 14 }}>{t('login.sub')}</div>

        <Field label={t('login.user')}>
          <input value={user} onChange={(e) => { setUser(e.target.value); setError(false) }} autoFocus autoComplete="username" />
        </Field>
        <Field label={t('login.pass')}>
          <input type="password" value={pass} onChange={(e) => { setPass(e.target.value); setError(false) }} autoComplete="current-password" />
        </Field>
        {error && <div className="notice warn" style={{ marginBottom: 10 }}>{t('login.error')}</div>}
        <button className="btn primary" type="submit" style={{ width: '100%', justifyContent: 'center', padding: '9px 0', fontSize: 14 }}>
          {t('login.btn')}
        </button>

        <div className="login-demo">
          <div className="nav-label" style={{ padding: '0 0 6px' }}>{t('login.demo')}</div>
          <div className="row" style={{ gap: 6 }}>
            {ACCOUNTS.map((a) => {
              const p = personOf(a)
              return (
                <button key={a.user} type="button" className="btn sm"
                  onClick={() => { setUser(a.user); setPass('1234'); setError(false) }}>
                  {L(p.name)} <span className="muted">· {a.user}</span>
                </button>
              )
            })}
          </div>
        </div>
      </form>
    </div>
  )
}
