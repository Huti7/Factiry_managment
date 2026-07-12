// SCADA / gate-machine simulator. The app only READS plant state — this module
// stands in for the control room and the sensors. Runs a tick every 2 seconds
// and mutates a cloned state draft (the reducer owns immutability).
// Alerts are stored as {kind, refId, params} and rendered into the viewer's
// language by alertText.js, so the feed follows the language switch.
import { uid, clamp, dayKey } from './utils.js'
import { CAUSES } from './data/seed.js'

export const TICK_MS = 2000
const UNEXPLAINED_AFTER_MS = 3 * 60 * 1000 // stop with no reason for 3 min → alert

export function addAlert(draft, { severity, kind, section, refId, params = {} }, now = Date.now()) {
  const dup = draft.alerts.find((a) => !a.acked && a.kind === kind && a.refId === refId)
  if (dup) { dup.params = params; return dup }
  const alert = { id: uid('al'), at: now, severity, kind, section, refId, params, acked: false }
  draft.alerts.unshift(alert)
  if (draft.alerts.length > 200) draft.alerts.length = 200
  return alert
}

export function stopLine(draft, lineId, machineId, now, source = 'control-room') {
  const line = draft.lines.find((l) => l.id === lineId)
  if (!line || line.status === 'stopped') return null
  line.status = 'stopped'
  line.rateTph = 0
  line.wheatInTph = 0
  const report = {
    id: uid('sr'), machineId, lineId, stoppedAt: now, source,
    status: 'awaiting-reason', cause: null, note: '', reportedAt: null, reportedBy: null,
    partRequestId: null, resumedAt: null, escalated: false,
  }
  draft.stopReports.unshift(report)
  addAlert(draft, { severity: 'warning', kind: 'line-stopped', refId: lineId, section: 'production', params: { machineId } }, now)
  return report
}

function siloAlerts(draft, now) {
  for (const s of draft.silos) {
    const pctLevel = (s.levelT / s.capacityT) * 100
    if (pctLevel < s.lowPct) {
      addAlert(draft, {
        severity: pctLevel < s.lowPct / 2 ? 'critical' : 'warning',
        kind: 'silo-low', refId: s.id, section: 'silos',
        params: { level: Math.round(s.levelT), pct: Math.round(pctLevel) },
      }, now)
    }
  }
}

export function simTick(draft, now = Date.now()) {
  const dtH = TICK_MS / 3600e3
  const today = dayKey(now)

  // roll the production day over at midnight
  if (draft.liveDay && draft.liveDay !== today) {
    for (const ln of draft.lines) {
      draft.productionDays.push({
        date: draft.liveDay, lineId: ln.id, tonnes: Math.round(ln.producedToday * 10) / 10,
        wheatT: Math.round(ln.wheatToday * 10) / 10, downtimeMin: 0, downtimeCause: '',
      })
      ln.producedToday = 0
      ln.wheatToday = 0
    }
  }
  draft.liveDay = today

  for (const ln of draft.lines) {
    if (ln.status === 'running') {
      // rate wanders around nominal; extraction wanders around ~74%
      const drift = (Math.random() - 0.5) * 0.35
      ln.rateTph = clamp(ln.rateTph + drift, ln.nominalTph * 0.72, ln.nominalTph * 1.08)
      const extraction = clamp((ln.rateTph / (ln.wheatInTph || 1)) + (Math.random() - 0.5) * 0.01, 0.6, 0.82)
      ln.wheatInTph = ln.rateTph / extraction
      ln.producedToday += ln.rateTph * dtH
      ln.wheatToday += ln.wheatInTph * dtH

      // material movement: wheat out of fullest wheat silo, flour + bran into bins
      const wheatUsed = ln.wheatInTph * dtH
      const src = draft.silos.filter((s) => s.kind === 'wheat').sort((a, b) => b.levelT - a.levelT)[0]
      if (src) src.levelT = Math.max(0, src.levelT - wheatUsed)
      const flourBin = draft.silos.find((s) => s.id === (ln.id === 'L1' ? 'S-F1' : 'S-F2'))
      if (flourBin) flourBin.levelT = Math.min(flourBin.capacityT, flourBin.levelT + ln.rateTph * dtH)
      const branBin = draft.silos.find((s) => s.kind === 'bran')
      if (branBin) branBin.levelT = Math.min(branBin.capacityT, branBin.levelT + wheatUsed * 0.26)

      if (extraction < 0.68) {
        addAlert(draft, {
          severity: 'warning', kind: 'yield-drop', refId: ln.id, section: 'production',
          params: { ex: Math.round(extraction * 1000) / 10 },
        }, now)
      }
    }

    // live sparkline buffer (~4 min of samples)
    const buf = draft.liveHistory[ln.id] || (draft.liveHistory[ln.id] = [])
    buf.push({ t: now, rate: Math.round(ln.rateTph * 100) / 100, extraction: ln.wheatInTph ? Math.round((ln.rateTph / ln.wheatInTph) * 1000) / 10 : 0 })
    if (buf.length > 120) buf.splice(0, buf.length - 120)
  }

  // unexplained stop escalation
  for (const r of draft.stopReports) {
    if (r.status === 'awaiting-reason' && !r.escalated && now - r.stoppedAt > UNEXPLAINED_AFTER_MS) {
      r.escalated = true
      addAlert(draft, {
        severity: 'critical', kind: 'unexplained-stop', refId: r.id, section: 'production',
        params: { machineId: r.machineId },
      }, now)
    }
  }

  // rare random control-room stop (~ once per 12 min on average)
  if (Math.random() < TICK_MS / (12 * 60 * 1000)) {
    const running = draft.lines.filter((l) => l.status === 'running')
    if (running.length) {
      const ln = running[Math.floor(Math.random() * running.length)]
      const ms = draft.machines.filter((m) => m.lineId === ln.id)
      stopLine(draft, ln.id, ms[Math.floor(Math.random() * ms.length)].id, now)
    }
  }

  siloAlerts(draft, now)

  // overdue invoices
  for (const inv of draft.invoices) {
    const balance = inv.amount - inv.paid
    if (balance > 0 && inv.dueTs < now) {
      const days = Math.floor((now - inv.dueTs) / 86400e3)
      addAlert(draft, {
        severity: days > 5 ? 'critical' : 'warning', kind: 'payment-overdue', refId: inv.id, section: 'accounting',
        params: {},
      }, now)
    }
  }

  return draft
}

// Demo triggers so a reviewer can fire every alert path on demand.
export function demoEvent(draft, name, now = Date.now()) {
  switch (name) {
    case 'line-stop': {
      const running = draft.lines.filter((l) => l.status === 'running')
      const ln = running[0] || draft.lines[0]
      const ms = draft.machines.filter((m) => m.lineId === ln.id)
      stopLine(draft, ln.id, ms[Math.floor(Math.random() * ms.length)].id, now)
      break
    }
    case 'silo-drain': {
      const s = draft.silos.find((x) => x.kind === 'wheat')
      s.levelT = s.capacityT * (s.lowPct / 100) * 0.6
      siloAlerts(draft, now)
      break
    }
    case 'yield-dip': {
      const ln = draft.lines.find((l) => l.status === 'running') || draft.lines[0]
      ln.rateTph = ln.nominalTph * 0.74
      ln.wheatInTph = ln.rateTph / 0.655
      addAlert(draft, {
        severity: 'warning', kind: 'yield-drop', refId: ln.id, section: 'production',
        params: { ex: 65.5 },
      }, now)
      break
    }
    default:
      break
  }
  return draft
}

export { CAUSES, UNEXPLAINED_AFTER_MS }
