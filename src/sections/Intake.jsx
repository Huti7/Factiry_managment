import React, { useState } from 'react'
import { useStore, useUser, can } from '../store.jsx'
import { useLang } from '../i18n.jsx'
import { Card, Modal, Field, SectionHead, Pill, Tile } from '../components/ui.jsx'
import { fmt, pct, dateShort, timeHM } from '../utils.js'

export default function Intake({ goto }) {
  const { state } = useStore()
  const user = useUser()
  const { t, L } = useLang()
  const [adding, setAdding] = useState(false)
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const today = state.intakes.filter((i) => i.at >= todayStart.getTime())
  const todayT = today.reduce((a, i) => a + i.netT, 0)
  const wk = state.intakes.filter((i) => i.at >= Date.now() - 7 * 86400e3)

  return (
    <div className="stack">
      <SectionHead title={t('nav.intake')} sub={t('in.sub')}>
        {can(user, 'add-intake') && <button className="btn primary" onClick={() => setAdding(true)}>{t('in.record')}</button>}
      </SectionHead>

      <div className="grid cols-3">
        <Tile label={t('in.today')} value={fmt(todayT, 1)} unit={t('u.t')} refText={t('in.trucksToday', { n: fmt(today.length, 0) })} tone="tile-good" />
        <Tile label={t('in.last7')} value={fmt(wk.reduce((a, i) => a + i.netT, 0), 0)} unit={t('u.t')}
          refText={t('in.deliveriesAvg', { n: fmt(wk.length, 0), v: fmt(wk.length ? wk.reduce((a, i) => a + i.netT, 0) / wk.length : 0, 1) })} />
        <Tile label={t('in.avgMoisture')} value={fmt(wk.length ? wk.reduce((a, i) => a + i.moisturePct, 0) / wk.length : 0, 1)} unit={t('u.pct')}
          refText={t('in.limitNote')} />
      </div>

      <Card title={t('in.register')} right={<span className="muted small">{t('in.newest')}</span>}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>{t('in.lot')}</th><th>{t('common.when')}</th><th>{t('in.truck')}</th><th>{t('in.supplier')}</th><th className="num">{t('in.net')}</th><th className="num">{t('in.moisture')}</th><th>{t('in.toSilo')}</th><th>{t('in.trace')}</th></tr>
            </thead>
            <tbody>
              {state.intakes.slice(0, 25).map((i) => (
                <tr key={i.id}>
                  <td><b>{i.lotNo}</b></td>
                  <td>{dateShort(i.at)} {timeHM(i.at)}</td>
                  <td><span className="ltr-nums">{i.truckPlate}</span></td>
                  <td>{L(i.supplier)}</td>
                  <td className="num">{fmt(i.netT, 1)}</td>
                  <td className="num">{i.moisturePct > 13.5 ? <Pill tone="amber">{pct(i.moisturePct, 1)}</Pill> : pct(i.moisturePct, 1)}</td>
                  <td>{L(state.silos.find((s) => s.id === i.siloId)?.name)}</td>
                  <td><button className="btn sm" onClick={() => goto('traceability', i.lotNo)}>{t('in.chain')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {adding && <IntakeModal onClose={() => setAdding(false)} />}
    </div>
  )
}

function IntakeModal({ onClose }) {
  const { state, dispatch } = useStore()
  const user = useUser()
  const { t, L } = useLang()
  const [f, setF] = useState({ truckPlate: '', supplier: '', netT: '', moisturePct: '', siloId: 'S-W1' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const ok = f.truckPlate && f.supplier && Number(f.netT) > 0 && f.moisturePct !== ''

  return (
    <Modal
      title={t('in.modalTitle')}
      sub={t('in.modalSub')}
      onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={!ok} onClick={() => { dispatch({ type: 'ADD_INTAKE', ...f, by: user.id }); onClose() }}>{t('in.saveIntake')}</button>
      </>}
    >
      <div className="form-row">
        <Field label={t('in.plate')}><input value={f.truckPlate} onChange={set('truckPlate')} placeholder="63ع441" /></Field>
        <Field label={t('in.supplier')}><input value={f.supplier} onChange={set('supplier')} placeholder={t('in.supplierPh')} /></Field>
      </div>
      <div className="form-row">
        <Field label={t('in.netW')}><input type="number" step="0.1" value={f.netT} onChange={set('netT')} /></Field>
        <Field label={t('in.moistPct')}><input type="number" step="0.1" value={f.moisturePct} onChange={set('moisturePct')} /></Field>
      </div>
      <Field label={t('in.unloadInto')}>
        <select value={f.siloId} onChange={set('siloId')}>
          {state.silos.filter((s) => s.kind === 'wheat').map((s) => (
            <option key={s.id} value={s.id}>{L(s.name)} — {fmt(s.levelT, 0)}/{fmt(s.capacityT, 0)} {t('u.t')}</option>
          ))}
        </select>
      </Field>
      {Number(f.moisturePct) > 13.5 && <div className="notice warn">{t('in.aboveLimit')}</div>}
    </Modal>
  )
}
