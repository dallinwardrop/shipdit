'use client'

import { usePathname } from 'next/navigation'
import { ActivityTicker, type TickerItem } from './ActivityTicker'

export function TickerWrapper({ items }: { items: TickerItem[] }) {
  const pathname = usePathname()
  if (pathname === '/submit') return null
  return <ActivityTicker items={items} />
}
