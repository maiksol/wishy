import { useState, FormEvent, MouseEvent, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useSession, signOut } from 'next-auth/react'
import type { GetServerSideProps } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from './api/auth/[...nextauth]'
import type { WishList } from '@prisma/client'
import Logo from '../components/Logo'
import { THEMES, type Theme } from '../lib/themes'
import styles from '../styles/Home.module.css'

type ListWithMeta = WishList & {
  _count: { wishes: number; shares: number }
  owner: { name: string }
  shareToken: string | null
}

const THEME_COLORS: Record<string, string> = {
  jul: '#2d7a4f',
  bursdag: '#f59e0b',
  bryllup: '#b5924a',
}

function ListCard({
  list,
  isOwner,
  onDelete,
}: {
  list: ListWithMeta
  isOwner: boolean
  onDelete?: (e: MouseEvent<HTMLButtonElement>, id: number) => void
}) {
  const [shareToken, setShareToken] = useState(list.shareToken)
  const [shareLoading, setShareLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleShare = useCallback(async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setShareLoading(true)

    let token = shareToken
    if (!token) {
      const res = await fetch('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-token', listId: list.id }),
      })
      if (res.ok) {
        const updated = await fetch(`/api/lists?id=${list.id}`)
        const data = await updated.json()
        token = data.shareToken
        setShareToken(token)
      }
    }

    setShareLoading(false)
    if (!token) return

    const url = `${window.location.origin}/invite?token=${token}`
    const nav = navigator as Navigator & { share?: (d: { url: string; title: string }) => Promise<void> }
    if (nav.share) {
      await nav.share({ url, title: `${list.name} – Wishy` }).catch(() => null)
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [shareToken, list.id, list.name])

  return (
    <li className={styles.listCardWrapper}>
      <Link href={`/list/${list.id}`} className={styles.listCard}>
        <div
          className={styles.listCardAccent}
          style={{ background: list.theme ? THEME_COLORS[list.theme] : 'var(--primary)' }}
        />
        <div className={styles.listCardBody}>
          <span className={styles.listCardName}>{list.name}</span>
          <span className={styles.listCardMeta}>
            {!isOwner && (
              <span className={styles.listCardOwner}>av {list.owner.name} · </span>
            )}
            {list.theme && `${THEMES.find((t) => t.id === list.theme)?.emoji} `}
            {list._count.wishes} {list._count.wishes === 1 ? 'ønske' : 'ønsker'}
            {isOwner && list._count.shares > 0 && ` · delt med ${list._count.shares}`}
          </span>
        </div>
      </Link>
      {isOwner && (
        <button
          className={styles.listCardShare}
          onClick={handleShare}
          disabled={shareLoading}
          aria-label={`Del ${list.name}`}
        >
          {copied ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : shareLoading ? '…' : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          )}
        </button>
      )}
      {isOwner && onDelete && (
        <button
          className={styles.listCardDelete}
          onClick={(e) => onDelete(e, list.id)}
          aria-label={`Slett ${list.name}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
          </svg>
        </button>
      )}
    </li>
  )
}

export default function Home({ initialLists, currentUserId }: { initialLists: ListWithMeta[]; currentUserId: number }) {
  const router = useRouter()
  const { data: session } = useSession()
  const [lists, setLists] = useState<ListWithMeta[]>(initialLists)
  const [name, setName] = useState('')
  const [theme, setTheme] = useState<Theme>(null)
  const [loading, setLoading] = useState(false)

  const myLists = lists.filter((l) => l.ownerId === currentUserId)
  const sharedLists = lists.filter((l) => l.ownerId !== currentUserId)

  async function createList(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, theme }),
      })
      if (!res.ok) throw new Error(await res.text())
      const newList: WishList = await res.json()
      await router.push(`/list/${newList.id}`)
    } catch (err) {
      console.error('Kunne ikke opprette liste:', err)
      setLoading(false)
    }
  }

  async function deleteList(e: MouseEvent<HTMLButtonElement>, id: number) {
    e.preventDefault()
    await fetch(`/api/lists?id=${id}`, { method: 'DELETE' })
    setLists((prev) => prev.filter((l) => l.id !== id))
  }

  return (
    <div className={styles.page}>
      <main className={styles.inner}>
        <header className={styles.header}>
          <Logo />
          <div className={styles.headerUser}>
            <span className={styles.headerUserName}>{session?.user?.name}</span>
            <button
              className={styles.signOutButton}
              onClick={() => signOut({ callbackUrl: '/logg-inn' })}
            >
              Logg ut
            </button>
          </div>
        </header>

        <form onSubmit={createList} className={styles.form}>
          <div className={styles.nameThemeRow}>
            <input
              className={styles.input}
              type="text"
              placeholder="Navn på liste…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <select
              className={styles.themeSelect}
              value={String(theme)}
              onChange={(e) => setTheme((e.target.value === 'null' ? null : e.target.value) as Theme)}
            >
              {THEMES.map((t) => (
                <option key={String(t.id)} value={String(t.id)}>
                  {t.emoji} {t.label}
                </option>
              ))}
            </select>
          </div>
          <button className={styles.button} type="submit" disabled={loading || !name.trim()}>
            {loading ? '…' : 'Opprett liste'}
          </button>
        </form>

        {/* My lists */}
        <section className={styles.listSection}>
          {(myLists.length > 0 || sharedLists.length > 0) && (
            <h2 className={styles.listSectionTitle}>Mine lister</h2>
          )}
          <ul className={styles.listCards}>
            {myLists.length === 0 ? (
              <li className={styles.emptyState}>
                <span className={styles.emptyEmoji}>✨</span>
                <p className={styles.emptyText}>Ingen lister ennå.{'\n'}Opprett din første!</p>
              </li>
            ) : (
              myLists.map((list) => (
                <ListCard key={list.id} list={list} isOwner={true} onDelete={deleteList} />
              ))
            )}
          </ul>
        </section>

        {/* Shared with me */}
        {sharedLists.length > 0 && (
          <section className={styles.listSection}>
            <h2 className={styles.listSectionTitle}>Delt med meg</h2>
            <ul className={styles.listCards}>
              {sharedLists.map((list) => (
                <ListCard key={list.id} list={list} isOwner={false} />
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  if (!session) return { redirect: { destination: '/logg-inn', permanent: false } }

  const { default: prisma } = await import('../lib/prisma')
  const userId = session.user.id
  const lists = await prisma.wishList.findMany({
    where: {
      OR: [{ ownerId: userId }, { shares: { some: { userId } } }],
    },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { wishes: true, shares: true } },
      owner: { select: { name: true } },
    },
  })

  return { props: { initialLists: JSON.parse(JSON.stringify(lists)), currentUserId: userId } }
}
