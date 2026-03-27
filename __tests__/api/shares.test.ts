import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockReq, mockRes, SESSION_OWNER, SESSION_VIEWER } from '../helpers/mock'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('../../pages/api/auth/[...nextauth]', () => ({ authOptions: {} }))

const mockPrisma = {
  wishList: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  wishListShare: {
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
}
vi.mock('../../lib/prisma', () => ({ default: mockPrisma }))

import { getServerSession } from 'next-auth'
const { default: handler } = await import('../../pages/api/shares')

const mockSession = vi.mocked(getServerSession)

const OWNER_LIST = { id: 1, ownerId: 1 }

describe('/api/shares', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('auth guard', () => {
    it('returns 401 when not logged in', async () => {
      mockSession.mockResolvedValue(null)
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { action: 'generate-token', listId: 1 } }), res)
      expect(res.statusCode).toBe(401)
    })
  })

  describe('method guard', () => {
    it('returns 405 for non-POST', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      const res = mockRes()
      await handler(mockReq({ method: 'GET' }), res)
      expect(res.statusCode).toBe(405)
    })
  })

  describe('unknown action', () => {
    it('returns 400 for unknown action', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { action: 'frobnicate' } }), res)
      expect(res.statusCode).toBe(400)
    })
  })

  describe('action: generate-token', () => {
    it('returns 400 when listId is missing', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { action: 'generate-token' } }), res)
      expect(res.statusCode).toBe(400)
    })

    it('returns 403 when caller is not owner', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      mockPrisma.wishList.findUnique.mockResolvedValue(OWNER_LIST)
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { action: 'generate-token', listId: 1 } }), res)
      expect(res.statusCode).toBe(403)
    })

    it('generates and stores a token for owner', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      mockPrisma.wishList.findUnique.mockResolvedValue(OWNER_LIST)
      mockPrisma.wishList.update.mockResolvedValue({})
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { action: 'generate-token', listId: 1 } }), res)
      expect(res.statusCode).toBe(200)
      expect(mockPrisma.wishList.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ shareToken: expect.any(String) }) })
      )
    })
  })

  describe('action: revoke-token', () => {
    it('returns 403 when caller is not owner', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      mockPrisma.wishList.findUnique.mockResolvedValue(OWNER_LIST)
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { action: 'revoke-token', listId: 1 } }), res)
      expect(res.statusCode).toBe(403)
    })

    it('sets shareToken to null for owner', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      mockPrisma.wishList.findUnique.mockResolvedValue(OWNER_LIST)
      mockPrisma.wishList.update.mockResolvedValue({})
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { action: 'revoke-token', listId: 1 } }), res)
      expect(res.statusCode).toBe(200)
      expect(mockPrisma.wishList.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { shareToken: null } })
      )
    })
  })

  describe('action: add', () => {
    it('returns 400 when email is missing', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { action: 'add', listId: 1 } }), res)
      expect(res.statusCode).toBe(400)
    })

    it('returns 403 when caller is not owner', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      mockPrisma.wishList.findUnique.mockResolvedValue(OWNER_LIST)
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { action: 'add', listId: 1, email: 'c@c.com' } }), res)
      expect(res.statusCode).toBe(403)
    })

    it('returns 404 when target user does not exist', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      mockPrisma.wishList.findUnique.mockResolvedValue(OWNER_LIST)
      mockPrisma.user.findUnique.mockResolvedValue(null)
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { action: 'add', listId: 1, email: 'nobody@x.com' } }), res)
      expect(res.statusCode).toBe(404)
    })

    it('returns 400 when owner tries to share with themselves', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      mockPrisma.wishList.findUnique.mockResolvedValue(OWNER_LIST)
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, email: 'alice@example.com' }) // same as owner
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { action: 'add', listId: 1, email: 'alice@example.com' } }), res)
      expect(res.statusCode).toBe(400)
    })

    it('creates a share for a valid target user', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      mockPrisma.wishList.findUnique.mockResolvedValue(OWNER_LIST)
      mockPrisma.user.findUnique.mockResolvedValue({ id: 2, email: 'bob@example.com' })
      mockPrisma.wishListShare.upsert.mockResolvedValue({})
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { action: 'add', listId: 1, email: 'bob@example.com' } }), res)
      expect(res.statusCode).toBe(200)
      expect(mockPrisma.wishListShare.upsert).toHaveBeenCalled()
    })
  })

  describe('action: remove', () => {
    it('returns 403 when caller is not owner', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      mockPrisma.wishList.findUnique.mockResolvedValue(OWNER_LIST)
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { action: 'remove', listId: 1, targetUserId: 2 } }), res)
      expect(res.statusCode).toBe(403)
    })

    it('removes share for owner', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      mockPrisma.wishList.findUnique.mockResolvedValue(OWNER_LIST)
      mockPrisma.wishListShare.deleteMany.mockResolvedValue({})
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { action: 'remove', listId: 1, targetUserId: 2 } }), res)
      expect(res.statusCode).toBe(200)
      expect(mockPrisma.wishListShare.deleteMany).toHaveBeenCalledWith({ where: { listId: 1, userId: 2 } })
    })
  })

  describe('action: join', () => {
    it('returns 400 when token is missing', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { action: 'join' } }), res)
      expect(res.statusCode).toBe(400)
    })

    it('returns 404 for invalid token', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      mockPrisma.wishList.findUnique.mockResolvedValue(null)
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { action: 'join', token: 'badtoken' } }), res)
      expect(res.statusCode).toBe(404)
    })

    it('returns listId without creating share when owner joins their own list', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      mockPrisma.wishList.findUnique.mockResolvedValue({ id: 1, ownerId: 1 })
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { action: 'join', token: 'mytoken' } }), res)
      expect(res.statusCode).toBe(200)
      expect(res._data).toMatchObject({ listId: 1 })
      expect(mockPrisma.wishListShare.upsert).not.toHaveBeenCalled()
    })

    it('creates share and returns listId for viewer', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      mockPrisma.wishList.findUnique.mockResolvedValue({ id: 1, ownerId: 1 })
      mockPrisma.wishListShare.upsert.mockResolvedValue({})
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { action: 'join', token: 'validtoken' } }), res)
      expect(res.statusCode).toBe(200)
      expect(res._data).toMatchObject({ ok: true, listId: 1 })
      expect(mockPrisma.wishListShare.upsert).toHaveBeenCalled()
    })
  })
})
