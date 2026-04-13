'use client'

import Link from 'next/link'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import type { AuthStatusResponse, AuthTokenResponse } from '@/lib/types'

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

function AuthPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const googleButtonRef = useRef<HTMLDivElement | null>(null)
  const [guestName, setGuestName] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')

  const nextPath = searchParams.get('next') || '/'

  useEffect(() => {
    let cancelled = false

    async function restoreAuthSession() {
      try {
        const response = await fetch('/api/auth/me', { method: 'GET' })
        const payload = (await response.json()) as AuthStatusResponse | { detail?: string }
        if (!response.ok) return
        if (!cancelled && 'authenticated' in payload && payload.authenticated) {
          router.replace(nextPath)
        }
      } catch {
        // keep user on auth page
      }
    }

    restoreAuthSession()

    return () => {
      cancelled = true
    }
  }, [nextPath, router])

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current || typeof window === 'undefined') return

    let cancelled = false

    function renderGoogleButton() {
      if (cancelled || !googleButtonRef.current || !window.google?.accounts?.id) return false
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response: { credential?: string }) => {
          if (!response.credential) {
            setError('Google sign-in did not return a credential.')
            return
          }

          setAuthLoading(true)
          setError(null)
          try {
            const authResponse = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id_token: response.credential }),
            })
            const payload = (await authResponse.json()) as AuthTokenResponse | { detail?: string }
            if (!authResponse.ok || !('user' in payload)) {
              throw new Error('detail' in payload ? payload.detail || 'Google sign-in failed.' : 'Google sign-in failed.')
            }
            router.replace(nextPath)
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Google sign-in failed.')
          } finally {
            setAuthLoading(false)
          }
        },
      })
      googleButtonRef.current.innerHTML = ''
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        width: 320,
      })
      return true
    }

    if (renderGoogleButton()) return

    const intervalId = window.setInterval(() => {
      if (renderGoogleButton()) {
        window.clearInterval(intervalId)
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [nextPath, router])

  async function handleGuestSignIn() {
    setAuthLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: guestName.trim() || undefined }),
      })
      const payload = (await response.json()) as AuthTokenResponse | { detail?: string }
      if (!response.ok || !('user' in payload)) {
        throw new Error('detail' in payload ? payload.detail || 'Guest sign-in failed.' : 'Guest sign-in failed.')
      }
      router.replace(nextPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Guest sign-in failed.')
    } finally {
      setAuthLoading(false)
    }
  }

  async function handlePasswordAuth() {
    setAuthLoading(true)
    setError(null)
    try {
      const endpoint = authMode === 'signup' ? '/api/auth/register' : '/api/auth/login'
      const body =
        authMode === 'signup'
          ? { email: email.trim(), password, name: fullName.trim() || undefined }
          : { email: email.trim(), password }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = (await response.json()) as AuthTokenResponse | { detail?: string }
      if (!response.ok || !('user' in payload)) {
        throw new Error('detail' in payload ? payload.detail || 'Email sign-in failed.' : 'Email sign-in failed.')
      }
      router.replace(nextPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Email sign-in failed.')
    } finally {
      setAuthLoading(false)
    }
  }

  return (
    <main className="min-h-screen px-3 py-4 text-white sm:px-4 sm:py-6 lg:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--panel)] p-5 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.78rem] font-medium uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                Account Access
              </p>
              <h1 className="mt-3 text-[2rem] font-semibold leading-none tracking-[-0.02em] text-white sm:text-[2.4rem]">
                Sign In
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-[1.5] text-[var(--text-secondary)] sm:text-base">
                Sign in with Google if you want a named workspace, or continue as a guest if you just want to use the app right away.
              </p>
            </div>
            <Link
              href="/"
              className="rounded-[6px] border border-[var(--border)] bg-[var(--panel-muted)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#202020]"
            >
              Back
            </Link>
          </div>

          <div className="mt-8 rounded-[8px] border border-[var(--border)] bg-[var(--panel-muted)] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.14em] text-[var(--text-secondary)]">JWT</p>
                <h2 className="mt-3 text-[1.5rem] font-semibold text-white">
                  {authMode === 'signin' ? 'Sign in with email' : 'Create your account'}
                </h2>
                <p className="mt-2 text-sm leading-[1.5] text-[var(--text-secondary)]">
                  {authMode === 'signin'
                    ? 'Use your email and password to start a JWT-backed session.'
                    : 'Create a named account stored in Postgres and sign in immediately.'}
                </p>
              </div>
              <div className="flex overflow-hidden rounded-[6px] border border-[var(--border)] bg-[var(--bg-base)]">
                <button
                  type="button"
                  onClick={() => setAuthMode('signin')}
                  className={`px-4 py-2 text-sm font-semibold transition ${authMode === 'signin' ? 'bg-[var(--button-primary)] text-white' : 'text-[var(--text-secondary)]'}`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className={`px-4 py-2 text-sm font-semibold transition ${authMode === 'signup' ? 'bg-[var(--button-primary)] text-white' : 'text-[var(--text-secondary)]'}`}
                >
                  Create Account
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              {authMode === 'signup' ? (
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Full name"
                  className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm text-white outline-none placeholder:text-[var(--text-muted)] focus:border-white/30"
                />
              ) : null}
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email address"
                type="email"
                className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm text-white outline-none placeholder:text-[var(--text-muted)] focus:border-white/30"
              />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                type="password"
                className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm text-white outline-none placeholder:text-[var(--text-muted)] focus:border-white/30"
              />
              <button
                type="button"
                onClick={handlePasswordAuth}
                disabled={authLoading}
                className="mt-1 w-full rounded-[6px] border border-transparent bg-[var(--button-primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--button-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authLoading ? 'Working...' : authMode === 'signin' ? 'Sign In with Email' : 'Create Account'}
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <section className="rounded-[8px] border border-[var(--border)] bg-[var(--panel-muted)] p-5">
              <p className="text-sm uppercase tracking-[0.14em] text-[var(--text-secondary)]">Google</p>
              <h2 className="mt-3 text-[1.3rem] font-semibold text-white">Use Google</h2>
              <p className="mt-3 text-sm leading-[1.5] text-[var(--text-secondary)]">
                Best if you want a persistent identity without managing a password here.
              </p>
              <div className="mt-5">
                {googleClientId ? (
                  <div ref={googleButtonRef} className="min-h-[44px]" />
                ) : (
                  <div className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                    Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to enable Google sign-in.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[8px] border border-[var(--border)] bg-[var(--panel-muted)] p-5">
              <p className="text-sm uppercase tracking-[0.14em] text-[var(--text-secondary)]">Guest</p>
              <h2 className="mt-3 text-[1.3rem] font-semibold text-white">Continue as guest</h2>
              <p className="mt-3 text-sm leading-[1.5] text-[var(--text-secondary)]">
                Use the workspace immediately without creating an account.
              </p>
              <div className="mt-5 space-y-3">
                <input
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  placeholder="Optional guest name"
                  className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm text-white outline-none placeholder:text-[var(--text-muted)] focus:border-white/30"
                />
                <button
                  type="button"
                  onClick={handleGuestSignIn}
                  disabled={authLoading}
                  className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#202020] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {authLoading ? 'Signing In...' : 'Continue as Guest'}
                </button>
              </div>
            </section>
          </div>

          {error ? <p className="mt-6 text-sm text-rose-300">{error}</p> : null}
        </div>
      </div>
    </main>
  )
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen px-3 py-4 text-white sm:px-4 sm:py-6 lg:px-6">
          <div className="mx-auto max-w-3xl rounded-[8px] border border-[var(--border)] bg-[var(--panel)] p-5 text-sm text-[var(--text-secondary)] sm:p-8">
            Loading sign-in options...
          </div>
        </main>
      }
    >
      <AuthPageContent />
    </Suspense>
  )
}
