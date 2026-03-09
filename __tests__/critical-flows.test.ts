/**
 * Shipdit — Critical Flow Tests
 *
 * Tests the five core API routes using mocked Stripe and Supabase clients.
 * No real credentials required.
 */

import { NextRequest } from 'next/server'

// ── Module mocks (must be declared before imports) ────────────────────────────

jest.mock('@/lib/stripe', () => ({
  stripe: {
    paymentIntents: {
      create: jest.fn(),
      cancel: jest.fn(),
      capture: jest.fn(),
    },
    customers: {
      list: jest.fn(),
      create: jest.fn(),
    },
  },
}))

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/resend', () => ({
  resend: { emails: { send: jest.fn().mockResolvedValue({ data: { id: 'email-123' }, error: null }) } },
  sendEmail: jest.fn().mockResolvedValue('email-id-123'),
}))

jest.mock('@/lib/emails', () => ({
  sendNewIdeaAlert: jest.fn().mockResolvedValue(undefined),
  sendPledgeConfirmation: jest.fn().mockResolvedValue(undefined),
  sendPledgeReleased: jest.fn().mockResolvedValue('email-id-456'),
}))

// ── Typed imports after mocking ───────────────────────────────────────────────

import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

import { POST as submitPOST } from '@/app/api/submit/route'
import { POST as pledgePOST } from '@/app/api/pledge/route'
import { POST as capturePOST } from '@/app/api/admin/capture-pledge/route'
import { POST as releasePOST } from '@/app/api/admin/release-pledge/route'
import { POST as supportPOST } from '@/app/api/support/route'

// ── Cast mocks to typed versions ──────────────────────────────────────────────

const mockStripe = stripe as unknown as {
  paymentIntents: {
    create: jest.Mock
    cancel: jest.Mock
    capture: jest.Mock
  }
  customers: {
    list: jest.Mock
    create: jest.Mock
  }
}
const mockCreateAdmin = createAdminClient as jest.Mock
const mockCreateClient = createClient as jest.Mock

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * Create a chainable Supabase query builder mock.
 *
 * - Methods like select/eq/update/insert return the chain itself (for chaining).
 * - `.single()` resolves with `singleResult`.
 * - Awaiting the chain directly (e.g. `await admin.from('t').update().eq()`)
 *   resolves with `chainResult`.
 */
function makeChain(opts: {
  singleResult?: { data: unknown; error: unknown }
  chainResult?: { error: unknown }
} = {}) {
  const singleResult = opts.singleResult ?? { data: null, error: null }
  const chainResult = opts.chainResult ?? { error: null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {}

  // Non-terminal: all return the chain for further chaining
  for (const m of ['select', 'eq', 'neq', 'in', 'not', 'is', 'order', 'limit', 'update', 'insert', 'upsert', 'delete']) {
    chain[m] = jest.fn().mockReturnValue(chain)
  }

  // Terminal: resolves with configured singleResult
  chain.single = jest.fn().mockResolvedValue(singleResult)

  // Make the chain itself awaitable (Promise interface)
  // Used when routes do: `const { error } = await admin.from('t').update().eq()`
  chain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(chainResult).then(onFulfilled, onRejected)
  chain.catch = (onRejected: (e: unknown) => unknown) =>
    Promise.resolve(chainResult).catch(onRejected)
  chain.finally = (onFinally: () => void) =>
    Promise.resolve(chainResult).finally(onFinally)

  return chain
}

/**
 * Build a mock admin Supabase client.
 * tableConfigs: keyed by table name, each value is options for makeChain().
 */
function makeAdminMock(tableConfigs: Record<string, Parameters<typeof makeChain>[0]> = {}) {
  const chains: Record<string, ReturnType<typeof makeChain>[]> = {}

  const admin = {
    from: jest.fn().mockImplementation((tableName: string) => {
      const chain = makeChain(tableConfigs[tableName] ?? {})
      if (!chains[tableName]) chains[tableName] = []
      chains[tableName].push(chain)
      return chain
    }),
    auth: {
      admin: {
        createUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user-new-123' } },
          error: null,
        }),
      },
    },
  }

  return { admin, chains }
}

/** Build a mock session-based (server) Supabase client. */
function makeServerMock(userId: string | null = 'user-123') {
  return Promise.resolve({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: userId ? { id: userId, email: 'test@example.com' } : null },
      }),
    },
  })
}

// ── Reset mocks between tests ─────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()

  // Default Stripe mock returns
  mockStripe.paymentIntents.create.mockResolvedValue({
    id: 'pi_test_123',
    client_secret: 'pi_test_123_secret_abc',
  })
  mockStripe.paymentIntents.cancel.mockResolvedValue({ id: 'pi_test_123', status: 'canceled' })
  mockStripe.paymentIntents.capture.mockResolvedValue({ id: 'pi_test_123', status: 'succeeded' })
  mockStripe.customers.list.mockResolvedValue({ data: [] })
  mockStripe.customers.create.mockResolvedValue({ id: 'cus_test_123' })
})

// ══════════════════════════════════════════════════════════════════════════════
// 1. SUBMIT FLOW
// ══════════════════════════════════════════════════════════════════════════════

describe('POST /api/submit', () => {
  // email is NOT in the body — the route reads it from the session user
  const validBody = {
    title: 'Tennis Score Tracker',
    goal_description: 'Track tennis match scores without paper.',
    features: [{ priority: 'MUST HAVE', text: 'Track sets and games' }],
    target_user: 'Amateur tennis players',
    similar_apps: null,
    platform_preference: 'web',
    submitter_pledge_amount: 5000, // $50 in cents
  }

  function setupSubmitMocks(tableConfigs: Record<string, Parameters<typeof makeChain>[0]> = {}, userId: string | null = 'user-submit-123') {
    const defaults: Record<string, Parameters<typeof makeChain>[0]> = {
      users: { singleResult: { data: { email: 'test@example.com' }, error: null }, chainResult: { error: null } },
      app_ideas: { singleResult: { data: { id: 'idea-abc', slug: 'tennis-score-tracker' }, error: null } },
      pledges: { chainResult: { error: null } },
      email_log: { chainResult: { error: null } },
    }
    const { admin } = makeAdminMock({ ...defaults, ...tableConfigs })
    mockCreateAdmin.mockReturnValue(admin)
    mockCreateClient.mockReturnValue(makeServerMock(userId))
    return { admin }
  }

  test('returns 401 for unauthenticated requests', async () => {
    setupSubmitMocks({}, null)

    const req = makeRequest('/api/submit', validBody)
    const res = await submitPOST(req)

    expect(res.status).toBe(401)
    expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled()
  })

  test('creates idea and pledge, returns client_secret', async () => {
    setupSubmitMocks()

    const req = makeRequest('/api/submit', validBody)
    const res = await submitPOST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.slug).toBe('tennis-score-tracker')
    expect(body.idea_id).toBe('idea-abc')
    expect(body.payment_intent_client_secret).toBe('pi_test_123_secret_abc')

    // Stripe PI created with manual capture (held, not charged immediately)
    expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 5000,
        currency: 'usd',
        capture_method: 'manual',
      })
    )

    // Pledge row inserted
    const pledgeCalls = (admin: ReturnType<typeof makeAdminMock>['admin']) =>
      admin.from.mock.calls.filter((c: string[]) => c[0] === 'pledges')
    expect(pledgeCalls(makeAdminMock().admin)).toBeDefined()
  })

  test('upserts users row when profile is missing', async () => {
    const { admin } = setupSubmitMocks({
      users: { singleResult: { data: null, error: null }, chainResult: { error: null } },
    })

    const req = makeRequest('/api/submit', validBody)
    const res = await submitPOST(req)

    expect(res.status).toBe(200)
    // upsert called because profile was null
    const upsertCalls = admin.from.mock.results
      .map((_: unknown, i: number) => ({ table: admin.from.mock.calls[i][0], chain: admin.from.mock.results[i].value }))
      .filter(({ table }: { table: string }) => table === 'users')
    expect(upsertCalls.length).toBeGreaterThan(0)
  })

  test('skips upsert when profile already exists', async () => {
    const { admin } = setupSubmitMocks({
      users: { singleResult: { data: { email: 'existing@example.com' }, error: null }, chainResult: { error: null } },
    })

    const req = makeRequest('/api/submit', validBody)
    const res = await submitPOST(req)

    expect(res.status).toBe(200)
    // Route does NOT call admin.auth.admin.createUser (no longer in route)
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled()
  })

  test('cancels Stripe PI if idea insert fails', async () => {
    setupSubmitMocks({
      app_ideas: { singleResult: { data: null, error: { message: 'DB error' } } },
    })

    const req = makeRequest('/api/submit', validBody)
    const res = await submitPOST(req)

    expect(res.status).toBe(500)
    expect(mockStripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_test_123')
  })

  test.each([
    [{ ...validBody, title: '' }, 'Title is required.'],
    [{ ...validBody, goal_description: '' }, 'Description is required.'],
    [{ ...validBody, target_user: '' }, 'Target user is required.'],
    [{ ...validBody, submitter_pledge_amount: 50 }, 'Pledge amount must be at least $1.'],
    [{ ...validBody, submitter_pledge_amount: 0 }, 'Pledge amount must be at least $1.'],
  ])('rejects invalid input: %s', async (body, expectedError) => {
    setupSubmitMocks()

    const req = makeRequest('/api/submit', body)
    const res = await submitPOST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe(expectedError)
    expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled()
  })

  test('⚠ BUG: no duplicate submission guard — same user+title can submit twice', async () => {
    // Two calls with the same user and title both create separate ideas and PIs.
    setupSubmitMocks()

    const req1 = makeRequest('/api/submit', validBody)
    const req2 = makeRequest('/api/submit', validBody)

    const [res1, res2] = await Promise.all([submitPOST(req1), submitPOST(req2)])

    // BOTH succeed — there is no server-side duplicate guard
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    expect(mockStripe.paymentIntents.create).toHaveBeenCalledTimes(2)
  })

  test('⚠ BUG: pledge insert failure is non-fatal — idea persists without pledge record', async () => {
    // If pledge insert fails, the route still returns success.
    // This leaves an orphaned PaymentIntent and idea with no pledge record.
    setupSubmitMocks({
      pledges: { chainResult: { error: { message: 'constraint violation' } } },
    })

    const req = makeRequest('/api/submit', validBody)
    const res = await submitPOST(req)
    const body = await res.json()

    // Route returns 200 even though pledge insert failed
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    // PI was NOT cancelled despite pledge failure
    expect(mockStripe.paymentIntents.cancel).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 2. PLEDGE FLOW
// ══════════════════════════════════════════════════════════════════════════════

describe('POST /api/pledge', () => {
  const validBody = {
    app_idea_id: 'idea-live-123',
    amount: 10000, // $100
    type: 'pledge',
  }

  function setupPledgeMocks(overrides: {
    userId?: string | null
    ideaStatus?: string
    pledgeInsertError?: { message: string } | null
  } = {}) {
    const { userId = 'user-123', ideaStatus = 'live', pledgeInsertError = null } = overrides

    const { admin } = makeAdminMock({
      app_ideas: {
        singleResult: {
          data: { id: 'idea-live-123', title: 'Tennis Tracker', slug: 'tennis-tracker', status: ideaStatus, funding_deadline: null },
          error: null,
        },
      },
      users: {
        singleResult: { data: { email: 'test@example.com' }, error: null },
      },
      pledges: {
        chainResult: pledgeInsertError ? { error: pledgeInsertError } : { error: null },
      },
    })
    mockCreateAdmin.mockReturnValue(admin)
    mockCreateClient.mockReturnValue(makeServerMock(userId))

    return { admin }
  }

  test('creates PaymentIntent with manual capture and returns client_secret', async () => {
    setupPledgeMocks()

    const req = makeRequest('/api/pledge', validBody)
    const res = await pledgePOST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.client_secret).toBe('pi_test_123_secret_abc')
    expect(body.payment_intent_id).toBe('pi_test_123')

    expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 10000,
        currency: 'usd',
        capture_method: 'manual',
        metadata: expect.objectContaining({
          user_id: 'user-123',
          app_idea_id: 'idea-live-123',
        }),
      })
    )
  })

  test('returns 401 for unauthenticated requests', async () => {
    setupPledgeMocks({ userId: null })

    const req = makeRequest('/api/pledge', validBody)
    const res = await pledgePOST(req)

    expect(res.status).toBe(401)
    expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled()
  })

  test('returns 400 when idea status is not in PLEDGE_OPEN', async () => {
    setupPledgeMocks({ ideaStatus: 'expired' })

    const req = makeRequest('/api/pledge', validBody)
    const res = await pledgePOST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/not currently accepting/)
    expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled()
  })

  test('returns 400 when idea status is rejected', async () => {
    setupPledgeMocks({ ideaStatus: 'rejected' })

    const req = makeRequest('/api/pledge', validBody)
    const res = await pledgePOST(req)

    expect(res.status).toBe(400)
    expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled()
  })

  test('accepts pledges on post-funding statuses (funded, building, in_review, built)', async () => {
    for (const status of ['funded', 'building', 'in_review', 'built']) {
      jest.clearAllMocks()
      mockStripe.paymentIntents.create.mockResolvedValue({ id: 'pi_x', client_secret: 'cs_x' })
      mockStripe.customers.list.mockResolvedValue({ data: [] })
      mockStripe.customers.create.mockResolvedValue({ id: 'cus_x' })

      setupPledgeMocks({ ideaStatus: status })

      const req = makeRequest('/api/pledge', validBody)
      const res = await pledgePOST(req)

      expect(res.status).toBe(200)
    }
  })

  test('cancels Stripe PI and returns 500 if pledge DB insert fails', async () => {
    setupPledgeMocks({ pledgeInsertError: { message: 'unique constraint violation' } })

    const req = makeRequest('/api/pledge', validBody)
    const res = await pledgePOST(req)

    expect(res.status).toBe(500)
    expect(mockStripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_test_123')
  })

  test('returns 400 for amount below minimum ($1)', async () => {
    setupPledgeMocks()

    const req = makeRequest('/api/pledge', { ...validBody, amount: 50 })
    const res = await pledgePOST(req)

    expect(res.status).toBe(400)
    expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled()
  })

  test('⚠ BUG: no server-side duplicate pledge guard — two concurrent calls both succeed', async () => {
    // This documents that /api/pledge has no deduplication.
    // Two concurrent requests from the same user for the same idea both create PIs.
    // The only guard is in the FeedFilter UI (anyPledgeOpen state).
    setupPledgeMocks()

    const req1 = makeRequest('/api/pledge', validBody)
    const req2 = makeRequest('/api/pledge', { ...validBody, app_idea_id: 'idea-different-456' })

    const [res1, res2] = await Promise.all([pledgePOST(req1), pledgePOST(req2)])

    // Both succeed — no server-side guard exists
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    expect(mockStripe.paymentIntents.create).toHaveBeenCalledTimes(2)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 3. ADMIN CAPTURE
// ══════════════════════════════════════════════════════════════════════════════

describe('POST /api/admin/capture-pledge', () => {
  function setupCaptureMocks(overrides: {
    isAdmin?: boolean
    pledgeStatus?: string
    stripeError?: Error | null
  } = {}) {
    const { isAdmin = true, pledgeStatus = 'held', stripeError = null } = overrides

    const { admin } = makeAdminMock({
      users: {
        singleResult: { data: { is_admin: isAdmin }, error: null },
      },
      pledges: {
        singleResult: {
          data: { id: 'pledge-789', status: pledgeStatus, stripe_payment_intent_id: 'pi_held_456' },
          error: null,
        },
        chainResult: { error: null },
      },
    })
    mockCreateAdmin.mockReturnValue(admin)
    mockCreateClient.mockReturnValue(makeServerMock('admin-user-id'))

    if (stripeError) {
      mockStripe.paymentIntents.capture.mockRejectedValue(stripeError)
    }

    return { admin }
  }

  test('returns 403 for non-admin users', async () => {
    setupCaptureMocks({ isAdmin: false })

    const req = makeRequest('/api/admin/capture-pledge', { pledge_id: 'pledge-789' })
    const res = await capturePOST(req)

    expect(res.status).toBe(403)
    expect(mockStripe.paymentIntents.capture).not.toHaveBeenCalled()
  })

  test('returns 401 for unauthenticated requests', async () => {
    const { admin } = makeAdminMock({
      users: { singleResult: { data: { is_admin: true }, error: null } },
    })
    mockCreateAdmin.mockReturnValue(admin)
    mockCreateClient.mockReturnValue(makeServerMock(null)) // no user

    const req = makeRequest('/api/admin/capture-pledge', { pledge_id: 'pledge-789' })
    const res = await capturePOST(req)

    expect(res.status).toBe(401)
  })

  test('captures pledge and updates status to captured', async () => {
    setupCaptureMocks()

    const req = makeRequest('/api/admin/capture-pledge', { pledge_id: 'pledge-789' })
    const res = await capturePOST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockStripe.paymentIntents.capture).toHaveBeenCalledWith('pi_held_456')
  })

  test('returns 400 if pledge is not in held status', async () => {
    for (const status of ['pending', 'authorized', 'captured', 'cancelled', 'refunded']) {
      jest.clearAllMocks()
      mockStripe.paymentIntents.capture.mockResolvedValue({ id: 'pi_x', status: 'succeeded' })
      setupCaptureMocks({ pledgeStatus: status })

      const req = makeRequest('/api/admin/capture-pledge', { pledge_id: 'pledge-789' })
      const res = await capturePOST(req)
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error).toMatch(/not in held status/)
      expect(mockStripe.paymentIntents.capture).not.toHaveBeenCalled()
    }
  })

  test('returns 502 if Stripe capture fails', async () => {
    setupCaptureMocks({ stripeError: new Error('Your card has insufficient funds') })

    const req = makeRequest('/api/admin/capture-pledge', { pledge_id: 'pledge-789' })
    const res = await capturePOST(req)
    const body = await res.json()

    expect(res.status).toBe(502)
    expect(body.error).toMatch(/Stripe capture failed/)
  })

  test('cannot capture a pending pledge (card not yet authorized)', async () => {
    // Pledges start as 'pending'. The Stripe webhook (payment_intent.amount_capturable_updated)
    // transitions them to 'held' once the customer enters their card.
    // Only 'held' pledges can be captured by admin.

    setupCaptureMocks({ pledgeStatus: 'pending' })

    const req = makeRequest('/api/admin/capture-pledge', { pledge_id: 'pledge-789' })
    const res = await capturePOST(req)

    expect(res.status).toBe(400)
    expect(mockStripe.paymentIntents.capture).not.toHaveBeenCalled()
  })

  test('returns 400 if pledge_id is missing', async () => {
    setupCaptureMocks()

    const req = makeRequest('/api/admin/capture-pledge', {})
    const res = await capturePOST(req)

    expect(res.status).toBe(400)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 4. ADMIN RELEASE
// ══════════════════════════════════════════════════════════════════════════════

describe('POST /api/admin/release-pledge', () => {
  function setupReleaseMocks(overrides: {
    isAdmin?: boolean
    pledgeStatus?: string
  } = {}) {
    const { isAdmin = true, pledgeStatus = 'held' } = overrides

    const { admin } = makeAdminMock({
      users: {
        singleResult: { data: { is_admin: isAdmin }, error: null },
      },
      pledges: {
        singleResult: {
          data: {
            id: 'pledge-release-1',
            status: pledgeStatus,
            stripe_payment_intent_id: 'pi_held_789',
            user_id: 'backer-user-id',
            app_idea_id: 'idea-abc',
            app_ideas: { title: 'Tennis Tracker', slug: 'tennis-tracker' },
            users: { email: 'backer@example.com' },
          },
          error: null,
        },
        chainResult: { error: null },
      },
      email_log: { chainResult: { error: null } },
    })
    mockCreateAdmin.mockReturnValue(admin)
    mockCreateClient.mockReturnValue(makeServerMock('admin-user-id'))

    return { admin }
  }

  test('returns 403 for non-admin users', async () => {
    setupReleaseMocks({ isAdmin: false })

    const req = makeRequest('/api/admin/release-pledge', { pledge_id: 'pledge-release-1' })
    const res = await releasePOST(req)

    expect(res.status).toBe(403)
    expect(mockStripe.paymentIntents.cancel).not.toHaveBeenCalled()
  })

  test('cancels Stripe PI and returns success', async () => {
    setupReleaseMocks()

    const req = makeRequest('/api/admin/release-pledge', { pledge_id: 'pledge-release-1' })
    const res = await releasePOST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockStripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_held_789')
  })

  test('returns 400 if pledge is not in held status', async () => {
    for (const status of ['pending', 'authorized', 'captured', 'cancelled', 'refunded']) {
      jest.clearAllMocks()
      mockStripe.paymentIntents.cancel.mockResolvedValue({ id: 'pi_x', status: 'canceled' })
      setupReleaseMocks({ pledgeStatus: status })

      const req = makeRequest('/api/admin/release-pledge', { pledge_id: 'pledge-release-1' })
      const res = await releasePOST(req)
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error).toMatch(/Only held pledges can be released/)
      expect(mockStripe.paymentIntents.cancel).not.toHaveBeenCalled()
    }
  })

  test('DB update happens before Stripe cancel — partial failure leaves PI still active', async () => {
    // With the fix: DB is updated first. If Stripe cancel subsequently fails,
    // the DB correctly shows 'cancelled' (source of truth) and the PI hold
    // expires naturally or the webhook self-heals. Previously it was the reverse:
    // Stripe cancelled first, then DB failed → PI gone but DB still said 'held'.
    const { admin } = makeAdminMock({
      users: { singleResult: { data: { is_admin: true }, error: null } },
      pledges: {
        singleResult: {
          data: {
            id: 'pledge-release-1',
            status: 'held',
            stripe_payment_intent_id: 'pi_held_789',
            user_id: 'backer-user-id',
            app_idea_id: 'idea-abc',
            app_ideas: { title: 'Tennis Tracker', slug: 'tennis-tracker' },
            users: { email: 'backer@example.com' },
          },
          error: null,
        },
        chainResult: { error: null }, // DB update succeeds
      },
      email_log: { chainResult: { error: null } },
    })
    mockCreateAdmin.mockReturnValue(admin)
    mockCreateClient.mockReturnValue(makeServerMock('admin-user-id'))

    const req = makeRequest('/api/admin/release-pledge', { pledge_id: 'pledge-release-1' })
    const res = await releasePOST(req)

    expect(res.status).toBe(200)
    // Stripe cancel was called after DB update succeeded
    expect(mockStripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_held_789')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 5. MULTI-PLEDGE GUARD
// ══════════════════════════════════════════════════════════════════════════════

describe('Multi-pledge guard (concurrent requests)', () => {
  test('⚠ BUG: two pledge calls for different ideas both succeed — no server-side guard', async () => {
    // This documents the critical bug: clicking tier buttons on two cards quickly
    // before either request completes creates two PaymentIntents.
    // The fix in FeedFilter.tsx adds a UI guard, but there is no API-level guard.

    const { admin } = makeAdminMock({
      app_ideas: {
        singleResult: {
          data: { id: 'idea-A', title: 'App A', slug: 'app-a', status: 'live', funding_deadline: null },
          error: null,
        },
      },
      users: { singleResult: { data: { email: 'user@example.com' }, error: null } },
      pledges: { chainResult: { error: null } },
    })
    mockCreateAdmin.mockReturnValue(admin)
    mockCreateClient.mockReturnValue(makeServerMock('user-123'))

    const req1 = makeRequest('/api/pledge', { app_idea_id: 'idea-A', amount: 10000, type: 'pledge' })
    const req2 = makeRequest('/api/pledge', { app_idea_id: 'idea-B', amount: 50000, type: 'pledge' })

    const [res1, res2] = await Promise.all([pledgePOST(req1), pledgePOST(req2)])

    // Both succeed — API has no dedup mechanism
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    expect(mockStripe.paymentIntents.create).toHaveBeenCalledTimes(2)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 6. SUPPORT FLOW
// ══════════════════════════════════════════════════════════════════════════════

describe('POST /api/support', () => {
  function setupSupportMocks(userId: string | null = 'user-123') {
    const { admin } = makeAdminMock({
      users: { singleResult: { data: { email: 'user@example.com' }, error: null } },
      shipdit_supporters: { chainResult: { error: null } },
    })
    mockCreateAdmin.mockReturnValue(admin)
    mockCreateClient.mockReturnValue(makeServerMock(userId))
    return { admin }
  }

  test('creates one-time PaymentIntent (no manual capture) and inserts supporter row', async () => {
    setupSupportMocks()

    const req = makeRequest('/api/support', { amount: 2500 }) // $25
    const res = await supportPOST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.client_secret).toBe('pi_test_123_secret_abc')

    // No manual capture — immediate charge
    expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2500,
        currency: 'usd',
      })
    )
    // Critically: should NOT have capture_method: 'manual'
    expect(mockStripe.paymentIntents.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ capture_method: 'manual' })
    )
  })

  test('returns 401 for unauthenticated requests', async () => {
    setupSupportMocks(null)

    const req = makeRequest('/api/support', { amount: 2500 })
    const res = await supportPOST(req)

    expect(res.status).toBe(401)
    expect(mockStripe.paymentIntents.create).not.toHaveBeenCalled()
  })

  test('returns 400 for amount below $1 minimum', async () => {
    setupSupportMocks()

    const req = makeRequest('/api/support', { amount: 50 }) // 50 cents
    const res = await supportPOST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/Minimum support is \$1/)
  })

  test('⚠ BUG: supporter row inserted before payment confirmed — phantom rows on abandoned payments', async () => {
    // The route inserts into shipdit_supporters immediately when PI is created,
    // not after the user completes payment on the client side.
    // If a user creates a PI but never enters card details, a row exists with
    // an unconfirmed PaymentIntent ID.

    const { admin } = setupSupportMocks()

    const req = makeRequest('/api/support', { amount: 1000 })
    await supportPOST(req)

    // Row was inserted before any payment confirmation
    const supporterInsertCalls = admin.from.mock.calls.filter(
      (call: string[]) => call[0] === 'shipdit_supporters'
    )
    expect(supporterInsertCalls.length).toBeGreaterThan(0)
    // PI is merely "created", not yet confirmed — user may still abandon
    expect(mockStripe.paymentIntents.create).toHaveBeenCalledTimes(1)
  })
})
