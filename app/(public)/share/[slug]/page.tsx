import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { formatDollars } from '@/lib/utils'
import { CopyButton } from './CopyButton'

export const dynamic = 'force-dynamic'

export default async function SharePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = createAdminClient()

  const { data: idea } = await supabase
    .from('app_ideas')
    .select('id, title, slug, submitter_id, submitter_pledge_amount, referral_code, status')
    .eq('slug', slug)
    .single()

  if (!idea) notFound()

  // Only the submitter may view the share dashboard
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user || user.id !== idea.submitter_id) {
    redirect(`/fund/${idea.slug}`)
  }

  // Pull referral conversions (friends who backed via the submitter's link)
  const { data: referral } = await supabase
    .from('referrals')
    .select('conversions')
    .eq('ref_code', idea.referral_code ?? '')
    .single()

  const conversions = referral?.conversions ?? 0
  const TARGET = 50

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const shareUrl = idea.referral_code
    ? `${appUrl}/fund/${idea.slug}?ref=${idea.referral_code}`
    : `${appUrl}/fund/${idea.slug}`

  const shareCopy = {
    text: `I just submitted an app idea and need your help funding it. $10 gets you notified when it launches. Check it out: ${shareUrl}`,
    linkedin: `I just submitted an idea to Shipdit — a platform where the community funds apps and they get built free for everyone. If we hit the goal, this gets built. Would love your support: ${shareUrl}`,
    twitter: `just submitted an app idea to @shipdit — if we hit the funding goal it gets built free for everyone. back it here: ${shareUrl}`,
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Success header */}
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-xl">submission_confirmed.exe</span>
        </div>
        <div className="p-4 space-y-3">
          <h1 className="font-vt323 text-4xl leading-tight" style={{ color: '#000080' }}>
            YOUR IDEA IS LIVE IN THE QUEUE
          </h1>
          <p className="font-vt323 text-2xl" style={{ color: '#000' }}>
            &ldquo;{idea.title}&rdquo;
          </p>
          <div className="win95-sunken p-3 text-sm">
            You&apos;re already{' '}
            <strong>{formatDollars(idea.submitter_pledge_amount)}</strong> toward the goal.
            Your pledge is held — never charged unless funding completes within 120 days.
          </div>
        </div>
      </div>

      {/* 50-friends CTA */}
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-xl">funding_strategy.txt</span>
        </div>
        <div className="p-4 space-y-3">
          <p className="font-vt323 text-2xl" style={{ color: '#000080' }}>
            Most apps get funded when the submitter shares with 50 people.
          </p>

          {/* Live counter */}
          <div className="win95-raised p-3 flex items-center gap-4">
            <div>
              <span className="font-vt323 text-5xl" style={{ color: '#000080' }}>
                {conversions}
              </span>
              <span className="font-vt323 text-2xl" style={{ color: '#404040' }}>
                {' '}/ {TARGET}
              </span>
            </div>
            <div className="flex-1">
              <div className="win95-progress-track">
                <div
                  className="win95-progress-fill"
                  style={{ width: `${Math.min(100, Math.round((conversions / TARGET) * 100))}%` }}
                />
              </div>
              <p className="text-xs mt-1" style={{ fontFamily: 'Share Tech Mono, monospace' }}>
                {conversions} of {TARGET} friends backed it
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Share links */}
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-xl">share_now.exe</span>
        </div>
        <div className="p-4 space-y-4">
          {/* Referral link */}
          <div className="space-y-1">
            <p className="text-xs font-bold" style={{ fontFamily: 'Share Tech Mono, monospace' }}>
              YOUR REFERRAL LINK
            </p>
            <div className="win95-sunken p-2 flex gap-2 items-center">
              <code className="text-xs flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                {shareUrl}
              </code>
              <CopyButton text={shareUrl} />
            </div>
          </div>

          {/* TEXT */}
          <div className="win95-raised p-3 space-y-2">
            <p
              className="text-xs font-bold"
              style={{ fontFamily: 'Share Tech Mono, monospace', color: '#000080' }}
            >
              📱 TEXT
            </p>
            <p className="text-xs leading-relaxed" style={{ fontFamily: 'Share Tech Mono, monospace' }}>
              {shareCopy.text}
            </p>
            <CopyButton text={shareCopy.text} label="Copy text" />
          </div>

          {/* LINKEDIN */}
          <div className="win95-raised p-3 space-y-2">
            <p
              className="text-xs font-bold"
              style={{ fontFamily: 'Share Tech Mono, monospace', color: '#000080' }}
            >
              💼 LINKEDIN
            </p>
            <p className="text-xs leading-relaxed" style={{ fontFamily: 'Share Tech Mono, monospace' }}>
              {shareCopy.linkedin}
            </p>
            <CopyButton text={shareCopy.linkedin} label="Copy post" />
          </div>

          {/* TWITTER / X */}
          <div className="win95-raised p-3 space-y-2">
            <p
              className="text-xs font-bold"
              style={{ fontFamily: 'Share Tech Mono, monospace', color: '#000080' }}
            >
              🐦 TWITTER / X
            </p>
            <p className="text-xs leading-relaxed" style={{ fontFamily: 'Share Tech Mono, monospace' }}>
              {shareCopy.twitter}
            </p>
            <CopyButton text={shareCopy.twitter} label="Copy tweet" />
          </div>
        </div>
      </div>

      {/* Status-based footer */}
      <div className="win95-window">
        <div className="p-3">
          {['submitted', 'under_review', 'awaiting_price'].includes(idea.status) && (
            <div className="win95-sunken p-3 text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#404040' }}>
              ⏳ Your idea is in the review queue. You'll get an email when it's approved and priced. Once it goes live you'll get a share link to send to friends.
            </div>
          )}
          {idea.status === 'priced' && (
            <div className="win95-sunken p-3 text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#004000' }}>
              ✓ Your idea has been priced! It launches to the funding feed soon.
            </div>
          )}
          {!['submitted', 'under_review', 'awaiting_price', 'priced'].includes(idea.status) && (
            <div className="flex justify-between items-center">
              <p className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace' }}>
                Your idea is visible in the public funding feed.
              </p>
              <Link href={`/fund/${idea.slug}`} className="win95-btn text-sm whitespace-nowrap">
                View your idea in the funding feed →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
