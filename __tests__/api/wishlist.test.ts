import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockReq, mockRes, SESSION_OWNER, SESSION_VIEWER } from '../helpers/mock'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('../../pages/api/auth/[...nextauth]', () => ({ authOptions: {} }))

const mockPrisma = {
  wishList: {
    findUnique: vi.fn(),
  },
  wishListShare: {
    findUnique: vi.fn(),
  },
  wish: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}
vi.mock('../../lib/prisma', () => ({ default: mockPrisma }))

import { getServerSession } from 'next-auth'
const { default: handler } = await import('../../pages/api/wishlist')

const mockSession = vi.mocked(getServerSession)

describe('/api/wishlist', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('auth guard', () => {
    it('returns 401 when not logged in', async () => {
      mockSession.mockResolvedValue(null)
      const res = mockRes()
      await handler(mockReq(), res)
      expect(res.statusCode).toBe(401)
    })
  })

  describe('GET — fetch wishes', () => {
    it('returns 400 when listId is missing', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      const res = mockRes()
      await handler(mockReq({ method: 'GET', query: {} }), res)
      expect(res.statusCode).toBe(400)
    })

    it('returns 403 when user has no access', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      mockPrisma.wishList.findUnique.mockResolvedValue({ id: 1, ownerId: 1 })
      mockPrisma.wishListShare.findUnique.mockResolvedValue(null)
      const res = mockRes()
      await handler(mockReq({ method: 'GET', query: { listId: '1' } }), res)
      expect(res.statusCode).toBe(403)
    })

    it('strips reservation data for owner (surprise preservation)', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      mockPrisma.wishList.findUnique.mockResolvedValue({ id: 1, ownerId: 1 })
      mockPrisma.wish.findMany.mockResolvedValue([
        { id: 10, title: 'Book', reservation: { id: 1, userId: 2, status: 'reservert', user: { id: 2, name: 'Bob' } } },
      ])
      const res = mockRes()
      await handler(mockReq({ method: 'GET', query: { listId: '1' } }), res)
      expect(res.statusCode).toBe(200)
      const wishes = res._data as Array<{ reservation: unknown }>
      expect(wishes[0].reservation).toBeNull()
    })

    it('returns reservation data for viewer', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      mockPrisma.wishList.findUnique.mockResolvedValue({ id: 1, ownerId: 1 })
      mockPrisma.wishListShare.findUnique.mockResolvedValue({ id: 1, listId: 1, userId: 2 })
      const reservation = { id: 1, userId: 2, status: 'reservert', user: { id: 2, name: 'Bob' } }
      mockPrisma.wish.findMany.mockResolvedValue([{ id: 10, title: 'Book', reservation }])
      const res = mockRes()
      await handler(mockReq({ method: 'GET', query: { listId: '1' } }), res)
      expect(res.statusCode).toBe(200)
      const wishes = res._data as Array<{ reservation: unknown }>
      expect(wishes[0].reservation).toEqual(reservation)
    })
  })

  describe('POST — add wish', () => {
    it('returns 400 when title is missing', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      mockPrisma.wishList.findUnique.mockResolvedValue({ id: 1, ownerId: 1 })
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { listId: 1 } }), res)
      expect(res.statusCode).toBe(400)
    })

    it('returns 403 when non-owner tries to add a wish', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      mockPrisma.wishList.findUnique.mockResolvedValue({ id: 1, ownerId: 1 })
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { title: 'Bike', listId: 1 } }), res)
      expect(res.statusCode).toBe(403)
    })

    it('creates wish for owner', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      mockPrisma.wishList.findUnique.mockResolvedValue({ id: 1, ownerId: 1 })
      const created = { id: 5, title: 'Bike', description: null, url: null, listId: 1, reservation: null }
      mockPrisma.wish.create.mockResolvedValue(created)
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { title: 'Bike', listId: 1 } }), res)
      expect(res.statusCode).toBe(201)
      expect(res._data).toEqual(created)
    })

    it('trims whitespace from title', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      mockPrisma.wishList.findUnique.mockResolvedValue({ id: 1, ownerId: 1 })
      mockPrisma.wish.create.mockResolvedValue({ id: 5, title: 'Bike', listId: 1, reservation: null })
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { title: '  Bike  ', listId: 1 } }), res)
      expect(mockPrisma.wish.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ title: 'Bike' }) })
      )
    })

    it('stores null for empty description and url', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      mockPrisma.wishList.findUnique.mockResolvedValue({ id: 1, ownerId: 1 })
      mockPrisma.wish.create.mockResolvedValue({ id: 5, title: 'Bike', listId: 1, reservation: null })
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { title: 'Bike', description: '  ', url: '', listId: 1 } }), res)
      expect(mockPrisma.wish.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ description: null, url: null }) })
      )
    })
  })

  describe('PATCH — edit wish', () => {
    it('returns 403 when non-owner tries to edit', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      mockPrisma.wish.findUnique.mockResolvedValue({ id: 5, list: { ownerId: 1 } })
      const res = mockRes()
      await handler(mockReq({ method: 'PATCH', query: { id: '5' }, body: { title: 'New Title' } }), res)
      expect(res.statusCode).toBe(403)
    })

    it('returns 400 when title is set to empty string', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      mockPrisma.wish.findUnique.mockResolvedValue({ id: 5, list: { ownerId: 1 } })
      const res = mockRes()
      await handler(mockReq({ method: 'PATCH', query: { id: '5' }, body: { title: '   ' } }), res)
      expect(res.statusCode).toBe(400)
    })

    it('updates wish for owner', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      mockPrisma.wish.findUnique.mockResolvedValue({ id: 5, list: { ownerId: 1 } })
      const updated = { id: 5, title: 'New Bike', description: 'Red one', url: null, reservation: null }
      mockPrisma.wish.update.mockResolvedValue(updated)
      const res = mockRes()
      await handler(mockReq({ method: 'PATCH', query: { id: '5' }, body: { title: 'New Bike', description: 'Red one' } }), res)
      expect(res.statusCode).toBe(200)
      expect(res._data).toEqual(updated)
    })
  })

  describe('DELETE — remove wish', () => {
    it('returns 403 when non-owner tries to delete', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      mockPrisma.wish.findUnique.mockResolvedValue({ id: 5, list: { ownerId: 1 } })
      const res = mockRes()
      await handler(mockReq({ method: 'DELETE', query: { id: '5' } }), res)
      expect(res.statusCode).toBe(403)
    })

    it('deletes wish for owner', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      mockPrisma.wish.findUnique.mockResolvedValue({ id: 5, list: { ownerId: 1 } })
      mockPrisma.wish.delete.mockResolvedValue({})
      const res = mockRes()
      await handler(mockReq({ method: 'DELETE', query: { id: '5' } }), res)
      expect(res.statusCode).toBe(204)
    })
  })
})
