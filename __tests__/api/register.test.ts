import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockReq, mockRes } from '../helpers/mock'

vi.mock('bcryptjs', () => ({
  hash: vi.fn().mockResolvedValue('hashed_pin'),
}))

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  wishList: {
    findUnique: vi.fn(),
  },
  wishListShare: {
    upsert: vi.fn(),
  },
}
vi.mock('../../lib/prisma', () => ({ default: mockPrisma }))

const { default: handler } = await import('../../pages/api/register')

describe('POST /api/register', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 405 for non-POST', async () => {
    const res = mockRes()
    await handler(mockReq({ method: 'GET' }), res)
    expect(res.statusCode).toBe(405)
  })

  it('returns 400 when name is missing', async () => {
    const res = mockRes()
    await handler(mockReq({ method: 'POST', body: { email: 'a@b.com', pin: '1234' } }), res)
    expect(res.statusCode).toBe(400)
    expect(res._data).toMatchObject({ error: expect.stringContaining('Navn') })
  })

  it('returns 400 when email is missing', async () => {
    const res = mockRes()
    await handler(mockReq({ method: 'POST', body: { name: 'Alice', pin: '1234' } }), res)
    expect(res.statusCode).toBe(400)
    expect(res._data).toMatchObject({ error: expect.stringContaining('E-post') })
  })

  it('returns 400 when PIN is too short', async () => {
    const res = mockRes()
    await handler(mockReq({ method: 'POST', body: { name: 'Alice', email: 'a@b.com', pin: '123' } }), res)
    expect(res.statusCode).toBe(400)
    expect(res._data).toMatchObject({ error: expect.stringContaining('PIN') })
  })

  it('returns 400 when PIN contains non-digits', async () => {
    const res = mockRes()
    await handler(mockReq({ method: 'POST', body: { name: 'Alice', email: 'a@b.com', pin: '12ab' } }), res)
    expect(res.statusCode).toBe(400)
  })

  it('returns 409 when email already exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 1, email: 'a@b.com' })
    const res = mockRes()
    await handler(mockReq({ method: 'POST', body: { name: 'Alice', email: 'a@b.com', pin: '1234' } }), res)
    expect(res.statusCode).toBe(409)
  })

  it('creates user and returns 201 on valid input', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({ id: 1, name: 'Alice', email: 'alice@example.com' })
    const res = mockRes()
    await handler(mockReq({ method: 'POST', body: { name: 'Alice', email: 'alice@example.com', pin: '1234' } }), res)
    expect(res.statusCode).toBe(201)
    expect(res._data).toMatchObject({ id: 1, name: 'Alice', email: 'alice@example.com' })
  })

  it('normalises email to lowercase before storing', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({ id: 1, name: 'Alice', email: 'alice@example.com' })
    const res = mockRes()
    await handler(mockReq({ method: 'POST', body: { name: 'Alice', email: '  Alice@EXAMPLE.COM  ', pin: '1234' } }), res)
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: 'alice@example.com' }) })
    )
  })

  it('auto-joins list when a valid invite token is provided', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({ id: 42, name: 'Alice', email: 'alice@example.com' })
    mockPrisma.wishList.findUnique.mockResolvedValue({ id: 7 })
    mockPrisma.wishListShare.upsert.mockResolvedValue({})
    const res = mockRes()
    await handler(
      mockReq({ method: 'POST', body: { name: 'Alice', email: 'alice@example.com', pin: '1234', token: 'validtoken' } }),
      res
    )
    expect(res.statusCode).toBe(201)
    expect(res._data).toMatchObject({ listId: 7 })
    expect(mockPrisma.wishListShare.upsert).toHaveBeenCalled()
  })

  it('still registers successfully when invite token is invalid', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({ id: 42, name: 'Alice', email: 'alice@example.com' })
    mockPrisma.wishList.findUnique.mockResolvedValue(null)
    const res = mockRes()
    await handler(
      mockReq({ method: 'POST', body: { name: 'Alice', email: 'alice@example.com', pin: '1234', token: 'badtoken' } }),
      res
    )
    expect(res.statusCode).toBe(201)
    expect((res._data as { listId?: number }).listId).toBeUndefined()
    expect(mockPrisma.wishListShare.upsert).not.toHaveBeenCalled()
  })
})
