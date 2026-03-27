import { vi } from 'vitest'
import type { NextApiRequest, NextApiResponse } from 'next'

export function mockReq(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
  return {
    method: 'GET',
    body: {},
    query: {},
    headers: {},
    ...overrides,
  } as NextApiRequest
}

export function mockRes() {
  const res = {
    statusCode: 200,
    _data: undefined as unknown,
    _ended: false,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(data: unknown) {
      this._data = data
      return this
    },
    end() {
      this._ended = true
      return this
    },
    setHeader: vi.fn(),
  }
  return res as unknown as NextApiResponse & {
    statusCode: number
    _data: unknown
    _ended: boolean
  }
}

/** A session for user with id=1 (owner in most tests) */
export const SESSION_OWNER = { user: { id: 1, name: 'Alice', email: 'alice@example.com' } }

/** A session for user with id=2 (viewer in most tests) */
export const SESSION_VIEWER = { user: { id: 2, name: 'Bob', email: 'bob@example.com' } }
