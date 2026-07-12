import React, { useState } from 'react'
import { useStore, useUser, can, PEOPLE } from '../store.jsx'
import { Card, Modal, Field, SectionHead, Pill, Tile, Seg, Empty } from '../components/ui.jsx'
import { receivables } from '../derive.js'
import { fmt, money, dateShort, monthKey } from '../utils.js'

const KIND_TONE = { sale: 'green', payment: 'green', purchase: 'gray', expense: 'gray' }

export default function Accounting() {
  const { state, dispatch } = useStore()
  const user = useUser()
  const [view, setView] = useState('ledger')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [paying, setPaying] = useState(null)

  const month = monthKey(Date.now())
  const monthEntries = state.acctEntries.filter((e) => monthKey(e.at) === month)
  const income = monthEntries.filter((e) => e.amount > 0).reduce((a, e) => a + e.amount, 0)
  const outgo = monthEntries.filter((e) => e.amount < 0).reduce((a, e) => a + e.amount, 0)
  const recv = receivables(state)
  const overdue = recv.filter((r) => r.overdueDays > 0)

  const who = (id) => id?.startsWith('import:') ? id.replace('import:', '') : PEOPLE.find((p) => p.id === id)?.name || id

  return (
    <div className="stack">
      <SectionHead
        title="Accounting"
        sub="Hybrid ledger: imported records + manual entries. Every figure carries its source; every edit is logged."
      >
        <Seg value={view} onChange={setView} options={[{ value: 'ledger', label: 'Ledger' }, { value: 'receivables', label: `Receivables (${recv.length})` }]} />
        {can(user, 'add-acct') && <button className="btn primary" onClick={() => setAdding(true)}>+ Manual entry</button>}
      </SectionHead>

      <div className="grid cols-3">
        <Tile label="Income this month" value={money(income)} refText={<>{monthEntries.filter((e) => e.amount > 0).length} entries (sales + payments)</>} tone="tile-good" />
        <Tile label="Spending this month" value={money(-outgo)} refText={<>wheat purchases + running costs</>} />
        <Tile label="Net this month" value={money(income + outgo)}
          refText={overdue.length ? <span className="tile-crit">{money(overdue.reduce((a, r) => a + r.balance, 0))} stuck in overdue invoices</span> : 'no overdue receivables'}
          tone={income + outgo >= 0 ? 'tile-good' : 'tile-crit'} />
      </div>

      {view === 'ledger' && (
        <Card title="Ledger" right={<span className="muted small">source-tagged · edits logged</span>}>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Date</th><th>Type</th><th>Description</th><th className="num">Amount</th><th>Source</th><th>By</th><th></th></tr></thead>
              <tbody>
                {state.acctEntries.slice(0, 30).map((e) => (
                  <tr key={e.id}>
                    <td>{dateShort(e.at)}</td>
                    <td><Pill tone={KIND_TONE[e.kind]}>{e.kind}</Pill></td>
                    <td>{e.desc}
                      {e.edits.length > 0 && (
                        <div className="muted small">✎ edited {e.edits.length}×, last by {who(e.edits[e.edits.length - 1].by)}: {money(e.edits[e.edits.length - 1].from)} → {money(e.edits[e.edits.length - 1].to)}</div>
                      )}
                    </td>
                    <td className="num" style={{ color: e.amount >= 0 ? 'var(--green-700)' : 'var(--ink)' }}><b>{e.amount >= 0 ? '+' : '−'}{money(Math.abs(e.amount))}</b></td>
                    <td>{e.source === 'imported' ? <Pill tone="gray">imported</Pill> : <Pill tone="green">manual</Pill>}</td>
                    <td className="muted">{who(e.by)}</td>
                    <td>{can(user, 'edit-acct') && <button className="btn sm" onClick={() => setEditing(e)}>Edit</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {view === 'receivables' && (
        <Card title="Who owes money" right={<span className="muted small">sorted by most overdue</span>}>
          {recv.length === 0 && <Empty>All invoices settled.</Empty>}
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Invoice</th><th>Customer</th><th className="num">Invoiced</th><th className="num">Paid</th><th className="num">Balance</th><th>Due</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {recv.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.id}</b></td>
                    <td>{r.customer}</td>
                    <td className="num">{money(r.amount)}</td>
                    <td className="num">{money(r.paid)}</td>
                    <td className="num"><b>{money(r.balance)}</b></td>
                    <td>{dateShort(r.dueTs)}</td>
                    <td>{r.overdueDays > 0
                      ? <Pill tone="red">overdue {r.overdueDays} d</Pill>
                      : <Pill tone="green">current</Pill>}</td>
                    <td>{can(user, 'record-payment') && <button className="btn sm" onClick={() => setPaying(r)}>Record payment</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {adding && <EntryModal onClose={() => setAdding(false)} />}
      {editing && <EditModal entry={editing} onClose={() => setEditing(null)} />}
      {paying && <PayModal inv={paying} onClose={() => setPaying(null)} />}
    </div>
  )
}

function EntryModal({ onClose }) {
  const { dispatch } = useStore()
  const user = useUser()
  const [f, setF] = useState({ kind: 'expense', desc: '', amount: '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const signed = () => (f.kind === 'sale' || f.kind === 'payment' ? Math.abs(Number(f.amount)) : -Math.abs(Number(f.amount)))
  return (
    <Modal title="Manual ledger entry" sub="Saved with source = manual and your name." onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!f.desc || !Number(f.amount)} onClick={() => {
          dispatch({ type: 'ADD_ACCT_ENTRY', kind: f.kind, desc: f.desc, amount: signed(), by: user.id })
          onClose()
        }}>Save entry</button>
      </>}>
      <Field label="Type">
        <select value={f.kind} onChange={set('kind')}>
          <option value="sale">Sale (+)</option>
          <option value="payment">Payment received (+)</option>
          <option value="purchase">Purchase (−)</option>
          <option value="expense">Expense (−)</option>
        </select>
      </Field>
      <Field label="Description"><input value={f.desc} onChange={set('desc')} /></Field>
      <Field label="Amount ($)"><input type="number" value={f.amount} onChange={set('amount')} /></Field>
    </Modal>
  )
}

function EditModal({ entry, onClose }) {
  const { dispatch } = useStore()
  const user = useUser()
  const [amount, setAmount] = useState(entry.amount)
  const [note, setNote] = useState('')
  return (
    <Modal title={`Edit entry — ${entry.desc}`} sub="The previous value stays in the edit log with your name and reason." onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!note || Number(amount) === entry.amount} onClick={() => {
          dispatch({ type: 'EDIT_ACCT_ENTRY', id: entry.id, amount, note, by: user.id })
          onClose()
        }}>Save edit</button>
      </>}>
      <Field label={`Amount (was ${money(entry.amount)})`}><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      <Field label="Reason for edit (required)"><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    </Modal>
  )
}

function PayModal({ inv, onClose }) {
  const { dispatch } = useStore()
  const user = useUser()
  const [amount, setAmount] = useState(inv.balance)
  return (
    <Modal title={`Record payment — ${inv.id} ${inv.customer}`} sub={`Balance ${money(inv.balance)}`} onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!(Number(amount) > 0)} onClick={() => {
          dispatch({ type: 'RECORD_PAYMENT', invoiceId: inv.id, amount, by: user.id })
          onClose()
        }}>Save payment</button>
      </>}>
      <Field label="Amount received ($)"><input type="number" max={inv.balance} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
    </Modal>
  )
}
