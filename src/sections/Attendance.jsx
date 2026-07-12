import React, { useState } from 'react'
import { useStore, useUser, can, PEOPLE } from '../store.jsx'
import { Card, Modal, Field, SectionHead, Pill, Tile, Seg, Empty } from '../components/ui.jsx'
import { attendanceToday, missingPunchOuts, staffing, attendanceMonth } from '../derive.js'
import { fmt, timeHM, monthKey, dateFull } from '../utils.js'

export default function Attendance() {
  const { state } = useStore()
  const user = useUser()
  const [view, setView] = useState('today')
  const [fixing, setFixing] = useState(null) // {worker, day?}

  const rows = attendanceToday(state)
  const groups = staffing(state)
  const short = groups.filter((g) => g.present < g.required)
  const missing = missingPunchOuts(state)
  const present = rows.filter((r) => r.status !== 'absent').length
  const late = rows.filter((r) => r.status === 'late')

  // foreman can only correct records on their own line
  const canFix = (w) => can(user, 'correct-attendance') && (user.role !== 'foreman' || user.lineId === w.lineId || w.lineId == null)

  return (
    <div className="stack">
      <SectionHead
        title="Attendance"
        sub="Punch events read from the gate machine (fingerprint/RFID). The app interprets — corrections are manual and logged."
      >
        <Seg value={view} onChange={setView} options={[{ value: 'today', label: 'Today (live)' }, { value: 'month', label: 'Monthly rollup' }]} />
      </SectionHead>

      {view === 'today' && (
        <>
          <div className="grid cols-3">
            <Tile label="On site now" value={`${present}`} unit={`of ${state.workers.length} on roster`}
              refText={<>{rows.filter((r) => r.status === 'absent').length} absent · {late.length} late</>}
              tone={short.length ? 'tile-warn' : 'tile-good'} progress={(present / state.workers.length) * 100} />
            <Tile label="Understaffed" value={`${short.length}`} unit="lines / departments"
              refText={short.length ? <span className="tile-crit">{short.map((s) => `${s.name}: ${s.present}/${s.required}`).join(' · ')}</span> : 'Every station meets required headcount'}
              tone={short.length ? 'tile-crit' : 'tile-good'} />
            <Tile label="Missing punch-outs" value={`${missing.length}`} unit="to correct"
              refText={missing.length ? 'Gate recorded IN but no OUT — foreman correction needed' : 'Gate records are complete'}
              tone={missing.length ? 'tile-warn' : 'tile-good'} />
          </div>

          <div className="grid cols-2">
            <Card title="Staffing by line / department" right={<span className="muted small">present vs required</span>}>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr><th>Station</th><th className="num">Present</th><th className="num">Required</th><th>Status</th></tr></thead>
                  <tbody>
                    {groups.map((g) => (
                      <tr key={g.key}>
                        <td><b>{g.name}</b>{g.absent.length > 0 && <div className="muted small">absent: {g.absent.map((a) => a.worker.name).join(', ')}</div>}</td>
                        <td className="num">{g.present}</td>
                        <td className="num">{g.required}</td>
                        <td>{g.present < g.required
                          ? <Pill tone="red">short {g.required - g.present}</Pill>
                          : <Pill tone="green">OK</Pill>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Corrections needed" right={<span className="muted small">missing punch-outs</span>}>
              {missing.length === 0 && <Empty>Nothing to correct.</Empty>}
              {missing.map((m) => (
                <div key={m.worker.id + m.day} className="row" style={{ justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--line-soft)' }}>
                  <span><b>{m.worker.name}</b> <span className="muted small">({m.worker.dept})</span><div className="muted small">{dateFull(m.inPunch.at)} — punched IN {timeHM(m.inPunch.at)}, no punch-out</div></span>
                  {canFix(m.worker)
                    ? <button className="btn sm primary" onClick={() => setFixing(m)}>Add punch-out</button>
                    : <span className="muted small">foreman/HR only</span>}
                </div>
              ))}
              {state.corrections.length > 0 && (
                <div className="mt">
                  <div className="nav-label" style={{ padding: 0 }}>Correction log</div>
                  <div className="log-list mt">
                    {state.corrections.slice(0, 5).map((c) => (
                      <div key={c.id}>✎ {PEOPLE.find((p) => p.id === c.by)?.name} added {c.dir.toUpperCase()} {timeHM(c.punchAt)} for {state.workers.find((w) => w.id === c.workerId)?.name} — “{c.note}”</div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>

          <Card title="Today's board" right={<span className="muted small">live from gate machine · shift starts 07:00, 10 min grace</span>}>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Worker</th><th>Department</th><th>In</th><th>Out</th><th>Status</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.worker.id}>
                      <td><b>{r.worker.name}</b></td>
                      <td className="muted">{r.worker.dept}{r.worker.lineId ? ` — ${state.lines.find((l) => l.id === r.worker.lineId)?.name}` : ''}</td>
                      <td>{r.firstIn ? <>{timeHM(r.firstIn.at)}{r.firstIn.source === 'manual' && <Pill tone="gray">manual</Pill>}</> : '—'}</td>
                      <td>{r.lastOut ? timeHM(r.lastOut.at) : <span className="muted">on site</span>}</td>
                      <td>
                        {r.status === 'present' && <Pill tone="green">present</Pill>}
                        {r.status === 'late' && <Pill tone="amber">late {r.lateMin} min</Pill>}
                        {r.status === 'absent' && <Pill tone="red">absent</Pill>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {view === 'month' && <MonthView />}

      {fixing && <FixModal item={fixing} onClose={() => setFixing(null)} />}
    </div>
  )
}

function MonthView() {
  const { state } = useStore()
  const month = monthKey(Date.now())
  const roll = attendanceMonth(state, month)
  return (
    <Card title={`Monthly rollup — ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}
      right={<span className="muted small">history from the punch database, not the live sensors</span>}>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr><th>Worker</th><th>Department</th><th className="num">Days worked</th><th className="num">Absences</th><th className="num">Times late</th><th className="num">Late minutes</th><th className="num">Hours</th></tr>
          </thead>
          <tbody>
            {roll.map((r) => (
              <tr key={r.worker.id}>
                <td><b>{r.worker.name}</b></td>
                <td className="muted">{r.worker.dept}</td>
                <td className="num">{r.present + r.late}</td>
                <td className="num">{r.absent ? <Pill tone={r.absent > 2 ? 'red' : 'amber'}>{r.absent}</Pill> : 0}</td>
                <td className="num">{r.late}</td>
                <td className="num">{r.lateMin}</td>
                <td className="num">{fmt(r.hours, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function FixModal({ item, onClose }) {
  const { dispatch } = useStore()
  const user = useUser()
  const [time, setTime] = useState('16:00')
  const [note, setNote] = useState('')
  const save = () => {
    const [h, m] = time.split(':').map(Number)
    const d = new Date(item.inPunch.at); d.setHours(h, m, 0, 0)
    dispatch({ type: 'CORRECT_PUNCH', workerId: item.worker.id, at: d.getTime(), dir: 'out', note, by: user.id })
    onClose()
  }
  return (
    <Modal
      title={`Add punch-out — ${item.worker.name}`}
      sub={`${dateFull(item.inPunch.at)} · punched in ${timeHM(item.inPunch.at)}. This correction is logged with your name.`}
      onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!note} onClick={save}>Save correction</button>
      </>}
    >
      <Field label="Punch-out time"><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
      <Field label="Reason (required)"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. left with maintenance crew, gate reader missed him" /></Field>
    </Modal>
  )
}
