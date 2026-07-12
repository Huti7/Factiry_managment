import React, { useState } from 'react'
import { useStore, useUser, can } from '../store.jsx'
import { Card, Modal, Field, SectionHead, Pill, Tile, Empty } from '../components/ui.jsx'
import { stockSummary } from '../derive.js'
import { fmt, money, dateShort, timeHM } from '../utils.js'

export default function Orders({ goto }) {
  const { state } = useStore()
  const user = useUser()
  const [adding, setAdding] = useState(false)
  const [dispatching, setDispatching] = useState(null)

  const stock = stockSummary(state)
  const open = state.orders.filter((o) => o.dispatchedT < o.qtyT)
  const branOrders = state.orders.filter((o) => o.product.includes('Bran'))

  const orderStatus = (o) =>
    o.dispatchedT >= o.qtyT ? <Pill tone="green">shipped</Pill>
      : o.dispatchedT > 0 ? <Pill tone="amber">partial {fmt(o.dispatchedT, 0)}/{o.qtyT} t</Pill>
        : <Pill tone="gray">pending</Pill>

  return (
    <div className="stack">
      <SectionHead title="Orders / Dispatch" sub="Customer orders including bran/byproduct sales — shipped vs pending vs in stock.">
        {can(user, 'add-order') && <button className="btn primary" onClick={() => setAdding(true)}>+ New order</button>}
      </SectionHead>

      <div className="grid cols-4">
        <Tile label="Produced today" value={fmt(stock.producedToday, 0)} unit="t" refText={<>vs <b>{state.lines.reduce((a, l) => a + l.targetTpd, 0)} t</b> daily target</>} tone="tile-good" />
        <Tile label="In stock now" value={fmt(stock.flourStock + stock.branStock, 0)} unit="t" refText={<>{fmt(stock.flourStock, 0)} t flour · {fmt(stock.branStock, 0)} t bran</>} />
        <Tile label="Pending dispatch" value={fmt(stock.pendingT, 0)} unit="t"
          refText={stock.pendingT > stock.flourStock + stock.branStock ? <span className="tile-crit">exceeds stock — production must cover</span> : 'covered by current stock'}
          tone={stock.pendingT > stock.flourStock + stock.branStock ? 'tile-warn' : ''} />
        <Tile label="Open order value" value={money(open.reduce((a, o) => a + (o.qtyT - o.dispatchedT) * o.unitPrice, 0))}
          refText={<>{open.length} open orders · {branOrders.length} bran orders this period</>} />
      </div>

      <Card title="Order book">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Order</th><th>Customer</th><th>Product</th><th className="num">Qty (t)</th><th className="num">Unit $</th><th>Due</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {state.orders.map((o) => (
                <tr key={o.id}>
                  <td><b>{o.id}</b></td>
                  <td>{o.customer}</td>
                  <td>{o.product.includes('Bran') ? <Pill tone="gray">{o.product}</Pill> : o.product}</td>
                  <td className="num">{fmt(o.qtyT, 0)}</td>
                  <td className="num">{fmt(o.unitPrice, 0)}</td>
                  <td>{dateShort(o.dueTs)}{o.dueTs < Date.now() && o.dispatchedT < o.qtyT && <Pill tone="red">due</Pill>}</td>
                  <td>{orderStatus(o)}</td>
                  <td>
                    {o.dispatchedT < o.qtyT && can(user, 'add-dispatch') && (
                      <button className="btn sm" onClick={() => setDispatching(o)}>Dispatch…</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Dispatch log" right={<span className="muted small">every shipment tied to a flour lot for traceability</span>}>
        {state.dispatches.length === 0 && <Empty>No shipments yet.</Empty>}
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>When</th><th>Order</th><th>Customer</th><th className="num">Qty (t)</th><th>Truck</th><th>Lot</th></tr></thead>
            <tbody>
              {state.dispatches.slice(0, 15).map((d) => {
                const o = state.orders.find((x) => x.id === d.orderId)
                return (
                  <tr key={d.id}>
                    <td>{dateShort(d.at)} {timeHM(d.at)}</td>
                    <td><b>{d.orderId}</b></td>
                    <td>{o?.customer}</td>
                    <td className="num">{fmt(d.qtyT, 0)}</td>
                    <td>{d.truck}</td>
                    <td>{d.lotId ? <button className="btn sm" onClick={() => goto('traceability', d.lotId)}>{d.lotId} →</button> : <span className="muted">bulk bran</span>}</td>
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
  const [f, setF] = useState({ customer: '', product: 'Zero Flour (00)', qtyT: '', unitPrice: '', due: '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const ok = f.customer && Number(f.qtyT) > 0 && Number(f.unitPrice) > 0 && f.due
  return (
    <Modal title="New customer order" onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!ok} onClick={() => {
          dispatch({ type: 'ADD_ORDER', customer: f.customer, product: f.product, qtyT: f.qtyT, unitPrice: f.unitPrice, dueTs: new Date(f.due).getTime() })
          onClose()
        }}>Save order</button>
      </>}>
      <Field label="Customer"><input value={f.customer} onChange={set('customer')} /></Field>
      <div className="form-row">
        <Field label="Product">
          <select value={f.product} onChange={set('product')}>
            <option>Zero Flour (00)</option>
            <option>Baladi Flour (82%)</option>
            <option>Bran</option>
          </select>
        </Field>
        <Field label="Quantity (t)"><input type="number" value={f.qtyT} onChange={set('qtyT')} /></Field>
      </div>
      <div className="form-row">
        <Field label="Unit price ($/t)"><input type="number" value={f.unitPrice} onChange={set('unitPrice')} /></Field>
        <Field label="Due date"><input type="date" value={f.due} onChange={set('due')} /></Field>
      </div>
    </Modal>
  )
}

function DispatchModal({ order, onClose }) {
  const { state, dispatch } = useStore()
  const remaining = order.qtyT - order.dispatchedT
  const lots = state.flourLots.filter((l) => !l.open && l.product === order.product)
  const [f, setF] = useState({ qtyT: remaining, truck: '', lotId: lots[lots.length - 1]?.id || '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const isBran = order.product.includes('Bran')
  const heldLots = new Set(state.labTests.filter((t) => t.result === 'fail').map((t) => t.lotId))
  const ok = Number(f.qtyT) > 0 && f.truck && (isBran || (f.lotId && !heldLots.has(f.lotId)))
  return (
    <Modal title={`Dispatch — ${order.id} ${order.customer}`} sub={`${fmt(remaining, 0)} t remaining of ${order.qtyT} t (${order.product})`} onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!ok} onClick={() => {
          dispatch({ type: 'ADD_DISPATCH', orderId: order.id, qtyT: f.qtyT, truck: f.truck, lotId: isBran ? null : f.lotId })
          onClose()
        }}>Record shipment</button>
      </>}>
      <div className="form-row">
        <Field label="Quantity (t)"><input type="number" max={remaining} value={f.qtyT} onChange={set('qtyT')} /></Field>
        <Field label="Truck"><input value={f.truck} onChange={set('truck')} placeholder="TR 1234" /></Field>
      </div>
      {!isBran && (
        <Field label="From flour lot (traceability)">
          <select value={f.lotId} onChange={set('lotId')}>
            {lots.map((l) => <option key={l.id} value={l.id} disabled={heldLots.has(l.id)}>{l.id} — {l.date}{heldLots.has(l.id) ? ' — HELD (lab fail)' : ''}</option>)}
          </select>
        </Field>
      )}
      {!isBran && heldLots.has(f.lotId) && <div className="notice warn">This lot is held by a failed lab test and cannot be dispatched.</div>}
    </Modal>
  )
}
