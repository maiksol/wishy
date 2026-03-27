import NextAuth, { type AuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import prisma from '../../../lib/prisma'

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'E-post', type: 'email' },
        pin:   { label: 'PIN', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.pin) return null
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        })
        if (!user) return null
        const valid = await compare(credentials.pin, user.passwordHash)
        if (!valid) return null
        return { id: user.id, name: user.name, email: user.email }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/logg-inn',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id    = user.id as number
        token.name  = user.name!
        token.email = user.email!
      }
      return token
    },
    async session({ session, token }) {
      session.user.id    = token.id
      session.user.name  = token.name
      session.user.email = token.email
      return session
    },
  },
}

export default NextAuth(authOptions)
