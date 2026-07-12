// Seed data for the demo plant. Everything is generated relative to "now" so
// the dashboard always opens on a live-looking day.
import { uid, dayKey } from '../utils.js'

const DAY = 24 * 3600 * 1000

export const PEOPLE = [
  { id: 'p-owner', name: 'Haj Karim', role: 'owner', title: 'Owner / Head Manager' },
  { id: 'p-fore1', name: 'Samir Aziz', role: 'foreman', title: 'Foreman — Mill Line 1', lineId: 'L1' },
  { id: 'p-fore2', name: 'Dawood Nasr', role: 'foreman', title: 'Foreman — Mill Line 2', lineId: 'L2' },
  { id: 'p-lab', name: 'Layla Haddad', role: 'lab', title: 'Lab Technician' },
  { id: 'p-acct', name: 'Nadia Fares', role: 'accountant', title: 'Accountant' },
]

export const CAUSES = ['Breakdown', 'Maintenance', 'Cleaning', 'Wheat shortage', 'Shift end', 'Power cut']

export function makeSeed(now = Date.now()) {
  const today0 = new Date(now); today0.setHours(0, 0, 0, 0)
  const t0 = today0.getTime()
  const shiftStart = t0 + 7 * 3600 * 1000 // day shift 07:00

  const lines = [
    { id: 'L1', name: 'Mill Line 1', product: 'Zero Flour (00)', nominalTph: 9.5, rateTph: 9.4, wheatInTph: 12.7, targetTpd: 150, status: 'running', producedToday: 0, wheatToday: 0, requiredStaff: 5 },
    { id: 'L2', name: 'Mill Line 2', product: 'Baladi Flour (82%)', nominalTph: 7.5, rateTph: 7.6, wheatInTph: 9.6, targetTpd: 120, status: 'running', producedToday: 0, wheatToday: 0, requiredStaff: 4 },
  ]

  const machines = [
    { id: 'M-RM101', name: 'Roller Mill RM-101', lineId: 'L1' },
    { id: 'M-RM102', name: 'Roller Mill RM-102', lineId: 'L1' },
    { id: 'M-SF110', name: 'Plansifter SF-110', lineId: 'L1' },
    { id: 'M-PU115', name: 'Purifier PU-115', lineId: 'L1' },
    { id: 'M-RM201', name: 'Roller Mill RM-201', lineId: 'L2' },
    { id: 'M-SF210', name: 'Plansifter SF-210', lineId: 'L2' },
    { id: 'M-CL010', name: 'Wheat Cleaner CL-010', lineId: null },
    { id: 'M-PK300', name: 'Packing Machine PK-300', lineId: null },
    { id: 'M-WB001', name: 'Weighbridge WB-001', lineId: null },
  ]

  const silos = [
    { id: 'S-W1', name: 'Wheat Silo 1', kind: 'wheat', capacityT: 1200, levelT: 780, lowPct: 20, sensorOk: true },
    { id: 'S-W2', name: 'Wheat Silo 2', kind: 'wheat', capacityT: 1200, levelT: 310, lowPct: 20, sensorOk: true },
    { id: 'S-W3', name: 'Wheat Silo 3', kind: 'wheat', capacityT: 800, levelT: 655, lowPct: 20, sensorOk: false },
    { id: 'S-F1', name: 'Flour Bin 1 (Zero)', kind: 'flour', capacityT: 300, levelT: 152, lowPct: 15, sensorOk: true },
    { id: 'S-F2', name: 'Flour Bin 2 (Baladi)', kind: 'flour', capacityT: 300, levelT: 214, lowPct: 15, sensorOk: true },
    { id: 'S-B1', name: 'Bran Bin', kind: 'bran', capacityT: 150, levelT: 96, lowPct: 15, sensorOk: true },
  ]

  // ── workers (gate machine population) ────────────────────────────────────
  const mk = (name, dept, lineId) => ({ id: uid('w'), name, dept, lineId, shiftStartH: 7 })
  const workers = [
    mk('Ali Mansour', 'Milling', 'L1'), mk('Hassan Tahir', 'Milling', 'L1'),
    mk('Omar Khalil', 'Milling', 'L1'), mk('Yousef Salim', 'Milling', 'L1'),
    mk('Karam Adel', 'Milling', 'L1'),
    mk('Bilal Hamdan', 'Milling', 'L2'), mk('Ziad Qasim', 'Milling', 'L2'),
    mk('Fadi Nour', 'Milling', 'L2'), mk('Rami Sleiman', 'Milling', 'L2'),
    mk('Tarek Wael', 'Intake & Cleaning', null), mk('Jamil Odeh', 'Intake & Cleaning', null),
    mk('Nabil Asfour', 'Packing & Dispatch', null), mk('Sami Ghanem', 'Packing & Dispatch', null),
    mk('Walid Barakat', 'Packing & Dispatch', null),
    mk('Marwan Saab', 'Maintenance', null), mk('Adnan Khoury', 'Maintenance', null),
  ]
  const deptRequired = { 'Intake & Cleaning': 2, 'Packing & Dispatch': 3, Maintenance: 2 }

  // Today's punches: most in on time, one late, one absent, one missing punch-out yesterday.
  const punches = []
  workers.forEach((w, i) => {
    if (i === 3) return // Yousef absent today → Line 1 short one operator
    const late = i === 6 ? 38 : 0 // Ziad 38 min late
    const jitter = Math.floor(Math.random() * 9) - 4
    punches.push({ id: uid('pn'), workerId: w.id, at: shiftStart + (late + jitter) * 60000, dir: 'in', source: 'gate' })
  })
  // Yesterday's punches incl. one missing punch-out (Marwan)
  const yStart = shiftStart - DAY
  workers.forEach((w, i) => {
    punches.push({ id: uid('pn'), workerId: w.id, at: yStart + (Math.floor(Math.random() * 7) - 3) * 60000, dir: 'in', source: 'gate' })
    if (w.name !== 'Marwan Saab') {
      punches.push({ id: uid('pn'), workerId: w.id, at: yStart + 9 * 3600 * 1000 + Math.floor(Math.random() * 20) * 60000, dir: 'out', source: 'gate' })
    }
  })

  // 30-day attendance history for the monthly rollup
  const attendanceDays = []
  for (let d = 30; d >= 1; d--) {
    const ts = t0 - d * DAY
    const dow = new Date(ts).getDay()
    if (dow === 5) continue // Friday off
    workers.forEach((w) => {
      const r = Math.random()
      let status = 'present', lateMin = 0, hours = 9
      if (r > 0.965) { status = 'absent'; hours = 0 }
      else if (r > 0.9) { status = 'late'; lateMin = 12 + Math.floor(Math.random() * 50); hours = 8.5 }
      attendanceDays.push({ date: dayKey(ts), workerId: w.id, status, lateMin, hours })
    })
  }

  // ── wheat intake & lots ──────────────────────────────────────────────────
  const suppliers = ['Golden Plains Trading', 'Al-Reef Grain Co.', 'Port Silo Terminal', 'Hasad Agri Supply']
  const intakes = []
  let lotSeq = 41
  for (let d = 12; d >= 0; d--) {
    const trucks = d === 0 ? 2 : 1 + Math.floor(Math.random() * 3)
    for (let k = 0; k < trucks; k++) {
      const at = t0 - d * DAY + (8 + k * 2) * 3600 * 1000 + Math.floor(Math.random() * 50) * 60000
      intakes.push({
        id: uid('in'),
        lotNo: `WL-${String(lotSeq++).padStart(4, '0')}`,
        at,
        truckPlate: `TR ${1000 + Math.floor(Math.random() * 9000)}`,
        supplier: suppliers[Math.floor(Math.random() * suppliers.length)],
        netT: Math.round((22 + Math.random() * 16) * 10) / 10,
        moisturePct: Math.round((10.5 + Math.random() * 3.4) * 10) / 10,
        siloId: ['S-W1', 'S-W2', 'S-W3'][Math.floor(Math.random() * 3)],
        by: 'Weighbridge WB-001',
      })
    }
  }
  intakes.sort((a, b) => b.at - a.at)

  // Flour lots (production batches) with traceability to wheat lots
  const flourLots = []
  let fSeq = 118
  for (let d = 6; d >= 0; d--) {
    for (const ln of lines) {
      const dayIntakes = intakes.filter((i) => i.at < t0 - (d - 1) * DAY && i.at > t0 - (d + 3) * DAY)
      const wheatLots = dayIntakes.slice(0, 2).map((i) => i.lotNo)
      flourLots.push({
        id: `FL-${String(fSeq++).padStart(4, '0')}`,
        lineId: ln.id,
        product: ln.product,
        date: dayKey(t0 - d * DAY),
        tonnes: d === 0 ? 0 : Math.round(ln.targetTpd * (0.82 + Math.random() * 0.2)),
        wheatLots,
        open: d === 0,
      })
    }
  }

  // ── lab tests ────────────────────────────────────────────────────────────
  const labTests = []
  flourLots.filter((l) => !l.open).forEach((l, i) => {
    if (i % 3 === 2) return // some lots still awaiting tests
    const fail = Math.random() > 0.93
    labTests.push({
      id: uid('lt'),
      lotId: l.id,
      at: new Date(l.date).getTime() + 15 * 3600 * 1000,
      moisture: Math.round((13.2 + Math.random() * 1.6) * 10) / 10,
      protein: Math.round((10.2 + Math.random() * 2.4) * 10) / 10,
      gluten: Math.round((26 + Math.random() * 6) * 10) / 10,
      ash: Math.round((0.48 + Math.random() * 0.35) * 100) / 100,
      fallingNumber: 280 + Math.floor(Math.random() * 140),
      result: fail ? 'watch' : 'pass',
      by: 'p-lab',
      note: fail ? 'Moisture near upper limit — recheck next batch' : '',
    })
  })

  // ── orders / dispatch ────────────────────────────────────────────────────
  const customers = ['Al-Madina Bakeries', 'Sunrise Bakery Group', 'City Feed Mills', 'Noor Distribution', 'Al-Salam Pastry Co.']
  const shippedLots = flourLots.filter((l) => !l.open)
  const orders = [
    { id: 'ORD-2201', customer: 'Al-Madina Bakeries', product: 'Zero Flour (00)', qtyT: 120, unitPrice: 410, dueTs: t0 + 2 * DAY, dispatchedT: 80 },
    { id: 'ORD-2202', customer: 'Sunrise Bakery Group', product: 'Baladi Flour (82%)', qtyT: 90, unitPrice: 355, dueTs: t0 + 4 * DAY, dispatchedT: 90 },
    { id: 'ORD-2203', customer: 'City Feed Mills', product: 'Bran', qtyT: 60, unitPrice: 170, dueTs: t0 + 1 * DAY, dispatchedT: 24 },
    { id: 'ORD-2204', customer: 'Noor Distribution', product: 'Zero Flour (00)', qtyT: 200, unitPrice: 405, dueTs: t0 + 9 * DAY, dispatchedT: 0 },
    { id: 'ORD-2205', customer: 'Al-Salam Pastry Co.', product: 'Zero Flour (00)', qtyT: 45, unitPrice: 415, dueTs: t0 + 3 * DAY, dispatchedT: 0 },
    { id: 'ORD-2206', customer: 'Sunrise Bakery Group', product: 'Bran', qtyT: 30, unitPrice: 175, dueTs: t0 + 6 * DAY, dispatchedT: 0 },
  ]
  const dispatches = [
    { id: uid('dp'), orderId: 'ORD-2201', lotId: shippedLots[0]?.id, qtyT: 40, at: t0 - 2 * DAY + 11 * 3600e3, truck: 'TR 4413' },
    { id: uid('dp'), orderId: 'ORD-2201', lotId: shippedLots[2]?.id, qtyT: 40, at: t0 - 1 * DAY + 10 * 3600e3, truck: 'TR 4413' },
    { id: uid('dp'), orderId: 'ORD-2202', lotId: shippedLots[1]?.id, qtyT: 90, at: t0 - 1 * DAY + 13 * 3600e3, truck: 'TR 8821' },
    { id: uid('dp'), orderId: 'ORD-2203', lotId: null, qtyT: 24, at: t0 - 3 * 3600e3, truck: 'TR 2094' },
  ]

  // ── accounting ───────────────────────────────────────────────────────────
  const acctEntries = []
  for (let d = 28; d >= 0; d--) {
    const ts = t0 - d * DAY + 12 * 3600e3
    if (d % 2 === 0) acctEntries.push({ id: uid('ac'), at: ts, kind: 'sale', desc: `Flour sales invoice ${customers[d % customers.length]}`, amount: 18000 + Math.floor(Math.random() * 30000), source: 'imported', by: 'import:tally-erp', edits: [] })
    if (d % 3 === 0) acctEntries.push({ id: uid('ac'), at: ts, kind: 'purchase', desc: 'Wheat purchase — supplier settlement', amount: -(24000 + Math.floor(Math.random() * 26000)), source: 'imported', by: 'import:tally-erp', edits: [] })
    if (d % 7 === 3) acctEntries.push({ id: uid('ac'), at: ts, kind: 'expense', desc: ['Electricity bill', 'Packing bags stock', 'Diesel for loaders', 'Machine lubricants'][d % 4], amount: -(1800 + Math.floor(Math.random() * 5200)), source: 'manual', by: 'p-acct', edits: [] })
  }
  const invoices = [
    { id: 'INV-981', customer: 'Al-Madina Bakeries', amount: 32800, issuedTs: t0 - 24 * DAY, dueTs: t0 - 9 * DAY, paid: 12000 },
    { id: 'INV-987', customer: 'City Feed Mills', amount: 10200, issuedTs: t0 - 18 * DAY, dueTs: t0 - 3 * DAY, paid: 0 },
    { id: 'INV-992', customer: 'Sunrise Bakery Group', amount: 31950, issuedTs: t0 - 9 * DAY, dueTs: t0 + 6 * DAY, paid: 15000 },
    { id: 'INV-995', customer: 'Noor Distribution', amount: 40500, issuedTs: t0 - 4 * DAY, dueTs: t0 + 11 * DAY, paid: 40500 },
    { id: 'INV-996', customer: 'Al-Salam Pastry Co.', amount: 18675, issuedTs: t0 - 2 * DAY, dueTs: t0 + 13 * DAY, paid: 0 },
  ]

  // ── spare parts ──────────────────────────────────────────────────────────
  const partRequests = [
    {
      id: 'PR-104', machineId: 'M-RM102', part: 'Fluted roll set (250mm)', reason: 'worn',
      urgency: 'normal', estCost: 2400, note: 'Corrugation worn below spec, extraction slipping on B1 passage.',
      status: 'approved', by: 'p-fore1', at: now - 3 * DAY,
      history: [
        { at: now - 3 * DAY, by: 'p-fore1', action: 'submitted' },
        { at: now - 2.5 * DAY, by: 'p-owner', action: 'approved', note: 'Order from Bühler agent, ask for freight quote first.' },
      ],
    },
    {
      id: 'PR-105', machineId: 'M-SF210', part: 'Sifter sieve frames ×6', reason: 'preventive',
      urgency: 'low', estCost: 620, note: 'Scheduled replacement window next month.',
      status: 'pending', by: 'p-fore2', at: now - 26 * 3600e3, history: [{ at: now - 26 * 3600e3, by: 'p-fore2', action: 'submitted' }],
    },
    {
      id: 'PR-103', machineId: 'M-CL010', part: 'Destoner deck rubber', reason: 'broken',
      urgency: 'urgent', estCost: 380, note: 'Deck rubber torn, stones passing to first break.',
      status: 'purchased', by: 'p-fore1', at: now - 9 * DAY,
      history: [
        { at: now - 9 * DAY, by: 'p-fore1', action: 'submitted' },
        { at: now - 9 * DAY + 3600e3, by: 'p-owner', action: 'approved' },
        { at: now - 7 * DAY, by: 'p-owner', action: 'purchased', note: 'Local supplier, fitted same day.' },
      ],
    },
    {
      id: 'PR-101', machineId: 'M-PK300', part: 'Stitching head assembly', reason: 'worn',
      urgency: 'normal', estCost: 1150, note: '', status: 'purchased', by: 'p-fore2', at: now - 21 * DAY,
      history: [
        { at: now - 21 * DAY, by: 'p-fore2', action: 'submitted' },
        { at: now - 20 * DAY, by: 'p-owner', action: 'approved' },
        { at: now - 16 * DAY, by: 'p-owner', action: 'purchased' },
      ],
    },
    {
      id: 'PR-102', machineId: 'M-RM201', part: 'Feed gate servo', reason: 'broken',
      urgency: 'urgent', estCost: 900, note: 'Requested twice, second unit also failed.',
      status: 'rejected', by: 'p-fore2', at: now - 15 * DAY,
      history: [
        { at: now - 15 * DAY, by: 'p-fore2', action: 'submitted' },
        { at: now - 14 * DAY, by: 'p-owner', action: 'rejected', note: 'Maintenance to inspect wiring first — two failures in a month is not the servo.' },
      ],
    },
  ]

  // ── production history (30 days) ─────────────────────────────────────────
  const productionDays = []
  for (let d = 30; d >= 1; d--) {
    const ts = t0 - d * DAY
    if (new Date(ts).getDay() === 5) continue
    for (const ln of lines) {
      const tonnes = Math.round(ln.targetTpd * (0.78 + Math.random() * 0.28))
      productionDays.push({
        date: dayKey(ts), lineId: ln.id, tonnes,
        wheatT: Math.round(tonnes / (0.7 + Math.random() * 0.06)),
        downtimeMin: Math.random() > 0.72 ? 25 + Math.floor(Math.random() * 130) : 0,
        downtimeCause: '',
      })
    }
  }
  productionDays.forEach((p) => { if (p.downtimeMin) p.downtimeCause = CAUSES[Math.floor(Math.random() * CAUSES.length)] })

  // ── stop reports ─────────────────────────────────────────────────────────
  const stopReports = [
    {
      id: uid('sr'), machineId: 'M-RM102', lineId: 'L1', stoppedAt: now - 3 * DAY - 2 * 3600e3,
      resumedAt: now - 3 * DAY, status: 'resolved', cause: 'Breakdown',
      note: 'B1 roll bearing overheating — running at reduced feed until roll set replaced.',
      reportedAt: now - 3 * DAY - 2 * 3600e3 + 4 * 60000, reportedBy: 'p-fore1', partRequestId: 'PR-104',
    },
    {
      id: uid('sr'), machineId: 'M-SF210', lineId: 'L2', stoppedAt: now - 1 * DAY - 5 * 3600e3,
      resumedAt: now - 1 * DAY - 4.2 * 3600e3, status: 'resolved', cause: 'Cleaning',
      note: 'Weekly sieve cleaning.', reportedAt: now - 1 * DAY - 5 * 3600e3 + 2 * 60000, reportedBy: 'p-fore2', partRequestId: null,
    },
  ]

  // ── comm hub ─────────────────────────────────────────────────────────────
  const threads = PEOPLE.filter((p) => p.id !== 'p-owner').map((p) => ({
    id: `th-${p.id}`, participants: ['p-owner', p.id], messages: [],
  }))
  threads.find((t) => t.participants.includes('p-acct')).messages.push(
    { id: uid('m'), from: 'p-owner', at: now - 26 * 3600e3, text: 'Chase Al-Madina on INV-981 — it is two weeks overdue now.', type: 'order', status: 'done', ackedAt: now - 25 * 3600e3, doneAt: now - 22 * 3600e3 },
    { id: uid('m'), from: 'p-acct', at: now - 22 * 3600e3, text: 'Called their purchasing office. They promise a transfer of the remaining 20,800 by Thursday.', type: 'message' },
  )
  threads.find((t) => t.participants.includes('p-lab')).messages.push(
    { id: uid('m'), from: 'p-lab', at: now - 5 * 3600e3, text: 'FL-0125 moisture at 14.6% — inside limit but close. Watching next batch.', type: 'message' },
  )
  // Pre-approved safety pair: lab ↔ both production foremen
  const links = [
    { id: uid('lk'), a: 'p-lab', b: 'p-fore1', scope: 'permanent', preapproved: true, task: 'Quality ↔ production (safety pair)', grantedAt: now - 90 * DAY },
    { id: uid('lk'), a: 'p-lab', b: 'p-fore2', scope: 'permanent', preapproved: true, task: 'Quality ↔ production (safety pair)', grantedAt: now - 90 * DAY },
  ]

  const alerts = [
    { id: uid('al'), at: now - 40 * 60000, severity: 'critical', kind: 'payment-overdue', text: 'INV-981 Al-Madina Bakeries overdue 9 days — $20,800 outstanding', section: 'accounting', refId: 'INV-981' },
    { id: uid('al'), at: now - 3 * 3600e3, severity: 'warning', kind: 'understaffed', text: 'Mill Line 1 short one operator (Yousef Salim absent)', section: 'attendance', refId: 'L1' },
    { id: uid('al'), at: now - 5 * 3600e3, severity: 'warning', kind: 'sensor-drift', text: 'Wheat Silo 3 level sensor flagged for drift — foreman confirmation needed', section: 'silos', refId: 'S-W3' },
  ]

  return {
    seededAt: now,
    currentUserId: 'p-owner',
    lines, machines, silos, workers, deptRequired,
    punches, attendanceDays, corrections: [],
    intakes, flourLots, labTests,
    orders, dispatches,
    acctEntries, invoices,
    partRequests, stopReports,
    threads, links, alerts,
    liveHistory: { L1: [], L2: [] }, // rolling {t, rate, extraction} samples
    productionDays,
    siloOverrides: [],
    notifications: [],
  }
}
