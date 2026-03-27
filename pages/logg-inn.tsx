import { useState, FormEvent } from 'react'
import { signIn } from 'next-auth/react'
import { getServerSession } from 'next-auth'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import Link from 'next/link'
import Logo from '../components/Logo'
import { authOptions } from './api/auth/[...nextauth]'
import styles from '../styles/Home.module.css'

export default function LoggInn() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const raw = router.query.callbackUrl as string | undefined
  const callbackUrl = raw?.startsWith('/') ? raw : '/'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await signIn('credentials', {
        email,
        pin,
        redirect: false,
      })
      if (result?.error) {
        setError('Feil e-post eller passord')
      } else {
        router.push(callbackUrl)
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
          <h1 className={styles.authTitle}>Logg inn</h1>
          <form onSubmit={handleSubmit} className={styles.authForm}>
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
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              placeholder="4-sifret PIN-kode"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              required
              autoComplete="current-password"
            />
            {error && <p className={styles.authError}>{error}</p>}
            <button className={styles.button} type="submit" disabled={loading} style={{ alignSelf: 'stretch' }}>
              {loading ? 'Logger inn…' : 'Logg inn'}
            </button>
          </form>
          <p className={styles.authSwitch}>
            Har du ikke konto?{' '}
            <Link href={`/registrer${callbackUrl !== '/' ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ''}`}>
              Registrer deg
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
