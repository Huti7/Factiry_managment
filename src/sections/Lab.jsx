import React, { useState } from 'react'
import { useStore, useUser, can, PEOPLE } from '../store.jsx'
import { Card, Modal, Field, SectionHead, Pill, Empty } from '../components/ui.jsx'
import { fmt, dateShort, timeHM } from '../utils.js'

const RESULT_TONE = { pass: 'green', watch: 'amber', fail: 'red' }

export default function Lab({ goto }) {
  const { state } = useStore()
  const user = useUser()
  const [adding, setAdding] = useState(false)

  const testedLots = new Set(state.labTests.map((t) => t.lotId))
  const awaiting = state.flourLots.filter((l) => !l.open && !testedLots.has(l.id))

  return (
    <div className="stack">
      <SectionHead
        title="Lab Reports"
        sub="Quality tests per batch/lot, entered by the lab technician. A FAIL holds dispatch and alerts the owner."
      >
        {can(user, 'add-lab') && <button className="btn primary" onClick={() => setAdding(true)}>+ Enter test result</button>}
      </SectionHead>

      {awaiting.length > 0 && (
        <div className="notice">🧪 {awaiting.length} closed lot{awaiting.length > 1 ? 's' : ''} still awaiting lab results: {awaiting.map((l) => l.id).join(', ')}</div>
      )}

      <Card title="Test register">
        {state.labTests.length === 0 && <Empty>No tests recorded.</Empty>}
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Lot</th><th>When</th><th className="num">Moisture %</th><th className="num">Protein %</th>
                <th className="num">Wet gluten %</th><th className="num">Ash %</th><th className="num">Falling № (s)</th>
                <th>Result</th><th>By</th><th>Trace</th>
              </tr>
            </thead>
            <tbody>
              {state.labTests.slice(0, 30).map((t) => (
                <tr key={t.id}>
                  <td><b>{t.lotId}</b></td>
                  <td>{dateShort(t.at)} {timeHM(t.at)}</td>
                  <td className="num">{fmt(t.moisture, 1)}</td>
                  <td className="num">{fmt(t.protein, 1)}</td>
                  <td className="num">{fmt(t.gluten, 1)}</td>
                  <td className="num">{fmt(t.ash, 2)}</td>
                  <td className="num">{t.fallingNumber}</td>
                  <td><Pill tone={RESULT_TONE[t.result]}>{t.result.toUpperCase()}</Pill>{t.note && <div className="muted small">{t.note}</div>}</td>
                  <td>{PEOPLE.find((p) => p.id === t.by)?.name || t.by}</td>
                  <td><button className="btn sm" onClick={() => goto('traceability', t.lotId)}>chain →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Reference limits" right={<span className="muted small">house spec</span>}>
        <div className="kv">
          <dt>Moisture</dt><dd>≤ 14.5% (flour)</dd>
          <dt>Protein</dt><dd>≥ 10.5% for Zero flour, ≥ 9.5% Baladi</dd>
          <dt>Ash</dt><dd>≤ 0.55% Zero · ≤ 0.9% Baladi</dd>
          <dt>Falling number</dt><dd>≥ 250 s</dd>
        </div>
      </Card>

      {adding && <LabModal onClose={() => setAdding(false)} />}
    </div>
  )
}

function LabModal({ onClose }) {
  const { state, dispatch } = useStore()
  const user = useUser()
  const lots = [...state.flourLots].reverse()
  const [f, setF] = useState({ lotId: lots[0]?.id || '', moisture: '', protein: '', gluten: '', ash: '', fallingNumber: '', result: 'pass', note: '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const ok = f.lotId && f.moisture !== '' && f.protein !== ''

  return (
    <Modal
      title="Enter lab test"
      sub="Result is attached to the lot's traceability chain."
      onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!ok} onClick={() => {
          dispatch({
            type: 'ADD_LAB_TEST', by: user.id,
            test: {
              lotId: f.lotId, moisture: Number(f.moisture), protein: Number(f.protein),
              gluten: Number(f.gluten) || null, ash: Number(f.ash) || null,
              fallingNumber: Number(f.fallingNumber) || null, result: f.result, note: f.note,
            },
          })
          onClose()
        }}>Save test</button>
      </>}
    >
      <Field label="Lot">
        <select value={f.lotId} onChange={set('lotId')}>
          <optgroup label="Flour lots">
            {lots.map((l) => <option key={l.id} value={l.id}>{l.id} — {l.product} ({l.date})</option>)}
          </optgroup>
          <optgroup label="Wheat lots (intake)">
            {state.intakes.slice(0, 10).map((i) => <option key={i.id} value={i.lotNo}>{i.lotNo} — {i.supplier}</option>)}
          </optgroup>
        </select>
      </Field>
      <div className="form-row">
        <Field label="Moisture %"><input type="number" step="0.1" value={f.moisture} onChange={set('moisture')} /></Field>
        <Field label="Protein %"><input type="number" step="0.1" value={f.protein} onChange={set('protein')} /></Field>
        <Field label="Wet gluten %"><input type="number" step="0.1" value={f.gluten} onChange={set('gluten')} /></Field>
      </div>
      <div className="form-row">
        <Field label="Ash %"><input type="number" step="0.01" value={f.ash} onChange={set('ash')} /></Field>
        <Field label="Falling № (s)"><input type="number" value={f.fallingNumber} onChange={set('fallingNumber')} /></Field>
        <Field label="Result">
          <select value={f.result} onChange={set('result')}>
            <option value="pass">Pass</option>
            <option value="watch">Watch</option>
            <option value="fail">Fail — hold dispatch</option>
          </select>
        </Field>
      </div>
      <Field label="Note"><input value={f.note} onChange={set('note')} placeholder="Optional remark" /></Field>
      {f.result === 'fail' && <div className="notice warn">Saving a FAIL raises a critical alert and holds dispatch of this lot pending the owner's decision.</div>}
    </Modal>
  )
}
