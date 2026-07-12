import React, { useState } from 'react'
import { useStore, useUser, can } from '../store.jsx'
import { useLang } from '../i18n.jsx'
import { Card, Modal, Field, SectionHead, Pill, Tile, Empty } from '../components/ui.jsx'
import { stockSummary } from '../derive.js'
import { fmt, money, dateShort, timeHM } from '../utils.js'

export default function Orders({ goto }) {
  const { state } = useStore()
  const user = useUser()
  const { t, L } = useLang()
  const [adding, setAdding] = useState(false)
  const [dispatching, setDispatching] = useState(null)

  const stock = stockSummary(state)
  const open = state.orders.filter((o) => o.dispatchedT < o.qtyT)
  const branOrders = state.orders.filter((o) => o.product === 'bran')

  const orderStatus = (o) =>
    o.dispatchedT >= o.qtyT ? <Pill tone="green">{t('st.shipped')}</Pill>
      : o.dispatchedT > 0 ? <Pill tone="amber">{t('or.partialOf', { a: fmt(o.dispatchedT, 0), b: fmt(o.qtyT, 0) })}</Pill>
        : <Pill tone="gray">{t('st.pendingLow')}</Pill>

  return (
    <div className="stack">
      <SectionHead title={t('nav.orders')} sub={t('or.sub')}>
        {can(user, 'add-order') && <button className="btn primary" onClick={() => setAdding(true)}>{t('or.new')}</button>}
      </SectionHead>

      <div className="grid cols-4">
        <Tile label={t('ov.producedToday')} value={fmt(stock.producedToday, 0)} unit={t('u.t')}
          refText={t('or.vsTarget', { t: fmt(state.lines.reduce((a, l) => a + l.targetTpd, 0), 0) })} tone="tile-good" />
        <Tile label={t('or.inStock')} value={fmt(stock.flourStock + stock.branStock, 0)} unit={t('u.t')}
          refText={t('or.flourBran', { f: fmt(stock.flourStock, 0), b: fmt(stock.branStock, 0) })} />
        <Tile label={t('or.pending')} value={fmt(stock.pendingT, 0)} unit={t('u.t')}
          refText={stock.pendingT > stock.flourStock + stock.branStock ? <span className="tile-crit">{t('or.exceedsStock')}</span> : t('or.covered')}
          tone={stock.pendingT > stock.flourStock + stock.branStock ? 'tile-warn' : ''} />
        <Tile label={t('or.openValue')} value={money(open.reduce((a, o) => a + (o.qtyT - o.dispatchedT) * o.unitPrice, 0))}
          refText={t('or.openBran', { n: fmt(open.length, 0), b: fmt(branOrders.length, 0) })} />
      </div>

      <Card title={t('or.book')}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>{t('or.order')}</th><th>{t('or.customer')}</th><th>{t('or.product')}</th><th className="num">{t('or.qty')}</th><th className="num">{t('or.unitPrice')}</th><th>{t('or.due')}</th><th>{t('common.status')}</th><th></th></tr>
            </thead>
            <tbody>
              {state.orders.map((o) => (
                <tr key={o.id}>
                  <td><b>{o.id}</b></td>
                  <td>{L(o.customer)}</td>
                  <td>{o.product === 'bran' ? <Pill tone="gray">{t('product.bran')}</Pill> : t(`product.${o.product}`)}</td>
                  <td className="num">{fmt(o.qtyT, 0)}</td>
                  <td className="num">{fmt(o.unitPrice, 0)}</td>
                  <td>{dateShort(o.dueTs)}{o.dueTs < Date.now() && o.dispatchedT < o.qtyT && <Pill tone="red">{t('or.dueBadge')}</Pill>}</td>
                  <td>{orderStatus(o)}</td>
                  <td>
                    {o.dispatchedT < o.qtyT && can(user, 'add-dispatch') && (
                      <button className="btn sm" onClick={() => setDispatching(o)}>{t('or.dispatchBtn')}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={t('or.dispatchLog')} right={<span className="muted small">{t('or.logSub')}</span>}>
        {state.dispatches.length === 0 && <Empty>{t('or.noShip')}</Empty>}
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>{t('common.when')}</th><th>{t('or.order')}</th><th>{t('or.customer')}</th><th className="num">{t('or.qty')}</th><th>{t('in.truck')}</th><th>{t('or.lot')}</th></tr></thead>
            <tbody>
              {state.dispatches.slice(0, 15).map((d) => {
                const o = state.orders.find((x) => x.id === d.orderId)
                return (
                  <tr key={d.id}>
                    <td>{dateShort(d.at)} {timeHM(d.at)}</td>
                    <td><b>{d.orderId}</b></td>
                    <td>{L(o?.customer)}</td>
                    <td className="num">{fmt(d.qtyT, 0)}</td>
                    <td><span className="ltr-nums">{d.truck}</span></td>
                    <td>{d.lotId ? <button className="btn sm" onClick={() => goto('traceability', d.lotId)}>{d.lotId} ←</button> : <span className="muted">{t('or.bulkBran')}</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {adding && <OrderModal onClose={() => setAdding(false)} />}
      {dispatching && <DispatchModal order={dispatching} onClose={() => setDispatching(null)} />}
    </div>
  )
}

function OrderModal({ onClose }) {
  const { dispatch } = useStore()
  const { t } = useLang()
  const [f, setF] = useState({ customer: '', product: 'zero', qtyT: '', unitPrice: '', due: '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const ok = f.customer && Number(f.qtyT) > 0 && Number(f.unitPrice) > 0 && f.due
  return (
    <Modal title={t('or.modalNew')} onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={!ok} onClick={() => {
          dispatch({ type: 'ADD_ORDER', customer: f.customer, product: f.product, qtyT: f.qtyT, unitPrice: f.unitPrice, dueTs: new Date(f.due).getTime() })
          onClose()
        }}>{t('or.saveOrder')}</button>
      </>}>
      <Field label={t('or.customer')}><input value={f.customer} onChange={set('customer')} /></Field>
      <div className="form-row">
        <Field label={t('or.product')}>
          <select value={f.product} onChange={set('product')}>
            <option value="zero">{t('product.zero')}</option>
            <option value="whole">{t('product.whole')}</option>
            <option value="bran">{t('product.bran')}</option>
          </select>
        </Field>
        <Field label={t('or.qtyT')}><input type="number" value={f.qtyT} onChange={set('qtyT')} /></Field>
      </div>
      <div className="form-row">
        <Field label={t('or.unitPriceF')}><input type="number" value={f.unitPrice} onChange={set('unitPrice')} /></Field>
        <Field label={t('or.dueDate')}><input type="date" value={f.due} onChange={set('due')} /></Field>
      </div>
    </Modal>
  )
}

function DispatchModal({ order, onClose }) {
  const { state, dispatch } = useStore()
  const { t, L } = useLang()
  const remaining = order.qtyT - order.dispatchedT
  const lots = state.flourLots.filter((l) => !l.open && l.product === order.product)
  const [f, setF] = useState({ qtyT: remaining, truck: '', lotId: lots[lots.length - 1]?.id || '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const isBran = order.product === 'bran'
  const heldLots = new Set(state.labTests.filter((x) => x.result === 'fail').map((x) => x.lotId))
  const ok = Number(f.qtyT) > 0 && f.truck && (isBran || (f.lotId && !heldLots.has(f.lotId)))
  return (
    <Modal title={t('or.dispatchTitle', { id: order.id, c: L(order.customer) })}
      sub={t('or.remaining', { r: fmt(remaining, 0), q: fmt(order.qtyT, 0), p: t(`product.${order.product}`) })} onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={!ok} onClick={() => {
          dispatch({ type: 'ADD_DISPATCH', orderId: order.id, qtyT: f.qtyT, truck: f.truck, lotId: isBran ? null : f.lotId })
          onClose()
        }}>{t('or.recordShip')}</button>
      </>}>
      <div className="form-row">
        <Field label={t('or.qtyT')}><input type="number" max={remaining} value={f.qtyT} onChange={set('qtyT')} /></Field>
        <Field label={t('in.truck')}><input value={f.truck} onChange={set('truck')} placeholder="63ع441" /></Field>
      </div>
      {!isBran && (
        <Field label={t('or.fromLot')}>
          <select value={f.lotId} onChange={set('lotId')}>
            {lots.map((l) => <option key={l.id} value={l.id} disabled={heldLots.has(l.id)}>{l.id} — {l.date}{heldLots.has(l.id) ? ` — ${t('or.held')}` : ''}</option>)}
          </select>
        </Field>
      )}
      {!isBran && heldLots.has(f.lotId) && <div className="notice warn">{t('or.heldWarn')}</div>}
    </Modal>
  )
}
