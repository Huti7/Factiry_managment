// Demo authentication for the factory's private deployment.
// NOTE: this is client-side demo auth so the client can feel the flow — a real
// deployment moves credential checks to the backend (see README).
import { PEOPLE } from './data/seed.js'

export const ACCOUNTS = [
  { user: 'arash', personId: 'p-owner' },
  { user: 'bagher', personId: 'p-fore1' },
  { user: 'shangarain', personId: 'p-lab' },
  { user: 'negin', personId: 'p-acct' },
  { user: 'reza', personId: 'p-sales' },
  { user: 'amir', personId: 'p-buy' },
  { user: 'behnam', personId: 'p-scale' },
]

const DEMO_PASS = '1234'
const SESSION_KEY = 'flourmill-session'

export function authenticate(username, password) {
  const acc = ACCOUNTS.find((a) => a.user === username.trim().toLowerCase())
  if (!acc || password !== DEMO_PASS) return null
  return acc.personId
}

export function personOf(account) {
  return PEOPLE.find((p) => p.id === account.personId)
}

export function loadSession() {
  try {
    const id = localStorage.getItem(SESSION_KEY)
    return PEOPLE.some((p) => p.id === id) ? id : null
  } catch { return null }
}

export function saveSession(personId) {
  try {
    if (personId) localStorage.setItem(SESSION_KEY, personId)
    else localStorage.removeItem(SESSION_KEY)
  } catch { /* private mode */ }
}
