import React, { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { Card, SectionHead, Tile, Seg } from '../components/ui.jsx'
import { attendanceMonth } from '../derive.js'
import { fmt, money, monthKey, downloadCSV, dayKey } from '../utils.js'

export default function Reports() {
  const { state } = useStore()
  const months = useMemo(() => {
    const s = new Set(state.productionDays.map((p) => p.date.slice(0, 7)))
    s.add(monthKey(Date.now()))
    return [...s].sort().reverse()
  }, [state.productionDays])
  const [month, setMonth] = useState(months[0])

  // production: stored daily history + live today
  const prodRows = state.productionDays.filter((p) => p.date.startsWith(month))
  const liveRows = dayKey(Date.now()).startsWith(month)
    ? state.lines.map((l) => ({ date: dayKey(Date.now()), lineId: l.id, tonnes: l.producedToday, wheatT: l.wheatToday, downtimeMin: 0, downtimeCause: '(today, live)' }))
    : []
  const allProd = [...prodRows, ...liveRows]
  const totalT = allProd.reduce((a, p) => a + p.tonnes, 0)
  const totalWheat = allProd.reduce((a, p) => a + p.wheatT, 0)
  const downtime = allProd.reduce((a, p) => a + p.downtimeMin, 0)

  // downtime by cause (history + stop reports this month)
  const byCause = {}
  allProd.forEach((p) => { if (p.downtimeMin && p.downtimeCause && !p.downtimeCause.startsWith('(')) byCause[p.downtimeCause] = (byCause[p.downtimeCause] || 0) + p.downtimeMin })
  state.stopReports.forEach((r) => {
    if (!monthKey(r.stoppedAt).startsWith(month) || !r.cause) return
    const mins = Math.round(((r.resumedAt || Date.now()) - r.stoppedAt) / 60000)
    byCause[r.cause] = (byCause[r.cause] || 0) + mins
  })

  const att = attendanceMonth(state, month)
  const acct = state.acctEntries.filter((e) => monthKey(e.at) === month)
  const income = acct.filter((e) => e.amount > 0).reduce((a, e) => a + e.amount, 0)
  const outgo = acct.filter((e) => e.amount < 0).reduce((a, e) => a + e.amount, 0)

  const lineName = (id) => state.lines.find((l) => l.id === id)?.name || id
  const maxCause = Math.max(1, ...Object.values(byCause))

  const exports = [
    {
      label: 'Production (daily)', file: `production-${month}.csv`,
      headers: ['Date', 'Line', 'Flour t', 'Wheat t', 'Extraction %', 'Downtime min', 'Downtime cause'],
      rows: allProd.map((p) => [p.date, lineName(p.lineId), fmt(p.tonnes, 1), fmt(p.wheatT, 1), p.wheatT ? fmt((p.tonnes / p.wheatT) * 100, 1) : '', p.downtimeMin, p.downtimeCause]),
    },
    {
      label: 'Attendance rollup', file: `attendance-${month}.csv`,
      headers: ['Worker', 'Department', 'Days worked', 'Absences', 'Times late', 'Late minutes', 'Hours'],
      rows: att.map((r) => [r.worker.name, r.worker.dept, r.present + r.late, r.absent, r.late, r.lateMin, fmt(r.hours, 0)]),
    },
    {
      label: 'Accounting ledger', file: `accounting-${month}.csv`,
      headers: ['Date', 'Type', 'Description', 'Amount', 'Source', 'Edits'],
      rows: acct.map((e) => [dayKey(e.at), e.kind, e.desc, e.amount, e.source, e.edits.length]),
    },
    {
      label: 'Downtime by cause', file: `downtime-${month}.csv`,
      headers: ['Cause', 'Minutes'],
      rows: Object.entries(byCause).map(([c, m]) => [c, m]),
    },
  ]

  return (
    <div className="stack">
      <SectionHead
        title="Monthly Reports"
        sub="Sensors give “now” — this database history gives “this month”. Every table exports to CSV."
      >
        <Seg value={month} onChange={setMonth} options={months.slice(0, 3).map((m) => ({ value: m, label: m }))} />
      </SectionHead>

      <div className="grid cols-4">
        <Tile label="Flour produced" value={fmt(totalT, 0)} unit="t" refText={<>from <b>{fmt(totalWheat, 0)} t</b> wheat · avg extraction {totalWheat ? fmt((totalT / totalWheat) * 100, 1) : '—'}%</>} tone="tile-good" />
        <Tile label="Downtime" value={fmt(Object.values(byCause).reduce((a, b) => a + b, 0), 0)} unit="min"
          refText={Object.keys(byCause).length ? `worst cause: ${Object.entries(byCause).sort((a, b) => b[1] - a[1])[0][0]}` : 'no downtime recorded'}
          tone={downtime > 300 ? 'tile-warn' : ''} />
        <Tile label="Income" value={money(income)} refText={`${acct.filter((e) => e.amount > 0).length} entries`} tone="tile-good" />
        <Tile label="Net result" value={money(income + outgo)} refText={<>spending {money(-outgo)}</>} tone={income + outgo >= 0 ? 'tile-good' : 'tile-crit'} />
      </div>

      <Card title="Downtime by cause" right={<span className="muted small">minutes this month</span>}>
        {Object.keys(byCause).length === 0 && <div className="muted small">No downtime recorded this month.</div>}
        <div className="stack" style={{ gap: 8 }}>
          {Object.entries(byCause).sort((a, b) => b[1] - a[1]).map(([cause, mins]) => (
            <div key={cause} className="row" style={{ flexWrap: 'nowrap' }}>
              <span style={{ flex: '0 0 130px' }} className="small"><b>{cause}</b></span>
              <div className="progress" style={{ flex: 1, marginTop: 0 }}>
                <i className={cause === 'Breakdown' ? 'crit' : ''} style={{ width: `${(mins / maxCause) * 100}%` }} />
              </div>
              <span className="small num" style={{ flex: '0 0 70px', textAlign: 'right' }}>{fmt(mins, 0)} min</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Exports" right={<span className="muted small">CSV, opens in Excel</span>}>
        <div className="row">
          {exports.map((ex) => (
            <button key={ex.file} className="btn" onClick={() => downloadCSV(ex.file, ex.headers, ex.rows)}>
              ⬇ {ex.label} <span className="muted small">({ex.rows.length} rows)</span>
            </button>
          ))}
        </div>
      </Card>

      <Card title={`Production by day — ${month}`}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Date</th><th>Line</th><th className="num">Flour (t)</th><th className="num">Wheat (t)</th><th className="num">Extraction</th><th className="num">Downtime</th><th>Cause</th></tr></thead>
            <tbody>
              {[...allProd].reverse().slice(0, 40).map((p, i) => (
                <tr key={i}>
                  <td>{p.date}</td>
                  <td>{lineName(p.lineId)}</td>
                  <td className="num">{fmt(p.tonnes, 1)}</td>
                  <td className="num">{fmt(p.wheatT, 1)}</td>
                  <td className="num">{p.wheatT ? `${fmt((p.tonnes / p.wheatT) * 100, 1)}%` : '—'}</td>
                  <td className="num">{p.downtimeMin ? `${p.downtimeMin} min` : '—'}</td>
                  <td className="muted">{p.downtimeCause || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
