import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: number
      name: string
      email: string
    } & DefaultSession['user']
  }

  interface User {
    id: number
    name: string
    email: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: number
    name: string
    email: string
  }
}
