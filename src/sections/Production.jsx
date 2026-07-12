import React, { useState } from 'react'
import { useStore, useUser, can, PEOPLE } from '../store.jsx'
import { Card, Tile, StatusDot, Pill, Sparkline, Modal, Field, SectionHead, Empty } from '../components/ui.jsx'
import { CAUSES } from '../data/seed.js'
import { fmt, pct, timeHM, ago } from '../utils.js'

export default function Production({ goto }) {
  const { state, dispatch } = useStore()
  const user = useUser()
  const [reasonFor, setReasonFor] = useState(null) // stopReport being explained

  const openReports = state.stopReports.filter((r) => r.status !== 'resolved')
  const machineName = (id) => state.machines.find((m) => m.id === id)?.name || id
  const personName = (id) => PEOPLE.find((p) => p.id === id)?.name || (id ?? '—')

  return (
    <div className="stack">
      <SectionHead
        title="Live Production"
        sub="Sensor-fed from the control room. The app mirrors machine state — it never commands it."
      />

      {state.lines.map((ln) => {
        const hist = state.liveHistory[ln.id] || []
        const ratePts = hist.map((p) => ({ v: p.rate }))
        const exPts = hist.map((p) => ({ v: p.extraction }))
        const ex = ln.wheatInTph ? (ln.rateTph / ln.wheatInTph) * 100 : 0
        const report = openReports.find((r) => r.lineId === ln.id)
        return (
          <Card key={ln.id} pad0>
            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--line-soft)' }}>
              <StatusDot status={ln.status} />
              <div>
                <h3 style={{ fontSize: 15 }}>{ln.name}</h3>
                <div className="muted small">Producing: <b style={{ color: 'var(--ink)' }}>{ln.product}</b></div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                {ln.status === 'running'
                  ? <Pill tone="green">RUNNING</Pill>
                  : <Pill tone="red">STOPPED{report ? ` — since ${timeHM(report.stoppedAt)}` : ''}</Pill>}
              </div>
            </div>
            <div className="grid cols-4" style={{ padding: 16 }}>
              <div>
                <div className="muted small">Output rate</div>
                <div className={`tile-value ${ln.status === 'running' ? 'tile-good' : 'tile-crit'}`}>{fmt(ln.rateTph, 1)}<span className="unit">t/h vs {ln.nominalTph} nominal</span></div>
                <Sparkline points={ratePts} refValue={ln.nominalTph} label="output rate trend" />
              </div>
              <div>
                <div className="muted small">Extraction (flour ÷ wheat)</div>
                <div className={`tile-value ${ex >= 72 ? 'tile-good' : ex >= 69 ? 'tile-warn' : 'tile-crit'}`}>{ln.status === 'running' ? pct(ex, 1) : '—'}<span className="unit">target 74%</span></div>
                <Sparkline points={exPts} refValue={74} min={60} max={82} label="extraction trend" />
              </div>
              <div>
                <div className="muted small">Wheat feed</div>
                <div className="tile-value">{fmt(ln.wheatInTph, 1)}<span className="unit">t/h in</span></div>
                <div className="tile-ref">Wheat used today: <b>{fmt(ln.wheatToday, 0)} t</b></div>
              </div>
              <div>
                <div className="muted small">Today vs target</div>
                <div className="tile-value">{fmt(ln.producedToday, 0)}<span className="unit">of {ln.targetTpd} t</span></div>
                <div className="progress"><i className={ln.status === 'stopped' ? 'crit' : ''} style={{ width: `${Math.min(100, (ln.producedToday / ln.targetTpd) * 100)}%` }} /></div>
                <div className="tile-ref">{pct((ln.producedToday / ln.targetTpd) * 100, 0)} of daily target</div>
              </div>
            </div>
          </Card>
        )
      })}

      <Card title="Machine stop log — every stop needs a reason" right={<span className="muted small">stopped → why → part → approved → running</span>}>
        {state.stopReports.length === 0 && <Empty>No stops recorded.</Empty>}
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Machine</th><th>Stopped</th><th>Status</th><th>Reason</th><th>Reported by</th><th>Linked part request</th><th></th></tr>
            </thead>
            <tbody>
              {state.stopReports.slice(0, 12).map((r) => (
                <tr key={r.id}>
                  <td><b>{machineName(r.machineId)}</b><div className="muted small">{state.lines.find((l) => l.id === r.lineId)?.name}</div></td>
                  <td>{timeHM(r.stoppedAt)} <span className="muted small">· {ago(r.stoppedAt)}</span></td>
                  <td>
                    {r.status === 'awaiting-reason' && <Pill tone={r.escalated ? 'red' : 'amber'}>{r.escalated ? 'UNEXPLAINED' : 'reason pending'}</Pill>}
                    {r.status === 'explained' && <Pill tone="amber">explained — still down</Pill>}
                    {r.status === 'resolved' && <Pill tone="green">resolved{r.resumedAt ? ` ${timeHM(r.resumedAt)}` : ''}</Pill>}
                  </td>
                  <td>{r.cause ? <><b>{r.cause}</b>{r.note && <div className="muted small">{r.note}</div>}</> : <span className="muted">—</span>}</td>
                  <td>{personName(r.reportedBy)}</td>
                  <td>{r.partRequestId
                    ? <button className="btn sm" onClick={() => goto('parts', r.partRequestId)}>{r.partRequestId}</button>
                    : <span className="muted">none</span>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {r.status === 'awaiting-reason' && can(user, 'stop-reason') && (
                      <button className="btn sm primary" onClick={() => setReasonFor(r)}>Submit reason</button>
                    )}
                    {r.status === 'explained' && can(user, 'stop-reason') && (
                      <button className="btn sm" onClick={() => dispatch({ type: 'RESUME_LINE', stopReportId: r.id, by: user.id })}>Mark running again</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!can(user, 'stop-reason') && openReports.some((r) => r.status === 'awaiting-reason') && (
          <div className="notice warn mt">A stop is awaiting its reason report from the line foreman. It becomes an <b>unexplained stop</b> alert after 3 minutes.</div>
        )}
      </Card>

      {reasonFor && <StopReasonModal report={reasonFor} onClose={() => setReasonFor(null)} />}
    </div>
  )
}

function StopReasonModal({ report, onClose }) {
  const { state, dispatch } = useStore()
  const user = useUser()
  const [cause, setCause] = useState('')
  const [note, setNote] = useState('')
  const [needsPart, setNeedsPart] = useState(false)
  const [part, setPart] = useState('')
  const [estCost, setEstCost] = useState('')
  const machine = state.machines.find((m) => m.id === report.machineId)

  const submit = () => {
    if (!cause) return
    dispatch({ type: 'SUBMIT_STOP_REASON', id: report.id, cause, note, by: user.id })
    if (needsPart && part) {
      dispatch({
        type: 'ADD_PART_REQUEST', machineId: report.machineId, part, reason: 'broken',
        urgency: 'urgent', estCost: estCost || 0, note: `Linked to stop at ${timeHM(report.stoppedAt)}: ${note || cause}`,
        by: user.id, stopReportId: report.id,
      })
    }
    onClose()
  }

  return (
    <Modal
      title={`Why did ${machine?.name} stop?`}
      sub="Mandatory reason report — this goes straight to the owner's screen."
      onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!cause || (needsPart && !part)} onClick={submit}>Submit report</button>
      </>}
    >
      <Field label="Cause (pick one)">
        <div className="row">
          {CAUSES.map((c) => (
            <button key={c} className={`btn sm ${cause === c ? 'primary' : ''}`} onClick={() => setCause(c)}>{c}</button>
          ))}
        </div>
      </Field>
      <Field label="Details (optional)">
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened, what is needed to restart…" />
      </Field>
      <Field label=" ">
        <label className="row" style={{ fontWeight: 500 }}>
          <input type="checkbox" checked={needsPart} onChange={(e) => setNeedsPart(e.target.checked)} />
          A spare part is needed to fix this (creates an urgent part request linked to this stop)
        </label>
      </Field>
      {needsPart && (
        <div className="form-row">
          <Field label="Part needed"><input value={part} onChange={(e) => setPart(e.target.value)} placeholder="e.g. Drive belt SPB-2360" /></Field>
          <Field label="Rough cost ($)"><input type="number" value={estCost} onChange={(e) => setEstCost(e.target.value)} /></Field>
        </div>
      )}
    </Modal>
  )
}
