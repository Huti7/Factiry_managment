import React, { useState } from 'react'
import { useStore, useUser, can, PEOPLE } from '../store.jsx'
import { useLang } from '../i18n.jsx'
import { Card, Modal, Field, SectionHead, Pill, Empty } from '../components/ui.jsx'
import { fmt, dateShort, timeHM } from '../utils.js'

const RESULT_TONE = { pass: 'green', watch: 'amber', fail: 'red' }

export default function Lab({ goto }) {
  const { state } = useStore()
  const user = useUser()
  const { t, L } = useLang()
  const [adding, setAdding] = useState(false)

  const testedLots = new Set(state.labTests.map((x) => x.lotId))
  const awaiting = state.flourLots.filter((l) => !l.open && !testedLots.has(l.id))

  return (
    <div className="stack">
      <SectionHead title={t('nav.lab')} sub={t('lb.sub')}>
        {can(user, 'add-lab') && <button className="btn primary" onClick={() => setAdding(true)}>{t('lb.enter')}</button>}
      </SectionHead>

      {awaiting.length > 0 && (
        <div className="notice">{t('lb.awaiting', { n: fmt(awaiting.length, 0), lots: awaiting.map((l) => l.id).join('، ') })}</div>
      )}

      <Card title={t('lb.register')}>
        {state.labTests.length === 0 && <Empty>{t('lb.none')}</Empty>}
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('lb.lot')}</th><th>{t('common.when')}</th><th className="num">{t('lb.moisture')}</th><th className="num">{t('lb.protein')}</th>
                <th className="num">{t('lb.gluten')}</th><th className="num">{t('lb.ash')}</th><th className="num">{t('lb.fn')}</th>
                <th>{t('lb.result')}</th><th>{t('common.by')}</th><th>{t('in.trace')}</th>
              </tr>
            </thead>
            <tbody>
              {state.labTests.slice(0, 30).map((x) => (
                <tr key={x.id}>
                  <td><b>{x.lotId}</b></td>
                  <td>{dateShort(x.at)} {timeHM(x.at)}</td>
                  <td className="num">{fmt(x.moisture, 1)}</td>
                  <td className="num">{fmt(x.protein, 1)}</td>
                  <td className="num">{fmt(x.gluten, 1)}</td>
                  <td className="num">{fmt(x.ash, 2)}</td>
                  <td className="num">{fmt(x.fallingNumber, 0)}</td>
                  <td><Pill tone={RESULT_TONE[x.result]}>{t(`st.${x.result}`)}</Pill>{x.note && <div className="muted small">{L(x.note)}</div>}</td>
                  <td>{L(PEOPLE.find((p) => p.id === x.by)?.name) || x.by}</td>
                  <td><button className="btn sm" onClick={() => goto('traceability', x.lotId)}>{t('in.chain')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={t('lb.limits')} right={<span className="muted small">{t('lb.houseSpec')}</span>}>
        <div className="kv">
          <dt>{t('lb.moisture')}</dt><dd>{t('lb.limMoisture')}</dd>
          <dt>{t('lb.protein')}</dt><dd>{t('lb.limProtein')}</dd>
          <dt>{t('lb.ash')}</dt><dd>{t('lb.limAsh')}</dd>
          <dt>{t('lb.fn')}</dt><dd>{t('lb.limFN')}</dd>
        </div>
      </Card>

      {adding && <LabModal onClose={() => setAdding(false)} />}
    </div>
  )
}

function LabModal({ onClose }) {
  const { state, dispatch } = useStore()
  const user = useUser()
  const { t } = useLang()
  const lots = [...state.flourLots].reverse()
  const [f, setF] = useState({ lotId: lots[0]?.id || '', moisture: '', protein: '', gluten: '', ash: '', fallingNumber: '', result: 'pass', note: '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const ok = f.lotId && f.moisture !== '' && f.protein !== ''

  return (
    <Modal
      title={t('lb.modalTitle')}
      sub={t('lb.modalSub')}
      onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={!ok} onClick={() => {
          dispatch({
            type: 'ADD_LAB_TEST', by: user.id,
            test: {
              lotId: f.lotId, moisture: Number(f.moisture), protein: Number(f.protein),
              gluten: Number(f.gluten) || null, ash: Number(f.ash) || null,
              fallingNumber: Number(f.fallingNumber) || null, result: f.result, note: f.note,
            },
          })
          onClose()
        }}>{t('lb.saveTest')}</button>
      </>}
    >
      <Field label={t('lb.lot')}>
        <select value={f.lotId} onChange={set('lotId')}>
          <optgroup label={t('lb.flourLots')}>
            {lots.map((l) => <option key={l.id} value={l.id}>{l.id} — {t(`product.${l.product}`)} ({l.date})</option>)}
          </optgroup>
          <optgroup label={t('lb.wheatLots')}>
            {state.intakes.slice(0, 10).map((i) => {
              const sup = typeof i.supplier === 'string' ? i.supplier : `${i.supplier.fa} / ${i.supplier.en}`
              return <option key={i.id} value={i.lotNo}>{i.lotNo} — {sup}</option>
            })}
          </optgroup>
        </select>
      </Field>
      <div className="form-row">
        <Field label={t('lb.moisture')}><input type="number" step="0.1" value={f.moisture} onChange={set('moisture')} /></Field>
        <Field label={t('lb.protein')}><input type="number" step="0.1" value={f.protein} onChange={set('protein')} /></Field>
        <Field label={t('lb.gluten')}><input type="number" step="0.1" value={f.gluten} onChange={set('gluten')} /></Field>
      </div>
      <div className="form-row">
        <Field label={t('lb.ash')}><input type="number" step="0.01" value={f.ash} onChange={set('ash')} /></Field>
        <Field label={t('lb.fn')}><input type="number" value={f.fallingNumber} onChange={set('fallingNumber')} /></Field>
        <Field label={t('lb.result')}>
          <select value={f.result} onChange={set('result')}>
            <option value="pass">{t('lb.resPass')}</option>
            <option value="watch">{t('lb.resWatch')}</option>
            <option value="fail">{t('lb.resFail')}</option>
          </select>
        </Field>
      </div>
      <Field label={t('lb.note')}><input value={f.note} onChange={set('note')} placeholder={t('lb.notePh')} /></Field>
      {f.result === 'fail' && <div className="notice warn">{t('lb.failWarn')}</div>}
    </Modal>
  )
}
