import type { GetServerSideProps } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from './api/auth/[...nextauth]'

// This page has no UI — it only redirects via getServerSideProps.
export default function InvitePage() {
  return null
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const token = ctx.query.token as string | undefined
  if (!token) return { notFound: true }

  const session = await getServerSession(ctx.req, ctx.res, authOptions)

  if (!session) {
    // Not logged in → go register (or log in) with token preserved
    return {
      redirect: {
        destination: `/registrer?token=${encodeURIComponent(token)}`,
        permanent: false,
      },
    }
  }

  // Logged in → join the list
  const { default: prisma } = await import('../lib/prisma')
  const list = await prisma.wishList.findUnique({ where: { shareToken: token } })
  if (!list) return { notFound: true }

  const userId = session.user.id

  if (list.ownerId !== userId) {
    await prisma.wishListShare.upsert({
      where: { listId_userId: { listId: list.id, userId } },
      create: { listId: list.id, userId },
      update: {},
    })
  }

  return {
    redirect: {
      destination: `/list/${list.id}`,
      permanent: false,
    },
  }
}
