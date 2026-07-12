import React, { useState } from 'react'
import { useStore, useUser, can, PEOPLE } from '../store.jsx'
import { Card, Pill, Modal, Field, SectionHead, Empty } from '../components/ui.jsx'
import { fmt, ago } from '../utils.js'

export default function Silos() {
  const { state, dispatch } = useStore()
  const user = useUser()
  const [override, setOverride] = useState(null)

  const groups = [
    { label: 'Wheat in', kinds: ['wheat'] },
    { label: 'Flour & bran out', kinds: ['flour', 'bran'] },
  ]

  return (
    <div className="stack">
      <SectionHead
        title="Silos / Stock"
        sub="Live sensor levels. Foreman can confirm or correct a reading when a sensor drifts — every override is logged and reported to the owner."
      />

      {groups.map((g) => (
        <div key={g.label}>
          <div className="nav-label" style={{ padding: '0 0 8px' }}>{g.label}</div>
          <div className="grid cols-3">
            {state.silos.filter((s) => g.kinds.includes(s.kind)).map((s) => {
              const p = (s.levelT / s.capacityT) * 100
              const low = p < s.lowPct
              return (
                <Card key={s.id} title={s.name} right={
                  s.sensorOk ? <Pill tone="green">sensor OK</Pill> : <Pill tone="amber">⚠ sensor drift</Pill>
                }>
                  <div className="row" style={{ alignItems: 'stretch' }}>
                    <div style={{ flex: '0 0 64px' }}>
                      <div className="silo-bar" title={`${fmt(p, 0)}% full`}>
                        <div className="silo-low-line" style={{ bottom: `${s.lowPct}%` }} />
                        <div className={`silo-fill ${low ? 'low' : s.kind}`} style={{ height: `${p}%` }} />
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className={`tile-value ${low ? 'tile-crit' : ''}`}>{fmt(s.levelT, 0)}<span className="unit">t of {s.capacityT} t</span></div>
                      <div className="tile-ref">{fmt(p, 0)}% full · low alert below <b>{s.lowPct}%</b></div>
                      {low && <div className="notice warn mt">Below low-level threshold</div>}
                      {can(user, 'silo-override') && (
                        <button className="btn sm mt" onClick={() => setOverride(s)}>Confirm / correct level</button>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      ))}

      <Card title="Override log" right={<span className="muted small">every manual correction, who and why</span>}>
        {state.siloOverrides.length === 0 && <Empty>No manual corrections yet.</Empty>}
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>When</th><th>Silo</th><th>Change</th><th>By</th><th>Reason</th></tr></thead>
            <tbody>
              {state.siloOverrides.slice(0, 10).map((o) => (
                <tr key={o.id}>
                  <td>{ago(o.at)}</td>
                  <td><b>{state.silos.find((s) => s.id === o.siloId)?.name}</b></td>
                  <td className="num">{fmt(o.from, 0)} t → <b>{fmt(o.to, 0)} t</b></td>
                  <td>{PEOPLE.find((p) => p.id === o.by)?.name}</td>
                  <td className="muted">{o.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {override && <OverrideModal silo={override} onClose={() => setOverride(null)} />}
    </div>
  )
}

function OverrideModal({ silo, onClose }) {
  const { dispatch } = useStore()
  const user = useUser()
  const [level, setLevel] = useState(Math.round(silo.levelT))
  const [note, setNote] = useState('')

  return (
    <Modal
      title={`Correct level — ${silo.name}`}
      sub={`Sensor reads ${fmt(silo.levelT, 0)} t. Enter the confirmed level; the correction is logged and the owner is notified.`}
      onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!note} onClick={() => {
          dispatch({ type: 'SILO_OVERRIDE', siloId: silo.id, levelT: Number(level), note, by: user.id })
          onClose()
        }}>Save correction</button>
      </>}
    >
      <Field label={`Confirmed level (t, capacity ${silo.capacityT} t)`}>
        <input type="number" min="0" max={silo.capacityT} value={level} onChange={(e) => setLevel(e.target.value)} />
      </Field>
      <Field label="Reason (required)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. manual dip check after sensor drift" />
      </Field>
    </Modal>
  )
}
