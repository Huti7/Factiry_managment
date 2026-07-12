// Renders a stored alert (kind + refId + params) into the viewer's language.
// Alerts store ids, not prose, so the feed re-translates when the user
// switches language.
import { fmt, money, pct } from './utils.js'

export function alertText(a, { state, t, L }) {
  const machine = (id) => L(state.machines.find((m) => m.id === id)?.name) || id || ''
  const line = (id) => L(state.lines.find((l) => l.id === id)?.name) || id || ''
  const silo = (id) => L(state.silos.find((s) => s.id === id)?.name) || id || ''
  const person = (id) => L(state.people?.find((p) => p.id === id)?.name) || id || ''
  const p = a.params || {}

  switch (true) {
    case a.kind === 'silo-low':
      return t('alert.siloLow', { name: silo(a.refId), level: fmt(p.level, 0), pct: fmt(p.pct, 0) })
    case a.kind === 'line-stopped':
      return t('alert.lineStopped', { line: line(a.refId), machine: machine(p.machineId) })
    case a.kind === 'yield-drop':
      return t('alert.yieldDrop', { line: line(a.refId), ex: fmt(p.ex, 1) })
    case a.kind === 'unexplained-stop': {
      const rep = state.stopReports.find((r) => r.id === a.refId)
      const mins = rep ? Math.max(1, Math.round((Date.now() - rep.stoppedAt) / 60000)) : p.mins || 0
      return t('alert.unexplained', { machine: machine(p.machineId), mins: fmt(mins, 0) })
    }
    case a.kind === 'payment-overdue': {
      const inv = state.invoices.find((i) => i.id === a.refId)
      if (!inv) return a.refId
      const days = Math.max(1, Math.floor((Date.now() - inv.dueTs) / 86400e3))
      return t('alert.overdue', { inv: inv.id, customer: L(inv.customer), days: fmt(days, 0), balance: money(inv.amount - inv.paid) })
    }
    case a.kind === 'lab-fail':
      return t('alert.labFail', { lot: a.refId })
    case a.kind === 'part-urgent': {
      const r = state.partRequests.find((x) => x.id === a.refId)
      return t('alert.partUrgent', { id: a.refId, part: r ? L(r.part) : '', machine: machine(r?.machineId), cost: money(r?.estCost || p.cost) })
    }
    case a.kind === 'understaffed': {
      const w = state.workers.find((x) => x.id === p.workerId)
      return t('alert.understaffed', { line: line(a.refId), name: L(w?.name) })
    }
    case a.kind === 'sensor-drift':
      return t('alert.sensorDrift', { name: silo(a.refId) })
    case a.kind.startsWith('flag-'):
      return t('alert.flag', { name: person(p.fromId), text: p.text })
    case a.kind.startsWith('notify-'): {
      if (p.tkey === 'notif.stopReason')
        return t('notif.stopReason', { machine: machine(p.machineId), cause: t(`cause.${p.cause}`), note: p.note ? ` — ${p.note}` : '' })
      if (p.tkey === 'notif.siloFix')
        return t('notif.siloFix', { name: silo(p.siloId), from: fmt(p.from, 0), to: fmt(p.to, 0), note: p.note || '—' })
      if (p.tkey === 'notif.newPart') {
        const r = state.partRequests.find((x) => x.id === p.prId)
        return t('notif.newPart', { id: p.prId, part: r ? L(r.part) : '', machine: machine(r?.machineId) })
      }
      return a.kind
    }
    default:
      return a.kind
  }
}
