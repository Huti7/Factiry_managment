import React, { useState } from 'react'
import { useStore, useUser, can, PEOPLE } from '../store.jsx'
import { useLang } from '../i18n.jsx'
import { Card, StatusDot, Pill, Sparkline, Modal, Field, SectionHead, Empty } from '../components/ui.jsx'
import { CAUSES } from '../data/seed.js'
import { fmt, pct, timeHM, ago } from '../utils.js'

export default function Production({ goto }) {
  const { state, dispatch } = useStore()
  const user = useUser()
  const { t, L } = useLang()
  const [reasonFor, setReasonFor] = useState(null) // stopReport being explained

  const openReports = state.stopReports.filter((r) => r.status !== 'resolved')
  const machineName = (id) => L(state.machines.find((m) => m.id === id)?.name) || id
  const personName = (id) => L(PEOPLE.find((p) => p.id === id)?.name) || (id ?? '—')

  return (
    <div className="stack">
      <SectionHead title={t('nav.production')} sub={t('pr.sub')} />

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
                <h3 style={{ fontSize: 15 }}>{L(ln.name)}</h3>
                <div className="muted small">{t('pr.producing')} <b style={{ color: 'var(--ink)' }}>{t(`product.${ln.product}`)}</b></div>
              </div>
              <div style={{ marginInlineStart: 'auto' }}>
                {ln.status === 'running'
                  ? <Pill tone="green">{t('st.running')}</Pill>
                  : <Pill tone="red">{report ? t('pr.stoppedSince', { t: timeHM(report.stoppedAt) }) : t('st.stopped')}</Pill>}
              </div>
            </div>
            <div className="grid cols-4" style={{ padding: 16 }}>
              <div>
                <div className="muted small">{t('pr.outputRate')}</div>
                <div className={`tile-value ${ln.status === 'running' ? 'tile-good' : 'tile-crit'}`}>{fmt(ln.rateTph, 1)}<span className="unit">{t('pr.vsNominal', { n: fmt(ln.nominalTph, 1) })}</span></div>
                <Sparkline points={ratePts} refValue={ln.nominalTph} label="output rate trend" />
              </div>
              <div>
                <div className="muted small">{t('pr.extraction')}</div>
                <div className={`tile-value ${ex >= 72 ? 'tile-good' : ex >= 69 ? 'tile-warn' : 'tile-crit'}`}>{ln.status === 'running' ? pct(ex, 1) : '—'}<span className="unit">{t('pr.target74')}</span></div>
                <Sparkline points={exPts} refValue={74} min={60} max={82} label="extraction trend" />
              </div>
              <div>
                <div className="muted small">{t('pr.wheatFeed')}</div>
                <div className="tile-value">{fmt(ln.wheatInTph, 1)}<span className="unit">{t('pr.tphIn')}</span></div>
                <div className="tile-ref">{t('pr.wheatUsedToday')} <b>{fmt(ln.wheatToday, 0)} {t('u.t')}</b></div>
              </div>
              <div>
                <div className="muted small">{t('pr.todayVsTarget')}</div>
                <div className="tile-value">{fmt(ln.producedToday, 0)}<span className="unit">{t('pr.of', { t: fmt(ln.targetTpd, 0) })}</span></div>
                <div className="progress"><i className={ln.status === 'stopped' ? 'crit' : ''} style={{ width: `${Math.min(100, (ln.producedToday / ln.targetTpd) * 100)}%` }} /></div>
                <div className="tile-ref">{t('pr.ofDaily', { p: pct((ln.producedToday / ln.targetTpd) * 100, 0) })}</div>
              </div>
            </div>
          </Card>
        )
      })}

      <Card title={t('pr.stopLog')} right={<span className="muted small">{t('pr.chainHint')}</span>}>
        {state.stopReports.length === 0 && <Empty>{t('pr.noStops')}</Empty>}
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>{t('pr.machine')}</th><th>{t('pr.stopped')}</th><th>{t('common.status')}</th><th>{t('pr.reason')}</th><th>{t('pr.reportedBy')}</th><th>{t('pr.linkedPart')}</th><th></th></tr>
            </thead>
            <tbody>
              {state.stopReports.slice(0, 12).map((r) => (
                <tr key={r.id}>
                  <td><b>{machineName(r.machineId)}</b><div className="muted small">{L(state.lines.find((l) => l.id === r.lineId)?.name)}</div></td>
                  <td>{timeHM(r.stoppedAt)} <span className="muted small">· {ago(r.stoppedAt)}</span></td>
                  <td>
                    {r.status === 'awaiting-reason' && <Pill tone={r.escalated ? 'red' : 'amber'}>{r.escalated ? t('pr.unexplainedPill') : t('pr.reasonPending')}</Pill>}
                    {r.status === 'explained' && <Pill tone="amber">{t('pr.explainedDown')}</Pill>}
                    {r.status === 'resolved' && <Pill tone="green">{t('pr.resolved')}{r.resumedAt ? ` ${timeHM(r.resumedAt)}` : ''}</Pill>}
                  </td>
                  <td>{r.cause ? <><b>{t(`cause.${r.cause}`)}</b>{r.note && <div className="muted small">{L(r.note)}</div>}</> : <span className="muted">—</span>}</td>
                  <td>{personName(r.reportedBy)}</td>
                  <td>{r.partRequestId
                    ? <button className="btn sm" onClick={() => goto('parts', r.partRequestId)}>{r.partRequestId}</button>
                    : <span className="muted">{t('pr.none')}</span>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {r.status === 'awaiting-reason' && can(user, 'stop-reason') && (
                      <button className="btn sm primary" onClick={() => setReasonFor(r)}>{t('pr.submitReason')}</button>
                    )}
                    {r.status === 'explained' && can(user, 'stop-reason') && (
                      <button className="btn sm" onClick={() => dispatch({ type: 'RESUME_LINE', stopReportId: r.id, by: user.id })}>{t('pr.markRunning')}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!can(user, 'stop-reason') && openReports.some((r) => r.status === 'awaiting-reason') && (
          <div className="notice warn mt">{t('pr.awaitNote')}</div>
        )}
      </Card>

      {reasonFor && <StopReasonModal report={reasonFor} onClose={() => setReasonFor(null)} />}
    </div>
  )
}

function StopReasonModal({ report, onClose }) {
  const { state, dispatch } = useStore()
  const user = useUser()
  const { t, L } = useLang()
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
        urgency: 'urgent', estCost: estCost || 0,
        note: t('pr.stopLinkedNote', { t: timeHM(report.stoppedAt), note: note || t(`cause.${cause}`) }),
        by: user.id, stopReportId: report.id,
      })
    }
    onClose()
  }

  return (
    <Modal
      title={t('pr.whyStopped', { m: L(machine?.name) })}
      sub={t('pr.mandatory')}
      onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={!cause || (needsPart && !part)} onClick={submit}>{t('pr.submitReport')}</button>
      </>}
    >
      <Field label={t('pr.pickCause')}>
        <div className="row">
          {CAUSES.map((c) => (
            <button key={c} className={`btn sm ${cause === c ? 'primary' : ''}`} onClick={() => setCause(c)}>{t(`cause.${c}`)}</button>
          ))}
        </div>
      </Field>
      <Field label={t('pr.details')}>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('pr.detailsPh')} />
      </Field>
      <Field label=" ">
        <label className="row" style={{ fontWeight: 500 }}>
          <input type="checkbox" checked={needsPart} onChange={(e) => setNeedsPart(e.target.checked)} />
          {t('pr.needsPart')}
        </label>
      </Field>
      {needsPart && (
        <div className="form-row">
          <Field label={t('pr.partNeeded')}><input value={part} onChange={(e) => setPart(e.target.value)} placeholder={t('pr.partPh')} /></Field>
          <Field label={t('pr.roughCost')}><input type="number" value={estCost} onChange={(e) => setEstCost(e.target.value)} /></Field>
        </div>
      )}
    </Modal>
  )
}
