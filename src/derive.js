// Pure derivations over store state — the "interpretation" layer that turns raw
// punches / sensor records into what a manager wants to read.
import { dayKey } from './utils.js'

const LATE_GRACE_MIN = 10

/** Interpret today's gate punches into present / late / absent per worker. */
export function attendanceToday(state, now = Date.now()) {
  const today = dayKey(now)
  const rows = state.workers.map((w) => {
    const punchesToday = state.punches
      .filter((p) => p.workerId === w.id && dayKey(p.at) === today)
      .sort((a, b) => a.at - b.at)
    const firstIn = punchesToday.find((p) => p.dir === 'in')
    const lastOut = [...punchesToday].reverse().find((p) => p.dir === 'out')
    const shiftStart = new Date(now); shiftStart.setHours(w.shiftStartH, 0, 0, 0)
    let status = 'absent', lateMin = 0
    if (firstIn) {
      lateMin = Math.max(0, Math.round((firstIn.at - shiftStart.getTime()) / 60000))
      status = lateMin > LATE_GRACE_MIN ? 'late' : 'present'
    }
    return { worker: w, status, lateMin, firstIn, lastOut, punchesToday }
  })
  return rows
}

/** Missing punch-outs: an 'in' on a previous day with no 'out' after it. */
export function missingPunchOuts(state, now = Date.now()) {
  const today = dayKey(now)
  const out = []
  for (const w of state.workers) {
    const byDay = {}
    for (const p of state.punches.filter((p) => p.workerId === w.id)) {
      const k = dayKey(p.at)
      if (k === today) continue
      ;(byDay[k] = byDay[k] || []).push(p)
    }
    for (const [day, ps] of Object.entries(byDay)) {
      const hasIn = ps.some((p) => p.dir === 'in')
      const hasOut = ps.some((p) => p.dir === 'out')
      if (hasIn && !hasOut) out.push({ worker: w, day, inPunch: ps.find((p) => p.dir === 'in') })
    }
  }
  return out
}

/** Staffing per line/department vs required headcount. */
export function staffing(state, now = Date.now()) {
  const rows = attendanceToday(state, now)
  const groups = []
  for (const line of state.lines) {
    const staff = rows.filter((r) => r.worker.lineId === line.id)
    const present = staff.filter((r) => r.status !== 'absent').length
    groups.push({ key: line.id, name: line.name, required: line.requiredStaff, present, absent: staff.filter((r) => r.status === 'absent'), late: staff.filter((r) => r.status === 'late') })
  }
  for (const [dept, required] of Object.entries(state.deptRequired)) {
    const staff = rows.filter((r) => !r.worker.lineId && r.worker.dept === dept)
    groups.push({ key: dept, name: dept, required, present: staff.filter((r) => r.status !== 'absent').length, absent: staff.filter((r) => r.status === 'absent'), late: staff.filter((r) => r.status === 'late') })
  }
  return groups
}

/** Monthly attendance rollup per worker (history + live today). */
export function attendanceMonth(state, month /* 'YYYY-MM' */, now = Date.now()) {
  const rows = {}
  const ensure = (id) => (rows[id] = rows[id] || { present: 0, late: 0, absent: 0, lateMin: 0, hours: 0 })
  for (const d of state.attendanceDays) {
    if (!d.date.startsWith(month)) continue
    const r = ensure(d.workerId)
    r[d.status === 'late' ? 'late' : d.status === 'absent' ? 'absent' : 'present'] += 1
    if (d.status === 'late') r.present += 0 // late still counts as a worked day below
    r.lateMin += d.lateMin
    r.hours += d.hours
  }
  if (dayKey(now).startsWith(month)) {
    for (const t of attendanceToday(state, now)) {
      const r = ensure(t.worker.id)
      if (t.status === 'absent') r.absent += 1
      else if (t.status === 'late') { r.late += 1; r.lateMin += t.lateMin; r.hours += 8 }
      else { r.present += 1; r.hours += 9 }
    }
  }
  return state.workers.map((w) => ({ worker: w, ...(rows[w.id] || { present: 0, late: 0, absent: 0, lateMin: 0, hours: 0 }) }))
}

export function stockSummary(state) {
  const flourStock = state.silos.filter((s) => s.kind === 'flour').reduce((a, s) => a + s.levelT, 0)
  const branStock = state.silos.filter((s) => s.kind === 'bran').reduce((a, s) => a + s.levelT, 0)
  const wheatStock = state.silos.filter((s) => s.kind === 'wheat').reduce((a, s) => a + s.levelT, 0)
  const pendingT = state.orders.reduce((a, o) => a + Math.max(0, o.qtyT - o.dispatchedT), 0)
  const shippedT = state.orders.reduce((a, o) => a + o.dispatchedT, 0)
  const producedToday = state.lines.reduce((a, l) => a + l.producedToday, 0)
  const wheatUseTph = state.lines.reduce((a, l) => a + (l.status === 'running' ? l.wheatInTph : 0), 0)
  return { flourStock, branStock, wheatStock, pendingT, shippedT, producedToday, wheatUseTph, wheatDays: wheatUseTph > 0 ? wheatStock / (wheatUseTph * 20) : null }
}

export function receivables(state, now = Date.now()) {
  return state.invoices
    .map((inv) => ({ ...inv, balance: inv.amount - inv.paid, overdueDays: inv.dueTs < now && inv.amount - inv.paid > 0 ? Math.floor((now - inv.dueTs) / 86400e3) : 0 }))
    .filter((inv) => inv.balance > 0)
    .sort((a, b) => b.overdueDays - a.overdueDays)
}

/** Can person a talk to person b? Owner talks to everyone; spokes need a link. */
export function canTalk(state, a, b, now = Date.now()) {
  if (a === b) return false
  if (a === 'p-owner' || b === 'p-owner') return true
  return state.links.some((l) =>
    ((l.a === a && l.b === b) || (l.a === b && l.b === a)) &&
    (!l.expiresAt || l.expiresAt > now)
  )
}
