import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockReq, mockRes, SESSION_OWNER, SESSION_VIEWER } from '../helpers/mock'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('../../pages/api/auth/[...nextauth]', () => ({ authOptions: {} }))

const mockPrisma = {
  wishList: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  wishListShare: {
    findUnique: vi.fn(),
  },
}
vi.mock('../../lib/prisma', () => ({ default: mockPrisma }))

import { getServerSession } from 'next-auth'
const { default: handler } = await import('../../pages/api/lists')

const mockSession = vi.mocked(getServerSession)

describe('/api/lists', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('auth guard', () => {
    it('returns 401 when not logged in', async () => {
      mockSession.mockResolvedValue(null)
      const res = mockRes()
      await handler(mockReq(), res)
      expect(res.statusCode).toBe(401)
    })
  })

  describe('GET all lists', () => {
    it('returns lists owned by or shared with the user', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      const lists = [{ id: 1, name: 'My List', ownerId: 1 }]
      mockPrisma.wishList.findMany.mockResolvedValue(lists)
      const res = mockRes()
      await handler(mockReq({ method: 'GET', query: {} }), res)
      expect(res.statusCode).toBe(200)
      expect(res._data).toEqual(lists)
    })
  })

  describe('GET single list', () => {
    it('returns 404 when list does not exist', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      mockPrisma.wishList.findUnique.mockResolvedValue(null)
      const res = mockRes()
      await handler(mockReq({ method: 'GET', query: { id: '99' } }), res)
      expect(res.statusCode).toBe(404)
    })

    it('returns 403 when user has no access', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      mockPrisma.wishList.findUnique.mockResolvedValue({ id: 1, ownerId: 1 })
      mockPrisma.wishListShare.findUnique.mockResolvedValue(null)
      const res = mockRes()
      await handler(mockReq({ method: 'GET', query: { id: '1' } }), res)
      expect(res.statusCode).toBe(403)
    })

    it('returns list for owner', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      const list = { id: 1, ownerId: 1, name: 'My List' }
      mockPrisma.wishList.findUnique.mockResolvedValue(list)
      const res = mockRes()
      await handler(mockReq({ method: 'GET', query: { id: '1' } }), res)
      expect(res.statusCode).toBe(200)
      expect(res._data).toEqual(list)
    })

    it('returns list for viewer with share', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      const list = { id: 1, ownerId: 1, name: 'Shared List' }
      mockPrisma.wishList.findUnique.mockResolvedValue(list)
      mockPrisma.wishListShare.findUnique.mockResolvedValue({ id: 1, listId: 1, userId: 2 })
      const res = mockRes()
      await handler(mockReq({ method: 'GET', query: { id: '1' } }), res)
      expect(res.statusCode).toBe(200)
    })
  })

  describe('POST — create list', () => {
    it('returns 400 when name is missing', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { theme: 'jul' } }), res)
      expect(res.statusCode).toBe(400)
    })

    it('creates list with ownerId from session', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      const created = { id: 1, name: 'Juleliste', theme: 'jul', ownerId: 1 }
      mockPrisma.wishList.create.mockResolvedValue(created)
      const res = mockRes()
      await handler(mockReq({ method: 'POST', body: { name: 'Juleliste', theme: 'jul' } }), res)
      expect(res.statusCode).toBe(201)
      expect(mockPrisma.wishList.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Juleliste', ownerId: 1 }) })
      )
    })
  })

  describe('PATCH — update list', () => {
    it('returns 403 when caller is not owner', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      mockPrisma.wishList.findUnique.mockResolvedValue({ id: 1, ownerId: 1 })
      const res = mockRes()
      await handler(mockReq({ method: 'PATCH', query: { id: '1' }, body: { name: 'New Name' } }), res)
      expect(res.statusCode).toBe(403)
    })

    it('updates name and theme for owner', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      mockPrisma.wishList.findUnique.mockResolvedValue({ id: 1, ownerId: 1 })
      const updated = { id: 1, name: 'Nytt navn', theme: 'bursdag', ownerId: 1 }
      mockPrisma.wishList.update.mockResolvedValue(updated)
      const res = mockRes()
      await handler(mockReq({ method: 'PATCH', query: { id: '1' }, body: { name: 'Nytt navn', theme: 'bursdag' } }), res)
      expect(res.statusCode).toBe(200)
      expect(res._data).toEqual(updated)
    })

    it('returns 400 when name is empty string', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      mockPrisma.wishList.findUnique.mockResolvedValue({ id: 1, ownerId: 1 })
      const res = mockRes()
      await handler(mockReq({ method: 'PATCH', query: { id: '1' }, body: { name: '   ' } }), res)
      expect(res.statusCode).toBe(400)
    })
  })

  describe('DELETE — remove list', () => {
    it('returns 403 when caller is not owner', async () => {
      mockSession.mockResolvedValue(SESSION_VIEWER)
      mockPrisma.wishList.findUnique.mockResolvedValue({ id: 1, ownerId: 1 })
      const res = mockRes()
      await handler(mockReq({ method: 'DELETE', query: { id: '1' } }), res)
      expect(res.statusCode).toBe(403)
    })

    it('deletes list for owner', async () => {
      mockSession.mockResolvedValue(SESSION_OWNER)
      mockPrisma.wishList.findUnique.mockResolvedValue({ id: 1, ownerId: 1 })
      mockPrisma.wishList.delete.mockResolvedValue({})
      const res = mockRes()
      await handler(mockReq({ method: 'DELETE', query: { id: '1' } }), res)
      expect(res.statusCode).toBe(204)
      expect(mockPrisma.wishList.delete).toHaveBeenCalledWith({ where: { id: 1 } })
    })
  })
})
