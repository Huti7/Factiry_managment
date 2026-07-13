import React, { useState } from 'react'
import { useStore } from '../store.jsx'
import { useLang } from '../i18n.jsx'
import { Card, SectionHead, Tile, Seg } from '../components/ui.jsx'
import { receivables } from '../derive.js'
import { fmt, money, pct, dayKey, monthKey, dateFull, timeHM } from '../utils.js'

const DAY = 86400e3

// Collect everything the briefing needs for a period. Pure — reads state only.
function buildSummary(state, period, now = Date.now()) {
  const from = period === 'daily' ? new Date(new Date(now).setHours(0, 0, 0, 0)).getTime()
    : period === 'weekly' ? now - 7 * DAY
      : new Date(new Date(now).setDate(1)).setHours(0, 0, 0, 0)
  const inRange = (ts) => ts >= from && ts <= now
  const dayFrom = dayKey(from)

  // production: stored days + live today
  const prodRows = state.productionDays.filter((p) => p.date >= dayFrom)
  const liveT = state.lines.reduce((a, l) => a + l.producedToday, 0)
  const liveW = state.lines.reduce((a, l) => a + l.wheatToday, 0)
  const flourT = prodRows.reduce((a, p) => a + p.tonnes, 0) + liveT
  const wheatT = prodRows.reduce((a, p) => a + p.wheatT, 0) + liveW
  const dayCount = new Set([...prodRows.map((p) => p.date), dayKey(now)]).size
  const targetT = state.lines.reduce((a, l) => a + l.targetTpd, 0) * dayCount

  // downtime
  const byCause = {}
  prodRows.forEach((p) => { if (p.downtimeMin && p.downtimeCause) byCause[p.downtimeCause] = (byCause[p.downtimeCause] || 0) + p.downtimeMin })
  state.stopReports.forEach((r) => {
    if (!inRange(r.stoppedAt) || !r.cause) return
    byCause[r.cause] = (byCause[r.cause] || 0) + Math.round(((r.resumedAt || now) - r.stoppedAt) / 60000)
  })
  const downMin = Object.values(byCause).reduce((a, b) => a + b, 0)

  // intake
  const intakes = state.intakes.filter((i) => inRange(i.at))
  const intakeT = intakes.reduce((a, i) => a + i.netT, 0)
  const avgMoist = intakes.length ? intakes.reduce((a, i) => a + i.moisturePct, 0) / intakes.length : null

  // attendance (history days in range + today's live interpretation)
  const attDays = state.attendanceDays.filter((d) => d.date >= dayFrom)
  let absences = attDays.filter((d) => d.status === 'absent').length
  let lates = attDays.filter((d) => d.status === 'late').length
  const today = dayKey(now)
  for (const w of state.workers) {
    const punchesToday = state.punches.filter((p) => p.workerId === w.id && dayKey(p.at) === today)
    const firstIn = punchesToday.filter((p) => p.dir === 'in').sort((a, b) => a.at - b.at)[0]
    if (!firstIn) absences += 1
    else {
      const sh = new Date(now); sh.setHours(w.shiftStartH, 0, 0, 0)
      if ((firstIn.at - sh.getTime()) / 60000 > 10) lates += 1
    }
  }

  // dispatch & finance
  const ships = state.dispatches.filter((d) => inRange(d.at))
  const shippedT = ships.reduce((a, d) => a + d.qtyT, 0)
  const acct = state.acctEntries.filter((e) => inRange(e.at))
  const income = acct.filter((e) => e.amount > 0).reduce((a, e) => a + e.amount, 0)
  const outgo = acct.filter((e) => e.amount < 0).reduce((a, e) => a + e.amount, 0)
  const recv = receivables(state, now)
  const overdue = recv.filter((r) => r.overdueDays > 0)

  // parts & alerts
  const submitted = state.partRequests.filter((r) => inRange(r.at)).length
  const acted = (act) => state.partRequests.reduce((a, r) => a + r.history.filter((h) => h.action === act && inRange(h.at)).length, 0)
  const pendingNow = state.partRequests.filter((r) => r.status === 'pending').length
  const alerts = state.alerts.filter((a) => inRange(a.at))

  return {
    from, now, flourT, wheatT, targetT,
    extraction: wheatT ? (flourT / wheatT) * 100 : null,
    byCause, downMin,
    trucks: intakes.length, intakeT, avgMoist,
    absences, lates,
    shipments: ships.length, shippedT,
    income, outgo, net: income + outgo,
    recvTotal: recv.reduce((a, r) => a + r.balance, 0),
    overdueN: overdue.length, overdueSum: overdue.reduce((a, r) => a + r.balance, 0),
    partsSubmitted: submitted, partsApproved: acted('approved'), partsBought: acted('purchased'), partsPending: pendingNow,
    critN: alerts.filter((a) => a.severity === 'critical').length,
    warnN: alerts.filter((a) => a.severity === 'warning').length,
  }
}

export default function Summary() {
  const { state } = useStore()
  const { t, dir } = useLang()
  const [period, setPeriod] = useState('daily')

  const s = buildSummary(state, period)
  const periodLabel = t(period === 'daily' ? 'sm.pToday' : period === 'weekly' ? 'sm.pWeek' : 'sm.pMonth')

  const rows = [
    [t('sm.prodSec'), [
      [t('sm.flourT'), `${fmt(s.flourT, 0)} ${t('u.t')}`, t('sm.vsTarget', { t: fmt(s.targetT, 0), p: pct((s.flourT / (s.targetT || 1)) * 100, 0) })],
      [t('pr.extraction'), s.extraction ? pct(s.extraction, 1) : '—', t('pr.target74')],
      [t('rp.downtime'), s.downMin ? t('sm.downMin', { m: fmt(s.downMin, 0) }) : t('sm.noDown'),
        Object.entries(s.byCause).sort((a, b) => b[1] - a[1]).map(([c, m]) => `${t(`cause.${c}`)}: ${fmt(m, 0)}`).join(' · ')],
    ]],
    [t('sm.intakeSec'), [
      [t('in.today'), `${fmt(s.intakeT, 0)} ${t('u.t')}`, t('sm.trucks', { n: fmt(s.trucks, 0), v: fmt(s.intakeT, 0) })],
      [t('in.avgMoisture'), s.avgMoist ? pct(s.avgMoist, 1) : '—', ''],
    ]],
    [t('sm.attSec'), [
      [t('at.absences'), fmt(s.absences, 0), t('sm.absences', { a: fmt(s.absences, 0), l: fmt(s.lates, 0) })],
    ]],
    [t('sm.finSec'), [
      [t('sm.dispatched'), `${fmt(s.shippedT, 0)} ${t('u.t')}`, t('sm.shipments', { n: fmt(s.shipments, 0) })],
      [t('sm.net'), money(s.net), t('sm.inOut', { i: money(s.income), o: money(-s.outgo) })],
      [t('sm.recvNow'), money(s.recvTotal), t('sm.overdueNow', { n: fmt(s.overdueN, 0), v: money(s.overdueSum) })],
    ]],
    [t('sm.partsSec'), [
      [t('pt.reqTitle'), fmt(s.partsSubmitted, 0), t('sm.partsLine', { s: fmt(s.partsSubmitted, 0), a: fmt(s.partsApproved, 0), b: fmt(s.partsBought, 0), p: fmt(s.partsPending, 0) })],
    ]],
    [t('sm.alertsSec'), [
      [t('alerts.label'), fmt(s.critN + s.warnN, 0), t('sm.alertsLine', { c: fmt(s.critN, 0), w: fmt(s.warnN, 0) })],
    ]],
  ]

  const download = () => {
    const style = `body{font-family:Vazirmatn,Tahoma,'Segoe UI',sans-serif;max-width:720px;margin:24px auto;padding:0 16px;color:#14201a}
h1{font-size:20px;color:#0d5f2f}h2{font-size:14px;border-bottom:2px solid #d7f0e0;padding-bottom:4px;margin:22px 0 8px;color:#0e7a3d}
table{width:100%;border-collapse:collapse;font-size:13px}td{padding:6px 8px;border-bottom:1px solid #eef2ef;vertical-align:top}
td.v{font-weight:700;white-space:nowrap}td.k{color:#4b5a51;white-space:nowrap}td.n{color:#7d8a82;font-size:12px}
.meta{color:#7d8a82;font-size:12px;margin-bottom:4px}`
    const section = ([title, items]) => `<h2>${title}</h2><table>${items.map(([k, v, note]) =>
      `<tr><td class="k">${k}</td><td class="v">${v}</td><td class="n">${note || ''}</td></tr>`).join('')}</table>`
    const html = `<!doctype html><html lang="${dir === 'rtl' ? 'fa' : 'en'}" dir="${dir}"><head><meta charset="utf-8">
<title>${t('nav.summary')} — ${t('app.name')}</title><style>${style}</style></head><body>
<h1>🌾 ${t('app.name')} — ${t('nav.summary')}</h1>
<div class="meta">${t('sm.for', { p: periodLabel })} · ${dateFull(s.from)} ← ${dateFull(s.now)}</div>
<div class="meta">${t('sm.genAt', { d: dateFull(s.now), t: timeHM(s.now) })}</div>
${rows.map(section).join('')}
</body></html>`
    const blob = new Blob(['﻿' + html], { type: 'text/html;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `summary-${period}-${dayKey(Date.now())}.html`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="stack">
      <SectionHead title={t('nav.summary')} sub={t('sm.sub')}>
        <Seg value={period} onChange={setPeriod} options={[
          { value: 'daily', label: t('sm.daily') },
          { value: 'weekly', label: t('sm.weekly') },
          { value: 'monthly', label: t('sm.monthly') },
        ]} />
        <button className="btn primary" onClick={download}>{t('sm.download')}</button>
      </SectionHead>

      <div className="grid cols-4">
        <Tile label={t('sm.flourT')} value={fmt(s.flourT, 0)} unit={t('u.t')}
          refText={t('sm.vsTarget', { t: fmt(s.targetT, 0), p: pct((s.flourT / (s.targetT || 1)) * 100, 0) })}
          tone={s.flourT / (s.targetT || 1) >= 0.85 ? 'tile-good' : 'tile-warn'}
          progress={(s.flourT / (s.targetT || 1)) * 100} />
        <Tile label={t('pr.extraction')} value={s.extraction ? fmt(s.extraction, 1) : '—'} unit={t('u.pct')}
          refText={t('pr.target74')} tone={s.extraction >= 72 ? 'tile-good' : 'tile-warn'} />
        <Tile label={t('rp.downtime')} value={fmt(s.downMin, 0)} unit={t('u.min')}
          refText={Object.keys(s.byCause).length ? Object.entries(s.byCause).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([c, m]) => `${t(`cause.${c}`)}: ${fmt(m, 0)}`).join(' · ') : t('sm.noDown')}
          tone={s.downMin > 120 ? 'tile-warn' : 'tile-good'} />
        <Tile label={t('sm.net')} value={money(s.net)}
          refText={t('sm.inOut', { i: money(s.income), o: money(-s.outgo) })}
          tone={s.net >= 0 ? 'tile-good' : 'tile-crit'} />
      </div>

      {rows.map(([title, items]) => (
        <Card key={title} title={title}>
          <div className="tbl-wrap">
            <table className="tbl">
              <tbody>
                {items.map(([k, v, note], i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: 'nowrap' }} className="muted">{k}</td>
                    <td style={{ whiteSpace: 'nowrap' }}><b>{v}</b></td>
                    <td className="muted small">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  )
}
