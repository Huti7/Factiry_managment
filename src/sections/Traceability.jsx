import React, { useEffect, useState } from 'react'
import { useStore } from '../store.jsx'
import { useLang } from '../i18n.jsx'
import { Card, SectionHead, Pill, Empty } from '../components/ui.jsx'
import { fmt, pct, dateShort, timeHM } from '../utils.js'

const RESULT_TONE = { pass: 'green', watch: 'amber', fail: 'red' }

export default function Traceability({ focusRef }) {
  const { state } = useStore()
  const { t, L } = useLang()
  const [sel, setSel] = useState(state.flourLots[state.flourLots.length - 2]?.id || '')

  useEffect(() => {
    if (!focusRef?.refId) return
    // deep link can be a flour lot or a wheat lot number
    if (state.flourLots.some((l) => l.id === focusRef.refId)) setSel(focusRef.refId)
    else {
      const holder = state.flourLots.find((l) => l.wheatLots.includes(focusRef.refId))
      if (holder) setSel(holder.id)
    }
  }, [focusRef])

  const lot = state.flourLots.find((l) => l.id === sel)
  const intakes = lot ? state.intakes.filter((i) => lot.wheatLots.includes(i.lotNo)) : []
  const tests = lot ? state.labTests.filter((x) => x.lotId === lot.id) : []
  const wheatTests = lot ? state.labTests.filter((x) => lot.wheatLots.includes(x.lotId)) : []
  const ships = lot ? state.dispatches.filter((d) => d.lotId === lot.id) : []
  const line = lot ? state.lines.find((l) => l.id === lot.lineId) : null

  return (
    <div className="stack">
      <SectionHead title={t('nav.traceability')} sub={t('tr.sub')}>
        <select value={sel} onChange={(e) => setSel(e.target.value)} style={{ padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 7, font: 'inherit' }}>
          {[...state.flourLots].reverse().map((l) => (
            <option key={l.id} value={l.id}>{l.id} — {t(`product.${l.product}`)} · {l.date}{l.open ? ` ${t('tr.openTag')}` : ''}</option>
          ))}
        </select>
      </SectionHead>

      {!lot && <Card><Empty>{t('tr.select')}</Empty></Card>}

      {lot && (
        <Card>
          <div className="chain">
            <div className="chain-node">
              <div className="chain-rail"><div className="chain-dot" /><div className="chain-line" /></div>
              <div className="chain-body">
                <h3>{t('tr.s1', { n: fmt(intakes.length, 0) })}</h3>
                {intakes.length === 0 && <div className="muted small mt">{t('tr.noIntake')}</div>}
                <div className="tbl-wrap mt">
                  <table className="tbl">
                    <thead><tr><th>{t('tr.wheatLot')}</th><th>{t('tr.received')}</th><th>{t('in.supplier')}</th><th>{t('in.truck')}</th><th className="num">{t('in.net')}</th><th className="num">{t('in.moisture')}</th><th>{t('si.silo')}</th></tr></thead>
                    <tbody>
                      {intakes.map((i) => (
                        <tr key={i.id}>
                          <td><b>{i.lotNo}</b></td><td>{dateShort(i.at)} {timeHM(i.at)}</td><td>{L(i.supplier)}</td>
                          <td><span className="ltr-nums">{i.truckPlate}</span></td><td className="num">{fmt(i.netT, 1)}</td><td className="num">{pct(i.moisturePct, 1)}</td>
                          <td>{L(state.silos.find((s) => s.id === i.siloId)?.name)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {wheatTests.length > 0 && (
                  <div className="muted small mt">{t('tr.wheatChecks', { list: wheatTests.map((x) => `${x.lotId} ← ${t(`st.${x.result}`)}`).join(' · ') })}</div>
                )}
              </div>
            </div>

            <div className="chain-node">
              <div className="chain-rail"><div className="chain-dot" /><div className="chain-line" /></div>
              <div className="chain-body">
                <h3>{t('tr.s2', { id: lot.id })}</h3>
                <div className="kv mt">
                  <dt>{t('tr.product')}</dt><dd>{t(`product.${lot.product}`)}</dd>
                  <dt>{t('tr.line')}</dt><dd>{L(line?.name)}</dd>
                  <dt>{t('tr.date')}</dt><dd>{lot.date}{lot.open && <Pill tone="green"> {t('tr.openNow')}</Pill>}</dd>
                  <dt>{t('tr.qty')}</dt><dd>{lot.open ? t('tr.soFar', { v: fmt(line?.producedToday ?? 0, 1) }) : `${fmt(lot.tonnes, 0)} ${t('u.t')}`}</dd>
                </div>
              </div>
            </div>

            <div className="chain-node">
              <div className="chain-rail"><div className="chain-dot" /><div className="chain-line" /></div>
              <div className="chain-body">
                <h3>{t('tr.s3')}</h3>
                {tests.length === 0 && <div className="notice warn mt">{lot.open ? t('tr.noTestOpen') : t('tr.noTestWait')}</div>}
                {tests.map((x) => (
                  <div key={x.id} className="row mt">
                    <Pill tone={RESULT_TONE[x.result]}>{t(`st.${x.result}`)}</Pill>
                    <span className="small">{t('lb.moisture')} {fmt(x.moisture, 1)} · {t('lb.protein')} {fmt(x.protein, 1)} · {t('lb.ash')} {fmt(x.ash, 2)} · FN {fmt(x.fallingNumber, 0)}</span>
                    <span className="muted small">{dateShort(x.at)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="chain-node">
              <div className="chain-rail"><div className="chain-dot" /></div>
              <div className="chain-body" style={{ paddingBottom: 0 }}>
                <h3>{t('tr.s4')}</h3>
                {ships.length === 0 && <div className="muted small mt">{lot.open ? t('tr.stillOpen') : t('tr.inStockYet')}</div>}
                <div className="tbl-wrap mt">
                  {ships.length > 0 && (
                    <table className="tbl">
                      <thead><tr><th>{t('common.when')}</th><th>{t('or.order')}</th><th>{t('or.customer')}</th><th className="num">{t('or.qty')}</th><th>{t('in.truck')}</th></tr></thead>
                      <tbody>
                        {ships.map((d) => {
                          const o = state.orders.find((x) => x.id === d.orderId)
                          return <tr key={d.id}><td>{dateShort(d.at)} {timeHM(d.at)}</td><td><b>{d.orderId}</b></td><td>{L(o?.customer)}</td><td className="num">{fmt(d.qtyT, 0)}</td><td><span className="ltr-nums">{d.truck}</span></td></tr>
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
                {ships.length > 0 && (
                  <div className="notice mt">{t('tr.recall', {
                    names: ships.map((d) => L(state.orders.find((o) => o.id === d.orderId)?.customer)).filter(Boolean).join('، '),
                    v: fmt(ships.reduce((a, d) => a + d.qtyT, 0), 0),
                  })}</div>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
