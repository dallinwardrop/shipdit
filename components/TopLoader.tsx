'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export function TopLoader() {
  const pathname = usePathname()
  const prevPath = useRef(pathname)
  const [width, setWidth] = useState(0)
  const [visible, setVisible] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  function addTimer(fn: () => void, ms: number) {
    const t = setTimeout(fn, ms)
    timers.current.push(t)
  }
  function clearTimers() {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  // Intercept internal link clicks → start the bar
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('http') ||
        href.startsWith('mailto') ||
        anchor.getAttribute('target') === '_blank'
      ) return
      clearTimers()
      setVisible(true)
      setWidth(0)
      // Next tick: animate to 72% (looks like it's nearly there but not complete)
      addTimer(() => setWidth(72), 20)
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // Pathname changed → complete and fade out
  useEffect(() => {
    if (prevPath.current === pathname) return
    prevPath.current = pathname
    clearTimers()
    setWidth(100)
    addTimer(() => {
      setVisible(false)
      setWidth(0)
    }, 300)
  }, [pathname])

  useEffect(() => () => clearTimers(), [])

  if (!visible) return null

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        height: 3,
        background: '#c0c0c0',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${width}%`,
          background: '#000080',
          boxShadow: '1px 0 4px rgba(0,0,128,0.4)',
          transition:
            width >= 100
              ? 'width 200ms ease-out'
              : width > 0
              ? 'width 6s cubic-bezier(0.08, 0.6, 0.05, 1)'
              : 'none',
        }}
      />
    </div>
  )
}
