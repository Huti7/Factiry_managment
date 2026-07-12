import React, { useState } from 'react'
import { useStore, useUser, can } from '../store.jsx'
import { Card, Modal, Field, SectionHead, Pill, Tile } from '../components/ui.jsx'
import { fmt, dateShort, timeHM } from '../utils.js'

export default function Intake({ goto }) {
  const { state, dispatch } = useStore()
  const user = useUser()
  const [adding, setAdding] = useState(false)
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const today = state.intakes.filter((i) => i.at >= todayStart.getTime())
  const todayT = today.reduce((a, i) => a + i.netT, 0)
  const wk = state.intakes.filter((i) => i.at >= Date.now() - 7 * 86400e3)

  return (
    <div className="stack">
      <SectionHead
        title="Wheat Intake / Weighbridge"
        sub="Every truck: weigh-in, moisture test, lot number. This is the front of the traceability chain."
      >
        {can(user, 'add-intake') && <button className="btn primary" onClick={() => setAdding(true)}>+ Record truck</button>}
      </SectionHead>

      <div className="grid cols-3">
        <Tile label="Received today" value={fmt(todayT, 1)} unit="t" refText={<>{today.length} truck{today.length === 1 ? '' : 's'} over the weighbridge today</>} tone="tile-good" />
        <Tile label="Last 7 days" value={fmt(wk.reduce((a, i) => a + i.netT, 0), 0)} unit="t"
          refText={<>{wk.length} deliveries · avg <b>{fmt(wk.length ? wk.reduce((a, i) => a + i.netT, 0) / wk.length : 0, 1)} t</b>/truck</>} />
        <Tile label="Avg moisture (7 days)" value={fmt(wk.length ? wk.reduce((a, i) => a + i.moisturePct, 0) / wk.length : 0, 1)} unit="%"
          refText={<>Acceptance limit <b>13.5%</b> — above it wheat needs drying/blending</>} />
      </div>

      <Card title="Intake register" right={<span className="muted small">newest first</span>}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Lot №</th><th>When</th><th>Truck</th><th>Supplier</th><th className="num">Net (t)</th><th className="num">Moisture</th><th>To silo</th><th>Trace</th></tr>
            </thead>
            <tbody>
              {state.intakes.slice(0, 25).map((i) => (
                <tr key={i.id}>
                  <td><b>{i.lotNo}</b></td>
                  <td>{dateShort(i.at)} {timeHM(i.at)}</td>
                  <td>{i.truckPlate}</td>
                  <td>{i.supplier}</td>
                  <td className="num">{fmt(i.netT, 1)}</td>
                  <td className="num">{i.moisturePct > 13.5 ? <Pill tone="amber">{fmt(i.moisturePct, 1)}%</Pill> : `${fmt(i.moisturePct, 1)}%`}</td>
                  <td>{state.silos.find((s) => s.id === i.siloId)?.name}</td>
                  <td><button className="btn sm" onClick={() => goto('traceability', i.lotNo)}>chain →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {adding && <IntakeModal onClose={() => setAdding(false)} />}
    </div>
  )
}

function IntakeModal({ onClose }) {
  const { state, dispatch } = useStore()
  const user = useUser()
  const [f, setF] = useState({ truckPlate: '', supplier: '', netT: '', moisturePct: '', siloId: 'S-W1' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const ok = f.truckPlate && f.supplier && Number(f.netT) > 0 && f.moisturePct !== ''

  return (
    <Modal
      title="Record incoming truck"
      sub="A lot number is assigned automatically and the target silo level is updated."
      onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!ok} onClick={() => { dispatch({ type: 'ADD_INTAKE', ...f, by: user.id }); onClose() }}>Save intake</button>
      </>}
    >
      <div className="form-row">
        <Field label="Truck plate"><input value={f.truckPlate} onChange={set('truckPlate')} placeholder="TR 1234" /></Field>
        <Field label="Supplier"><input value={f.supplier} onChange={set('supplier')} placeholder="Supplier name" /></Field>
      </div>
      <div className="form-row">
        <Field label="Net weight (t)"><input type="number" step="0.1" value={f.netT} onChange={set('netT')} /></Field>
        <Field label="Moisture (%)"><input type="number" step="0.1" value={f.moisturePct} onChange={set('moisturePct')} /></Field>
      </div>
      <Field label="Unload into">
        <select value={f.siloId} onChange={set('siloId')}>
          {state.silos.filter((s) => s.kind === 'wheat').map((s) => (
            <option key={s.id} value={s.id}>{s.name} — {fmt(s.levelT, 0)}/{s.capacityT} t</option>
          ))}
        </select>
      </Field>
      {Number(f.moisturePct) > 13.5 && <div className="notice warn">Moisture above the 13.5% acceptance limit — flag to the owner before unloading.</div>}
    </Modal>
  )
}
