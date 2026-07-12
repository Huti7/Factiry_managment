import React from 'react'
import { useStore, useUser, can } from '../store.jsx'
import { useLang } from '../i18n.jsx'
import { alertText } from '../alertText.js'
import { ago } from '../utils.js'

const ICONS = { critical: '⛔', warning: '⚠️', info: 'ℹ️' }

export function AlertsStrip({ goto }) {
  const { state, dispatch } = useStore()
  const user = useUser()
  const { t, L } = useLang()
  const active = state.alerts.filter((a) => !a.acked).slice(0, 12)

  return (
    <div className="alert-strip" role="region" aria-label={t('alerts.label')}>
      <span className="alert-strip-label">🔔 {t('alerts.label')}</span>
      {active.length === 0 && (
        <span className="alert-clear">{t('alerts.allClear')}</span>
      )}
      {active.map((a) => (
        <span
          key={a.id}
          className={`alert-chip ${a.severity}`}
          onClick={() => goto(a.section, a.refId)}
          title={t('alerts.openHint')}
        >
          {ICONS[a.severity]} {alertText(a, { state, t, L })} <span className="t">· {ago(a.at)}</span>
          {can(user, 'ack-alerts') && (
            <button
              className="btn sm"
              style={{ padding: '0 6px', marginInlineStart: 2 }}
              onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ACK_ALERT', id: a.id, by: user.id }) }}
              title={t('alerts.ack')}
            >✓</button>
          )}
        </span>
      ))}
      {active.length > 1 && can(user, 'ack-alerts') && (
        <button className="btn sm" style={{ flex: '0 0 auto' }} onClick={() => dispatch({ type: 'ACK_ALL_ALERTS', by: user.id })}>
          {t('alerts.ackAll')}
        </button>
      )}
    </div>
  )
}
