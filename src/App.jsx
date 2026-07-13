import React, { useEffect, useState } from 'react'
import { useStore, useUser, PEOPLE, NAV_BY_ROLE } from './store.jsx'
import { useLang } from './i18n.jsx'
import { AlertsStrip } from './components/AlertsStrip.jsx'
import { Login } from './components/Login.jsx'
import { loadSession, saveSession } from './auth.js'
import { initials } from './utils.js'
import Overview from './sections/Overview.jsx'
import Twin from './sections/Twin.jsx'
import Production from './sections/Production.jsx'
import Silos from './sections/Silos.jsx'
import Intake from './sections/Intake.jsx'
import Lab from './sections/Lab.jsx'
import Attendance from './sections/Attendance.jsx'
import Orders from './sections/Orders.jsx'
import Accounting from './sections/Accounting.jsx'
import Parts from './sections/Parts.jsx'
import Traceability from './sections/Traceability.jsx'
import Comms from './sections/Comms.jsx'
import Reports from './sections/Reports.jsx'
import Summary from './sections/Summary.jsx'

const SECTIONS = {
  overview: { ico: '▦', comp: Overview },
  twin: { ico: '⬢', comp: Twin },
  production: { ico: '⚙', comp: Production },
  silos: { ico: '⛁', comp: Silos },
  intake: { ico: '⚖', comp: Intake },
  lab: { ico: '⚗', comp: Lab },
  attendance: { ico: '☷', comp: Attendance },
  orders: { ico: '⇶', comp: Orders },
  accounting: { ico: '¤', comp: Accounting },
  parts: { ico: '✚', comp: Parts },
  traceability: { ico: '⛓', comp: Traceability },
  comms: { ico: '✉', comp: Comms },
  reports: { ico: '⬓', comp: Reports },
  summary: { ico: '≣', comp: Summary },
}

function Clock() {
  const { lang } = useLang()
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const d = new Date(now)
  const locale = lang === 'fa' ? 'fa-IR' : 'en-US'
  return (
    <span className="clock">
      {d.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })} ·{' '}
      {d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
    </span>
  )
}

export default function App() {
  const { state, dispatch } = useStore()
  const user = useUser()
  const { t, L, lang, setLang } = useLang()
  const [section, setSection] = useState('overview')
  const [focusRef, setFocusRef] = useState(null) // deep-link payload from alert clicks
  const [session, setSession] = useState(() => loadSession())
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('flourmill-theme') || 'light' } catch { return 'light' }
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('flourmill-theme', theme) } catch { /* private mode */ }
  }, [theme])

  // keep the acting user in sync with the signed-in session
  useEffect(() => {
    if (session && state.currentUserId !== session) dispatch({ type: 'SET_USER', userId: session })
  }, [session])

  const login = (personId) => {
    dispatch({ type: 'SET_USER', userId: personId })
    saveSession(personId)
    setSession(personId)
    setSection('overview')
  }
  const logout = () => {
    saveSession(null)
    setSession(null)
  }

  const nav = NAV_BY_ROLE[user.role] || []
  const active = nav.includes(section) ? section : 'overview'
  const Comp = SECTIONS[active].comp

  const pendingParts = state.partRequests.filter((r) => r.status === 'pending').length
  const awaitingReason = state.stopReports.filter((r) => r.status === 'awaiting-reason').length
  const unreadOrders = state.threads.reduce(
    (a, th) => a + th.messages.filter((m) => m.type === 'order' && m.status !== 'done' && m.from !== user.id && th.participants.includes(user.id)).length, 0)

  const goto = (sec, ref = null) => {
    if (!nav.includes(sec)) return
    setSection(sec)
    setFocusRef(ref ? { section: sec, refId: ref, t: Date.now() } : null)
  }

  if (!session) return <Login onLogin={login} theme={theme} setTheme={setTheme} />

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">🌾</div>
          <div>
            <div className="brand-name">{t('app.name')}</div>
            <div className="brand-sub">{t('app.sub')}</div>
          </div>
        </div>
        <nav className="nav">
          <div className="nav-label">{t('nav.group.plant')}</div>
          {nav.filter((k) => ['overview', 'twin', 'production', 'silos', 'intake', 'lab', 'traceability'].includes(k)).map((k) => (
            <NavItem key={k} k={k} active={active} onClick={goto}
              badge={k === 'production' && awaitingReason ? { n: awaitingReason, amber: true } : null} />
          ))}
          <div className="nav-label">{t('nav.group.people')}</div>
          {nav.filter((k) => ['attendance', 'orders', 'accounting', 'reports', 'summary'].includes(k)).map((k) => (
            <NavItem key={k} k={k} active={active} onClick={goto} />
          ))}
          <div className="nav-label">{t('nav.group.approvals')}</div>
          {nav.filter((k) => ['parts', 'comms'].includes(k)).map((k) => (
            <NavItem key={k} k={k} active={active} onClick={goto}
              badge={k === 'parts' && user.role === 'owner' && pendingParts ? { n: pendingParts }
                : k === 'comms' && unreadOrders ? { n: unreadOrders, amber: true } : null} />
          ))}
        </nav>
        <div style={{ padding: '12px', borderTop: '1px solid var(--line-soft)' }}>
          <div className="nav-label" style={{ padding: '0 0 6px' }}>{t('side.signedIn')}</div>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <span className="avatar">{initials(L(user.name))}</span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 650, fontSize: 13 }}>{L(user.name)}</div>
              <div className="muted small">{t(user.titleKey)}</div>
            </span>
            <button className="btn sm" onClick={logout} title={t('side.logout')}>⎋ {t('side.logout')}</button>
          </div>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <h1>{t(`nav.${active}`)}</h1>
          <span className="pill green"><span className="dot run pulse" /> {t('top.live')}</span>
          <span className="pill gray">{t('top.readonly')}</span>
          <div className="spacer" />
          <div className="seg" role="group" aria-label="Language">
            <button className={lang === 'fa' ? 'on' : ''} onClick={() => setLang('fa')}>فارسی</button>
            <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
          </div>
          <button className="btn sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')} aria-label="theme">
            {theme === 'dark' ? '☀' : '🌙'}
          </button>
          <DemoMenu dispatch={dispatch} t={t} />
          <Clock />
        </div>
        <AlertsStrip goto={goto} />
        <main className="content">
          <div className="content-inner">
            <Comp goto={goto} focusRef={focusRef} />
          </div>
        </main>
      </div>
    </div>
  )
}

function NavItem({ k, active, onClick, badge }) {
  const { t } = useLang()
  return (
    <button className={`nav-item ${active === k ? 'active' : ''}`} onClick={() => onClick(k)}>
      <span className="nav-ico">{SECTIONS[k].ico}</span>
      {t(`nav.${k}`)}
      {badge && <span className={`nav-badge ${badge.amber ? 'amber' : ''}`}>{badge.n}</span>}
    </button>
  )
}

function DemoMenu({ dispatch, t }) {
  const [open, setOpen] = useState(false)
  const fire = (name) => { dispatch({ type: 'DEMO_EVENT', name }); setOpen(false) }
  return (
    <span style={{ position: 'relative' }}>
      <button className="btn sm" onClick={() => setOpen(!open)}>{t('top.simulate')}</button>
      {open && (
        <div style={{
          position: 'absolute', insetInlineEnd: 0, top: '110%', zIndex: 50, background: 'var(--surface)',
          border: '1px solid var(--line)', borderRadius: 8, boxShadow: 'var(--shadow)', minWidth: 220, padding: 6,
        }}>
          <button className="nav-item" onClick={() => fire('line-stop')}>{t('sim.lineStop')}</button>
          <button className="nav-item" onClick={() => fire('silo-drain')}>{t('sim.siloDrain')}</button>
          <button className="nav-item" onClick={() => fire('yield-dip')}>{t('sim.yieldDip')}</button>
          <button className="nav-item" onClick={() => { dispatch({ type: 'RESET' }); setOpen(false) }}>{t('sim.reset')}</button>
        </div>
      )}
    </span>
  )
}
