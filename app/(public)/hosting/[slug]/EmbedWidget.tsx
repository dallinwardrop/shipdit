'use client'

import { useState } from 'react'
import { CopyButton } from './CopyButton'

export function EmbedWidget({ snippet }: { snippet: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="win95-btn text-xs"
        style={{ fontFamily: 'Share Tech Mono, monospace' }}
      >
        {open ? '▼' : '▶'} Embed this widget
      </button>

      {open && (
        <div className="win95-sunken p-3 space-y-2 mt-2">
          <p className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}>
            Paste this into your app to show the hosting meter and drive contributions:
          </p>
          <pre
            className="text-xs overflow-x-auto whitespace-pre-wrap win95-sunken p-2"
            style={{ fontFamily: 'Share Tech Mono, monospace', margin: 0, background: '#fff' }}
          >
            {snippet}
          </pre>
          <CopyButton text={snippet} label="Copy Snippet" />
        </div>
      )}
    </div>
  )
}
