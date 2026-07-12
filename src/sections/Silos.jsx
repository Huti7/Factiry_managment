import React, { useState } from 'react'
import { useStore, useUser, can, PEOPLE } from '../store.jsx'
import { useLang } from '../i18n.jsx'
import { Card, Pill, Modal, Field, SectionHead, Empty } from '../components/ui.jsx'
import { fmt, ago } from '../utils.js'

export default function Silos() {
  const { state } = useStore()
  const user = useUser()
  const { t, L } = useLang()
  const [override, setOverride] = useState(null)

  const groups = [
    { label: t('si.wheatIn'), kinds: ['wheat'] },
    { label: t('si.flourOut'), kinds: ['flour', 'bran'] },
  ]

  return (
    <div className="stack">
      <SectionHead title={t('nav.silos')} sub={t('si.sub')} />

      {groups.map((g) => (
        <div key={g.label}>
          <div className="nav-label" style={{ padding: '0 0 8px' }}>{g.label}</div>
          <div className="grid cols-3">
            {state.silos.filter((s) => g.kinds.includes(s.kind)).map((s) => {
              const p = (s.levelT / s.capacityT) * 100
              const low = p < s.lowPct
              return (
                <Card key={s.id} title={L(s.name)} right={
                  s.sensorOk ? <Pill tone="green">{t('si.sensorOK')}</Pill> : <Pill tone="amber">{t('si.drift')}</Pill>
                }>
                  <div className="row" style={{ alignItems: 'stretch' }}>
                    <div style={{ flex: '0 0 64px' }}>
                      <div className="silo-bar" title={`${fmt(p, 0)}%`}>
                        <div className="silo-low-line" style={{ bottom: `${s.lowPct}%` }} />
                        <div className={`silo-fill ${low ? 'low' : s.kind}`} style={{ height: `${p}%` }} />
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className={`tile-value ${low ? 'tile-crit' : ''}`}>{fmt(s.levelT, 0)}<span className="unit">{t('si.tOf', { c: fmt(s.capacityT, 0) })}</span></div>
                      <div className="tile-ref">{t('si.fullPct', { p: fmt(p, 0), n: fmt(s.lowPct, 0) })}</div>
                      {low && <div className="notice warn mt">{t('si.belowThreshold')}</div>}
                      {can(user, 'silo-override') && (
                        <button className="btn sm mt" onClick={() => setOverride(s)}>{t('si.confirm')}</button>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      ))}

      <Card title={t('si.log')} right={<span className="muted small">{t('si.logSub')}</span>}>
        {state.siloOverrides.length === 0 && <Empty>{t('si.noOverrides')}</Empty>}
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>{t('common.when')}</th><th>{t('si.silo')}</th><th>{t('si.change')}</th><th>{t('common.by')}</th><th>{t('si.reasonReq')}</th></tr></thead>
            <tbody>
              {state.siloOverrides.slice(0, 10).map((o) => (
                <tr key={o.id}>
                  <td>{ago(o.at)}</td>
                  <td><b>{L(state.silos.find((s) => s.id === o.siloId)?.name)}</b></td>
                  <td className="num"><span className="ltr-nums">{fmt(o.from, 0)} ← {fmt(o.to, 0)}</span> {t('u.t')}</td>
                  <td>{L(PEOPLE.find((p) => p.id === o.by)?.name)}</td>
                  <td className="muted">{o.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {override && <OverrideModal silo={override} onClose={() => setOverride(null)} />}
    </div>
  )
}

function OverrideModal({ silo, onClose }) {
  const { dispatch } = useStore()
  const user = useUser()
  const { t, L } = useLang()
  const [level, setLevel] = useState(Math.round(silo.levelT))
  const [note, setNote] = useState('')

  return (
    <Modal
      title={t('si.correctTitle', { name: L(silo.name) })}
      sub={t('si.correctSub', { v: fmt(silo.levelT, 0) })}
      onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn primary" disabled={!note} onClick={() => {
          dispatch({ type: 'SILO_OVERRIDE', siloId: silo.id, levelT: Number(level), note, by: user.id })
          onClose()
        }}>{t('si.save')}</button>
      </>}
    >
      <Field label={t('si.confirmedLevel', { c: fmt(silo.capacityT, 0) })}>
        <input type="number" min="0" max={silo.capacityT} value={level} onChange={(e) => setLevel(e.target.value)} />
      </Field>
      <Field label={t('si.reasonReq')}>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('si.reasonPh')} />
      </Field>
    </Modal>
  )
}
