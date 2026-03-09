import Link from 'next/link'

export type TickerItem = { text: string; href?: string }

export function ActivityTicker({ items }: { items: TickerItem[] }) {
  if (items.length === 0) return null

  // Double the items so the second copy fills the gap as the first scrolls out
  const doubled = [...items, ...items]
  const durationSecs = Math.max(24, items.length * 5)

  return (
    <div
      style={{
        background: '#000060',
        borderTop: '2px solid #6060c0',
        borderBottom: '2px solid #000030',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes shipdit-ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .shipdit-ticker-track {
          display: flex;
          white-space: nowrap;
          width: max-content;
          animation: shipdit-ticker ${durationSecs}s linear infinite;
        }
        .shipdit-ticker-track:hover {
          animation-play-state: paused;
        }
      `}</style>
      <div className="shipdit-ticker-track" style={{ padding: '5px 0' }}>
        {doubled.map((item, i) => {
          const isSupport = item.href === '/support'
          const textStyle: React.CSSProperties = {
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: 12,
            letterSpacing: '0.02em',
            color: isSupport ? '#ffd700' : '#c8d0ff',
            textDecoration: 'none',
            paddingLeft: 20,
          }
          return (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
              {item.href ? (
                <Link href={item.href} style={textStyle}>
                  {item.text}
                </Link>
              ) : (
                <span style={textStyle}>{item.text}</span>
              )}
              <span
                style={{
                  color: '#303080',
                  fontFamily: 'Share Tech Mono, monospace',
                  fontSize: 12,
                  paddingLeft: 20,
                  userSelect: 'none',
                }}
              >
                &gt;&gt;&gt;
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
