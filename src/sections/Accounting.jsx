import React, { useState } from 'react'
import { useStore, useUser, can, PEOPLE } from '../store.jsx'
import { useLang } from '../i18n.jsx'
import { Card, Modal, Field, SectionHead, Pill, Tile, Seg, Empty } from '../components/ui.jsx'
import { receivables } from '../derive.js'
import { fmt, money, dateShort, monthKey } from '../utils.js'

const KIND_TONE = { sale: 'green', payment: 'green', purchase: 'gray', expense: 'gray' }

export default function Accounting() {
  const { state } = useStore()
  const user = useUser()
  const { t, L } = useLang()
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

  const who = (id) => (id === 'import' || id?.startsWith?.('import:')) ? t('ac.importSource') : L(PEOPLE.find((p) => p.id === id)?.name) || id

  return (
    <div className="stack">
      <SectionHead title={t('nav.accounting')} sub={t('ac.sub')}>
        <Seg value={view} onChange={setView} options={[{ value: 'ledger', label: t('ac.ledger') }, { value: 'receivables', label: t('ac.recvTab', { n: fmt(recv.length, 0) }) }]} />
        {can(user, 'add-acct') && <button className="btn primary" onClick={() => setAdding(true)}>{t('ac.manual')}</button>}
      </SectionHead>

      <div className="grid cols-3">
        <Tile label={t('ac.income')} value={money(income)} refText={t('ac.incomeSub', { n: fmt(monthEntries.filter((e) => e.amount > 0).length, 0) })} tone="tile-good" />
        <Tile label={t('ac.spend')} value={money(-outgo)} refText={t('ac.spendSub')} />
        <Tile label={t('ac.net')} value={money(income + outgo)}
          refText={overdue.length ? <span className="tile-crit">{t('ac.stuck', { sum: money(overdue.reduce((a, r) => a + r.balance, 0)) })}</span> : t('ac.noOverdue')}
          tone={income + outgo >= 0 ? 'tile-good' : 'tile-crit'} />
      </div>

      {view === 'ledger' && (
        <Card title={t('ac.ledger')} right={<span className="muted small">{t('ac.ledgerSub')}</span>}>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>{t('ac.date')}</th><th>{t('ac.type')}</th><th>{t('ac.desc')}</th><th className="num">{t('ac.amount')}</th><th>{t('ac.source')}</th><th>{t('common.by')}</th><th></th></tr></thead>
              <tbody>
                {state.acctEntries.slice(0, 30).map((e) => (
                  <tr key={e.id}>
                    <td>{dateShort(e.at)}</td>
                    <td><Pill tone={KIND_TONE[e.kind]}>{t(`kind.${e.kind}`)}</Pill></td>
                    <td>{L(e.desc)}
                      {e.edits.length > 0 && (
                        <div className="muted small">{t('ac.editedBy', {
                          n: fmt(e.edits.length, 0),
                          by: who(e.edits[e.edits.length - 1].by),
                          from: money(e.edits[e.edits.length - 1].from),
                          to: money(e.edits[e.edits.length - 1].to),
                        })}</div>
                      )}
                    </td>
                    <td className="num" style={{ color: e.amount >= 0 ? 'var(--green-700)' : 'var(--ink)' }}><b>{e.amount >= 0 ? '+' : '−'}{money(Math.abs(e.amount))}</b></td>
                    <td>{e.source === 'imported' ? <Pill tone="gray">{t('ac.imported')}</Pill> : <Pill tone="green">{t('ac.manualTag')}</Pill>}</td>
                    <td className="muted">{who(e.by)}</td>
                    <td>{can(user, 'edit-acct') && <button className="btn sm" onClick={() => setEditing(e)}>{t('ac.edit')}</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {view === 'receivables' && (
        <Card title={t('ac.who')} right={<span className="muted small">{t('ac.sorted')}</span>}>
          {recv.length === 0 && <Empty>{t('ac.allSettled')}</Empty>}
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>{t('ac.invoice')}</th><th>{t('or.customer')}</th><th className="num">{t('ac.invoiced')}</th><th className="num">{t('ac.paid')}</th><th className="num">{t('ac.balance')}</th><th>{t('or.due')}</th><th>{t('common.status')}</th><th></th></tr></thead>
              <tbody>
                {recv.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.id}</b></td>
                    <td>{L(r.customer)}</td>
                    <td className="num">{money(r.amount)}</td>
                    <td className="num">{money(r.paid)}</td>
                    <td className="num"><b>{money(r.balance)}</b></td>
                    <td>{dateShort(r.dueTs)}</td>
                    <td>{r.overdueDays > 0
                      ? <Pill tone="red">{t('ac.overdueD', { n: fmt(r.overdueDays, 0) })}</Pill>
                      : <Pill tone="green">{t('st.current')}</Pill>}</td>
                    <td>{can(user, 'record-payment') && <button className="btn sm" onClick={() => setPaying(r)}>{t('ac.recordPay')}</button>}</td>
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
  const { t } = useLang()
  const [f, setF] = useState({ kind: 'expense', desc: '', amount: '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const signed = () => (f.kind === 'sale' || f.kind === 'payment' ? Math.abs(Number(f.amount)) : -Math.abs(Number(f.amount)))
  return (
    <Modal title={t('ac.entryTitle')} sub={t('ac.entrySub')} onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={!f.desc || !Number(f.amount)} onClick={() => {
          dispatch({ type: 'ADD_ACCT_ENTRY', kind: f.kind, desc: f.desc, amount: signed(), by: user.id })
          onClose()
        }}>{t('ac.saveEntry')}</button>
      </>}>
      <Field label={t('ac.type')}>
        <select value={f.kind} onChange={set('kind')}>
          <option value="sale">{t('ac.kindSale')}</option>
          <option value="payment">{t('ac.kindPay')}</option>
          <option value="purchase">{t('ac.kindPur')}</option>
          <option value="expense">{t('ac.kindExp')}</option>
        </select>
      </Field>
      <Field label={t('ac.desc')}><input value={f.desc} onChange={set('desc')} /></Field>
      <Field label={t('ac.amountUnit')}><input type="number" value={f.amount} onChange={set('amount')} /></Field>
    </Modal>
  )
}

function EditModal({ entry, onClose }) {
  const { dispatch } = useStore()
  const user = useUser()
  const { t, L } = useLang()
  const [amount, setAmount] = useState(entry.amount)
  const [note, setNote] = useState('')
  return (
    <Modal title={t('ac.editTitle', { d: L(entry.desc) })} sub={t('ac.editSub')} onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={!note || Number(amount) === entry.amount} onClick={() => {
          dispatch({ type: 'EDIT_ACCT_ENTRY', id: entry.id, amount, note, by: user.id })
          onClose()
        }}>{t('ac.saveEdit')}</button>
      </>}>
      <Field label={t('ac.amountWas', { v: money(entry.amount) })}><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      <Field label={t('ac.editReason')}><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    </Modal>
  )
}

function PayModal({ inv, onClose }) {
  const { dispatch } = useStore()
  const user = useUser()
  const { t, L } = useLang()
  const [amount, setAmount] = useState(inv.balance)
  return (
    <Modal title={t('ac.payTitle', { id: inv.id, c: L(inv.customer) })} sub={t('ac.balanceIs', { v: money(inv.balance) })} onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={!(Number(amount) > 0)} onClick={() => {
          dispatch({ type: 'RECORD_PAYMENT', invoiceId: inv.id, amount, by: user.id })
          onClose()
        }}>{t('ac.savePay')}</button>
      </>}>
      <Field label={t('ac.received')}><input type="number" max={inv.balance} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
    </Modal>
  )
}
