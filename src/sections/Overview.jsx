import React from 'react'
import { useStore, useUser } from '../store.jsx'
import { Tile, Card, StatusDot, Pill, Sparkline } from '../components/ui.jsx'
import { staffing, stockSummary, receivables } from '../derive.js'
import { fmt, money, pct, ago } from '../utils.js'

export default function Overview({ goto }) {
  const { state } = useStore()
  const user = useUser()

  const targetTotal = state.lines.reduce((a, l) => a + l.targetTpd, 0)
  const produced = state.lines.reduce((a, l) => a + l.producedToday, 0)
  const running = state.lines.filter((l) => l.status === 'running')
  const extraction = running.length
    ? (running.reduce((a, l) => a + l.rateTph, 0) / running.reduce((a, l) => a + l.wheatInTph, 0)) * 100
    : null

  const stock = stockSummary(state)
  const staff = staffing(state)
  const short = staff.filter((g) => g.present < g.required)
  const totalPresent = staff.reduce((a, g) => a + g.present, 0)
  const totalRequired = staff.reduce((a, g) => a + g.required, 0)
  const recv = receivables(state)
  const overdue = recv.filter((r) => r.overdueDays > 0)
  const overdueSum = overdue.reduce((a, r) => a + r.balance, 0)
  const pendingParts = state.partRequests.filter((r) => r.status === 'pending')
  const urgentParts = pendingParts.filter((r) => r.urgency === 'urgent')

  const prodPct = (produced / targetTotal) * 100

  return (
    <div className="stack">
      <div className="grid cols-3">
        <Tile
          label="Production today — whole plant"
          value={fmt(produced, 0)} unit={`t of ${targetTotal} t target`}
          refText={<>On pace: <b>{pct(prodPct, 0)}</b> of daily target · {state.lines.length - running.length ? <span className="tile-crit">{state.lines.length - running.length} line stopped</span> : 'all lines running'}</>}
          tone={prodPct < 40 ? 'tile-warn' : 'tile-good'}
          progress={prodPct}
        />
        <Tile
          label="Live extraction (flour ÷ wheat)"
          value={extraction ? fmt(extraction, 1) : '—'} unit="%"
          refText={<>Target <b>74%</b> — {extraction == null ? 'no line running' : extraction >= 72 ? 'within range' : 'below range'}</>}
          tone={extraction == null ? '' : extraction >= 72 ? 'tile-good' : extraction >= 69 ? 'tile-warn' : 'tile-crit'}
          progress={extraction ? (extraction / 80) * 100 : 0} progressTick={(74 / 80) * 100}
        />
        <Tile
          label="Wheat in silos"
          value={fmt(stock.wheatStock, 0)} unit="t"
          refText={<>≈ <b>{stock.wheatDays ? fmt(stock.wheatDays, 1) : '—'} days</b> at current milling rate ({fmt(stock.wheatUseTph, 1)} t/h × 20 h)</>}
          tone={stock.wheatDays != null && stock.wheatDays < 5 ? 'tile-warn' : ''}
        />
      </div>

      <div className="grid cols-3">
        <Tile
          label="Staff on site"
          value={`${totalPresent}`} unit={`of ${totalRequired} required`}
          refText={short.length
            ? <span className="tile-crit">{short.map((s) => `${s.name} short ${s.required - s.present}`).join(' · ')}</span>
            : 'All lines and departments fully staffed'}
          tone={short.length ? 'tile-warn' : 'tile-good'}
          progress={(totalPresent / totalRequired) * 100}
        />
        <Tile
          label="Receivables outstanding"
          value={money(recv.reduce((a, r) => a + r.balance, 0))}
          refText={overdue.length
            ? <span className="tile-crit">{overdue.length} overdue invoice{overdue.length > 1 ? 's' : ''} · {money(overdueSum)} past due</span>
            : 'Nothing overdue'}
          tone={overdue.length ? 'tile-crit' : 'tile-good'}
        />
        <Tile
          label="Approvals waiting on you"
          value={`${pendingParts.length}`} unit="part requests"
          refText={urgentParts.length
            ? <span className="tile-crit">{urgentParts.length} marked URGENT — est. {money(pendingParts.reduce((a, r) => a + r.estCost, 0))} total</span>
            : pendingParts.length ? `Est. ${money(pendingParts.reduce((a, r) => a + r.estCost, 0))} total` : 'Queue is empty'}
          tone={urgentParts.length ? 'tile-crit' : pendingParts.length ? 'tile-warn' : 'tile-good'}
        />
      </div>

      <div className="grid cols-2">
        {state.lines.map((ln) => {
          const hist = (state.liveHistory[ln.id] || []).map((p) => ({ v: p.rate }))
          const ex = ln.wheatInTph ? (ln.rateTph / ln.wheatInTph) * 100 : 0
          return (
            <Card key={ln.id} title={<span><StatusDot status={ln.status} /> &nbsp;{ln.name} — {ln.product}</span>}
              right={<button className="btn sm" onClick={() => goto('production')}>Open</button>}>
              {ln.status === 'running' ? (
                <>
                  <div className="tile-value tile-good">{fmt(ln.rateTph, 1)}<span className="unit">t/h · extraction {fmt(ex, 1)}%</span></div>
                  <div className="tile-ref">Today <b>{fmt(ln.producedToday, 0)} t</b> of {ln.targetTpd} t target</div>
                  <div className="progress"><i style={{ width: `${Math.min(100, (ln.producedToday / ln.targetTpd) * 100)}%` }} /></div>
                  <div className="mt"><Sparkline points={hist} refValue={ln.nominalTph} unit=" t/h" label={`${ln.name} output rate trend`} /></div>
                </>
              ) : (
                <>
                  <div className="tile-value tile-crit">STOPPED</div>
                  <div className="tile-ref">Today <b>{fmt(ln.producedToday, 0)} t</b> of {ln.targetTpd} t target — output halted</div>
                  <div className="progress"><i className="crit" style={{ width: `${Math.min(100, (ln.producedToday / ln.targetTpd) * 100)}%` }} /></div>
                </>
              )}
            </Card>
          )
        })}
      </div>

      <div className="grid cols-2">
        <Card title="Produced vs sold vs in stock (flour)" right={<button className="btn sm" onClick={() => goto('orders')}>Orders</button>}>
          <div className="kv" style={{ gridTemplateColumns: '1fr auto' }}>
            <dt>Produced today</dt><dd>{fmt(stock.producedToday, 1)} t</dd>
            <dt>Flour in bins now</dt><dd>{fmt(stock.flourStock, 0)} t</dd>
            <dt>Bran in bin</dt><dd>{fmt(stock.branStock, 0)} t</dd>
            <dt>Committed to open orders</dt><dd>{fmt(stock.pendingT, 0)} t pending dispatch</dd>
          </div>
          {stock.pendingT > stock.flourStock + stock.branStock && (
            <div className="notice warn mt">⚠️ Open orders exceed current stock — production must cover the gap.</div>
          )}
        </Card>
        <Card title="Latest activity" right={<span className="muted small">alert history</span>}>
          <div className="log-list">
            {state.alerts.slice(0, 6).map((a) => (
              <div key={a.id} className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <Pill tone={a.severity === 'critical' ? 'red' : a.severity === 'warning' ? 'amber' : 'green'}>{a.severity}</Pill>{' '}
                  {a.text}
                </span>
                <span className="muted small" style={{ flex: '0 0 auto' }}>{ago(a.at)}{a.acked ? ' · ✓' : ''}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
