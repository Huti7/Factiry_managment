import React from 'react'
import { useStore } from '../store.jsx'
import { useLang } from '../i18n.jsx'
import { alertText } from '../alertText.js'
import { Tile, Card, StatusDot, Pill, Sparkline } from '../components/ui.jsx'
import { staffing, stockSummary, receivables } from '../derive.js'
import { fmt, money, pct, ago } from '../utils.js'

export default function Overview({ goto }) {
  const { state } = useStore()
  const { t, L } = useLang()

  const targetTotal = state.lines.reduce((a, l) => a + l.targetTpd, 0)
  const produced = state.lines.reduce((a, l) => a + l.producedToday, 0)
  const running = state.lines.filter((l) => l.status === 'running')
  const extraction = running.length
    ? (running.reduce((a, l) => a + l.rateTph, 0) / running.reduce((a, l) => a + l.wheatInTph, 0)) * 100
    : null

  const stock = stockSummary(state)
  const staff = staffing(state)
  const short = staff.filter((g) => g.present < g.required)
  const totalPresent = staff.reduce((a, g) => a + g.present, 0)
  const totalRequired = staff.reduce((a, g) => a + g.required, 0)
  const recv = receivables(state)
  const overdue = recv.filter((r) => r.overdueDays > 0)
  const overdueSum = overdue.reduce((a, r) => a + r.balance, 0)
  const pendingParts = state.partRequests.filter((r) => r.status === 'pending')
  const urgentParts = pendingParts.filter((r) => r.urgency === 'urgent')

  const prodPct = (produced / targetTotal) * 100
  const stationName = (g) => (g.nameKey ? t(g.nameKey) : L(g.name))

  return (
    <div className="stack">
      <div className="grid cols-3">
        <Tile
          label={t('ov.prodToday')}
          value={fmt(produced, 0)} unit={t('ov.unitTarget', { t: fmt(targetTotal, 0) })}
          refText={<>{t('ov.pace', { p: pct(prodPct, 0) })} · {state.lines.length - running.length
            ? <span className="tile-crit">{t('ov.nStopped', { n: fmt(state.lines.length - running.length, 0) })}</span>
            : t('ov.allRunning')}</>}
          tone={prodPct < 40 ? 'tile-warn' : 'tile-good'}
          progress={prodPct}
        />
        <Tile
          label={t('ov.extraction')}
          value={extraction ? fmt(extraction, 1) : '—'} unit={t('u.pct')}
          refText={<>{t('ov.targetIs', { t: pct(74, 0) })} — {extraction == null ? t('ov.noLine') : extraction >= 72 ? t('ov.within') : t('ov.below')}</>}
          tone={extraction == null ? '' : extraction >= 72 ? 'tile-good' : extraction >= 69 ? 'tile-warn' : 'tile-crit'}
          progress={extraction ? (extraction / 80) * 100 : 0} progressTick={(74 / 80) * 100}
        />
        <Tile
          label={t('ov.wheatSilos')}
          value={fmt(stock.wheatStock, 0)} unit={t('u.t')}
          refText={t('ov.daysAtRate', { d: stock.wheatDays ? fmt(stock.wheatDays, 1) : '—', r: fmt(stock.wheatUseTph, 1) })}
          tone={stock.wheatDays != null && stock.wheatDays < 5 ? 'tile-warn' : ''}
        />
      </div>

      <div className="grid cols-3">
        <Tile
          label={t('ov.staff')}
          value={fmt(totalPresent, 0)} unit={t('ov.ofRequired', { n: fmt(totalRequired, 0) })}
          refText={short.length
            ? <span className="tile-crit">{short.map((s) => t('ov.shortOne', { name: stationName(s), n: fmt(s.required - s.present, 0) })).join(' · ')}</span>
            : t('ov.fullyStaffed')}
          tone={short.length ? 'tile-warn' : 'tile-good'}
          progress={(totalPresent / totalRequired) * 100}
        />
        <Tile
          label={t('ov.recv')}
          value={money(recv.reduce((a, r) => a + r.balance, 0))}
          refText={overdue.length
            ? <span className="tile-crit">{t('ov.overdueN', { n: fmt(overdue.length, 0), sum: money(overdueSum) })}</span>
            : t('ov.noOverdue')}
          tone={overdue.length ? 'tile-crit' : 'tile-good'}
        />
        <Tile
          label={t('ov.approvals')}
          value={fmt(pendingParts.length, 0)} unit={t('ov.partReqUnit')}
          refText={urgentParts.length
            ? <span className="tile-crit">{t('ov.urgentTotal', { n: fmt(urgentParts.length, 0), sum: money(pendingParts.reduce((a, r) => a + r.estCost, 0)) })}</span>
            : pendingParts.length ? t('ov.estTotal', { sum: money(pendingParts.reduce((a, r) => a + r.estCost, 0)) }) : t('ov.queueEmpty')}
          tone={urgentParts.length ? 'tile-crit' : pendingParts.length ? 'tile-warn' : 'tile-good'}
        />
      </div>

      <div className="grid cols-2">
        {state.lines.map((ln) => {
          const hist = (state.liveHistory[ln.id] || []).map((p) => ({ v: p.rate }))
          const ex = ln.wheatInTph ? (ln.rateTph / ln.wheatInTph) * 100 : 0
          return (
            <Card key={ln.id} title={<span><StatusDot status={ln.status} /> &nbsp;{L(ln.name)} — {t(`product.${ln.product}`)}</span>}
              right={<button className="btn sm" onClick={() => goto('production')}>{t('common.open')}</button>}>
              {ln.status === 'running' ? (
                <>
                  <div className="tile-value tile-good">{fmt(ln.rateTph, 1)}<span className="unit">{t('u.tph')} · {t('pr.extraction')} {pct(ex, 1)}</span></div>
                  <div className="tile-ref">{t('ov.today')} <b>{fmt(ln.producedToday, 0)} {t('u.t')}</b> {t('ov.ofTargetShort', { t: fmt(ln.targetTpd, 0) })}</div>
                  <div className="progress"><i style={{ width: `${Math.min(100, (ln.producedToday / ln.targetTpd) * 100)}%` }} /></div>
                  <div className="mt"><Sparkline points={hist} refValue={ln.nominalTph} unit=" t/h" label={`${L(ln.name)} output rate trend`} /></div>
                </>
              ) : (
                <>
                  <div className="tile-value tile-crit">{t('st.stopped')}</div>
                  <div className="tile-ref">{t('ov.today')} <b>{fmt(ln.producedToday, 0)} {t('u.t')}</b> {t('ov.ofTargetShort', { t: fmt(ln.targetTpd, 0) })} — {t('ov.outputHalted')}</div>
                  <div className="progress"><i className="crit" style={{ width: `${Math.min(100, (ln.producedToday / ln.targetTpd) * 100)}%` }} /></div>
                </>
              )}
            </Card>
          )
        })}
      </div>

      <div className="grid cols-2">
        <Card title={t('ov.prodVsSold')} right={<button className="btn sm" onClick={() => goto('orders')}>{t('nav.orders')}</button>}>
          <div className="kv" style={{ gridTemplateColumns: '1fr auto' }}>
            <dt>{t('ov.producedToday')}</dt><dd>{fmt(stock.producedToday, 1)} {t('u.t')}</dd>
            <dt>{t('ov.flourBins')}</dt><dd>{fmt(stock.flourStock, 0)} {t('u.t')}</dd>
            <dt>{t('ov.branBin')}</dt><dd>{fmt(stock.branStock, 0)} {t('u.t')}</dd>
            <dt>{t('ov.committed')}</dt><dd>{t('ov.pendingDispatch', { v: fmt(stock.pendingT, 0) })}</dd>
          </div>
          {stock.pendingT > stock.flourStock + stock.branStock && (
            <div className="notice warn mt">{t('ov.exceeds')}</div>
          )}
        </Card>
        <Card title={t('ov.activity')} right={<span className="muted small">{t('ov.alertHistory')}</span>}>
          <div className="log-list">
            {state.alerts.slice(0, 6).map((a) => (
              <div key={a.id} className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <Pill tone={a.severity === 'critical' ? 'red' : a.severity === 'warning' ? 'amber' : 'green'}>{t(`sev.${a.severity}`)}</Pill>{' '}
                  {alertText(a, { state, t, L })}
                </span>
                <span className="muted small" style={{ flex: '0 0 auto' }}>{ago(a.at)}{a.acked ? ' · ✓' : ''}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
