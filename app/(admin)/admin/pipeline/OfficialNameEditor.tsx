'use client'

import { useState } from 'react'

export function OfficialNameEditor({
  ideaId,
  currentName,
}: {
  ideaId: string
  currentName: string | null
}) {
  const [value, setValue] = useState(currentName ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)
    const res = await fetch('/api/admin/official-name', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea_id: ideaId, official_name: value.trim() || null }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } else {
      const json = await res.json()
      setError(json.error ?? 'Failed to save.')
    }
  }

  return (
    <div className="flex items-center gap-1" style={{ minWidth: 200 }}>
      <input
        type="text"
        value={value}
        onChange={(e) => { setValue(e.target.value); setSaved(false) }}
        placeholder="Set official name…"
        className="win95-input"
        style={{ fontSize: 11, padding: '1px 4px', flex: 1, minWidth: 0 }}
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="win95-btn text-xs"
        style={{ whiteSpace: 'nowrap', padding: '2px 6px', fontSize: 10 }}
      >
        {saving ? '…' : saved ? '✓' : 'Set'}
      </button>
      {error && (
        <span style={{ color: 'darkred', fontSize: 10, fontFamily: 'Share Tech Mono, monospace' }}>
          {error}
        </span>
      )}
    </div>
  )
}
