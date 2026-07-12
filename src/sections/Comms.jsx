import React, { useEffect, useRef, useState } from 'react'
import { useStore, useUser, can, PEOPLE } from '../store.jsx'
import { Card, Modal, Field, SectionHead, Pill, Empty } from '../components/ui.jsx'
import { canTalk } from '../derive.js'
import { timeHM, dateShort, initials, ago } from '../utils.js'

export default function Comms({ focusRef }) {
  const { state, dispatch } = useStore()
  const user = useUser()

  const myThreads = state.threads.filter((t) => t.participants.includes(user.id))
  const [sel, setSel] = useState(myThreads[0]?.id || null)
  const [flagging, setFlagging] = useState(false)
  const [linking, setLinking] = useState(false)

  useEffect(() => {
    if (focusRef?.refId && state.threads.some((t) => t.id === focusRef.refId)) setSel(focusRef.refId)
  }, [focusRef])

  const thread = myThreads.find((t) => t.id === sel) || myThreads[0]
  const other = (t) => PEOPLE.find((p) => p.id === t.participants.find((x) => x !== user.id))

  return (
    <div className="stack">
      <SectionHead
        title="Communications"
        sub={user.role === 'owner'
          ? 'Hub-and-spoke: every line runs through you. Staff cannot message each other unless you grant a link.'
          : 'Direct line to the owner. You can message another colleague only where the owner has granted a link.'}
      >
        {can(user, 'raise-flag') && <button className="btn danger" onClick={() => setFlagging(true)}>⚑ Raise flag to owner</button>}
        {can(user, 'grant-links') && <button className="btn" onClick={() => setLinking(true)}>+ Grant a link</button>}
      </SectionHead>

      <div className="comms">
        <Card pad0 className="thread-list">
          <div style={{ padding: 8 }}>
            <div className="nav-label" style={{ padding: '4px 8px' }}>Direct lines</div>
            {myThreads.map((t) => {
              const p = other(t)
              const last = t.messages[t.messages.length - 1]
              const waiting = t.messages.filter((m) => m.type === 'order' && m.status !== 'done' && m.from !== user.id).length
              return (
                <button key={t.id} className={`item ${thread?.id === t.id ? 'on' : ''}`} onClick={() => setSel(t.id)}>
                  <span className="avatar">{p ? initials(p.name) : '?'}</span>
                  <span style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{p?.name || 'Unknown'}</div>
                    <div className="muted small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
                      {last ? last.text : p?.title}
                    </div>
                  </span>
                  {waiting > 0 && <span className="nav-badge amber">{waiting}</span>}
                </button>
              )
            })}
          </div>
        </Card>

        <Card pad0>
          {thread ? <ChatPane thread={thread} other={other(thread)} /> : <Empty>No conversations.</Empty>}
        </Card>
      </div>

      {user.role === 'owner' && <LinksCard onGrant={() => setLinking(true)} />}

      {flagging && <FlagModal onClose={() => setFlagging(false)} />}
      {linking && <LinkModal onClose={() => setLinking(false)} />}
    </div>
  )
}

function ChatPane({ thread, other }) {
  const { dispatch } = useStore()
  const user = useUser()
  const [text, setText] = useState('')
  const [msgType, setMsgType] = useState('message')
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight)
  }, [thread.id, thread.messages.length])

  const send = () => {
    if (!text.trim()) return
    dispatch({ type: 'SEND_MESSAGE', threadId: thread.id, from: user.id, text: text.trim(), msgType })
    setText('')
    setMsgType('message')
  }

  const name = (id) => PEOPLE.find((p) => p.id === id)?.name || id

  return (
    <div className="chat-pane" style={{ padding: '12px 14px' }}>
      <div className="row" style={{ paddingBottom: 8, borderBottom: '1px solid var(--line-soft)' }}>
        <span className="avatar">{other ? initials(other.name) : '?'}</span>
        <div>
          <b>{other?.name}</b>
          <div className="muted small">{other?.title}</div>
        </div>
      </div>
      <div className="chat-scroll" ref={scrollRef}>
        {thread.messages.length === 0 && <div className="msg sys">No messages yet — this line is always open.</div>}
        {thread.messages.map((m) => {
          const mine = m.from === user.id
          const cls = m.type === 'order' ? 'order-msg' : m.type === 'flag' ? 'flag-msg' : ''
          return (
            <div key={m.id} className={`msg ${mine ? 'mine' : 'theirs'} ${cls}`}>
              {m.type === 'order' && <div className="order-tag">⚑ OWNER'S ORDER — requires acknowledgement</div>}
              {m.type === 'flag' && <div className="flag-tag">⚑ FLAG RAISED</div>}
              <div>{m.text}</div>
              <div className="meta">
                {name(m.from)} · {dateShort(m.at)} {timeHM(m.at)}
                {m.type === 'order' && (
                  <> · {m.status === 'sent' && '✈ sent — not yet seen'}
                    {m.status === 'acknowledged' && `👁 acknowledged ${timeHM(m.ackedAt)}`}
                    {m.status === 'done' && `✅ done ${timeHM(m.doneAt)}`}</>
                )}
              </div>
              {m.type === 'order' && !mine && m.status !== 'done' && (
                <div className="row" style={{ marginTop: 6 }}>
                  {m.status === 'sent' && (
                    <button className="btn sm" onClick={() => dispatch({ type: 'ORDER_MSG_STATUS', threadId: thread.id, msgId: m.id, status: 'acknowledged' })}>
                      👁 Acknowledge receipt
                    </button>
                  )}
                  {m.status === 'acknowledged' && (
                    <button className="btn sm primary" onClick={() => dispatch({ type: 'ORDER_MSG_STATUS', threadId: thread.id, msgId: m.id, status: 'done' })}>
                      ✅ Mark done
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="chat-compose">
        {user.role === 'owner' && (
          <select value={msgType} onChange={(e) => setMsgType(e.target.value)} title="Message or directed order">
            <option value="message">Message</option>
            <option value="order">⚑ Order</option>
          </select>
        )}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={msgType === 'order' ? 'Give an instruction — receiver must acknowledge, then mark done…' : 'Type a message…'}
        />
        <button className="btn primary" onClick={send}>Send</button>
      </div>
    </div>
  )
}

function LinksCard({ onGrant }) {
  const { state, dispatch } = useStore()
  const name = (id) => PEOPLE.find((p) => p.id === id)?.name || id
  const now = Date.now()
  return (
    <Card title="Spoke-to-spoke links you have granted" right={<span className="muted small">staff can only talk to each other through these</span>}>
      {state.links.length === 0 && <Empty>No links — all communication runs through you.</Empty>}
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Between</th><th>Scope</th><th>Purpose</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {state.links.map((l) => (
              <tr key={l.id}>
                <td><b>{name(l.a)}</b> ↔ <b>{name(l.b)}</b></td>
                <td>{l.scope === 'permanent' ? <Pill tone="green">permanent</Pill> : <Pill tone="amber">temporary</Pill>}
                  {l.preapproved && <Pill tone="solid">pre-approved safety pair</Pill>}</td>
                <td className="muted">{l.task || '—'}</td>
                <td>{l.expiresAt
                  ? l.expiresAt > now ? <span className="small">expires {ago(l.expiresAt).replace(' ago', '')} from now</span> : <Pill tone="red">expired</Pill>
                  : <span className="muted small">no expiry</span>}</td>
                <td>{!l.preapproved && <button className="btn sm danger" onClick={() => dispatch({ type: 'REVOKE_LINK', id: l.id })}>Revoke</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function FlagModal({ onClose }) {
  const { dispatch } = useStore()
  const user = useUser()
  const [text, setText] = useState('')
  return (
    <Modal title="Raise a flag to the owner" sub="Lands in the owner's alerts feed and opens your direct thread. Use for bad batches, stopped machines, anything urgent." onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!text.trim()} onClick={() => { dispatch({ type: 'RAISE_FLAG', from: user.id, text: text.trim() }); onClose() }}>⚑ Raise flag</button>
      </>}>
      <Field label="What's wrong?"><textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Batch FL-0131 smells off — holding it in the bin" /></Field>
    </Modal>
  )
}

function LinkModal({ onClose }) {
  const { dispatch } = useStore()
  const spokes = PEOPLE.filter((p) => p.id !== 'p-owner')
  const [f, setF] = useState({ a: spokes[0].id, b: spokes[1].id, scope: 'temporary', task: '', hours: 24 })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const ok = f.a !== f.b && f.task
  return (
    <Modal title="Grant a communication link" sub="Lets two staff members message each other directly — permanently, or only for a task." onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!ok} onClick={() => {
          dispatch({ type: 'GRANT_LINK', a: f.a, b: f.b, scope: f.scope, task: f.task, hours: Number(f.hours) })
          onClose()
        }}>Grant link</button>
      </>}>
      <div className="form-row">
        <Field label="Person A">
          <select value={f.a} onChange={set('a')}>{spokes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </Field>
        <Field label="Person B">
          <select value={f.b} onChange={set('b')}>{spokes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </Field>
      </div>
      <div className="form-row">
        <Field label="Scope">
          <select value={f.scope} onChange={set('scope')}>
            <option value="temporary">Temporary (task-based)</option>
            <option value="permanent">Permanent</option>
          </select>
        </Field>
        {f.scope === 'temporary' && <Field label="Expires after (hours)"><input type="number" value={f.hours} onChange={set('hours')} /></Field>}
      </div>
      <Field label="Purpose / task (required)"><input value={f.task} onChange={set('task')} placeholder="e.g. Coordinate sifter overhaul this week" /></Field>
    </Modal>
  )
}
