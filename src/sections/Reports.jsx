import React, { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { useLang } from '../i18n.jsx'
import { Card, SectionHead, Tile, Seg } from '../components/ui.jsx'
import { attendanceMonth } from '../derive.js'
import { fmt, money, pct, monthKey, monthLabel, downloadCSV, dayKey } from '../utils.js'

export default function Reports() {
  const { state } = useStore()
  const { t, L } = useLang()
  const months = useMemo(() => {
    const s = new Set(state.productionDays.map((p) => p.date.slice(0, 7)))
    s.add(monthKey(Date.now()))
    return [...s].sort().reverse()
  }, [state.productionDays])
  const [month, setMonth] = useState(months[0])

  // production: stored daily history + live today
  const prodRows = state.productionDays.filter((p) => p.date.startsWith(month))
  const liveRows = dayKey(Date.now()).startsWith(month)
    ? state.lines.map((l) => ({ date: dayKey(Date.now()), lineId: l.id, tonnes: l.producedToday, wheatT: l.wheatToday, downtimeMin: 0, downtimeCause: 'live' }))
    : []
  const allProd = [...prodRows, ...liveRows]
  const totalT = allProd.reduce((a, p) => a + p.tonnes, 0)
  const totalWheat = allProd.reduce((a, p) => a + p.wheatT, 0)

  // downtime by cause (history + stop reports this month)
  const byCause = {}
  allProd.forEach((p) => { if (p.downtimeMin && p.downtimeCause && p.downtimeCause !== 'live') byCause[p.downtimeCause] = (byCause[p.downtimeCause] || 0) + p.downtimeMin })
  state.stopReports.forEach((r) => {
    if (!monthKey(r.stoppedAt).startsWith(month) || !r.cause) return
    const mins = Math.round(((r.resumedAt || Date.now()) - r.stoppedAt) / 60000)
    byCause[r.cause] = (byCause[r.cause] || 0) + mins
  })
  const totalDown = Object.values(byCause).reduce((a, b) => a + b, 0)

  const att = attendanceMonth(state, month)
  const acct = state.acctEntries.filter((e) => monthKey(e.at) === month)
  const income = acct.filter((e) => e.amount > 0).reduce((a, e) => a + e.amount, 0)
  const outgo = acct.filter((e) => e.amount < 0).reduce((a, e) => a + e.amount, 0)

  const lineName = (id) => L(state.lines.find((l) => l.id === id)?.name) || id
  const causeName = (c) => (c === 'live' ? t('rp.todayLive') : t(`cause.${c}`))
  const maxCause = Math.max(1, ...Object.values(byCause))
  const worstCause = Object.entries(byCause).sort((a, b) => b[1] - a[1])[0]

  const exports = [
    {
      label: t('rp.exProd'), file: `production-${month}.csv`,
      headers: [t('rp.dateCol'), t('rp.lineCol'), t('rp.flourT'), t('rp.wheatT'), t('rp.exCol'), t('rp.downCol'), t('rp.causeCol')],
      rows: allProd.map((p) => [p.date, lineName(p.lineId), p.tonnes.toFixed(1), p.wheatT.toFixed(1), p.wheatT ? ((p.tonnes / p.wheatT) * 100).toFixed(1) : '', p.downtimeMin, p.downtimeCause ? causeName(p.downtimeCause) : '']),
    },
    {
      label: t('rp.exAtt'), file: `attendance-${month}.csv`,
      headers: [t('at.worker'), t('at.dept'), t('at.daysWorked'), t('at.absences'), t('at.timesLate'), t('at.lateMinutes'), t('at.hours')],
      rows: att.map((r) => [L(r.worker.name), t(`dept.${r.worker.dept}`), r.present + r.late, r.absent, r.late, r.lateMin, Math.round(r.hours)]),
    },
    {
      label: t('rp.exAcct'), file: `accounting-${month}.csv`,
      headers: [t('ac.date'), t('ac.type'), t('ac.desc'), t('ac.amount'), t('ac.source'), t('rp.edits')],
      rows: acct.map((e) => [dayKey(e.at), t(`kind.${e.kind}`), L(e.desc), e.amount, e.source === 'imported' ? t('ac.imported') : t('ac.manualTag'), e.edits.length]),
    },
    {
      label: t('rp.byCause'), file: `downtime-${month}.csv`,
      headers: [t('rp.causeCol'), t('rp.minutes')],
      rows: Object.entries(byCause).map(([c, m]) => [causeName(c), m]),
    },
  ]

  return (
    <div className="stack">
      <SectionHead title={t('nav.reports')} sub={t('rp.sub')}>
        <Seg value={month} onChange={setMonth} options={months.slice(0, 3).map((m) => ({ value: m, label: monthLabel(m) }))} />
      </SectionHead>

      <div className="grid cols-4">
        <Tile label={t('rp.flour')} value={fmt(totalT, 0)} unit={t('u.t')}
          refText={t('rp.fromWheat', { w: fmt(totalWheat, 0), e: totalWheat ? pct((totalT / totalWheat) * 100, 1) : '—' })} tone="tile-good" />
        <Tile label={t('rp.downtime')} value={fmt(totalDown, 0)} unit={t('u.min')}
          refText={worstCause ? t('rp.worst', { c: causeName(worstCause[0]) }) : t('rp.noDown')}
          tone={totalDown > 300 ? 'tile-warn' : ''} />
        <Tile label={t('rp.income')} value={money(income)} refText={t('rp.entries', { n: fmt(acct.filter((e) => e.amount > 0).length, 0) })} tone="tile-good" />
        <Tile label={t('rp.net')} value={money(income + outgo)} refText={t('rp.spending', { v: money(-outgo) })} tone={income + outgo >= 0 ? 'tile-good' : 'tile-crit'} />
      </div>

      <Card title={t('rp.byCause')} right={<span className="muted small">{t('rp.minsMonth')}</span>}>
        {Object.keys(byCause).length === 0 && <div className="muted small">{t('rp.noDownMonth')}</div>}
        <div className="stack" style={{ gap: 8 }}>
          {Object.entries(byCause).sort((a, b) => b[1] - a[1]).map(([cause, mins]) => (
            <div key={cause} className="row" style={{ flexWrap: 'nowrap' }}>
              <span style={{ flex: '0 0 130px' }} className="small"><b>{causeName(cause)}</b></span>
              <div className="progress" style={{ flex: 1, marginTop: 0 }}>
                <i className={cause === 'breakdown' ? 'crit' : ''} style={{ width: `${(mins / maxCause) * 100}%` }} />
              </div>
              <span className="small num" style={{ flex: '0 0 90px', textAlign: 'end' }}>{fmt(mins, 0)} {t('u.min')}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title={t('rp.exports')} right={<span className="muted small">{t('rp.csvNote')}</span>}>
        <div className="row">
          {exports.map((ex) => (
            <button key={ex.file} className="btn" onClick={() => downloadCSV(ex.file, ex.headers, ex.rows)}>
              ⬇ {ex.label} <span className="muted small">{t('rp.rows', { n: fmt(ex.rows.length, 0) })}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card title={t('rp.prodByDay', { m: monthLabel(month) })}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>{t('rp.dateCol')}</th><th>{t('rp.lineCol')}</th><th className="num">{t('rp.flourT')}</th><th className="num">{t('rp.wheatT')}</th><th className="num">{t('rp.exCol')}</th><th className="num">{t('rp.downCol')}</th><th>{t('rp.causeCol')}</th></tr></thead>
            <tbody>
              {[...allProd].reverse().slice(0, 40).map((p, i) => (
                <tr key={i}>
                  <td><span className="ltr-nums">{p.date}</span></td>
                  <td>{lineName(p.lineId)}</td>
                  <td className="num">{fmt(p.tonnes, 1)}</td>
                  <td className="num">{fmt(p.wheatT, 1)}</td>
                  <td className="num">{p.wheatT ? pct((p.tonnes / p.wheatT) * 100, 1) : '—'}</td>
                  <td className="num">{p.downtimeMin ? `${fmt(p.downtimeMin, 0)} ${t('u.min')}` : '—'}</td>
                  <td className="muted">{p.downtimeCause ? causeName(p.downtimeCause) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
