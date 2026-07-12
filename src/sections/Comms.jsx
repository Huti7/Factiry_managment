import React, { useEffect, useRef, useState } from 'react'
import { useStore, useUser, can, PEOPLE } from '../store.jsx'
import { useLang } from '../i18n.jsx'
import { Card, Modal, Field, SectionHead, Pill, Empty } from '../components/ui.jsx'
import { timeHM, dateShort, dateFull, initials } from '../utils.js'

export default function Comms({ focusRef }) {
  const { state } = useStore()
  const user = useUser()
  const { t, L } = useLang()

  const myThreads = state.threads.filter((th) => th.participants.includes(user.id))
  const [sel, setSel] = useState(myThreads[0]?.id || null)
  const [flagging, setFlagging] = useState(false)
  const [linking, setLinking] = useState(false)

  useEffect(() => {
    if (focusRef?.refId && state.threads.some((th) => th.id === focusRef.refId)) setSel(focusRef.refId)
  }, [focusRef])

  const thread = myThreads.find((th) => th.id === sel) || myThreads[0]
  const other = (th) => PEOPLE.find((p) => p.id === th.participants.find((x) => x !== user.id))

  return (
    <div className="stack">
      <SectionHead title={t('nav.comms')} sub={user.role === 'owner' ? t('cm.subOwner') : t('cm.subSpoke')}>
        {can(user, 'raise-flag') && <button className="btn danger" onClick={() => setFlagging(true)}>{t('cm.flag')}</button>}
        {can(user, 'grant-links') && <button className="btn" onClick={() => setLinking(true)}>{t('cm.grant')}</button>}
      </SectionHead>

      <div className="comms">
        <Card pad0 className="thread-list">
          <div style={{ padding: 8 }}>
            <div className="nav-label" style={{ padding: '4px 8px' }}>{t('cm.direct')}</div>
            {myThreads.map((th) => {
              const p = other(th)
              const last = th.messages[th.messages.length - 1]
              const waiting = th.messages.filter((m) => m.type === 'order' && m.status !== 'done' && m.from !== user.id).length
              return (
                <button key={th.id} className={`item ${thread?.id === th.id ? 'on' : ''}`} onClick={() => setSel(th.id)}>
                  <span className="avatar">{p ? initials(L(p.name)) : '?'}</span>
                  <span style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{L(p?.name)}</div>
                    <div className="muted small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
                      {last ? L(last.text) : t(p?.titleKey)}
                    </div>
                  </span>
                  {waiting > 0 && <span className="nav-badge amber">{waiting}</span>}
                </button>
              )
            })}
          </div>
        </Card>

        <Card pad0>
          {thread ? <ChatPane thread={thread} other={other(thread)} /> : <Empty>{t('cm.noMsgs')}</Empty>}
        </Card>
      </div>

      {user.role === 'owner' && <LinksCard />}

      {flagging && <FlagModal onClose={() => setFlagging(false)} />}
      {linking && <LinkModal onClose={() => setLinking(false)} />}
    </div>
  )
}

function ChatPane({ thread, other }) {
  const { dispatch } = useStore()
  const user = useUser()
  const { t, L } = useLang()
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

  const name = (id) => L(PEOPLE.find((p) => p.id === id)?.name) || id

  return (
    <div className="chat-pane" style={{ padding: '12px 14px' }}>
      <div className="row" style={{ paddingBottom: 8, borderBottom: '1px solid var(--line-soft)' }}>
        <span className="avatar">{other ? initials(L(other.name)) : '?'}</span>
        <div>
          <b>{L(other?.name)}</b>
          <div className="muted small">{t(other?.titleKey)}</div>
        </div>
      </div>
      <div className="chat-scroll" ref={scrollRef}>
        {thread.messages.length === 0 && <div className="msg sys">{t('cm.noMsgs')}</div>}
        {thread.messages.map((m) => {
          const mine = m.from === user.id
          const cls = m.type === 'order' ? 'order-msg' : m.type === 'flag' ? 'flag-msg' : ''
          return (
            <div key={m.id} className={`msg ${mine ? 'mine' : 'theirs'} ${cls}`}>
              {m.type === 'order' && <div className="order-tag">{t('cm.orderTag')}</div>}
              {m.type === 'flag' && <div className="flag-tag">{t('cm.flagTag')}</div>}
              <div>{L(m.text)}</div>
              <div className="meta">
                {name(m.from)} · {dateShort(m.at)} {timeHM(m.at)}
                {m.type === 'order' && (
                  <> · {m.status === 'sent' && t('cm.sent')}
                    {m.status === 'acknowledged' && t('cm.acked', { t: timeHM(m.ackedAt) })}
                    {m.status === 'done' && t('cm.done', { t: timeHM(m.doneAt) })}</>
                )}
              </div>
              {m.type === 'order' && !mine && m.status !== 'done' && (
                <div className="row" style={{ marginTop: 6 }}>
                  {m.status === 'sent' && (
                    <button className="btn sm" onClick={() => dispatch({ type: 'ORDER_MSG_STATUS', threadId: thread.id, msgId: m.id, status: 'acknowledged' })}>
                      {t('cm.ackBtn')}
                    </button>
                  )}
                  {m.status === 'acknowledged' && (
                    <button className="btn sm primary" onClick={() => dispatch({ type: 'ORDER_MSG_STATUS', threadId: thread.id, msgId: m.id, status: 'done' })}>
                      {t('cm.doneBtn')}
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
          <select value={msgType} onChange={(e) => setMsgType(e.target.value)}>
            <option value="message">{t('cm.msg')}</option>
            <option value="order">{t('cm.order')}</option>
          </select>
        )}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={msgType === 'order' ? t('cm.orderPh') : t('cm.msgPh')}
        />
        <button className="btn primary" onClick={send}>{t('cm.send')}</button>
      </div>
    </div>
  )
}

function LinksCard() {
  const { state, dispatch } = useStore()
  const { t, L } = useLang()
  const name = (id) => L(PEOPLE.find((p) => p.id === id)?.name) || id
  const now = Date.now()
  return (
    <Card title={t('cm.links')} right={<span className="muted small">{t('cm.linksSub')}</span>}>
      {state.links.length === 0 && <Empty>{t('cm.noLinks')}</Empty>}
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>{t('cm.between')}</th><th>{t('cm.scope')}</th><th>{t('cm.purpose')}</th><th>{t('common.status')}</th><th></th></tr></thead>
          <tbody>
            {state.links.map((l) => (
              <tr key={l.id}>
                <td><b>{name(l.a)}</b> ↔ <b>{name(l.b)}</b></td>
                <td>{l.scope === 'permanent' ? <Pill tone="green">{t('cm.permanent')}</Pill> : <Pill tone="amber">{t('cm.temporary')}</Pill>}
                  {l.preapproved && <Pill tone="solid">{t('cm.preapproved')}</Pill>}</td>
                <td className="muted">{L(l.task) || '—'}</td>
                <td>{l.expiresAt
                  ? l.expiresAt > now ? <span className="small">{t('cm.until', { t: `${dateFull(l.expiresAt)} ${timeHM(l.expiresAt)}` })}</span> : <Pill tone="red">{t('cm.expired')}</Pill>
                  : <span className="muted small">{t('cm.noExpiry')}</span>}</td>
                <td>{!l.preapproved && <button className="btn sm danger" onClick={() => dispatch({ type: 'REVOKE_LINK', id: l.id })}>{t('cm.revoke')}</button>}</td>
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
  const { t } = useLang()
  const [text, setText] = useState('')
  return (
    <Modal title={t('cm.flagTitle')} sub={t('cm.flagSub')} onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={!text.trim()} onClick={() => { dispatch({ type: 'RAISE_FLAG', from: user.id, text: text.trim() }); onClose() }}>{t('cm.raiseBtn')}</button>
      </>}>
      <Field label={t('cm.whatsWrong')}><textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('cm.flagPh')} /></Field>
    </Modal>
  )
}

function LinkModal({ onClose }) {
  const { dispatch } = useStore()
  const { t, L } = useLang()
  const spokes = PEOPLE.filter((p) => p.id !== 'p-owner')
  const [f, setF] = useState({ a: spokes[0].id, b: spokes[1].id, scope: 'temporary', task: '', hours: 24 })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const ok = f.a !== f.b && f.task
  return (
    <Modal title={t('cm.grantTitle')} sub={t('cm.grantSub')} onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={!ok} onClick={() => {
          dispatch({ type: 'GRANT_LINK', a: f.a, b: f.b, scope: f.scope, task: f.task, hours: Number(f.hours) })
          onClose()
        }}>{t('cm.grantBtn')}</button>
      </>}>
      <div className="form-row">
        <Field label={t('cm.personA')}>
          <select value={f.a} onChange={set('a')}>{spokes.map((p) => <option key={p.id} value={p.id}>{L(p.name)}</option>)}</select>
        </Field>
        <Field label={t('cm.personB')}>
          <select value={f.b} onChange={set('b')}>{spokes.map((p) => <option key={p.id} value={p.id}>{L(p.name)}</option>)}</select>
        </Field>
      </div>
      <div className="form-row">
        <Field label={t('cm.scope')}>
          <select value={f.scope} onChange={set('scope')}>
            <option value="temporary">{t('cm.scopeTemp')}</option>
            <option value="permanent">{t('cm.scopePerm')}</option>
          </select>
        </Field>
        {f.scope === 'temporary' && <Field label={t('cm.expiresAfter')}><input type="number" value={f.hours} onChange={set('hours')} /></Field>}
      </div>
      <Field label={t('cm.purposeReq')}><input value={f.task} onChange={set('task')} placeholder={t('cm.purposePh')} /></Field>
    </Modal>
  )
}
