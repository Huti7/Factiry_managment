import React from 'react'
import { fmt } from '../utils.js'

export function Card({ title, right, children, className = '', pad0 = false }) {
  return (
    <div className={`card ${pad0 ? 'pad-0' : ''} ${className}`}>
      {(title || right) && (
        <div className="card-head" style={pad0 ? { padding: '14px 16px 0' } : undefined}>
          {title && <h3>{title}</h3>}
          {right && <div className="right">{right}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

/** Stat tile: always a value against a reference — never a bare number. */
export function Tile({ label, value, unit, refText, tone = '', progress, progressTick, right }) {
  return (
    <div className="card">
      <div className="card-head"><h3>{label}</h3>{right && <div className="right">{right}</div>}</div>
      <div className={`tile-value ${tone}`}>
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      {refText && <div className="tile-ref">{refText}</div>}
      {progress != null && (
        <div className="progress">
          <i className={tone === 'tile-crit' ? 'crit' : tone === 'tile-warn' ? 'warn' : ''} style={{ width: `${Math.min(100, progress)}%` }} />
          {progressTick != null && <span className="tick" style={{ left: `${Math.min(100, progressTick)}%` }} />}
        </div>
      )}
    </div>
  )
}

export function Pill({ tone = 'gray', children }) {
  return <span className={`pill ${tone}`}>{children}</span>
}

export function StatusDot({ status }) {
  const cls = status === 'running' ? 'run pulse' : status === 'stopped' ? 'stop' : 'idle'
  return <span className={`dot ${cls}`} />
}

/** Minimal SVG line sparkline. Single green series, hairline reference. */
export function Sparkline({ points, refValue, min, max, height = 46, width = 220, unit = '', label }) {
  if (!points || points.length < 2) return <div className="muted small">collecting data…</div>
  const vals = points.map((p) => p.v)
  const lo = min ?? Math.min(...vals, refValue ?? Infinity) * 0.97
  const hi = max ?? Math.max(...vals, refValue ?? -Infinity) * 1.03
  const x = (i) => (i / (points.length - 1)) * (width - 4) + 2
  const y = (v) => height - 4 - ((v - lo) / (hi - lo || 1)) * (height - 8)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const last = points[points.length - 1]
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height }} role="img" aria-label={label || `trend, latest ${fmt(last.v)}${unit}`}>
      {refValue != null && refValue >= lo && refValue <= hi && (
        <line x1="2" x2={width - 2} y1={y(refValue)} y2={y(refValue)} stroke="#b9c4bd" strokeWidth="1" strokeDasharray="4 3" />
      )}
      <path d={d} fill="none" stroke="#0e7a3d" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(points.length - 1)} cy={y(last.v)} r="3.5" fill="#0e7a3d" stroke="#fff" strokeWidth="1.5" />
    </svg>
  )
}

export function Modal({ title, sub, onClose, children, actions }) {
  return (
    <div className="modal-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        {sub && <div className="sub">{sub}</div>}
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  )
}

export function SectionHead({ title, sub, children }) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {sub && <div className="sub">{sub}</div>}
      </div>
      <div className="right">{children}</div>
    </div>
  )
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>
}

export function Seg({ options, value, onChange }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
