import React, { useState } from 'react'
import { useStore } from '../store.jsx'
import { useLang } from '../i18n.jsx'
import { Card, SectionHead, Pill, Empty } from '../components/ui.jsx'
import { fmt, pct, money, timeHM, dateShort, ago } from '../utils.js'

// Fixed layout of the plant mimic (SVG coordinates, always LTR like a P&ID).
const MACHINE_POS = {
  'M-WB001': { x: 18, y: 182 },
  'M-CL010': { x: 322, y: 182 },
  'M-RM101': { x: 458, y: 72 }, 'M-RM102': { x: 556, y: 72 }, 'M-SF110': { x: 654, y: 72 }, 'M-PU115': { x: 752, y: 72 },
  'M-RM201': { x: 458, y: 292 }, 'M-SF210': { x: 556, y: 292 },
  'M-PK300': { x: 952, y: 182 },
}
const NODE_W = 86, NODE_H = 46
const WHEAT_X = { 'S-W1': 142, 'S-W2': 204, 'S-W3': 266 } // silo left edges, y=30
const SILO_W = 46, SILO_H = 118

function Silo({ silo, x, y, w = SILO_W, h = SILO_H, sel, onClick, L, labelDy = 0 }) {
  const p = Math.max(0, Math.min(1, silo.levelT / silo.capacityT))
  const low = p * 100 < silo.lowPct
  const fill = low ? 'var(--crit)' : silo.kind === 'wheat' ? 'var(--green-500)' : silo.kind === 'bran' ? 'var(--green-800)' : 'var(--green-600)'
  return (
    <g className={`node ${sel ? 'sel' : ''}`} onClick={onClick}>
      <rect className="box" x={x} y={y} width={w} height={h} rx="7" />
      <rect x={x + 3} y={y + 3 + (h - 6) * (1 - p)} width={w - 6} height={(h - 6) * p} rx="4" fill={fill} opacity="0.85" />
      {/* low-level threshold mark */}
      <line x1={x + 3} x2={x + w - 3} y1={y + 3 + (h - 6) * (1 - silo.lowPct / 100)} y2={y + 3 + (h - 6) * (1 - silo.lowPct / 100)} stroke="var(--warn-hue)" strokeDasharray="3 3" strokeWidth="1.5" />
      <text x={x + w / 2} y={y + h + 15 + labelDy} textAnchor="middle" className="lbl">{L(silo.name)}</text>
      <text x={x + w / 2} y={y + h + 29 + labelDy} textAnchor="middle" className="code">{fmt(silo.levelT, 0)} / {fmt(silo.capacityT, 0)}</text>
    </g>
  )
}

function Machine({ m, state, sel, onClick, L }) {
  const pos = MACHINE_POS[m.id]
  const [word, code] = (() => {
    const parts = L(m.name).split(' ')
    return [parts.slice(0, -1).join(' '), parts[parts.length - 1]]
  })()
  const dot = state === 'running' ? 'var(--green-600)' : state === 'stopped' ? 'var(--crit)' : state === 'held' ? 'var(--warn-hue)' : 'var(--ink-3)'
  return (
    <g className={`node ${sel ? 'sel' : ''} ${state === 'running' ? 'run' : ''} ${state === 'stopped' ? 'stop' : ''}`} onClick={onClick}>
      <rect className="box" x={pos.x} y={pos.y} width={NODE_W} height={NODE_H} rx="9" />
      <circle cx={pos.x + NODE_W - 11} cy={pos.y + 11} r="4.5" fill={dot} className={state === 'running' ? 'pulse' : ''} />
      <text x={pos.x + NODE_W / 2} y={pos.y + 20} textAnchor="middle" className="lbl" style={{ fontWeight: 650 }}>{word}</text>
      <text x={pos.x + NODE_W / 2} y={pos.y + 35} textAnchor="middle" className="code">{code}</text>
    </g>
  )
}

function Pipe({ d, live, bran }) {
  return (
    <>
      <path className="pipe" d={d} />
      {live && <path className={`pipe-live ${bran ? 'bran' : ''}`} d={d} />}
    </>
  )
}

export default function Twin({ goto }) {
  const { state } = useStore()
  const { t, L } = useLang()
  const [sel, setSel] = useState(null) // {type:'machine'|'silo', id}

  const l1 = state.lines.find((l) => l.id === 'L1')
  const l2 = state.lines.find((l) => l.id === 'L2')
  const anyRun = l1.status === 'running' || l2.status === 'running'
  const openStopByMachine = {}
  state.stopReports.forEach((r) => { if (r.status !== 'resolved') openStopByMachine[r.machineId] = r })

  const machineState = (m) => {
    if (openStopByMachine[m.id]) return 'stopped'
    if (m.id === 'M-WB001') return 'idle'
    if (!m.lineId) return anyRun ? 'running' : 'idle'
    const line = m.lineId === 'L1' ? l1 : l2
    return line.status === 'running' ? 'running' : 'held'
  }

  const silo = (id) => state.silos.find((s) => s.id === id)
  const pick = (type, id) => setSel(sel?.id === id ? null : { type, id })
  const wheatIn = (l1.status === 'running' ? l1.wheatInTph : 0) + (l2.status === 'running' ? l2.wheatInTph : 0)
  const flourOut = (l1.status === 'running' ? l1.rateTph : 0) + (l2.status === 'running' ? l2.rateTph : 0)

  return (
    <div className="stack">
      <SectionHead title={t('nav.twin')} sub={t('tw.sub')}>
        <span className="pill green">{t('pr.wheatFeed')}: <b>{fmt(wheatIn, 1)}</b> {t('u.tph')}</span>
        <span className="pill green">{t('pr.outputRate')}: <b>{fmt(flourOut, 1)}</b> {t('u.tph')}</span>
        <span className="pill gray">{t('pr.extraction')}: <b>{wheatIn ? pct((flourOut / wheatIn) * 100, 1) : '—'}</b></span>
      </SectionHead>

      <div className="twin-grid">
        <Card pad0>
          <div dir="ltr" style={{ padding: '10px 6px 2px' }}>
            <svg className="twin-svg" viewBox="0 0 1120 480" role="img" aria-label={t('nav.twin')}>
              {/* intake → wheat silos manifold */}
              <Pipe d="M104,205 C120,205 118,58 142,34 H288" live={anyRun} />
              <Pipe d="M165,34 V30 M227,34 V30" live={false} />
              {/* silos → cleaner */}
              <Pipe d={`M165,${30 + SILO_H} V196 H322`} live={anyRun} />
              <Pipe d={`M227,${30 + SILO_H} V196`} live={anyRun} />
              <Pipe d={`M289,${30 + SILO_H} V196`} live={anyRun} />
              {/* cleaner → the two mill lines */}
              <Pipe d="M408,198 C436,198 430,95 458,95" live={l1.status === 'running'} />
              <Pipe d="M408,212 C436,212 430,315 458,315" live={l2.status === 'running'} />
              {/* line 1 chain */}
              <Pipe d="M544,95 H556" live={l1.status === 'running'} />
              <Pipe d="M642,95 H654" live={l1.status === 'running'} />
              <Pipe d="M740,95 H752" live={l1.status === 'running'} />
              <Pipe d="M838,95 C862,95 858,90 882,90" live={l1.status === 'running'} />
              {/* line 2 chain */}
              <Pipe d="M544,315 H556" live={l2.status === 'running'} />
              <Pipe d="M642,315 C666,315 662,310 686,310" live={l2.status === 'running'} />
              {/* bran drops from the sifters */}
              <Pipe d="M697,118 C697,240 748,330 800,392" live={l1.status === 'running'} bran />
              <Pipe d="M599,338 C599,375 700,395 800,412" live={l2.status === 'running'} bran />
              {/* bins → packing */}
              <Pipe d={`M905,${90 + SILO_H} C905,196 928,196 952,196`} live={anyRun} />
              <Pipe d="M709,310 C860,310 900,214 952,214" live={l2.status === 'running'} />
              {/* packing → dispatch */}
              <Pipe d="M1038,205 H1092" live={anyRun} />

              {/* rate labels on the lanes */}
              <text x="470" y="60" className="rate">{fmt(l1.rateTph, 1)} {t('u.tph')} · {t(`product.${l1.product}`)}</text>
              <text x="470" y="280" className="rate">{fmt(l2.rateTph, 1)} {t('u.tph')} · {t(`product.${l2.product}`)}</text>
              <text x="40" y="168" className="lbl">{t('tw.intake')}</text>
              <text x="1092" y="190" className="lbl" textAnchor="end">{t('tw.dispatch')} ⬅</text>

              {/* wheat silos */}
              {Object.entries(WHEAT_X).map(([id, x], i) => (
                <Silo key={id} silo={silo(id)} x={x} y={30} sel={sel?.id === id} onClick={() => pick('silo', id)} L={L} labelDy={i === 1 ? 30 : 0} />
              ))}
              {/* flour bins + bran bin */}
              <Silo silo={silo('S-F1')} x={882} y={90} sel={sel?.id === 'S-F1'} onClick={() => pick('silo', 'S-F1')} L={L} />
              <Silo silo={silo('S-F2')} x={686} y={252} h={58} sel={sel?.id === 'S-F2'} onClick={() => pick('silo', 'S-F2')} L={L} />
              <Silo silo={silo('S-B1')} x={800} y={384} h={58} sel={sel?.id === 'S-B1'} onClick={() => pick('silo', 'S-B1')} L={L} />

              {/* machines */}
              {state.machines.map((m) => (
                <Machine key={m.id} m={m} state={machineState(m)} sel={sel?.id === m.id} onClick={() => pick('machine', m.id)} L={L} />
              ))}
            </svg>
          </div>
          <div className="muted small" style={{ padding: '4px 16px 12px' }}>
            <span className="dot run" /> {t('st.running')} &nbsp; <span className="dot stop" /> {t('st.stopped')} &nbsp;
            <span className="dot idle" /> {t('tw.idle')} &nbsp;·&nbsp; <span style={{ color: 'var(--green-500)' }}>—</span> {t('tw.wheatLine')}/{t('product.zero')} &nbsp;
            <span style={{ color: 'var(--green-800)' }}>—</span> {t('tw.branLine')}
          </div>
        </Card>

        {sel?.type === 'machine' && <MachineFile id={sel.id} goto={goto} />}
        {sel?.type === 'silo' && <SiloFile id={sel.id} goto={goto} />}
        {!sel && <Card><Empty>{t('tw.select')}</Empty></Card>}
      </div>
    </div>
  )
}

function MachineFile({ id, goto }) {
  const { state } = useStore()
  const { t, L } = useLang()
  const m = state.machines.find((x) => x.id === id)
  const line = state.lines.find((l) => l.id === m.lineId)
  const stops = state.stopReports.filter((r) => r.machineId === id)
  const open = stops.find((r) => r.status !== 'resolved')
  const downMin = stops.reduce((a, r) => a + Math.round(((r.resumedAt || Date.now()) - r.stoppedAt) / 60000), 0)
  const parts = state.partRequests.filter((r) => r.machineId === id)
  const spend = parts.filter((r) => r.status === 'approved' || r.status === 'purchased').reduce((a, r) => a + r.estCost, 0)
  const lastCaused = stops.find((r) => r.cause)

  return (
    <Card title={t('tw.machineFile')} right={line ? <Pill tone="gray">{L(line.name)}</Pill> : null}>
      <h3 style={{ fontSize: 16, marginBottom: 8 }}>{L(m.name)}</h3>
      {open ? (
        <div className="notice warn" style={{ marginBottom: 10 }}>
          ⛔ {t('tw.openStop')}: {timeHM(open.stoppedAt)} — {open.cause ? t(`cause.${open.cause}`) : t('tw.awaitingReason')}
          {open.partRequestId && <> · <button className="btn sm" onClick={() => goto('parts', open.partRequestId)}>{open.partRequestId}</button></>}
        </div>
      ) : (
        <div className="notice" style={{ marginBottom: 10 }}>✓ {line ? (line.status === 'running' ? t('st.running') : t('tw.held')) : t('tw.idle')}</div>
      )}
      <div className="kv" style={{ gridTemplateColumns: '1fr auto' }}>
        <dt>{t('tw.stopsRec')}</dt><dd>{fmt(stops.length, 0)}</dd>
        <dt>{t('tw.totalDown')}</dt><dd>{fmt(downMin, 0)} {t('u.min')}</dd>
        <dt>{t('tw.lastCause')}</dt><dd>{lastCaused ? t(`cause.${lastCaused.cause}`) : '—'}</dd>
        <dt>{t('tw.partReqs')}</dt><dd>{fmt(parts.length, 0)}</dd>
        <dt>{t('tw.partsSpend')}</dt><dd>{money(spend)}</dd>
      </div>
      {stops.length > 0 && (
        <div className="mt">
          <div className="nav-label" style={{ padding: 0 }}>{t('tw.recent')}</div>
          <div className="log-list mt">
            {stops.slice(0, 3).map((r) => (
              <div key={r.id}>· {dateShort(r.stoppedAt)} {timeHM(r.stoppedAt)} — {r.cause ? t(`cause.${r.cause}`) : t('tw.awaitingReason')} <span className="muted">({ago(r.stoppedAt)})</span></div>
            ))}
          </div>
        </div>
      )}
      {stops.length === 0 && <div className="muted small mt">{t('tw.noStops')}</div>}
      <div className="row mt">
        <button className="btn sm" onClick={() => goto('production')}>{t('tw.goStops')}</button>
        <button className="btn sm" onClick={() => goto('parts')}>{t('tw.goParts')}</button>
      </div>
    </Card>
  )
}

function SiloFile({ id, goto }) {
  const { state } = useStore()
  const { t, L } = useLang()
  const s = state.silos.find((x) => x.id === id)
  const p = (s.levelT / s.capacityT) * 100
  const low = p < s.lowPct
  const overrides = state.siloOverrides.filter((o) => o.siloId === id)

  return (
    <Card title={t('tw.siloFile')} right={s.sensorOk ? <Pill tone="green">{t('si.sensorOK')}</Pill> : <Pill tone="amber">{t('si.drift')}</Pill>}>
      <h3 style={{ fontSize: 16, marginBottom: 8 }}>{L(s.name)}</h3>
      <div className={`tile-value ${low ? 'tile-crit' : ''}`}>{fmt(s.levelT, 0)}<span className="unit">{t('si.tOf', { c: fmt(s.capacityT, 0) })}</span></div>
      <div className="tile-ref">{t('si.fullPct', { p: fmt(p, 0), n: fmt(s.lowPct, 0) })}</div>
      <div className="progress"><i className={low ? 'crit' : ''} style={{ width: `${Math.min(100, p)}%` }} />
        <span className="tick" style={{ insetInlineStart: `${s.lowPct}%` }} /></div>
      {low && <div className="notice warn mt">{t('si.belowThreshold')}</div>}
      {overrides.length > 0 && (
        <div className="muted small mt">✎ {overrides.length} × {t('si.log')}</div>
      )}
      <div className="row mt">
        <button className="btn sm" onClick={() => goto('silos')}>{t('tw.goSilos')}</button>
      </div>
    </Card>
  )
}
