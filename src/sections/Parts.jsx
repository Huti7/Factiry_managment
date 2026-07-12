import React, { useState } from 'react'
import { useStore, useUser, can, PEOPLE } from '../store.jsx'
import { Card, Modal, Field, SectionHead, Pill, Tile, Empty } from '../components/ui.jsx'
import { fmt, money, dateShort, ago } from '../utils.js'

const STATUS_TONE = { pending: 'amber', approved: 'green', rejected: 'red', purchased: 'solid' }
const URGENCY_TONE = { urgent: 'red', normal: 'gray', low: 'gray' }

export default function Parts({ focusRef }) {
  const { state, dispatch } = useStore()
  const user = useUser()
  const [adding, setAdding] = useState(false)
  const [asking, setAsking] = useState(null)
  const [filter, setFilter] = useState('all')

  const machineName = (id) => state.machines.find((m) => m.id === id)?.name || id
  const who = (id) => PEOPLE.find((p) => p.id === id)?.name || id

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
      <SectionHead
        title="Spare-Parts Requests"
        sub="Foreman requests → owner decides. Parts can only be bought after approval. Every request builds the machine's cost history."
      >
        {can(user, 'create-part-request') && <button className="btn primary" onClick={() => setAdding(true)}>+ Request a part</button>}
      </SectionHead>

      <div className="grid cols-3">
        <Tile label="Waiting for owner decision" value={`${pending.length}`} unit="requests"
          refText={pending.filter((r) => r.urgency === 'urgent').length
            ? <span className="tile-crit">{pending.filter((r) => r.urgency === 'urgent').length} URGENT — owner notified immediately</span>
            : 'no urgent requests pending'}
          tone={pending.some((r) => r.urgency === 'urgent') ? 'tile-crit' : pending.length ? 'tile-warn' : 'tile-good'} />
        <Tile label="Pending value" value={money(pending.reduce((a, r) => a + r.estCost, 0))} refText="estimated cost of undecided requests" />
        <Tile label="Approved, not yet bought" value={`${state.partRequests.filter((r) => r.status === 'approved').length}`} unit="requests"
          refText="cleared for purchase" tone="tile-good" />
      </div>

      <Card title="Requests" right={
        <div className="seg">
          {['all', 'pending', 'approved', 'purchased', 'rejected'].map((s) => (
            <button key={s} className={filter === s ? 'on' : ''} onClick={() => setFilter(s)}>{s}</button>
          ))}
        </div>
      }>
        {reqs.length === 0 && <Empty>No requests in this view.</Empty>}
        <div className="stack">
          {reqs.map((r) => (
            <div key={r.id} style={{
              border: '1px solid var(--line)', borderRadius: 8, padding: '12px 14px',
              background: focusRef?.refId === r.id ? 'var(--green-25)' : '#fff',
              borderLeft: r.urgency === 'urgent' && r.status === 'pending' ? '4px solid var(--crit)' : '4px solid var(--green-100)',
            }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div className="row">
                  <b>{r.id}</b>
                  <Pill tone={STATUS_TONE[r.status]}>{r.status.toUpperCase()}</Pill>
                  {r.urgency === 'urgent' && <Pill tone={URGENCY_TONE.urgent}>⚡ URGENT</Pill>}
                  <Pill tone="gray">{r.reason}</Pill>
                </div>
                <span className="muted small">{who(r.by)} · {ago(r.at)}</span>
              </div>
              <div className="mt" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <div><div className="muted small">Machine</div><b>{machineName(r.machineId)}</b></div>
                <div><div className="muted small">Part</div><b>{r.part}</b></div>
                <div><div className="muted small">Rough cost</div><b>{money(r.estCost)}</b></div>
              </div>
              {r.note && <div className="muted small mt">“{r.note}”</div>}
              <div className="log-list mt">
                {r.history.map((h, i) => (
                  <div key={i}>· {dateShort(h.at)} — <b>{h.action}</b> by {who(h.by)}{h.note ? ` — “${h.note}”` : ''}</div>
                ))}
              </div>
              <div className="row mt">
                {user.role === 'owner' && r.status === 'pending' && (
                  <>
                    <button className="btn sm primary" onClick={() => dispatch({ type: 'PART_ACTION', id: r.id, action: 'approved', by: user.id })}>✓ Approve</button>
                    <button className="btn sm danger" onClick={() => dispatch({ type: 'PART_ACTION', id: r.id, action: 'rejected', by: user.id, note: 'Rejected by owner' })}>✕ Reject</button>
                    <button className="btn sm" onClick={() => setAsking(r)}>? Ask a question</button>
                  </>
                )}
                {user.role === 'owner' && r.status === 'approved' && (
                  <button className="btn sm primary" onClick={() => dispatch({ type: 'PART_ACTION', id: r.id, action: 'purchased', by: user.id })}>Mark purchased</button>
                )}
                {r.status === 'pending' && user.role !== 'owner' && <span className="muted small">Waiting for the owner — purchase is blocked until approval.</span>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Per-machine parts cost history" right={<span className="muted small">approved + purchased requests</span>}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Machine</th><th className="num">Requests</th><th className="num">Total est. cost</th></tr></thead>
            <tbody>
              {Object.entries(byMachine).sort((a, b) => b[1].cost - a[1].cost).map(([mid, v]) => (
                <tr key={mid}>
                  <td><b>{machineName(mid)}</b></td>
                  <td className="num">{v.count}</td>
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
  const [f, setF] = useState({ machineId: state.machines[0].id, part: '', reason: 'worn', urgency: 'normal', estCost: '', note: '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const ok = f.part && Number(f.estCost) >= 0 && f.estCost !== ''
  return (
    <Modal title="Request a spare part" sub={f.urgency === 'urgent' ? '⚡ Urgent requests notify the owner immediately.' : 'Goes to the owner for approval before purchase.'} onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!ok} onClick={() => { dispatch({ type: 'ADD_PART_REQUEST', ...f, by: user.id }); onClose() }}>Submit request</button>
      </>}>
      <Field label="Machine">
        <select value={f.machineId} onChange={set('machineId')}>
          {state.machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </Field>
      <Field label="Part"><input value={f.part} onChange={set('part')} placeholder="e.g. Fluted roll set 250mm" /></Field>
      <div className="form-row">
        <Field label="Reason">
          <select value={f.reason} onChange={set('reason')}>
            <option value="worn">Worn</option>
            <option value="broken">Broken</option>
            <option value="preventive">Preventive</option>
          </select>
        </Field>
        <Field label="Urgency">
          <select value={f.urgency} onChange={set('urgency')}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="urgent">Urgent</option>
          </select>
        </Field>
        <Field label="Rough cost ($)"><input type="number" value={f.estCost} onChange={set('estCost')} /></Field>
      </div>
      <Field label="Why it is needed"><textarea rows={2} value={f.note} onChange={set('note')} /></Field>
    </Modal>
  )
}

function AskModal({ req, onClose }) {
  const { dispatch } = useStore()
  const user = useUser()
  const [q, setQ] = useState('')
  return (
    <Modal title={`Question about ${req.id}`} sub="Sent to the requesting foreman's direct thread and logged on the request." onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!q} onClick={() => { dispatch({ type: 'PART_ACTION', id: req.id, action: 'question', note: q, by: user.id }); onClose() }}>Send question</button>
      </>}>
      <Field label="Your question"><textarea rows={3} value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Can it wait for the maintenance window on Friday?" /></Field>
    </Modal>
  )
}
