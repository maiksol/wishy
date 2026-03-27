import type { GetServerSideProps } from 'next'
import { getServerSession } from 'next-auth'
import Link from 'next/link'
import { authOptions } from './api/auth/[...nextauth]'
import Logo from '../components/Logo'
import { THEMES, type Theme } from '../lib/themes'
import styles from '../styles/Home.module.css'

type InvitePageProps = {
  token: string
  listName: string
  ownerName: string
  theme: string | null
}

export default function InvitePage({ token, listName, ownerName, theme }: InvitePageProps) {
  const activeTheme = THEMES.find((t) => t.id === theme) ?? THEMES[0]
  const containerClass = [styles.page, theme ? styles[theme] : ''].filter(Boolean).join(' ')

  const registerUrl = `/registrer?token=${encodeURIComponent(token)}&listName=${encodeURIComponent(listName)}&ownerName=${encodeURIComponent(ownerName)}`
  const loginUrl = `/logg-inn?callbackUrl=${encodeURIComponent(`/invite?token=${token}`)}`

  return (
    <div className={containerClass}>
      <div className={styles.authPage}>
        <div className={styles.authCard}>
          <div className={styles.authLogo}>
            <Logo />
          </div>
          <div className={styles.inviteEmoji}>{activeTheme.emoji}</div>
          <h1 className={styles.authTitle}>Du er invitert!</h1>
          <p className={styles.inviteText}>
            <strong>{ownerName}</strong> vil dele ønskelisten{' '}
            <strong>«{listName}»</strong> med deg.
          </p>
          <Link href={registerUrl} className={styles.invitePrimaryButton}>
            Registrer deg for å se listen
          </Link>
          <p className={styles.authSwitch}>
            Har du allerede konto?{' '}
            <Link href={loginUrl}>Logg inn</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const token = ctx.query.token as string | undefined
  if (!token) return { notFound: true }

  const { default: prisma } = await import('../lib/prisma')
  const list = await prisma.wishList.findUnique({
    where: { shareToken: token },
    include: { owner: { select: { name: true } } },
  })
  if (!list) return { notFound: true }

  const session = await getServerSession(ctx.req, ctx.res, authOptions)

  // Already logged in → join and redirect immediately
  if (session) {
    const userId = session.user.id
    if (list.ownerId !== userId) {
      await prisma.wishListShare.upsert({
        where: { listId_userId: { listId: list.id, userId } },
        create: { listId: list.id, userId },
        update: {},
      })
    }
    return { redirect: { destination: `/list/${list.id}`, permanent: false } }
  }

  return {
    props: {
      token,
      listName: list.name,
      ownerName: list.owner.name,
      theme: list.theme ?? null,
    },
  }
}
