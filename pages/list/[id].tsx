import { useState, FormEvent } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import type { GetServerSideProps } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../api/auth/[...nextauth]'
import type { WishList } from '@prisma/client'
import Logo from '../../components/Logo'
import { THEMES, type Theme } from '../../lib/themes'
import styles from '../../styles/Home.module.css'

type ReservationData = {
  id: number
  status: string
  userId: number
  user: { id: number; name: string }
}

type WishWithReservation = {
  id: number
  title: string
  description: string | null
  url: string | null
  createdAt: string
  listId: number
  reservation: ReservationData | null
}

type ShareMember = {
  id: number
  userId: number
  user: { id: number; name: string; email: string }
}

type ListPageProps = {
  list: WishList & { shareToken: string | null }
  wishes: WishWithReservation[]
  isOwner: boolean
  shares: ShareMember[]
  currentUserId: number
}

export default function ListPage({ list: initialList, wishes: initialWishes, isOwner, shares: initialShares, currentUserId }: ListPageProps) {
  const router = useRouter()
  const { data: session } = useSession()

  const [wishes, setWishes] = useState(initialWishes)
  const [shares, setShares] = useState(initialShares)
  const [shareToken, setShareToken] = useState(initialList.shareToken)

  // Add wish form
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  // Share panel
  const [showSharePanel, setShowSharePanel] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [tokenLoading, setTokenLoading] = useState(false)

  const theme = (initialList?.theme ?? null) as Theme
  const activeTheme = THEMES.find((t) => t.id === theme) ?? THEMES[0]
  const containerClass = [styles.page, theme ? styles[theme] : ''].filter(Boolean).join(' ')

  async function addWish(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setAddLoading(true)
    const res = await fetch('/api/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, url, listId: initialList.id }),
    })
    if (res.ok) {
      setTitle('')
      setDescription('')
      setUrl('')
      const r = await fetch(`/api/wishlist?listId=${initialList.id}`)
      setWishes(await r.json())
    }
    setAddLoading(false)
  }

  async function deleteWish(wishId: number) {
    await fetch(`/api/wishlist?id=${wishId}`, { method: 'DELETE' })
    setWishes((prev) => prev.filter((w) => w.id !== wishId))
  }

  async function setReservation(wishId: number, status: 'reservert' | 'kjopt') {
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wishId, status }),
    })
    if (res.ok) {
      const reservation = await res.json()
      setWishes((prev) =>
        prev.map((w) =>
          w.id === wishId
            ? { ...w, reservation: { ...reservation, user: { id: currentUserId, name: session?.user?.name ?? '' } } }
            : w
        )
      )
    }
  }

  async function undoReservation(wishId: number) {
    const res = await fetch(`/api/reservations?wishId=${wishId}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      setWishes((prev) =>
        prev.map((w) => (w.id === wishId ? { ...w, reservation: null } : w))
      )
    }
  }

  async function generateToken() {
    setTokenLoading(true)
    const res = await fetch('/api/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate-token', listId: initialList.id }),
    })
    if (res.ok) {
      const r = await fetch(`/api/lists?id=${initialList.id}`)
      const updated = await r.json()
      setShareToken(updated.shareToken)
    }
    setTokenLoading(false)
  }

  async function revokeToken() {
    setTokenLoading(true)
    const res = await fetch('/api/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revoke-token', listId: initialList.id }),
    })
    if (res.ok) setShareToken(null)
    setTokenLoading(false)
  }

  function copyInviteLink() {
    if (!shareToken) return
    const link = `${window.location.origin}/invite?token=${shareToken}`
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function addByEmail(e: FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviteLoading(true)
    setInviteError('')
    const res = await fetch('/api/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', listId: initialList.id, email: inviteEmail.trim() }),
    })
    if (res.ok) {
      setInviteEmail('')
      // Refresh shares list
      router.replace(router.asPath)
    } else {
      const data = await res.json()
      setInviteError(data.error ?? 'Noe gikk galt')
    }
    setInviteLoading(false)
  }

  async function removeMember(targetUserId: number) {
    await fetch('/api/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove', listId: initialList.id, targetUserId }),
    })
    setShares((prev) => prev.filter((s) => s.userId !== targetUserId))
  }

  return (
    <div className={containerClass}>
      <main className={styles.inner}>
        <header className={styles.listHeader}>
          <Logo />
          <Link href="/" className={styles.backButton}>← Alle lister</Link>
        </header>

        <div className={styles.listTitleRow}>
          <h2 className={styles.listTitle}>{initialList.name}</h2>
          {isOwner && (
            <button
              className={styles.shareToggleButton}
              onClick={() => setShowSharePanel((v) => !v)}
              aria-expanded={showSharePanel}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Del
            </button>
          )}
        </div>

        {/* Share panel — owner only */}
        {isOwner && showSharePanel && (
          <div className={styles.sharePanel}>
            <h3 className={styles.sharePanelTitle}>Del listen</h3>

            {/* Invite link */}
            <div className={styles.sharePanelSection}>
              <p className={styles.sharePanelLabel}>Invitasjonslenke</p>
              {shareToken ? (
                <div className={styles.inviteLinkRow}>
                  <span className={styles.inviteLink}>
                    {typeof window !== 'undefined'
                      ? `${window.location.origin}/invite?token=${shareToken}`
                      : `/invite?token=${shareToken}`}
                  </span>
                  <button className={styles.copyButton} onClick={copyInviteLink}>
                    {copied ? '✓ Kopiert' : 'Kopier'}
                  </button>
                  <button className={styles.revokeButton} onClick={revokeToken} disabled={tokenLoading}>
                    Trekk tilbake
                  </button>
                </div>
              ) : (
                <button className={styles.generateButton} onClick={generateToken} disabled={tokenLoading}>
                  {tokenLoading ? 'Genererer…' : 'Generer lenke'}
                </button>
              )}
            </div>

            {/* Add by email */}
            <div className={styles.sharePanelSection}>
              <p className={styles.sharePanelLabel}>Inviter via e-post</p>
              <form onSubmit={addByEmail} className={styles.inviteForm}>
                <input
                  className={styles.input}
                  type="email"
                  placeholder="E-postadresse"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
                <button className={styles.button} type="submit" disabled={inviteLoading}>
                  {inviteLoading ? '…' : 'Legg til'}
                </button>
              </form>
              {inviteError && <p className={styles.authError}>{inviteError}</p>}
            </div>

            {/* Member list */}
            {shares.length > 0 && (
              <div className={styles.sharePanelSection}>
                <p className={styles.sharePanelLabel}>Har tilgang</p>
                <ul className={styles.memberList}>
                  {shares.map((s) => (
                    <li key={s.id} className={styles.memberItem}>
                      <span className={styles.memberName}>{s.user.name}</span>
                      <span className={styles.memberEmail}>{s.user.email}</span>
                      <button
                        className={styles.removeMemberButton}
                        onClick={() => removeMember(s.userId)}
                        aria-label={`Fjern tilgang for ${s.user.name}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Add wish form — owner only */}
        {isOwner && (
          <form onSubmit={addWish} className={styles.form}>
            <input
              className={styles.input}
              type="text"
              placeholder="Hva ønsker du deg? *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <input
              className={styles.input}
              type="text"
              placeholder="Beskrivelse (valgfritt)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <input
              className={styles.input}
              type="url"
              placeholder="Lenke (valgfritt)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button className={styles.button} type="submit" disabled={addLoading || !title.trim()}>
              {addLoading ? 'Legger til…' : '+ Legg til ønske'}
            </button>
          </form>
        )}

        <ul className={styles.list}>
          {wishes.length === 0 ? (
            <li className={styles.emptyState}>
              <span className={styles.emptyEmoji}>{activeTheme.emptyEmoji}</span>
              <p className={styles.emptyText}>
                {isOwner ? `Ingen ønsker ennå.\nLegg til det første!` : 'Ingen ønsker ennå.'}
              </p>
            </li>
          ) : (
            wishes.map((wish) => {
              const res = wish.reservation
              const myReservation = res?.userId === currentUserId
              const someoneElse = res && !myReservation

              return (
                <li key={wish.id} className={styles.item}>
                  <div className={styles.itemContent}>
                    <span className={styles.itemTitle}>{wish.title}</span>
                    {wish.description && (
                      <span className={styles.itemDescription}>{wish.description}</span>
                    )}
                    {wish.url && (
                      <a
                        className={styles.itemUrl}
                        href={wish.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Se produkt →
                      </a>
                    )}

                    {/* Reservation controls — viewer only */}
                    {!isOwner && (
                      <div className={styles.reservationRow}>
                        {myReservation ? (
                          <>
                            <span className={[styles.reservedBadge, res.status === 'kjopt' ? styles.reservedBadgeBought : ''].filter(Boolean).join(' ')}>
                              {res.status === 'kjopt' ? '🛍 Du har kjøpt dette' : '✓ Du har reservert dette'}
                            </span>
                            <button
                              className={styles.undoButton}
                              onClick={() => undoReservation(wish.id)}
                            >
                              Angre
                            </button>
                          </>
                        ) : someoneElse ? (
                          <span className={[styles.reservedBadge, styles.reservedBadgeOther].join(' ')}>
                            {res.status === 'kjopt'
                              ? `🛍 Kjøpt av ${res.user.name}`
                              : `✓ Reservert av ${res.user.name}`}
                          </span>
                        ) : (
                          <>
                            <button
                              className={styles.reserveButton}
                              onClick={() => setReservation(wish.id, 'reservert')}
                            >
                              Reserver
                            </button>
                            <button
                              className={styles.buyButton}
                              onClick={() => setReservation(wish.id, 'kjopt')}
                            >
                              Kjøpt
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Delete button — owner only */}
                  {isOwner && (
                    <button
                      className={styles.deleteButton}
                      onClick={() => deleteWish(wish.id)}
                      aria-label={`Slett ${wish.title}`}
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
            })
          )}
        </ul>
      </main>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  if (!session) {
    return { redirect: { destination: `/logg-inn?callbackUrl=${encodeURIComponent(`/list/${ctx.params?.id}`)}`, permanent: false } }
  }

  const { default: prisma } = await import('../../lib/prisma')
  const listId = Number(ctx.params?.id)
  if (!listId) return { notFound: true }

  const userId = session.user.id

  const list = await prisma.wishList.findUnique({ where: { id: listId } })
  if (!list) return { notFound: true }

  const isOwner = list.ownerId === userId
  const share = await prisma.wishListShare.findUnique({
    where: { listId_userId: { listId, userId } },
  })
  if (!isOwner && !share) return { notFound: true }

  const wishesRaw = await prisma.wish.findMany({
    where: { listId },
    orderBy: { createdAt: 'desc' },
    include: {
      reservation: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  })

  const wishes = wishesRaw.map((w) => ({
    ...w,
    reservation: isOwner ? null : w.reservation,
    createdAt: w.createdAt.toISOString(),
  }))

  const shares = isOwner
    ? await prisma.wishListShare.findMany({
        where: { listId },
        include: { user: { select: { id: true, name: true, email: true } } },
      })
    : []

  return {
    props: {
      list: JSON.parse(JSON.stringify(list)),
      wishes: JSON.parse(JSON.stringify(wishes)),
      isOwner,
      shares: JSON.parse(JSON.stringify(shares)),
      currentUserId: userId,
    },
  }
}
