import React, { useEffect, useState } from 'react'
import { useStore } from '../store.jsx'
import { Card, SectionHead, Pill, Empty } from '../components/ui.jsx'
import { fmt, dateShort, timeHM } from '../utils.js'

const RESULT_TONE = { pass: 'green', watch: 'amber', fail: 'red' }

export default function Traceability({ focusRef }) {
  const { state } = useStore()
  const [sel, setSel] = useState(state.flourLots[state.flourLots.length - 2]?.id || '')

  useEffect(() => {
    if (!focusRef?.refId) return
    // deep link can be a flour lot or a wheat lot number
    if (state.flourLots.some((l) => l.id === focusRef.refId)) setSel(focusRef.refId)
    else {
      const holder = state.flourLots.find((l) => l.wheatLots.includes(focusRef.refId))
      if (holder) setSel(holder.id)
    }
  }, [focusRef])

  const lot = state.flourLots.find((l) => l.id === sel)
  const intakes = lot ? state.intakes.filter((i) => lot.wheatLots.includes(i.lotNo)) : []
  const tests = lot ? state.labTests.filter((t) => t.lotId === lot.id) : []
  const wheatTests = lot ? state.labTests.filter((t) => lot.wheatLots.includes(t.lotId)) : []
  const ships = lot ? state.dispatches.filter((d) => d.lotId === lot.id) : []
  const line = lot ? state.lines.find((l) => l.id === lot.lineId) : null

  return (
    <div className="stack">
      <SectionHead
        title="Traceability"
        sub="Food-safety batch tracing: wheat intake → flour lot → lab result → dispatch. Pick a lot to unroll its full chain."
      >
        <select value={sel} onChange={(e) => setSel(e.target.value)} style={{ padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 7, font: 'inherit' }}>
          {[...state.flourLots].reverse().map((l) => (
            <option key={l.id} value={l.id}>{l.id} — {l.product} · {l.date}{l.open ? ' (open)' : ''}</option>
          ))}
        </select>
      </SectionHead>

      {!lot && <Card><Empty>Select a flour lot.</Empty></Card>}

      {lot && (
        <Card>
          <div className="chain">
            <div className="chain-node">
              <div className="chain-rail"><div className="chain-dot" /><div className="chain-line" /></div>
              <div className="chain-body">
                <h3>1 · Wheat intake ({intakes.length} deliveries feed this lot)</h3>
                {intakes.length === 0 && <div className="muted small mt">No matched intake records.</div>}
                <div className="tbl-wrap mt">
                  <table className="tbl">
                    <thead><tr><th>Wheat lot</th><th>Received</th><th>Supplier</th><th>Truck</th><th className="num">Net (t)</th><th className="num">Moisture</th><th>Silo</th></tr></thead>
                    <tbody>
                      {intakes.map((i) => (
                        <tr key={i.id}>
                          <td><b>{i.lotNo}</b></td><td>{dateShort(i.at)} {timeHM(i.at)}</td><td>{i.supplier}</td>
                          <td>{i.truckPlate}</td><td className="num">{fmt(i.netT, 1)}</td><td className="num">{fmt(i.moisturePct, 1)}%</td>
                          <td>{state.silos.find((s) => s.id === i.siloId)?.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {wheatTests.length > 0 && (
                  <div className="muted small mt">Wheat lab checks: {wheatTests.map((t) => `${t.lotId} → ${t.result.toUpperCase()}`).join(' · ')}</div>
                )}
              </div>
            </div>

            <div className="chain-node">
              <div className="chain-rail"><div className="chain-dot" /><div className="chain-line" /></div>
              <div className="chain-body">
                <h3>2 · Milled into flour lot <b>{lot.id}</b></h3>
                <div className="kv mt">
                  <dt>Product</dt><dd>{lot.product}</dd>
                  <dt>Line</dt><dd>{line?.name}</dd>
                  <dt>Date</dt><dd>{lot.date}{lot.open && <Pill tone="green"> open — producing now</Pill>}</dd>
                  <dt>Quantity</dt><dd>{lot.open ? `${fmt(line?.producedToday ?? 0, 1)} t so far today` : `${fmt(lot.tonnes, 0)} t`}</dd>
                </div>
              </div>
            </div>

            <div className="chain-node">
              <div className="chain-rail"><div className="chain-dot" /><div className="chain-line" /></div>
              <div className="chain-body">
                <h3>3 · Lab results on this lot</h3>
                {tests.length === 0 && <div className="notice warn mt">No lab test recorded for this lot{lot.open ? ' yet (still producing)' : ' — dispatch should wait for quality release'}.</div>}
                {tests.map((t) => (
                  <div key={t.id} className="row mt">
                    <Pill tone={RESULT_TONE[t.result]}>{t.result.toUpperCase()}</Pill>
                    <span className="small">moisture {fmt(t.moisture, 1)}% · protein {fmt(t.protein, 1)}% · ash {fmt(t.ash, 2)}% · FN {t.fallingNumber}s</span>
                    <span className="muted small">{dateShort(t.at)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="chain-node">
              <div className="chain-rail"><div className="chain-dot" /></div>
              <div className="chain-body" style={{ paddingBottom: 0 }}>
                <h3>4 · Dispatched to customers</h3>
                {ships.length === 0 && <div className="muted small mt">Not shipped yet — {lot.open ? 'lot still open' : 'in stock'}.</div>}
                <div className="tbl-wrap mt">
                  {ships.length > 0 && (
                    <table className="tbl">
                      <thead><tr><th>When</th><th>Order</th><th>Customer</th><th className="num">Qty (t)</th><th>Truck</th></tr></thead>
                      <tbody>
                        {ships.map((d) => {
                          const o = state.orders.find((x) => x.id === d.orderId)
                          return <tr key={d.id}><td>{dateShort(d.at)} {timeHM(d.at)}</td><td><b>{d.orderId}</b></td><td>{o?.customer}</td><td className="num">{fmt(d.qtyT, 0)}</td><td>{d.truck}</td></tr>
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
                {ships.length > 0 && (
                  <div className="notice mt">Recall scope if this lot fails: {ships.map((d) => state.orders.find((o) => o.id === d.orderId)?.customer).filter(Boolean).join(', ')} — {fmt(ships.reduce((a, d) => a + d.qtyT, 0), 0)} t shipped.</div>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
