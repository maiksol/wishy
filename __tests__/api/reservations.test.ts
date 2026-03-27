import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockReq, mockRes, SESSION_OWNER, SESSION_VIEWER } from '../helpers/mock'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('../../pages/api/auth/[...nextauth]', () => ({ authOptions: {} }))

const mockPrisma = {
  wish: {
    findUnique: vi.fn(),
  },
  wishListShare: {
    findUnique: vi.fn(),
  },
  reservation: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
}
vi.mock('../../lib/prisma', () => ({ default: mockPrisma }))

import { getServerSession } from 'next-auth'
const { default: handler } = await import('../../pages/api/reservations')

const mockSession = vi.mocked(getServerSession)

// A wish owned by user 1 (owner), accessible by user 2 (viewer)
const WISH = { id: 10, listId: 1, list: { ownerId: 1 } }
const SHARE = { id: 1, listId: 1, userId: 2 }

describe('/api/reservations', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('auth guard', () => {
    it('returns 401 when not logged in', async () => {
      mockSession.mockResolvedValue(null)
      const res = mockRes()
      await handler(mockReq(), res)
      expect(res.statusCode).toBe(401)
    })
  })

  describe('POST — create or update reservation', () => {
    it('returns 400 when wishId is missing', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { status: 'reservert' } }), res)
      expect(res.statusCode).toBe(400)
    })

    it('returns 400 when status is invalid', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { wishId: 10, status: 'eid' } }), res)
      expect(res.statusCode).toBe(400)
    })

    it('returns 404 when wish does not exist', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      mockPrisma.wish.findUnique.mockResolvedValue(null)
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { wishId: 99, status: 'reservert' } }), res)
      expect(res.statusCode).toBe(404)
    })

    it('returns 403 when owner tries to reserve their own wish', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      mockPrisma.wish.findUnique.mockResolvedValue(WISH)
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { wishId: 10, status: 'reservert' } }), res)
      expect(res.statusCode).toBe(403)
      expect((res._data as { error: string }).error).toMatch(/egne ønsker/)
    })

    it('returns 403 when viewer has no share access', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      mockPrisma.wish.findUnique.mockResolvedValue(WISH)
      mockPrisma.wishListShare.findUnique.mockResolvedValue(null)
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { wishId: 10, status: 'reservert' } }), res)
      expect(res.statusCode).toBe(403)
    })

    it('returns 409 when someone else already reserved the wish', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      mockPrisma.wish.findUnique.mockResolvedValue(WISH)
      mockPrisma.wishListShare.findUnique.mockResolvedValue(SHARE)
      mockPrisma.reservation.findUnique.mockResolvedValue({ id: 1, wishId: 10, userId: 99 }) // different user
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { wishId: 10, status: 'reservert' } }), res)
      expect(res.statusCode).toBe(409)
    })

    it('creates a reservation for authorised viewer', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      mockPrisma.wish.findUnique.mockResolvedValue(WISH)
      mockPrisma.wishListShare.findUnique.mockResolvedValue(SHARE)
      mockPrisma.reservation.findUnique.mockResolvedValue(null)
      const created = { id: 1, wishId: 10, userId: 2, status: 'reservert' }
      mockPrisma.reservation.upsert.mockResolvedValue(created)
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { wishId: 10, status: 'reservert' } }), res)
      expect(res.statusCode).toBe(200)
      expect(res._data).toEqual(created)
    })

    it('allows viewer to upgrade their own reservation from reservert to kjopt', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      mockPrisma.wish.findUnique.mockResolvedValue(WISH)
      mockPrisma.wishListShare.findUnique.mockResolvedValue(SHARE)
      mockPrisma.reservation.findUnique.mockResolvedValue({ id: 1, wishId: 10, userId: 2, status: 'reservert' }) // same user
      const updated = { id: 1, wishId: 10, userId: 2, status: 'kjopt' }
      mockPrisma.reservation.upsert.mockResolvedValue(updated)
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { wishId: 10, status: 'kjopt' } }), res)
      expect(res.statusCode).toBe(200)
      expect((res._data as { status: string }).status).toBe('kjopt')
    })
  })

  describe('DELETE — undo reservation', () => {
    it('returns 400 when wishId is missing', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      const res = mockRes()
      await handler(mockReq({ method: 'DELETE', query: {} }), res)
      expect(res.statusCode).toBe(400)
    })

    it('returns 404 when reservation does not exist', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      mockPrisma.reservation.findUnique.mockResolvedValue(null)
      const res = mockRes()
      await handler(mockReq({ method: 'DELETE', query: { wishId: '10' } }), res)
      expect(res.statusCode).toBe(404)
    })

    it('returns 403 when trying to undo someone else\'s reservation', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      mockPrisma.reservation.findUnique.mockResolvedValue({ id: 1, wishId: 10, userId: 99 }) // other user
      const res = mockRes()
      await handler(mockReq({ method: 'DELETE', query: { wishId: '10' } }), res)
      expect(res.statusCode).toBe(403)
    })

    it('deletes own reservation', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      mockPrisma.reservation.findUnique.mockResolvedValue({ id: 1, wishId: 10, userId: 2 })
      mockPrisma.reservation.delete.mockResolvedValue({})
      const res = mockRes()
      await handler(mockReq({ method: 'DELETE', query: { wishId: '10' } }), res)
      expect(res.statusCode).toBe(204)
      expect(mockPrisma.reservation.delete).toHaveBeenCalledWith({ where: { wishId: 10 } })
    })
  })

  describe('method guard', () => {
    it('returns 405 for unsupported methods', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      const res = mockRes()
      await handler(mockReq({ method: 'GET' }), res)
      expect(res.statusCode).toBe(405)
    })
  })
})
