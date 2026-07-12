# Al-Qamh Flour Mills — Owner Command Center

A management dashboard for a flour factory, built owner-first: the whole plant on
one screen, every communication routed through the owner, and a reason or an
approval attached to every significant action.

**The app reads and records only — it never controls machines.** The control room
keeps command of the plant; this dashboard mirrors it live.

## Run it

```bash
npm install
npm run dev        # development server
npm run build      # production build → dist/
npm run preview    # serve the production build
```

## Three live data sources → one dashboard

| Source | Feeds | In this demo |
|---|---|---|
| Plant sensors / SCADA | live production, silo levels, machine status, yield | `src/sim.js` simulates the control room on a 2 s tick |
| Gate attendance machine | fingerprint/RFID punch events | seeded punch stream in `src/data/seed.js` |
| Accounting system | imported ledger records + manual entries | seeded imports, manual entry in the UI |

Sensor data is buffered into a persistent store (localStorage in the demo,
standing in for the history database) so monthly reports survive: **sensors give
"now", the database gives "this month".**

## Sections

- **Overview** — glanceable tiles; every number is shown against a target,
  threshold, or reference — never bare.
- **Live Production** — flour type per line, output t/h vs nominal, production vs
  daily target, live extraction (flour ÷ wheat) vs 74% target, and the machine
  stop log.
- **Silos / Stock** — live levels, low-level alerts, foreman override with a
  mandatory reason (logged and reported to the owner).
- **Wheat Intake / Weighbridge** — truck weigh-in, moisture, auto lot number —
  the front of the traceability chain.
- **Lab Reports** — moisture/protein/gluten/ash/falling number per lot; a FAIL
  raises a critical alert and blocks dispatch of that lot.
- **Attendance** — interprets gate punches into present/late/absent, maps
  absences to understaffed lines ("Mill Line 1 short one operator"), flags
  missing punch-outs, logs every correction, monthly rollup.
- **Orders / Dispatch** — orders incl. bran sales; produced vs sold vs in stock;
  each shipment tied to a flour lot.
- **Accounting** — hybrid ledger with every figure tagged `imported`/`manual`,
  full edit log, and an explicit receivables (who-owes-money) view.
- **Spare-Parts Requests** — foreman submits machine/part/reason/urgency/cost;
  owner approves / rejects / asks a question; purchase is blocked until
  approval; per-machine cost history; urgent requests alert the owner instantly.
- **Traceability** — wheat intake → flour lot → lab result → dispatch, with
  recall scope.
- **Communications** — hub-and-spoke: owner has a direct line to everyone,
  spokes only talk to each other via owner-granted links (permanent or
  temporary), lab ↔ production is pre-approved as a safety pair, anyone can
  raise a flag (lands in the alerts feed + opens a thread), and owner **orders**
  are distinct from messages — they require acknowledge + done.
- **Monthly Reports** — production, attendance, accounting, downtime-by-cause;
  all exportable as CSV.

## Accountability chain

Every control-room machine stop appears live and demands a reason from the
foreman (preset causes + free text). No reason within 3 minutes → an
**unexplained stop** critical alert. A stop can spawn a linked urgent part
request, forming the chain: *stopped → why → part needed → approved → fixed →
running*.

## Roles

Use the "Viewing as" switcher (bottom of the sidebar) to see each role's view:
owner (everything + approvals + communication control), foreman (production,
silo override, part requests, own-line attendance corrections), lab technician
(lab entry), accountant (ledger + receivables).

Use the **⚡ Simulate** menu (top bar) to trigger a control-room line stop, a low
silo, or a yield dip on demand.

## Stack

React 18 + Vite, no other runtime dependencies. White/green design system in
`src/styles.css`; amber/red are reserved for warnings and alerts.
