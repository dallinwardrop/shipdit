'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CancelPledgeButton({ pledgeId, appTitle }: { pledgeId: string; appTitle: string }) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  async function handleCancel() {
    if (!confirm(`Cancel your pledge for "${appTitle}"?\n\nYour hold will be released and your card will not be charged.`)) return

    setState('loading')
    try {
      const res = await fetch('/api/pledges/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pledge_id: pledgeId }),
      })
      if (!res.ok) {
        const json = await res.json()
        alert(`Error: ${json.error ?? 'Unknown error'}`)
        setState('error')
        setTimeout(() => setState('idle'), 2500)
        return
      }
      setState('done')
      setTimeout(() => router.refresh(), 600)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 2500)
    }
  }

  const base: React.CSSProperties = {
    fontFamily: 'Share Tech Mono, monospace',
    fontSize: 10,
    cursor: state === 'loading' ? 'default' : 'pointer',
    padding: '2px 8px',
    background: '#c0c0c0',
    border: '2px solid',
    whiteSpace: 'nowrap',
  }

  const styles: Record<typeof state, React.CSSProperties> = {
    idle:    { ...base, borderColor: '#fff #808080 #808080 #fff', color: 'darkred' },
    loading: { ...base, borderColor: '#808080 #fff #fff #808080', opacity: 0.7 },
    done:    { ...base, borderColor: '#808080 #fff #fff #808080', background: '#d0d0d0', color: '#404040' },
    error:   { ...base, borderColor: '#fff #808080 #808080 #fff', background: '#ffc0c0', color: 'darkred' },
  }

  const labels = { idle: 'Cancel Pledge', loading: '⌛...', done: '✓ Cancelled', error: '⚠ Error' }

  return (
    <button onClick={handleCancel} disabled={state !== 'idle'} style={styles[state]}>
      {labels[state]}
    </button>
  )
}
