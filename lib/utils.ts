/**
 * Generate a URL-safe slug from a title.
 * Uniqueness is enforced in the DB trigger; this is client-side preview only.
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Generate an 8-character alphanumeric referral code.
 */
export function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * Format cents to a dollar string (e.g. 100000 → "$1,000").
 */
export function formatDollars(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

/**
 * Format a dollar amount as a compact string (e.g. 1500000 → "$15,000").
 */
export function formatCents(cents: number): string {
  return formatDollars(cents)
}

/**
 * Return number of days remaining until a deadline (negative = overdue).
 */
export function daysUntil(deadline: string | null): number | null {
  if (!deadline) return null
  const now = Date.now()
  const end = new Date(deadline).getTime()
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24))
}

/**
 * Clamp a progress value between 0 and 100.
 */
export function progressPercent(raised: number, goal: number): number {
  if (goal <= 0) return 0
  return Math.min(100, Math.round((raised / goal) * 100))
}

/**
 * Format cents to a dollar string (e.g. 100000 → "$1,000").
 */
export function formatAmount(cents: number): string {
  return formatDollars(cents)
}

/**
 * Return a human-readable string for time remaining until a date.
 * e.g. "14 days left", "1 day left", "Ended"
 */
export function timeUntil(date: Date): string {
  const days = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'Ended'
  return `${days} ${days === 1 ? 'day' : 'days'} left`
}

/**
 * Truncate text to maxLength, adding ellipsis if needed.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + '…'
}
