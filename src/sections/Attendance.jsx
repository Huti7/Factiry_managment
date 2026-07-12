import React, { useState } from 'react'
import { useStore, useUser, can, PEOPLE } from '../store.jsx'
import { useLang } from '../i18n.jsx'
import { Card, Modal, Field, SectionHead, Pill, Tile, Seg, Empty } from '../components/ui.jsx'
import { attendanceToday, missingPunchOuts, staffing, attendanceMonth } from '../derive.js'
import { fmt, timeHM, monthKey, monthLabel, dateFull } from '../utils.js'

export default function Attendance() {
  const { state } = useStore()
  const user = useUser()
  const { t, L } = useLang()
  const [view, setView] = useState('today')
  const [fixing, setFixing] = useState(null) // {worker, day?}

  const rows = attendanceToday(state)
  const groups = staffing(state)
  const short = groups.filter((g) => g.present < g.required)
  const missing = missingPunchOuts(state)
  const present = rows.filter((r) => r.status !== 'absent').length
  const late = rows.filter((r) => r.status === 'late')
  const stationName = (g) => (g.nameKey ? t(g.nameKey) : L(g.name))

  // foreman can only correct records on their own line
  const canFix = (w) => can(user, 'correct-attendance') && (user.role !== 'foreman' || user.lineId === w.lineId || w.lineId == null)

  return (
    <div className="stack">
      <SectionHead title={t('nav.attendance')} sub={t('at.sub')}>
        <Seg value={view} onChange={setView} options={[{ value: 'today', label: t('at.todayLive') }, { value: 'month', label: t('at.monthly') }]} />
      </SectionHead>

      {view === 'today' && (
        <>
          <div className="grid cols-3">
            <Tile label={t('at.onSite')} value={fmt(present, 0)} unit={t('at.ofRoster', { n: fmt(state.workers.length, 0) })}
              refText={t('at.absLate', { a: fmt(rows.filter((r) => r.status === 'absent').length, 0), l: fmt(late.length, 0) })}
              tone={short.length ? 'tile-warn' : 'tile-good'} progress={(present / state.workers.length) * 100} />
            <Tile label={t('at.understaffed')} value={fmt(short.length, 0)} unit={t('at.linesDepts')}
              refText={short.length ? <span className="tile-crit">{short.map((s) => `${stationName(s)}: ${fmt(s.present, 0)}/${fmt(s.required, 0)}`).join(' · ')}</span> : t('at.allMeet')}
              tone={short.length ? 'tile-crit' : 'tile-good'} />
            <Tile label={t('at.missing')} value={fmt(missing.length, 0)} unit={t('at.toCorrect')}
              refText={missing.length ? t('at.missingNote') : t('at.complete')}
              tone={missing.length ? 'tile-warn' : 'tile-good'} />
          </div>

          <div className="grid cols-2">
            <Card title={t('at.byStation')} right={<span className="muted small">{t('at.presentVsReq')}</span>}>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr><th>{t('at.station')}</th><th className="num">{t('at.present')}</th><th className="num">{t('at.required')}</th><th>{t('common.status')}</th></tr></thead>
                  <tbody>
                    {groups.map((g) => (
                      <tr key={g.key}>
                        <td><b>{stationName(g)}</b>{g.absent.length > 0 && <div className="muted small">{t('at.absentList', { names: g.absent.map((a) => L(a.worker.name)).join('، ') })}</div>}</td>
                        <td className="num">{fmt(g.present, 0)}</td>
                        <td className="num">{fmt(g.required, 0)}</td>
                        <td>{g.present < g.required
                          ? <Pill tone="red">{t('at.shortN', { n: fmt(g.required - g.present, 0) })}</Pill>
                          : <Pill tone="green">{t('at.ok')}</Pill>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title={t('at.corrections')} right={<span className="muted small">{t('at.missing')}</span>}>
              {missing.length === 0 && <Empty>{t('at.nothing')}</Empty>}
              {missing.map((m) => (
                <div key={m.worker.id + m.day} className="row" style={{ justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--line-soft)' }}>
                  <span><b>{L(m.worker.name)}</b> <span className="muted small">({t(`dept.${m.worker.dept}`)})</span><div className="muted small">{t('at.punchedIn', { d: dateFull(m.inPunch.at), t: timeHM(m.inPunch.at) })}</div></span>
                  {canFix(m.worker)
                    ? <button className="btn sm primary" onClick={() => setFixing(m)}>{t('at.addOut')}</button>
                    : <span className="muted small">{t('at.foremanOnly')}</span>}
                </div>
              ))}
              {state.corrections.length > 0 && (
                <div className="mt">
                  <div className="nav-label" style={{ padding: 0 }}>{t('at.corrLog')}</div>
                  <div className="log-list mt">
                    {state.corrections.slice(0, 5).map((c) => (
                      <div key={c.id}>{t('at.corrLine', {
                        by: L(PEOPLE.find((p) => p.id === c.by)?.name),
                        dir: c.dir === 'out' ? t('at.out') : t('at.in'),
                        t: timeHM(c.punchAt),
                        name: L(state.workers.find((w) => w.id === c.workerId)?.name),
                        note: c.note,
                      })}</div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>

          <Card title={t('at.board')} right={<span className="muted small">{t('at.boardSub')}</span>}>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>{t('at.worker')}</th><th>{t('at.dept')}</th><th>{t('at.in')}</th><th>{t('at.out')}</th><th>{t('common.status')}</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.worker.id}>
                      <td><b>{L(r.worker.name)}</b></td>
                      <td className="muted">{t(`dept.${r.worker.dept}`)}{r.worker.lineId ? ` — ${L(state.lines.find((l) => l.id === r.worker.lineId)?.name)}` : ''}</td>
                      <td>{r.firstIn ? <>{timeHM(r.firstIn.at)}{r.firstIn.source === 'manual' && <Pill tone="gray">{t('at.manual')}</Pill>}</> : '—'}</td>
                      <td>{r.lastOut ? timeHM(r.lastOut.at) : <span className="muted">{t('at.onSiteNow')}</span>}</td>
                      <td>
                        {r.status === 'present' && <Pill tone="green">{t('st.present')}</Pill>}
                        {r.status === 'late' && <Pill tone="amber">{t('at.lateMin', { n: fmt(r.lateMin, 0) })}</Pill>}
                        {r.status === 'absent' && <Pill tone="red">{t('st.absent')}</Pill>}
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
  const { t, L } = useLang()
  const month = monthKey(Date.now())
  const roll = attendanceMonth(state, month)
  return (
    <Card title={t('at.rollTitle', { m: monthLabel(month) })}
      right={<span className="muted small">{t('at.rollSub')}</span>}>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr><th>{t('at.worker')}</th><th>{t('at.dept')}</th><th className="num">{t('at.daysWorked')}</th><th className="num">{t('at.absences')}</th><th className="num">{t('at.timesLate')}</th><th className="num">{t('at.lateMinutes')}</th><th className="num">{t('at.hours')}</th></tr>
          </thead>
          <tbody>
            {roll.map((r) => (
              <tr key={r.worker.id}>
                <td><b>{L(r.worker.name)}</b></td>
                <td className="muted">{t(`dept.${r.worker.dept}`)}</td>
                <td className="num">{fmt(r.present + r.late, 0)}</td>
                <td className="num">{r.absent ? <Pill tone={r.absent > 2 ? 'red' : 'amber'}>{fmt(r.absent, 0)}</Pill> : fmt(0, 0)}</td>
                <td className="num">{fmt(r.late, 0)}</td>
                <td className="num">{fmt(r.lateMin, 0)}</td>
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
  const { t, L } = useLang()
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
      title={t('at.fixTitle', { name: L(item.worker.name) })}
      sub={t('at.fixSub', { d: dateFull(item.inPunch.at), t: timeHM(item.inPunch.at) })}
      onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={!note} onClick={save}>{t('at.saveCorr')}</button>
      </>}
    >
      <Field label={t('at.outTime')}><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
      <Field label={t('si.reasonReq')}><input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('at.fixPh')} /></Field>
    </Modal>
  )
}
