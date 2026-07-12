import React, { useEffect, useState } from 'react'
import { useStore, useUser, PEOPLE, NAV_BY_ROLE, can } from './store.jsx'
import { AlertsStrip } from './components/AlertsStrip.jsx'
import Overview from './sections/Overview.jsx'
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

const SECTIONS = {
  overview: { label: 'Overview', ico: '▦', comp: Overview },
  production: { label: 'Live Production', ico: '⚙', comp: Production },
  silos: { label: 'Silos / Stock', ico: '⛁', comp: Silos },
  intake: { label: 'Wheat Intake', ico: '⚖', comp: Intake },
  lab: { label: 'Lab Reports', ico: '⚗', comp: Lab },
  attendance: { label: 'Attendance', ico: '☷', comp: Attendance },
  orders: { label: 'Orders / Dispatch', ico: '⇶', comp: Orders },
  accounting: { label: 'Accounting', ico: '¤', comp: Accounting },
  parts: { label: 'Spare Parts', ico: '✚', comp: Parts },
  traceability: { label: 'Traceability', ico: '⛓', comp: Traceability },
  comms: { label: 'Communications', ico: '✉', comp: Comms },
  reports: { label: 'Monthly Reports', ico: '⬓', comp: Reports },
}

function Clock() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const d = new Date(now)
  return (
    <span className="clock">
      {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ·{' '}
      {d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
    </span>
  )
}

export default function App() {
  const { state, dispatch } = useStore()
  const user = useUser()
  const [section, setSection] = useState('overview')
  const [focusRef, setFocusRef] = useState(null) // deep-link payload from alert clicks

  const nav = NAV_BY_ROLE[user.role] || []
  const active = nav.includes(section) ? section : 'overview'
  const Comp = SECTIONS[active].comp

  const pendingParts = state.partRequests.filter((r) => r.status === 'pending').length
  const awaitingReason = state.stopReports.filter((r) => r.status === 'awaiting-reason').length
  const unreadOrders = state.threads.reduce(
    (a, t) => a + t.messages.filter((m) => m.type === 'order' && m.status !== 'done' && m.from !== user.id && t.participants.includes(user.id)).length, 0)

  const goto = (sec, ref = null) => {
    if (!nav.includes(sec)) return
    setSection(sec)
    setFocusRef(ref ? { section: sec, refId: ref, t: Date.now() } : null)
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">🌾</div>
          <div>
            <div className="brand-name">Al-Qamh Mills</div>
            <div className="brand-sub">Owner Command Center</div>
          </div>
        </div>
        <nav className="nav">
          <div className="nav-label">Plant</div>
          {nav.filter((k) => ['overview', 'production', 'silos', 'intake', 'lab', 'traceability'].includes(k)).map((k) => (
            <NavItem key={k} k={k} active={active} onClick={goto}
              badge={k === 'production' && awaitingReason ? { n: awaitingReason, amber: true } : null} />
          ))}
          <div className="nav-label">People & Money</div>
          {nav.filter((k) => ['attendance', 'orders', 'accounting', 'reports'].includes(k)).map((k) => (
            <NavItem key={k} k={k} active={active} onClick={goto} />
          ))}
          <div className="nav-label">Approvals & Comms</div>
          {nav.filter((k) => ['parts', 'comms'].includes(k)).map((k) => (
            <NavItem key={k} k={k} active={active} onClick={goto}
              badge={k === 'parts' && user.role === 'owner' && pendingParts ? { n: pendingParts }
                : k === 'comms' && unreadOrders ? { n: unreadOrders, amber: true } : null} />
          ))}
        </nav>
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--line-soft)' }}>
          <div className="nav-label" style={{ padding: '0 0 6px' }}>Viewing as</div>
          <select
            style={{ width: '100%', padding: '7px 8px', border: '1px solid var(--line)', borderRadius: 7, font: 'inherit' }}
            value={user.id}
            onChange={(e) => dispatch({ type: 'SET_USER', userId: e.target.value })}
          >
            {PEOPLE.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.title}</option>)}
          </select>
          <div className="muted small" style={{ marginTop: 8 }}>
            Role demo switch. Each role sees only its own sections and actions.
          </div>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <h1>{SECTIONS[active].label}</h1>
          <span className="pill green"><span className="dot run pulse" /> SCADA live</span>
          <span className="pill gray">Read-only mirror — control room keeps command</span>
          <div className="spacer" />
          <DemoMenu dispatch={dispatch} />
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
  return (
    <button className={`nav-item ${active === k ? 'active' : ''}`} onClick={() => onClick(k)}>
      <span className="nav-ico">{SECTIONS[k].ico}</span>
      {SECTIONS[k].label}
      {badge && <span className={`nav-badge ${badge.amber ? 'amber' : ''}`}>{badge.n}</span>}
    </button>
  )
}

function DemoMenu({ dispatch }) {
  const [open, setOpen] = useState(false)
  const fire = (name) => { dispatch({ type: 'DEMO_EVENT', name }); setOpen(false) }
  return (
    <span style={{ position: 'relative' }}>
      <button className="btn sm" onClick={() => setOpen(!open)}>⚡ Simulate</button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '110%', zIndex: 50, background: '#fff',
          border: '1px solid var(--line)', borderRadius: 8, boxShadow: 'var(--shadow)', minWidth: 210, padding: 6,
        }}>
          <button className="nav-item" onClick={() => fire('line-stop')}>Control-room line stop</button>
          <button className="nav-item" onClick={() => fire('silo-drain')}>Wheat silo runs low</button>
          <button className="nav-item" onClick={() => fire('yield-dip')}>Extraction yield dip</button>
          <button className="nav-item" onClick={() => { dispatch({ type: 'RESET' }); setOpen(false) }}>↺ Reset demo data</button>
        </div>
      )}
    </span>
  )
}
