import React, { useState } from 'react'
import { useStore, useUser, can, PEOPLE } from '../store.jsx'
import { useLang } from '../i18n.jsx'
import { Card, Modal, Field, SectionHead, Pill, Tile, Empty } from '../components/ui.jsx'
import { fmt, money, dateShort, ago } from '../utils.js'

const STATUS_TONE = { pending: 'amber', approved: 'green', rejected: 'red', purchased: 'solid' }

export default function Parts({ focusRef }) {
  const { state, dispatch } = useStore()
  const user = useUser()
  const { t, L } = useLang()
  const [adding, setAdding] = useState(false)
  const [asking, setAsking] = useState(null)
  const [filter, setFilter] = useState('all')

  const machineName = (id) => L(state.machines.find((m) => m.id === id)?.name) || id
  const who = (id) => L(PEOPLE.find((p) => p.id === id)?.name) || id

  const reqs = state.partRequests.filter((r) => filter === 'all' || r.status === filter)
  const pending = state.partRequests.filter((r) => r.status === 'pending')

  // per-machine cost history (approved + purchased spend)
  const byMachine = {}
  for (const r of state.partRequests) {
    if (r.status === 'rejected') continue
    const k = r.machineId
    byMachine[k] = byMachine[k] || { count: 0, cost: 0 }
    byMachine[k].count += 1
    byMachine[k].cost += r.estCost
  }

  return (
    <div className="stack">
      <SectionHead title={t('nav.parts')} sub={t('pt.sub')}>
        {can(user, 'create-part-request') && <button className="btn primary" onClick={() => setAdding(true)}>{t('pt.request')}</button>}
      </SectionHead>

      <div className="grid cols-3">
        <Tile label={t('pt.waiting')} value={fmt(pending.length, 0)} unit={t('pt.requests')}
          refText={pending.filter((r) => r.urgency === 'urgent').length
            ? <span className="tile-crit">{t('pt.urgentNote', { n: fmt(pending.filter((r) => r.urgency === 'urgent').length, 0) })}</span>
            : t('pt.noUrgent')}
          tone={pending.some((r) => r.urgency === 'urgent') ? 'tile-crit' : pending.length ? 'tile-warn' : 'tile-good'} />
        <Tile label={t('pt.pendingValue')} value={money(pending.reduce((a, r) => a + r.estCost, 0))} refText={t('pt.pendingSub')} />
        <Tile label={t('pt.approvedNot')} value={fmt(state.partRequests.filter((r) => r.status === 'approved').length, 0)} unit={t('pt.requests')}
          refText={t('pt.cleared')} tone="tile-good" />
      </div>

      <Card title={t('pt.reqTitle')} right={
        <div className="seg">
          {['all', 'pending', 'approved', 'purchased', 'rejected'].map((s) => (
            <button key={s} className={filter === s ? 'on' : ''} onClick={() => setFilter(s)}>{t(`ft.${s}`)}</button>
          ))}
        </div>
      }>
        {reqs.length === 0 && <Empty>{t('pt.noneView')}</Empty>}
        <div className="stack">
          {reqs.map((r) => (
            <div key={r.id} style={{
              border: '1px solid var(--line)', borderRadius: 8, padding: '12px 14px',
              background: focusRef?.refId === r.id ? 'var(--green-25)' : '#fff',
              borderInlineStart: r.urgency === 'urgent' && r.status === 'pending' ? '4px solid var(--crit)' : '4px solid var(--green-100)',
            }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div className="row">
                  <b>{r.id}</b>
                  <Pill tone={STATUS_TONE[r.status]}>{t(`st.${r.status}`)}</Pill>
                  {r.urgency === 'urgent' && <Pill tone="red">{t('pt.urgentPill')}</Pill>}
                  <Pill tone="gray">{t(`reason.${r.reason}`)}</Pill>
                </div>
                <span className="muted small">{who(r.by)} · {ago(r.at)}</span>
              </div>
              <div className="mt" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <div><div className="muted small">{t('pt.machine')}</div><b>{machineName(r.machineId)}</b></div>
                <div><div className="muted small">{t('pt.part')}</div><b>{L(r.part)}</b></div>
                <div><div className="muted small">{t('pt.cost')}</div><b>{money(r.estCost)}</b></div>
              </div>
              {r.note && <div className="muted small mt">«{L(r.note)}»</div>}
              <div className="log-list mt">
                {r.history.map((h, i) => (
                  <div key={i}>· {dateShort(h.at)} — <b>{t(`acn.${h.action}`)}</b> — {who(h.by)}{h.note ? ` — «${L(h.note)}»` : ''}</div>
                ))}
              </div>
              <div className="row mt">
                {user.role === 'owner' && r.status === 'pending' && (
                  <>
                    <button className="btn sm primary" onClick={() => dispatch({ type: 'PART_ACTION', id: r.id, action: 'approved', by: user.id })}>{t('pt.approve')}</button>
                    <button className="btn sm danger" onClick={() => dispatch({ type: 'PART_ACTION', id: r.id, action: 'rejected', by: user.id, note: t('pt.byOwner') })}>{t('pt.reject')}</button>
                    <button className="btn sm" onClick={() => setAsking(r)}>{t('pt.ask')}</button>
                  </>
                )}
                {user.role === 'owner' && r.status === 'approved' && (
                  <button className="btn sm primary" onClick={() => dispatch({ type: 'PART_ACTION', id: r.id, action: 'purchased', by: user.id })}>{t('pt.markPurchased')}</button>
                )}
                {r.status === 'pending' && user.role !== 'owner' && <span className="muted small">{t('pt.waitNote')}</span>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title={t('pt.history')} right={<span className="muted small">{t('pt.histSub')}</span>}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>{t('pt.machine')}</th><th className="num">{t('pt.count')}</th><th className="num">{t('pt.totalCost')}</th></tr></thead>
            <tbody>
              {Object.entries(byMachine).sort((a, b) => b[1].cost - a[1].cost).map(([mid, v]) => (
                <tr key={mid}>
                  <td><b>{machineName(mid)}</b></td>
                  <td className="num">{fmt(v.count, 0)}</td>
                  <td className="num"><b>{money(v.cost)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {adding && <RequestModal onClose={() => setAdding(false)} />}
      {asking && <AskModal req={asking} onClose={() => setAsking(null)} />}
    </div>
  )
}

function RequestModal({ onClose }) {
  const { state, dispatch } = useStore()
  const user = useUser()
  const { t, L } = useLang()
  const [f, setF] = useState({ machineId: state.machines[0].id, part: '', reason: 'worn', urgency: 'normal', estCost: '', note: '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const ok = f.part && Number(f.estCost) >= 0 && f.estCost !== ''
  return (
    <Modal title={t('pt.modalTitle')} sub={f.urgency === 'urgent' ? t('pt.urgentSub') : t('pt.normalSub')} onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={!ok} onClick={() => { dispatch({ type: 'ADD_PART_REQUEST', ...f, by: user.id }); onClose() }}>{t('pt.submit')}</button>
      </>}>
      <Field label={t('pt.machine')}>
        <select value={f.machineId} onChange={set('machineId')}>
          {state.machines.map((m) => <option key={m.id} value={m.id}>{L(m.name)}</option>)}
        </select>
      </Field>
      <Field label={t('pt.part')}><input value={f.part} onChange={set('part')} placeholder={t('pt.partPh')} /></Field>
      <div className="form-row">
        <Field label={t('pt.reasonLbl')}>
          <select value={f.reason} onChange={set('reason')}>
            <option value="worn">{t('reason.worn')}</option>
            <option value="broken">{t('reason.broken')}</option>
            <option value="preventive">{t('reason.preventive')}</option>
          </select>
        </Field>
        <Field label={t('pt.urgency')}>
          <select value={f.urgency} onChange={set('urgency')}>
            <option value="low">{t('urg.low')}</option>
            <option value="normal">{t('urg.normal')}</option>
            <option value="urgent">{t('urg.urgent')}</option>
          </select>
        </Field>
        <Field label={t('pr.roughCost')}><input type="number" value={f.estCost} onChange={set('estCost')} /></Field>
      </div>
      <Field label={t('pt.why')}><textarea rows={2} value={f.note} onChange={set('note')} /></Field>
    </Modal>
  )
}

function AskModal({ req, onClose }) {
  const { dispatch } = useStore()
  const user = useUser()
  const { t } = useLang()
  const [q, setQ] = useState('')
  return (
    <Modal title={t('pt.askTitle', { id: req.id })} sub={t('pt.askSub')} onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={!q} onClick={() => { dispatch({ type: 'PART_ACTION', id: req.id, action: 'question', note: q, by: user.id }); onClose() }}>{t('pt.sendQ')}</button>
      </>}>
      <Field label={t('pt.yourQ')}><textarea rows={3} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('pt.qPh')} /></Field>
    </Modal>
  )
}
