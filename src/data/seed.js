// Seed data for the demo plant, generated relative to "now" so the dashboard
// always opens on a live-looking day. All human-readable names are bilingual
// {en, fa}; enum-like values (products, causes, departments) are keys that the
// UI translates at render time.
import { uid, dayKey } from '../utils.js'

const DAY = 24 * 3600 * 1000

export const PEOPLE = [
  { id: 'p-owner', name: { en: 'Haj Karim Ahmadi', fa: 'حاج کریم احمدی' }, role: 'owner', titleKey: 'title.owner' },
  { id: 'p-fore1', name: { en: 'Saman Azizi', fa: 'سامان عزیزی' }, role: 'foreman', titleKey: 'title.foreman1', lineId: 'L1' },
  { id: 'p-fore2', name: { en: 'Davood Nasri', fa: 'داوود نصری' }, role: 'foreman', titleKey: 'title.foreman2', lineId: 'L2' },
  { id: 'p-lab', name: { en: 'Leila Haddadi', fa: 'لیلا حدادی' }, role: 'lab', titleKey: 'title.lab' },
  { id: 'p-acct', name: { en: 'Neda Farahani', fa: 'ندا فراهانی' }, role: 'accountant', titleKey: 'title.acct' },
]

export const CAUSES = ['breakdown', 'maintenance', 'cleaning', 'wheatShortage', 'shiftEnd', 'power']
export const PRODUCTS = ['zero', 'whole', 'bran']

export function makeSeed(now = Date.now()) {
  const today0 = new Date(now); today0.setHours(0, 0, 0, 0)
  const t0 = today0.getTime()
  const shiftStart = t0 + 7 * 3600 * 1000 // day shift 07:00

  const lines = [
    { id: 'L1', name: { en: 'Mill Line 1', fa: 'خط آسیاب ۱' }, product: 'zero', nominalTph: 9.5, rateTph: 9.4, wheatInTph: 12.7, targetTpd: 150, status: 'running', producedToday: 0, wheatToday: 0, requiredStaff: 5 },
    { id: 'L2', name: { en: 'Mill Line 2', fa: 'خط آسیاب ۲' }, product: 'whole', nominalTph: 7.5, rateTph: 7.6, wheatInTph: 9.6, targetTpd: 120, status: 'running', producedToday: 0, wheatToday: 0, requiredStaff: 4 },
  ]

  const machines = [
    { id: 'M-RM101', name: { en: 'Roller Mill RM-101', fa: 'والس RM-101' }, lineId: 'L1' },
    { id: 'M-RM102', name: { en: 'Roller Mill RM-102', fa: 'والس RM-102' }, lineId: 'L1' },
    { id: 'M-SF110', name: { en: 'Plansifter SF-110', fa: 'الک SF-110' }, lineId: 'L1' },
    { id: 'M-PU115', name: { en: 'Purifier PU-115', fa: 'پیورفایر PU-115' }, lineId: 'L1' },
    { id: 'M-RM201', name: { en: 'Roller Mill RM-201', fa: 'والس RM-201' }, lineId: 'L2' },
    { id: 'M-SF210', name: { en: 'Plansifter SF-210', fa: 'الک SF-210' }, lineId: 'L2' },
    { id: 'M-CL010', name: { en: 'Wheat Cleaner CL-010', fa: 'بوجاری CL-010' }, lineId: null },
    { id: 'M-PK300', name: { en: 'Packing Machine PK-300', fa: 'کیسه‌گیری PK-300' }, lineId: null },
    { id: 'M-WB001', name: { en: 'Weighbridge WB-001', fa: 'باسکول WB-001' }, lineId: null },
  ]

  const silos = [
    { id: 'S-W1', name: { en: 'Wheat Silo 1', fa: 'سیلوی گندم ۱' }, kind: 'wheat', capacityT: 1200, levelT: 780, lowPct: 20, sensorOk: true },
    { id: 'S-W2', name: { en: 'Wheat Silo 2', fa: 'سیلوی گندم ۲' }, kind: 'wheat', capacityT: 1200, levelT: 310, lowPct: 20, sensorOk: true },
    { id: 'S-W3', name: { en: 'Wheat Silo 3', fa: 'سیلوی گندم ۳' }, kind: 'wheat', capacityT: 800, levelT: 655, lowPct: 20, sensorOk: false },
    { id: 'S-F1', name: { en: 'Flour Bin 1 (Zero)', fa: 'مخزن آرد ۱ (نول)' }, kind: 'flour', capacityT: 300, levelT: 152, lowPct: 15, sensorOk: true },
    { id: 'S-F2', name: { en: 'Flour Bin 2 (Whole)', fa: 'مخزن آرد ۲ (سبوس‌دار)' }, kind: 'flour', capacityT: 300, levelT: 214, lowPct: 15, sensorOk: true },
    { id: 'S-B1', name: { en: 'Bran Bin', fa: 'مخزن سبوس' }, kind: 'bran', capacityT: 150, levelT: 96, lowPct: 15, sensorOk: true },
  ]

  // ── workers (gate machine population) ────────────────────────────────────
  const mk = (en, fa, dept, lineId) => ({ id: uid('w'), name: { en, fa }, dept, lineId, shiftStartH: 7 })
  const workers = [
    mk('Ali Mansouri', 'علی منصوری', 'milling', 'L1'),
    mk('Hassan Taheri', 'حسن طاهری', 'milling', 'L1'),
    mk('Omid Khalili', 'امید خلیلی', 'milling', 'L1'),
    mk('Yousef Salimi', 'یوسف سلیمی', 'milling', 'L1'),
    mk('Kamran Adeli', 'کامران عادلی', 'milling', 'L1'),
    mk('Babak Hemmati', 'بابک همتی', 'milling', 'L2'),
    mk('Zaniar Ghasemi', 'زانیار قاسمی', 'milling', 'L2'),
    mk('Farhad Nouri', 'فرهاد نوری', 'milling', 'L2'),
    mk('Ramin Soleimani', 'رامین سلیمانی', 'milling', 'L2'),
    mk('Touraj Vakili', 'تورج وکیلی', 'intake', null),
    mk('Jamshid Owji', 'جمشید اوجی', 'intake', null),
    mk('Nabi Asgari', 'نبی عسگری', 'packing', null),
    mk('Saeed Ghanbari', 'سعید قنبری', 'packing', null),
    mk('Vahid Boroumand', 'وحید برومند', 'packing', null),
    mk('Mehrdad Saberi', 'مهرداد صابری', 'maintenance', null),
    mk('Adel Khorrami', 'عادل خرمی', 'maintenance', null),
  ]
  const deptRequired = { intake: 2, packing: 3, maintenance: 2 }
  const ABSENT_IDX = 3   // Yousef absent today → Line 1 short one operator
  const LATE_IDX = 6     // Zaniar 38 min late
  const NO_OUT_IDX = 14  // Mehrdad missing yesterday's punch-out

  const punches = []
  workers.forEach((w, i) => {
    if (i === ABSENT_IDX) return
    const late = i === LATE_IDX ? 38 : 0
    const jitter = Math.floor(Math.random() * 9) - 4
    punches.push({ id: uid('pn'), workerId: w.id, at: shiftStart + (late + jitter) * 60000, dir: 'in', source: 'gate' })
  })
  const yStart = shiftStart - DAY
  workers.forEach((w, i) => {
    punches.push({ id: uid('pn'), workerId: w.id, at: yStart + (Math.floor(Math.random() * 7) - 3) * 60000, dir: 'in', source: 'gate' })
    if (i !== NO_OUT_IDX) {
      punches.push({ id: uid('pn'), workerId: w.id, at: yStart + 9 * 3600 * 1000 + Math.floor(Math.random() * 20) * 60000, dir: 'out', source: 'gate' })
    }
  })

  // 30-day attendance history for the monthly rollup (Fridays off)
  const attendanceDays = []
  for (let d = 30; d >= 1; d--) {
    const ts = t0 - d * DAY
    if (new Date(ts).getDay() === 5) continue
    workers.forEach((w) => {
      const r = Math.random()
      let status = 'present', lateMin = 0, hours = 9
      if (r > 0.965) { status = 'absent'; hours = 0 }
      else if (r > 0.9) { status = 'late'; lateMin = 12 + Math.floor(Math.random() * 50); hours = 8.5 }
      attendanceDays.push({ date: dayKey(ts), workerId: w.id, status, lateMin, hours })
    })
  }

  // ── wheat intake & lots ──────────────────────────────────────────────────
  const suppliers = [
    { en: 'Golden Plains Trading', fa: 'بازرگانی دشت طلایی' },
    { en: 'Alborz Grain Co.', fa: 'غلات البرز' },
    { en: 'Port Silo Terminal', fa: 'پایانهٔ سیلوی بندر' },
    { en: 'Hasad Agri Supply', fa: 'کشت و صنعت حصاد' },
  ]
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
        truckPlate: `${52 + Math.floor(Math.random() * 40)}ع${100 + Math.floor(Math.random() * 900)}`,
        supplier: suppliers[Math.floor(Math.random() * suppliers.length)],
        netT: Math.round((22 + Math.random() * 16) * 10) / 10,
        moisturePct: Math.round((10.5 + Math.random() * 3.4) * 10) / 10,
        siloId: ['S-W1', 'S-W2', 'S-W3'][Math.floor(Math.random() * 3)],
        by: 'M-WB001',
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
    const watch = Math.random() > 0.93
    labTests.push({
      id: uid('lt'),
      lotId: l.id,
      at: new Date(l.date).getTime() + 15 * 3600 * 1000,
      moisture: Math.round((13.2 + Math.random() * 1.6) * 10) / 10,
      protein: Math.round((10.2 + Math.random() * 2.4) * 10) / 10,
      gluten: Math.round((26 + Math.random() * 6) * 10) / 10,
      ash: Math.round((0.48 + Math.random() * 0.35) * 100) / 100,
      fallingNumber: 280 + Math.floor(Math.random() * 140),
      result: watch ? 'watch' : 'pass',
      by: 'p-lab',
      note: watch ? { en: 'Moisture near upper limit — recheck next batch', fa: 'رطوبت نزدیک حد بالا — بچ بعدی دوباره بررسی شود' } : '',
    })
  })

  // ── orders / dispatch ────────────────────────────────────────────────────
  const customers = [
    { en: 'Sahar Bakeries', fa: 'نانوایی‌های سحر' },
    { en: 'Tolou Bakery Group', fa: 'گروه نان طلوع' },
    { en: 'Tehran Feed Mills', fa: 'خوراک دام تهران' },
    { en: 'Noor Distribution', fa: 'پخش نور' },
    { en: 'Salar Pastry Co.', fa: 'قنادی سالار' },
  ]
  const shippedLots = flourLots.filter((l) => !l.open)
  const orders = [
    { id: 'ORD-2201', customer: customers[0], product: 'zero', qtyT: 120, unitPrice: 410, dueTs: t0 + 2 * DAY, dispatchedT: 80 },
    { id: 'ORD-2202', customer: customers[1], product: 'whole', qtyT: 90, unitPrice: 355, dueTs: t0 + 4 * DAY, dispatchedT: 90 },
    { id: 'ORD-2203', customer: customers[2], product: 'bran', qtyT: 60, unitPrice: 170, dueTs: t0 + 1 * DAY, dispatchedT: 24 },
    { id: 'ORD-2204', customer: customers[3], product: 'zero', qtyT: 200, unitPrice: 405, dueTs: t0 + 9 * DAY, dispatchedT: 0 },
    { id: 'ORD-2205', customer: customers[4], product: 'zero', qtyT: 45, unitPrice: 415, dueTs: t0 + 3 * DAY, dispatchedT: 0 },
    { id: 'ORD-2206', customer: customers[1], product: 'bran', qtyT: 30, unitPrice: 175, dueTs: t0 + 6 * DAY, dispatchedT: 0 },
  ]
  const dispatches = [
    { id: uid('dp'), orderId: 'ORD-2201', lotId: shippedLots[0]?.id, qtyT: 40, at: t0 - 2 * DAY + 11 * 3600e3, truck: '63ع441' },
    { id: uid('dp'), orderId: 'ORD-2201', lotId: shippedLots[2]?.id, qtyT: 40, at: t0 - 1 * DAY + 10 * 3600e3, truck: '63ع441' },
    { id: uid('dp'), orderId: 'ORD-2202', lotId: shippedLots[1]?.id, qtyT: 90, at: t0 - 1 * DAY + 13 * 3600e3, truck: '88ع210' },
    { id: uid('dp'), orderId: 'ORD-2203', lotId: null, qtyT: 24, at: t0 - 3 * 3600e3, truck: '20ع941' },
  ]

  // ── accounting ───────────────────────────────────────────────────────────
  const expenseDescs = [
    { en: 'Electricity bill', fa: 'قبض برق' },
    { en: 'Packing bags stock', fa: 'خرید کیسهٔ بسته‌بندی' },
    { en: 'Diesel for loaders', fa: 'گازوئیل لودرها' },
    { en: 'Machine lubricants', fa: 'روانکار ماشین‌آلات' },
  ]
  const acctEntries = []
  for (let d = 28; d >= 0; d--) {
    const ts = t0 - d * DAY + 12 * 3600e3
    if (d % 2 === 0) {
      const c = customers[d % customers.length]
      acctEntries.push({ id: uid('ac'), at: ts, kind: 'sale', desc: { en: `Flour sales invoice — ${c.en}`, fa: `فاکتور فروش آرد — ${c.fa}` }, amount: 18000 + Math.floor(Math.random() * 30000), source: 'imported', by: 'import', edits: [] })
    }
    if (d % 3 === 0) acctEntries.push({ id: uid('ac'), at: ts, kind: 'purchase', desc: { en: 'Wheat purchase — supplier settlement', fa: 'خرید گندم — تسویه با تأمین‌کننده' }, amount: -(24000 + Math.floor(Math.random() * 26000)), source: 'imported', by: 'import', edits: [] })
    if (d % 7 === 3) acctEntries.push({ id: uid('ac'), at: ts, kind: 'expense', desc: expenseDescs[d % 4], amount: -(1800 + Math.floor(Math.random() * 5200)), source: 'manual', by: 'p-acct', edits: [] })
  }
  const invoices = [
    { id: 'INV-981', customer: customers[0], amount: 32800, issuedTs: t0 - 24 * DAY, dueTs: t0 - 9 * DAY, paid: 12000 },
    { id: 'INV-987', customer: customers[2], amount: 10200, issuedTs: t0 - 18 * DAY, dueTs: t0 - 3 * DAY, paid: 0 },
    { id: 'INV-992', customer: customers[1], amount: 31950, issuedTs: t0 - 9 * DAY, dueTs: t0 + 6 * DAY, paid: 15000 },
    { id: 'INV-995', customer: customers[3], amount: 40500, issuedTs: t0 - 4 * DAY, dueTs: t0 + 11 * DAY, paid: 40500 },
    { id: 'INV-996', customer: customers[4], amount: 18675, issuedTs: t0 - 2 * DAY, dueTs: t0 + 13 * DAY, paid: 0 },
  ]

  // ── spare parts ──────────────────────────────────────────────────────────
  const partRequests = [
    {
      id: 'PR-104', machineId: 'M-RM102',
      part: { en: 'Fluted roll set (250mm)', fa: 'ست غلتک شیاردار (۲۵۰ میلی‌متر)' }, reason: 'worn',
      urgency: 'normal', estCost: 2400,
      note: { en: 'Corrugation worn below spec, extraction slipping on B1 passage.', fa: 'شیار غلتک زیر حد مجاز ساییده شده؛ راندمان در پاساژ B1 افت می‌کند.' },
      status: 'approved', by: 'p-fore1', at: now - 3 * DAY,
      history: [
        { at: now - 3 * DAY, by: 'p-fore1', action: 'submitted' },
        { at: now - 2.5 * DAY, by: 'p-owner', action: 'approved', note: { en: 'Order from the Bühler agent, ask for a freight quote first.', fa: 'از نمایندگی بولر سفارش بده؛ اول استعلام کرایهٔ حمل بگیر.' } },
      ],
    },
    {
      id: 'PR-105', machineId: 'M-SF210',
      part: { en: 'Sifter sieve frames ×6', fa: 'قاب الک ×۶' }, reason: 'preventive',
      urgency: 'low', estCost: 620,
      note: { en: 'Scheduled replacement window next month.', fa: 'تعویض برنامه‌ای در پنجرهٔ تعمیرات ماه آینده.' },
      status: 'pending', by: 'p-fore2', at: now - 26 * 3600e3,
      history: [{ at: now - 26 * 3600e3, by: 'p-fore2', action: 'submitted' }],
    },
    {
      id: 'PR-103', machineId: 'M-CL010',
      part: { en: 'Destoner deck rubber', fa: 'لاستیک دک سنگ‌گیر' }, reason: 'broken',
      urgency: 'urgent', estCost: 380,
      note: { en: 'Deck rubber torn, stones passing to first break.', fa: 'لاستیک دک پاره شده؛ سنگ به والس اول می‌رسد.' },
      status: 'purchased', by: 'p-fore1', at: now - 9 * DAY,
      history: [
        { at: now - 9 * DAY, by: 'p-fore1', action: 'submitted' },
        { at: now - 9 * DAY + 3600e3, by: 'p-owner', action: 'approved' },
        { at: now - 7 * DAY, by: 'p-owner', action: 'purchased', note: { en: 'Local supplier, fitted same day.', fa: 'تأمین‌کنندهٔ داخلی؛ همان روز نصب شد.' } },
      ],
    },
    {
      id: 'PR-101', machineId: 'M-PK300',
      part: { en: 'Stitching head assembly', fa: 'مجموعهٔ سردوخت کیسه' }, reason: 'worn',
      urgency: 'normal', estCost: 1150, note: '', status: 'purchased', by: 'p-fore2', at: now - 21 * DAY,
      history: [
        { at: now - 21 * DAY, by: 'p-fore2', action: 'submitted' },
        { at: now - 20 * DAY, by: 'p-owner', action: 'approved' },
        { at: now - 16 * DAY, by: 'p-owner', action: 'purchased' },
      ],
    },
    {
      id: 'PR-102', machineId: 'M-RM201',
      part: { en: 'Feed gate servo', fa: 'سروو دریچهٔ خوراک' }, reason: 'broken',
      urgency: 'urgent', estCost: 900,
      note: { en: 'Requested twice, second unit also failed.', fa: 'دوبار درخواست شده؛ واحد دوم هم سوخت.' },
      status: 'rejected', by: 'p-fore2', at: now - 15 * DAY,
      history: [
        { at: now - 15 * DAY, by: 'p-fore2', action: 'submitted' },
        { at: now - 14 * DAY, by: 'p-owner', action: 'rejected', note: { en: 'Maintenance to inspect wiring first — two failures in a month is not the servo.', fa: 'اول تعمیرات سیم‌کشی را بازرسی کند — دو خرابی در یک ماه کار سروو نیست.' } },
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
      resumedAt: now - 3 * DAY, status: 'resolved', cause: 'breakdown',
      note: { en: 'B1 roll bearing overheating — running at reduced feed until roll set replaced.', fa: 'بلبرینگ غلتک B1 داغ می‌کند — تا تعویض ست غلتک با خوراک کم کار می‌کنیم.' },
      reportedAt: now - 3 * DAY - 2 * 3600e3 + 4 * 60000, reportedBy: 'p-fore1', partRequestId: 'PR-104',
    },
    {
      id: uid('sr'), machineId: 'M-SF210', lineId: 'L2', stoppedAt: now - 1 * DAY - 5 * 3600e3,
      resumedAt: now - 1 * DAY - 4.2 * 3600e3, status: 'resolved', cause: 'cleaning',
      note: { en: 'Weekly sieve cleaning.', fa: 'نظافت هفتگی الک‌ها.' },
      reportedAt: now - 1 * DAY - 5 * 3600e3 + 2 * 60000, reportedBy: 'p-fore2', partRequestId: null,
    },
  ]

  // ── comm hub ─────────────────────────────────────────────────────────────
  const threads = PEOPLE.filter((p) => p.id !== 'p-owner').map((p) => ({
    id: `th-${p.id}`, participants: ['p-owner', p.id], messages: [],
  }))
  threads.find((t) => t.participants.includes('p-acct')).messages.push(
    {
      id: uid('m'), from: 'p-owner', at: now - 26 * 3600e3,
      text: { en: 'Chase Sahar Bakeries on INV-981 — it is two weeks overdue now.', fa: 'پیگیر فاکتور INV-981 نانوایی‌های سحر باش — دو هفته از سررسیدش گذشته.' },
      type: 'order', status: 'done', ackedAt: now - 25 * 3600e3, doneAt: now - 22 * 3600e3,
    },
    {
      id: uid('m'), from: 'p-acct', at: now - 22 * 3600e3,
      text: { en: 'Called their purchasing office. They promise to transfer the balance by Thursday.', fa: 'با واحد خریدشان تماس گرفتم. قول دادند مانده را تا پنجشنبه واریز کنند.' },
      type: 'message',
    },
  )
  threads.find((t) => t.participants.includes('p-lab')).messages.push(
    {
      id: uid('m'), from: 'p-lab', at: now - 5 * 3600e3,
      text: { en: 'FL-0125 moisture at 14.6% — inside limit but close. Watching the next batch.', fa: 'رطوبت بچ FL-0125 به ۱۴٫۶٪ رسیده — داخل حد اما نزدیک. بچ بعدی را زیر نظر دارم.' },
      type: 'message',
    },
  )
  // Pre-approved safety pair: lab ↔ both production foremen
  const links = [
    { id: uid('lk'), a: 'p-lab', b: 'p-fore1', scope: 'permanent', preapproved: true, task: { en: 'Quality ↔ production (safety pair)', fa: 'کیفیت ↔ تولید (جفت ایمنی)' }, grantedAt: now - 90 * DAY },
    { id: uid('lk'), a: 'p-lab', b: 'p-fore2', scope: 'permanent', preapproved: true, task: { en: 'Quality ↔ production (safety pair)', fa: 'کیفیت ↔ تولید (جفت ایمنی)' }, grantedAt: now - 90 * DAY },
  ]

  const alerts = [
    { id: uid('al'), at: now - 40 * 60000, severity: 'critical', kind: 'payment-overdue', section: 'accounting', refId: 'INV-981', params: {}, acked: false },
    { id: uid('al'), at: now - 3 * 3600e3, severity: 'warning', kind: 'understaffed', section: 'attendance', refId: 'L1', params: { workerId: workers[ABSENT_IDX].id }, acked: false },
    { id: uid('al'), at: now - 5 * 3600e3, severity: 'warning', kind: 'sensor-drift', section: 'silos', refId: 'S-W3', params: {}, acked: false },
  ]

  return {
    seededAt: now,
    currentUserId: 'p-owner',
    people: PEOPLE,
    lines, machines, silos, workers, deptRequired,
    punches, attendanceDays, corrections: [],
    intakes, flourLots, labTests,
    orders, dispatches,
    acctEntries, invoices,
    partRequests, stopReports,
    threads, links, alerts,
    liveHistory: { L1: [], L2: [] },
    productionDays,
    siloOverrides: [],
  }
}
