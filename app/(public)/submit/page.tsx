'use client'

import { Suspense, useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { FeatureItem } from '@/lib/supabase/types'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { createClient } from '@/lib/supabase/client'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const DRAFT_KEY = 'shipdit_submit_draft'

const cardElementOptions = {
  style: {
    base: {
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: '14px',
      color: '#000',
      '::placeholder': { color: '#808080' },
    },
    invalid: { color: 'darkred' },
  },
}

function CardConfirmStep({
  clientSecret,
  slug,
  pledgeAmountCents,
}: {
  clientSecret: string
  slug: string
  pledgeAmountCents: number
}) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [cardError, setCardError] = useState<string | null>(null)

  const handleConfirm = async () => {
    if (!stripe || !elements) return
    setConfirming(true)
    setCardError(null)

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) { setConfirming(false); return }

    const { error } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: cardElement },
    })

    if (error) {
      setCardError(error.message ?? 'Payment authorization failed.')
      setConfirming(false)
    } else {
      router.push(`/share/${slug}`)
    }
  }

  return (
    <div className="win95-window">
      <div className="win95-title-bar" style={{ background: '#004000' }}>
        <span className="font-vt323 text-xl">Step 2 of 2 — Authorize Your Pledge</span>
      </div>
      <div className="p-4 space-y-4">
        <p className="text-sm" style={{ fontFamily: 'Share Tech Mono, monospace' }}>
          Your idea has been saved. ✓ Now authorize your{' '}
          <strong>${(pledgeAmountCents / 100).toLocaleString()}</strong> pledge.
          Your card will be <strong>held but not charged</strong> until the idea hits its
          minimum funding goal within 72 hours of going live.
        </p>
        <div className="win95-sunken p-3" style={{ background: '#fff' }}>
          <CardElement options={cardElementOptions} />
        </div>
        {cardError && (
          <div className="win95-sunken p-2 text-sm" style={{ color: 'darkred', borderColor: 'darkred' }}>
            ⚠ {cardError}
          </div>
        )}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={confirming || !stripe}
          className="win95-btn win95-btn-primary w-full"
          style={{
            padding: '10px',
            fontSize: '1rem',
            fontFamily: 'VT323, monospace',
            ...(confirming ? { borderColor: '#808080 #fff #fff #808080', cursor: 'default', opacity: 0.85 } : {}),
          }}
        >
          {confirming ? '⌛ Authorizing...' : 'AUTHORIZE PLEDGE →'}
        </button>
        <p className="text-xs text-center" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#808080' }}>
          You will only be charged if your idea reaches its minimum funding goal.
        </p>
      </div>
    </div>
  )
}

type Priority = 'MUST HAVE' | 'SHOULD HAVE' | 'NICE TO HAVE'

// Note: email is NOT in FormState — the API always uses the authenticated user's
// account email. For unauthenticated users, the email field is a separate local
// state value (emailPreview) used only for display; it is never sent to the API.
type FormState = {
  title: string
  goal_description: string
  features: FeatureItem[]
  target_user: string
  similar_apps: string
  platform_preference: string
  submitter_pledge_amount: string
}

const DEFAULT_FORM: FormState = {
  title: '',
  goal_description: '',
  features: [
    { priority: 'MUST HAVE', text: '' },
    { priority: 'MUST HAVE', text: '' },
    { priority: 'SHOULD HAVE', text: '' },
  ],
  target_user: '',
  similar_apps: '',
  platform_preference: 'web',
  submitter_pledge_amount: '',
}

const PLATFORMS = [
  { value: 'web', label: 'Web' },
  { value: 'ios', label: 'iOS' },
  { value: 'android', label: 'Android' },
  { value: 'ios+android', label: 'iOS + Android' },
  { value: 'builder_decides', label: 'Builder Decides' },
]

const PRIORITIES: Priority[] = ['MUST HAVE', 'SHOULD HAVE', 'NICE TO HAVE']

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm mb-1"
      style={{ fontFamily: 'Share Tech Mono, monospace', fontWeight: 'bold' }}
    >
      {children}
    </label>
  )
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1">{children}</div>
}

function SubmitPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [form, setForm] = useState<FormState>({
    ...DEFAULT_FORM,
    title: searchParams.get('title') ?? '',
    goal_description: searchParams.get('description') ?? '',
  })

  // Separate local state for the email preview field (unauthenticated users only).
  // This is never sent to the API — the API always uses the session user's email.
  const [emailPreview, setEmailPreview] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [ideaSlug, setIdeaSlug] = useState<string | null>(null)

  // Auth state
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // UX state
  const [savedForLogin, setSavedForLogin] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (authUser) {
        setUser({ id: authUser.id, email: authUser.email ?? '' })

        // Restore draft if returning from login
        try {
          const raw = localStorage.getItem(DRAFT_KEY)
          if (raw) {
            const draft = JSON.parse(raw) as FormState
            setForm(draft)
            localStorage.removeItem(DRAFT_KEY)
            setDraftRestored(true)
          }
        } catch {
          localStorage.removeItem(DRAFT_KEY)
        }
      }
      setAuthLoading(false)
    })
  }, [])

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const addFeature = () => {
    setForm((prev) => ({
      ...prev,
      features: [...prev.features, { priority: 'SHOULD HAVE', text: '' }],
    }))
  }

  const removeFeature = (index: number) => {
    setForm((prev) => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index),
    }))
  }

  const updateFeature = (index: number, key: keyof FeatureItem, value: string) => {
    setForm((prev) => ({
      ...prev,
      features: prev.features.map((f, i) =>
        i === index ? { ...f, [key]: value } : f
      ),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const pledgeAmount = parseInt(form.submitter_pledge_amount, 10)
    if (isNaN(pledgeAmount) || pledgeAmount < 1) {
      setError('Please enter a valid pledge amount.')
      return
    }

    const featuresWithText = form.features.filter((f) => f.text.trim().length > 0)
    const mustHavesWithText = featuresWithText.filter((f) => f.priority === 'MUST HAVE')
    if (mustHavesWithText.length === 0) {
      setError('Please add at least 1 must-have feature.')
      return
    }
    if (mustHavesWithText.length > 3) {
      setError('Maximum 3 must-have features allowed.')
      return
    }

    // ── Auth gate: not logged in → save draft and show sign-in prompt ────────
    if (!user) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(form))
      } catch {
        // localStorage unavailable (e.g. private browsing) — gate anyway
      }
      setSavedForLogin(true)
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          goal_description: form.goal_description.trim(),
          features: featuresWithText,
          target_user: form.target_user.trim(),
          similar_apps: form.similar_apps.trim() || null,
          platform_preference: form.platform_preference,
          submitter_pledge_amount: pledgeAmount * 100, // convert to cents
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Something went wrong. Please try again.')
        return
      }

      setClientSecret(json.payment_intent_client_secret)
      setIdeaSlug(json.slug)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const pledgeAmountCents = parseInt(form.submitter_pledge_amount, 10) * 100

  // ── Step 2: Card authorization ─────────────────────────────────────────────
  if (clientSecret && ideaSlug) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Elements stripe={stripePromise}>
          <CardConfirmStep
            clientSecret={clientSecret}
            slug={ideaSlug}
            pledgeAmountCents={pledgeAmountCents}
          />
        </Elements>
      </div>
    )
  }

  // ── "Almost there!" gate: saved draft, waiting for sign-in ────────────────
  if (savedForLogin) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="win95-window">
          <div className="win95-title-bar" style={{ background: '#004000' }}>
            <span className="font-vt323 text-xl">Almost there!</span>
          </div>
          <div className="p-6 space-y-4 text-center">
            <p className="text-sm" style={{ fontFamily: 'Share Tech Mono, monospace', lineHeight: 1.7 }}>
              Sign in to submit your idea — we&apos;ll save your progress.
            </p>
            <div>
              <Link
                href="/login?redirectTo=/submit"
                className="win95-btn win95-btn-primary"
                style={{
                  display: 'inline-block',
                  padding: '10px 24px',
                  fontSize: '1rem',
                  fontFamily: 'VT323, monospace',
                  textDecoration: 'none',
                }}
              >
                Sign In to Continue →
              </Link>
            </div>
            <div>
              <button
                type="button"
                className="win95-btn text-xs"
                onClick={() => setSavedForLogin(false)}
              >
                ← Go back and edit
              </button>
            </div>
          </div>
        </div>

        <div className="win95-window">
          <div className="win95-title-bar" style={{ background: '#804000' }}>
            <span className="font-vt323 text-lg">⚡ Once approved: 72 hours to fund it</span>
          </div>
          <div className="p-3 text-sm space-y-2" style={{ fontFamily: 'Share Tech Mono, monospace', background: '#fff8e8' }}>
            <p>Ideas are reviewed within <strong>2–3 hours</strong> of submission. Once approved and live, you have <strong>72 hours</strong> to hit the funding goal.</p>
            <p>Share it everywhere. Make TikToks. If it funds, the Shipdit team builds it. If not, no one gets charged.</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Main form ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-xl">Submit App Idea — New Window</span>
          <div className="flex gap-1">
            <div className="win95-btn" style={{ minWidth: 16, padding: '0 6px', fontSize: 10 }}>
              _
            </div>
            <div className="win95-btn" style={{ minWidth: 16, padding: '0 6px', fontSize: 10 }}>
              □
            </div>
          </div>
        </div>

        <div className="p-4">
          <h1 className="font-vt323 text-4xl mb-1" style={{ color: '#000080' }}>
            SUBMIT YOUR IDEA
          </h1>
          <p className="text-xs mb-4" style={{ fontFamily: 'Share Tech Mono, monospace' }}>
            Your idea enters a review queue. Once approved and priced, it goes live for community
            funding. Your pledge is held — never charged unless the minimum build goal is hit within 72 hours of going live.
          </p>

          {/* Draft restored notice */}
          {draftRestored && (
            <div
              className="win95-sunken p-2 text-xs mb-4"
              style={{
                fontFamily: 'Share Tech Mono, monospace',
                color: '#004000',
                background: '#d0ffd0',
                borderColor: '#008000 #004000 #004000 #008000',
              }}
            >
              ✓ Your draft was restored — review the fields below and submit when ready.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 1. Title */}
            <FieldGroup>
              <FieldLabel htmlFor="title">1. App Name (working title)</FieldLabel>
              <input
                id="title"
                type="text"
                className="win95-input w-full"
                placeholder="e.g. Tennis Score Tracker"
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                required
                maxLength={120}
              />
            </FieldGroup>

            {/* 2. Problem */}
            <FieldGroup>
              <FieldLabel htmlFor="goal_description">
                2. What problem does this solve?
              </FieldLabel>
              <textarea
                id="goal_description"
                className="win95-textarea w-full"
                rows={4}
                placeholder="Describe the problem clearly. What's broken or missing today? Who suffers because of it?"
                value={form.goal_description}
                onChange={(e) => updateField('goal_description', e.target.value)}
                required
                maxLength={1000}
              />
            </FieldGroup>

            {/* 3. Features */}
            <FieldGroup>
              <FieldLabel htmlFor="features">3. Core features (in priority order)</FieldLabel>
              {(() => {
                const mustHaveCount = form.features.filter((f) => f.priority === 'MUST HAVE').length
                return (
                  <div className="space-y-2">
                    {form.features.map((feature, idx) => (
                      <div key={idx} className="win95-raised p-2 flex gap-2 items-start">
                        <select
                          className="win95-select"
                          style={{ width: 150, flexShrink: 0 }}
                          value={feature.priority}
                          onChange={(e) => updateFeature(idx, 'priority', e.target.value)}
                        >
                          {PRIORITIES.map((p) => (
                            <option
                              key={p}
                              value={p}
                              disabled={p === 'MUST HAVE' && feature.priority !== 'MUST HAVE' && mustHaveCount >= 3}
                            >
                              {p}
                            </option>
                          ))}
                        </select>
                        <textarea
                          className="win95-input flex-1 min-w-0"
                          placeholder="Describe this feature"
                          value={feature.text}
                          rows={2}
                          style={{ resize: 'none', overflow: 'hidden' }}
                          onChange={(e) => {
                            updateFeature(idx, 'text', e.target.value)
                            e.target.style.height = 'auto'
                            e.target.style.height = e.target.scrollHeight + 'px'
                          }}
                          maxLength={200}
                        />
                        {form.features.length > 1 && (
                          <button
                            type="button"
                            className="win95-btn text-xs flex-shrink-0"
                            style={{ minWidth: 28, padding: '2px 6px', color: 'darkred' }}
                            onClick={() => removeFeature(idx)}
                            aria-label="Remove feature"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="win95-btn text-xs"
                        onClick={addFeature}
                      >
                        + Add Feature
                      </button>
                      {mustHaveCount >= 3 && (
                        <span className="text-xs" style={{ fontFamily: 'Share Tech Mono, monospace', color: '#804000' }}>
                          Maximum 3 must-have features
                        </span>
                      )}
                    </div>
                  </div>
                )
              })()}
            </FieldGroup>

            {/* 4. Target user */}
            <FieldGroup>
              <FieldLabel htmlFor="target_user">4. Who is this for?</FieldLabel>
              <input
                id="target_user"
                type="text"
                className="win95-input w-full"
                placeholder="e.g. Amateur tennis players who track matches in a notebook"
                value={form.target_user}
                onChange={(e) => updateField('target_user', e.target.value)}
                required
                maxLength={300}
              />
            </FieldGroup>

            {/* 5. Similar apps */}
            <FieldGroup>
              <FieldLabel htmlFor="similar_apps">
                5. Similar existing apps (optional)
              </FieldLabel>
              <input
                id="similar_apps"
                type="text"
                className="win95-input w-full"
                placeholder="e.g. Tennis Score by Apple — but too complex, no history"
                value={form.similar_apps}
                onChange={(e) => updateField('similar_apps', e.target.value)}
                maxLength={300}
              />
            </FieldGroup>

            {/* 6. Platform */}
            <FieldGroup>
              <FieldLabel htmlFor="platform_preference">6. Platform preference</FieldLabel>
              <select
                id="platform_preference"
                className="win95-select w-full"
                value={form.platform_preference}
                onChange={(e) => updateField('platform_preference', e.target.value)}
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              {['ios', 'android', 'ios+android'].includes(form.platform_preference) && (
                <div
                  className="win95-sunken p-2 text-xs space-y-1"
                  style={{ color: '#804000', borderColor: '#886600 #cc8800 #cc8800 #886600', background: '#fffbe8' }}
                >
                  <p>📱 <strong>Heads up:</strong> native mobile apps (iOS/Android) are typically 5x the cost of web apps and take longer to build. Most ideas work great as a web app that works on mobile browsers — often at 1/4 the price.</p>
                  <p>Not sure? Pick <strong>Web</strong> and we&apos;ll discuss during review.</p>
                </div>
              )}
            </FieldGroup>

            {/* 7. Email — locked to account email when signed in */}
            <FieldGroup>
              <FieldLabel htmlFor="email">7. Your email</FieldLabel>
              {authLoading ? (
                /* While checking session — show disabled placeholder */
                <input
                  id="email"
                  type="email"
                  className="win95-input"
                  value=""
                  disabled
                  placeholder="Loading..."
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
              ) : user ? (
                /* Signed in — show account email, locked */
                <div className="flex items-center gap-2">
                  <input
                    id="email"
                    type="email"
                    className="win95-input"
                    value={user.email}
                    disabled
                    style={{ opacity: 0.75, cursor: 'not-allowed', flexGrow: 1 }}
                  />
                  <span
                    className="win95-sunken text-xs px-2 py-1 flex-shrink-0"
                    style={{
                      fontFamily: 'Share Tech Mono, monospace',
                      color: '#004000',
                      background: '#d0ffd0',
                      borderColor: '#008000 #004000 #004000 #008000',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ✓ Verified
                  </span>
                </div>
              ) : (
                /* Not signed in — editable field (value not sent to API) */
                <>
                  <input
                    id="email"
                    type="email"
                    className="win95-input"
                    placeholder="you@example.com"
                    value={emailPreview}
                    onChange={(e) => setEmailPreview(e.target.value)}
                  />
                  <p className="text-xs" style={{ color: '#404040' }}>
                    You&apos;ll need to sign in before submitting — we&apos;ll save your progress.
                  </p>
                </>
              )}
            </FieldGroup>

            {/* 8. Pledge amount */}
            <FieldGroup>
              <FieldLabel htmlFor="submitter_pledge_amount">
                8. What are you willing to personally put in to get this built? ($)
              </FieldLabel>
              <div className="win95-raised p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className="win95-sunken text-sm px-3 py-1 flex-shrink-0"
                    style={{ border: '2px inset', background: '#c0c0c0' }}
                  >
                    $
                  </span>
                  <input
                    id="submitter_pledge_amount"
                    type="number"
                    className="win95-input flex-1 min-w-0"
                    placeholder="500"
                    min="1"
                    value={form.submitter_pledge_amount}
                    onChange={(e) => updateField('submitter_pledge_amount', e.target.value)}
                    required
                  />
                </div>
                <div className="win95-sunken p-2 text-xs space-y-1" style={{ color: '#000040' }}>
                  <p>
                    <strong>The higher your pledge, the more seriously we take your submission.</strong>
                  </p>
                  <p>Basic apps (2–3 features) typically start at $1,000.</p>
                  <p>
                    Your pledge is 100% refunded if the app doesn&apos;t reach its minimum build goal within 72 hours of going live.
                    You are <strong>never charged until the goal is hit.</strong>
                  </p>
                </div>
              </div>
            </FieldGroup>

            {/* Error */}
            {error && (
              <div
                className="win95-sunken p-2 text-sm"
                style={{ color: 'darkred', borderColor: 'darkred' }}
              >
                ⚠ {error}
              </div>
            )}

            {/* Submit */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="submit"
                className="win95-btn win95-btn-primary w-full sm:w-auto"
                disabled={submitting || authLoading}
                style={{
                  minWidth: 140,
                  ...(submitting || authLoading ? { borderColor: '#808080 #fff #fff #808080', cursor: 'default', opacity: 0.85 } : {}),
                }}
              >
                {submitting ? '⌛ Submitting...' : 'Submit Idea →'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 72-hour urgency callout */}
      <div className="win95-window">
        <div className="win95-title-bar" style={{ background: '#804000' }}>
          <span className="font-vt323 text-lg">⚡ Once approved: 72 hours to fund it</span>
        </div>
        <div className="p-3 text-sm space-y-2" style={{ fontFamily: 'Share Tech Mono, monospace', background: '#fff8e8' }}>
          <p>Ideas are reviewed within <strong>2–3 hours</strong> of submission. Once approved and live, you have <strong>72 hours</strong> to hit the funding goal.</p>
          <p>Share it everywhere. Make TikToks. If it funds, the Shipdit team builds it. If not, no one gets charged.</p>
        </div>
      </div>

      {/* Terms */}
      <div className="win95-window">
        <div className="win95-title-bar">
          <span className="font-vt323 text-lg">How pledges work</span>
        </div>
        <div className="p-3 text-xs space-y-1" style={{ fontFamily: 'Share Tech Mono, monospace' }}>
          <p>✓ Your card is authorized (held) — not charged — when you submit.</p>
          <p>✓ Funds are only captured when the full goal is reached.</p>
          <p>✓ If the minimum build goal isn&apos;t hit within 72 hours of going live, your hold is fully released.</p>
          <p>✓ Once built, the app is free for the entire community forever.</p>
          <p>🏆 <strong>Backer Perks:</strong> The #1 backer submits up to 3 name suggestions — we approve the ones that meet our standards, they pick their favorite. Or they can hide an easter egg instead. The #2 backer gets whichever perk #1 didn&apos;t choose.</p>
          <p style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #c0c0c0' }}>
            🛡️ <strong>Build Guarantee:</strong> Once funded, a working MVP is delivered within 72 hours — or everyone gets a full automatic refund.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SubmitPage() {
  return (
    <Suspense>
      <SubmitPageInner />
    </Suspense>
  )
}
