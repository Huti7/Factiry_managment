import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react'
import { makeSeed, PEOPLE } from './data/seed.js'
import { simTick, demoEvent, addAlert, stopLine, TICK_MS } from './sim.js'
import { uid, dayKey, clamp } from './utils.js'

const LS_KEY = 'flourmill-state-v1'

// ── permissions ─────────────────────────────────────────────────────────────
const ROLE_CAPS = {
  owner: ['ack-alerts', 'approve-parts', 'grant-links', 'send-order', 'export-reports', 'add-order', 'record-payment', 'view-all'],
  foreman: ['silo-override', 'add-intake', 'correct-attendance', 'create-part-request', 'stop-reason', 'add-dispatch', 'raise-flag'],
  lab: ['add-lab', 'raise-flag'],
  accountant: ['add-acct', 'edit-acct', 'record-payment', 'add-order', 'add-dispatch', 'export-reports', 'raise-flag'],
}

export const NAV_BY_ROLE = {
  owner: ['overview', 'production', 'silos', 'intake', 'lab', 'attendance', 'orders', 'accounting', 'parts', 'traceability', 'comms', 'reports'],
  foreman: ['overview', 'production', 'silos', 'intake', 'attendance', 'parts', 'traceability', 'comms'],
  lab: ['overview', 'production', 'lab', 'traceability', 'comms'],
  accountant: ['overview', 'orders', 'accounting', 'comms', 'reports'],
}

export function can(user, cap) {
  return ROLE_CAPS[user.role]?.includes(cap) || false
}

// ── reducer ─────────────────────────────────────────────────────────────────
function withDraft(state, fn) {
  const draft = structuredClone(state)
  fn(draft)
  return draft
}

function notifyOwner(draft, text, section, refId, severity = 'info') {
  addAlert(draft, { severity, kind: `notify-${uid('n')}`, text, section, refId })
}

function ensureThread(draft, a, b) {
  let th = draft.threads.find((t) => t.participants.includes(a) && t.participants.includes(b))
  if (!th) {
    th = { id: uid('th'), participants: [a, b], messages: [] }
    draft.threads.push(th)
  }
  return th
}

function reducer(state, action) {
  const now = Date.now()
  switch (action.type) {
    case 'TICK':
      return withDraft(state, (d) => simTick(d, now))

    case 'DEMO_EVENT':
      return withDraft(state, (d) => demoEvent(d, action.name, now))

    case 'SET_USER':
      return { ...state, currentUserId: action.userId }

    case 'ACK_ALERT':
      return withDraft(state, (d) => {
        const a = d.alerts.find((x) => x.id === action.id)
        if (a) { a.acked = true; a.ackedBy = action.by; a.ackedAt = now }
      })

    case 'ACK_ALL_ALERTS':
      return withDraft(state, (d) => {
        d.alerts.forEach((a) => { if (!a.acked) { a.acked = true; a.ackedBy = action.by; a.ackedAt = now } })
      })

    // ── production / stops ──────────────────────────────────────────────
    case 'SUBMIT_STOP_REASON':
      return withDraft(state, (d) => {
        const r = d.stopReports.find((x) => x.id === action.id)
        if (!r) return
        r.cause = action.cause
        r.note = action.note
        r.reportedAt = now
        r.reportedBy = action.by
        r.status = 'explained'
        if (action.partRequestId) r.partRequestId = action.partRequestId
        // clear the pending-reason / unexplained alerts for this stop
        d.alerts.forEach((a) => {
          if ((a.kind === 'unexplained-stop' && a.refId === r.id)) { a.acked = true; a.ackedBy = action.by; a.ackedAt = now }
        })
        const m = d.machines.find((x) => x.id === r.machineId)
        notifyOwner(d, `Stop reason for ${m?.name}: ${action.cause}${action.note ? ` — ${action.note}` : ''}`, 'production', r.id)
      })

    case 'RESUME_LINE':
      return withDraft(state, (d) => {
        const r = d.stopReports.find((x) => x.id === action.stopReportId)
        const line = d.lines.find((l) => l.id === (r ? r.lineId : action.lineId))
        if (line) {
          line.status = 'running'
          line.rateTph = line.nominalTph * 0.9
          line.wheatInTph = line.rateTph / 0.74
        }
        if (r) { r.status = 'resolved'; r.resumedAt = now }
        d.alerts.forEach((a) => {
          if (a.kind === 'line-stopped' && a.refId === line?.id) { a.acked = true; a.ackedBy = action.by; a.ackedAt = now }
        })
      })

    // ── silos ───────────────────────────────────────────────────────────
    case 'SILO_OVERRIDE':
      return withDraft(state, (d) => {
        const s = d.silos.find((x) => x.id === action.siloId)
        if (!s) return
        const from = s.levelT
        s.levelT = clamp(action.levelT, 0, s.capacityT)
        s.sensorOk = true
        d.siloOverrides.unshift({ id: uid('ov'), siloId: s.id, at: now, by: action.by, from: Math.round(from * 10) / 10, to: s.levelT, note: action.note })
        d.alerts.forEach((a) => {
          if (a.kind === 'sensor-drift' && a.refId === s.id) { a.acked = true; a.ackedBy = action.by; a.ackedAt = now }
        })
        notifyOwner(d, `${s.name} level corrected by foreman: ${Math.round(from)} t → ${Math.round(s.levelT)} t (${action.note || 'no note'})`, 'silos', s.id)
      })

    // ── intake ──────────────────────────────────────────────────────────
    case 'ADD_INTAKE':
      return withDraft(state, (d) => {
        const seq = d.intakes.length + 41
        d.intakes.unshift({
          id: uid('in'), lotNo: `WL-${String(seq).padStart(4, '0')}`, at: now,
          truckPlate: action.truckPlate, supplier: action.supplier, netT: Number(action.netT),
          moisturePct: Number(action.moisturePct), siloId: action.siloId, by: action.by,
        })
        const s = d.silos.find((x) => x.id === action.siloId)
        if (s) s.levelT = Math.min(s.capacityT, s.levelT + Number(action.netT))
        // attach the new wheat lot to today's open flour lots on both lines
        d.flourLots.filter((l) => l.open).forEach((l) => l.wheatLots.push(`WL-${String(seq).padStart(4, '0')}`))
      })

    // ── lab ─────────────────────────────────────────────────────────────
    case 'ADD_LAB_TEST':
      return withDraft(state, (d) => {
        d.labTests.unshift({ id: uid('lt'), at: now, by: action.by, ...action.test })
        if (action.test.result === 'fail') {
          addAlert(d, {
            severity: 'critical', kind: 'lab-fail', refId: action.test.lotId, section: 'lab',
            text: `Lab FAIL on lot ${action.test.lotId} — hold dispatch pending owner decision`,
          })
        }
      })

    // ── attendance ──────────────────────────────────────────────────────
    case 'CORRECT_PUNCH':
      return withDraft(state, (d) => {
        d.punches.push({ id: uid('pn'), workerId: action.workerId, at: action.at, dir: action.dir, source: 'manual', by: action.by, note: action.note })
        d.corrections.unshift({ id: uid('cr'), at: now, by: action.by, workerId: action.workerId, dir: action.dir, punchAt: action.at, note: action.note })
      })

    // ── orders / dispatch ───────────────────────────────────────────────
    case 'ADD_ORDER':
      return withDraft(state, (d) => {
        d.orders.unshift({
          id: `ORD-${2200 + d.orders.length + 1}`, customer: action.customer, product: action.product,
          qtyT: Number(action.qtyT), unitPrice: Number(action.unitPrice), dueTs: action.dueTs, dispatchedT: 0,
        })
      })

    case 'ADD_DISPATCH':
      return withDraft(state, (d) => {
        const o = d.orders.find((x) => x.id === action.orderId)
        if (!o) return
        const qty = Math.min(Number(action.qtyT), o.qtyT - o.dispatchedT)
        o.dispatchedT += qty
        d.dispatches.unshift({ id: uid('dp'), orderId: o.id, lotId: action.lotId || null, qtyT: qty, at: now, truck: action.truck })
        const fl = d.flourLots.find((l) => l.id === action.lotId)
        const bin = o.product.includes('Bran') ? d.silos.find((s) => s.kind === 'bran')
          : fl ? d.silos.find((s) => s.id === (fl.lineId === 'L1' ? 'S-F1' : 'S-F2')) : null
        if (bin) bin.levelT = Math.max(0, bin.levelT - qty)
      })

    // ── accounting ──────────────────────────────────────────────────────
    case 'ADD_ACCT_ENTRY':
      return withDraft(state, (d) => {
        d.acctEntries.unshift({ id: uid('ac'), at: now, kind: action.kind, desc: action.desc, amount: Number(action.amount), source: 'manual', by: action.by, edits: [] })
      })

    case 'EDIT_ACCT_ENTRY':
      return withDraft(state, (d) => {
        const e = d.acctEntries.find((x) => x.id === action.id)
        if (!e) return
        e.edits.push({ at: now, by: action.by, from: e.amount, to: Number(action.amount), note: action.note })
        e.amount = Number(action.amount)
        if (action.desc) e.desc = action.desc
      })

    case 'RECORD_PAYMENT':
      return withDraft(state, (d) => {
        const inv = d.invoices.find((x) => x.id === action.invoiceId)
        if (!inv) return
        inv.paid = Math.min(inv.amount, inv.paid + Number(action.amount))
        d.acctEntries.unshift({ id: uid('ac'), at: now, kind: 'payment', desc: `Payment received — ${inv.customer} (${inv.id})`, amount: Number(action.amount), source: 'manual', by: action.by, edits: [] })
        if (inv.paid >= inv.amount) {
          d.alerts.forEach((a) => {
            if (a.kind === 'payment-overdue' && a.refId === inv.id) { a.acked = true; a.ackedBy = action.by; a.ackedAt = now }
          })
        }
      })

    // ── spare parts ─────────────────────────────────────────────────────
    case 'ADD_PART_REQUEST':
      return withDraft(state, (d) => {
        const id = `PR-${106 + d.partRequests.length}`
        d.partRequests.unshift({
          id, machineId: action.machineId, part: action.part, reason: action.reason,
          urgency: action.urgency, estCost: Number(action.estCost), note: action.note,
          status: 'pending', by: action.by, at: now,
          history: [{ at: now, by: action.by, action: 'submitted' }],
        })
        if (action.stopReportId) {
          const r = d.stopReports.find((x) => x.id === action.stopReportId)
          if (r) r.partRequestId = id
        }
        const m = d.machines.find((x) => x.id === action.machineId)
        if (action.urgency === 'urgent') {
          addAlert(d, {
            severity: 'critical', kind: 'part-urgent', refId: id, section: 'parts',
            text: `URGENT part request ${id}: ${action.part} for ${m?.name} (~$${Number(action.estCost).toLocaleString()})`,
          })
        } else {
          notifyOwner(d, `New part request ${id}: ${action.part} for ${m?.name}`, 'parts', id)
        }
      })

    case 'PART_ACTION':
      return withDraft(state, (d) => {
        const r = d.partRequests.find((x) => x.id === action.id)
        if (!r) return
        if (action.action === 'question') {
          const th = ensureThread(d, 'p-owner', r.by)
          th.messages.push({ id: uid('m'), from: action.by, at: now, text: `[${r.id} — ${r.part}] ${action.note}`, type: 'message' })
          r.history.push({ at: now, by: action.by, action: 'question', note: action.note })
        } else {
          if (action.action === 'purchased' && r.status !== 'approved') return // buy only after approval
          r.status = action.action
          r.history.push({ at: now, by: action.by, action: action.action, note: action.note })
          d.alerts.forEach((a) => {
            if (a.kind === 'part-urgent' && a.refId === r.id) { a.acked = true; a.ackedBy = action.by; a.ackedAt = now }
          })
        }
      })

    // ── comm hub ────────────────────────────────────────────────────────
    case 'SEND_MESSAGE':
      return withDraft(state, (d) => {
        const th = d.threads.find((t) => t.id === action.threadId)
        if (!th) return
        th.messages.push({
          id: uid('m'), from: action.from, at: now, text: action.text,
          type: action.msgType || 'message',
          ...(action.msgType === 'order' ? { status: 'sent' } : {}),
        })
      })

    case 'ORDER_MSG_STATUS':
      return withDraft(state, (d) => {
        const th = d.threads.find((t) => t.id === action.threadId)
        const m = th?.messages.find((x) => x.id === action.msgId)
        if (!m) return
        if (action.status === 'acknowledged') { m.status = 'acknowledged'; m.ackedAt = now }
        if (action.status === 'done') { m.status = 'done'; m.doneAt = now }
      })

    case 'RAISE_FLAG':
      return withDraft(state, (d) => {
        const th = ensureThread(d, 'p-owner', action.from)
        th.messages.push({ id: uid('m'), from: action.from, at: now, text: action.text, type: 'flag' })
        const person = PEOPLE.find((p) => p.id === action.from)
        addAlert(d, {
          severity: 'critical', kind: `flag-${uid('f')}`, refId: th.id, section: 'comms',
          text: `FLAG from ${person?.name}: ${action.text}`,
        })
      })

    case 'GRANT_LINK':
      return withDraft(state, (d) => {
        d.links.push({
          id: uid('lk'), a: action.a, b: action.b, scope: action.scope, task: action.task,
          grantedAt: now, expiresAt: action.scope === 'temporary' ? now + action.hours * 3600e3 : null,
        })
        ensureThread(d, action.a, action.b)
      })

    case 'REVOKE_LINK':
      return withDraft(state, (d) => {
        d.links = d.links.filter((l) => l.id !== action.id)
      })

    case 'RESET':
      return initState(true)

    default:
      return state
  }
}

// ── init & persistence ──────────────────────────────────────────────────────
function initState(forceFresh = false) {
  if (!forceFresh) {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        if (dayKey(saved.seededAt) === dayKey(Date.now())) return saved
      }
    } catch { /* fall through to fresh seed */ }
  }
  const s = makeSeed()
  // plant has been running since 07:00 — backfill today's counters
  const sh = new Date(); sh.setHours(7, 0, 0, 0)
  const hrs = clamp((Date.now() - sh.getTime()) / 3600e3, 0, 12)
  s.lines.forEach((ln) => {
    ln.producedToday = ln.nominalTph * hrs * 0.93
    ln.wheatToday = ln.producedToday / 0.74
  })
  s.liveDay = dayKey(Date.now())
  return s
}

const StoreCtx = createContext(null)

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => initState())
  const saveTimer = useRef(null)

  useEffect(() => {
    const t = setInterval(() => dispatch({ type: 'TICK' }), TICK_MS)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      try { localStorage.setItem(LS_KEY, JSON.stringify(state)) } catch { /* storage full — history persists best-effort */ }
    }, 800)
  }, [state])

  return <StoreCtx.Provider value={{ state, dispatch }}>{children}</StoreCtx.Provider>
}

export function useStore() {
  return useContext(StoreCtx)
}

export function useUser() {
  const { state } = useStore()
  return PEOPLE.find((p) => p.id === state.currentUserId) || PEOPLE[0]
}

export { PEOPLE }
