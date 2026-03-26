import { useState, FormEvent } from 'react'
import { signIn } from 'next-auth/react'
import { getServerSession } from 'next-auth'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import Link from 'next/link'
import Logo from '../components/Logo'
import { authOptions } from './api/auth/[...nextauth]'
import styles from '../styles/Home.module.css'

export default function Registrer() {
  const router = useRouter()
  const token = router.query.token as string | undefined
  const callbackUrl = router.query.callbackUrl as string | undefined

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, token }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? 'Noe gikk galt')
        return
      }

      const data = await res.json()
      await signIn('credentials', { email, password, redirect: false })

      if (data.listId) {
        router.push(`/list/${data.listId}`)
      } else if (callbackUrl) {
        router.push(callbackUrl)
      } else {
        router.push('/')
      }
    } catch {
      setError('Noe gikk galt. Prøv igjen.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.authPage}>
        <div className={styles.authCard}>
          <div className={styles.authLogo}>
            <Logo />
          </div>
          <h1 className={styles.authTitle}>Opprett konto</h1>
          {token && (
            <p className={styles.authHint}>Du er invitert til å se en ønskeliste!</p>
          )}
          <form onSubmit={handleSubmit} className={styles.authForm}>
            <input
              className={styles.input}
              type="text"
              placeholder="Navn"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
            <input
              className={styles.input}
              type="email"
              placeholder="E-post"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <input
              className={styles.input}
              type="password"
              placeholder="Passord (minst 8 tegn)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            {error && <p className={styles.authError}>{error}</p>}
            <button className={styles.button} type="submit" disabled={loading} style={{ alignSelf: 'stretch' }}>
              {loading ? 'Oppretter konto…' : 'Opprett konto'}
            </button>
          </form>
          <p className={styles.authSwitch}>
            Har du allerede konto?{' '}
            <Link href={`/logg-inn${token ? `?callbackUrl=${encodeURIComponent(`/invite?token=${token}`)}` : ''}`}>
              Logg inn
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  if (session) return { redirect: { destination: '/', permanent: false } }
  return { props: {} }
}
