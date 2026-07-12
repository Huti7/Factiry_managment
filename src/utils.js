let idCounter = 1000
export const uid = (p = 'id') => `${p}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`

// Module-level locale, set by the LangProvider. 'fa' renders Persian digits,
// Jalali dates and toman amounts; 'en' renders Latin digits and dollars.
let LANG = 'en'
let LOCALE = 'en-US'
export function setLocale(lang) {
  LANG = lang
  LOCALE = lang === 'fa' ? 'fa-IR' : 'en-US'
}

export const fmt = (n, d = 1) =>
  n == null || Number.isNaN(n) ? '—' : Number(n).toLocaleString(LOCALE, { maximumFractionDigits: d, minimumFractionDigits: 0 })

// Stored amounts are abstract units: $1 in English ≈ 1 million toman in Persian.
export const money = (n) => {
  if (n == null) return '—'
  if (LANG === 'fa') {
    const s = new Intl.NumberFormat('fa-IR', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n) * 1e6)
    return `${s} تومان`
  }
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

export const pct = (n, d = 1) => (n == null || Number.isNaN(n) ? '—' : LANG === 'fa' ? `٪${fmt(n, d)}` : `${fmt(n, d)}%`)

export const timeHM = (ts) =>
  new Date(ts).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false })

export const dateShort = (ts) =>
  new Date(ts).toLocaleDateString(LOCALE, { month: 'short', day: 'numeric' })

export const dateFull = (ts) =>
  new Date(ts).toLocaleDateString(LOCALE, { year: 'numeric', month: 'short', day: 'numeric' })

export const monthLabel = (ym /* 'YYYY-MM' */) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 15).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' })
}

export const dayKey = (ts) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const monthKey = (ts) => dayKey(ts).slice(0, 7)

export const ago = (ts) => {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
  const fa = LANG === 'fa'
  if (s < 60) return fa ? `${fmt(s, 0)} ثانیه پیش` : `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return fa ? `${fmt(m, 0)} دقیقه پیش` : `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return fa ? `${fmt(h, 0)} ساعت پیش` : `${h}h ago`
  return dateShort(ts)
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

export const initials = (name) =>
  name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

export function downloadCSV(filename, headers, rows) {
  const esc = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const body = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n')
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
