'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ReleasePledgeButton({ pledgeId, appTitle }: { pledgeId: string; appTitle: string }) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  async function handleRelease() {
    if (!confirm(`Release the held pledge for "${appTitle}"?\n\nThis will cancel the Stripe payment intent and notify the backer. This cannot be undone.`)) return

    setState('loading')
    try {
      const res = await fetch('/api/admin/release-pledge', {
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
      setTimeout(() => router.refresh(), 800)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 2500)
    }
  }

  const base: React.CSSProperties = {
    fontFamily: 'Share Tech Mono, monospace',
    fontSize: 10,
    cursor: state === 'loading' ? 'default' : 'pointer',
    padding: '1px 6px',
    background: '#c0c0c0',
    border: '2px solid',
    whiteSpace: 'nowrap',
  }

  const styles: Record<typeof state, React.CSSProperties> = {
    idle:    { ...base, borderColor: '#fff #808080 #808080 #fff', color: 'darkred' },
    loading: { ...base, borderColor: '#808080 #fff #fff #808080', opacity: 0.7 },
    done:    { ...base, borderColor: '#808080 #fff #fff #808080', background: '#a0c0a0', color: '#004000' },
    error:   { ...base, borderColor: '#fff #808080 #808080 #fff', background: '#ffc0c0', color: 'darkred' },
  }

  const labels = { idle: 'Release', loading: '⌛...', done: '✓ Done', error: '⚠ Error' }

  return (
    <button onClick={handleRelease} disabled={state !== 'idle'} style={styles[state]}>
      {labels[state]}
    </button>
  )
}
