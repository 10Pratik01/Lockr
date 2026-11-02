import Link from 'next/link'
import { SignInButton, SignUpButton, Show, UserButton } from '@clerk/nextjs'
import { SealDemo } from '@/components/landing/seal-demo'
import { Reveal, Words } from '@/components/landing/reveal'

const STEPS = [
  {
    title: 'Sealed in your browser',
    body: 'Your passphrase derives a key on your device. The credential is encrypted before any request is made.',
  },
  {
    title: 'A link, and a separate code',
    body: 'Send the link in one place and the six-digit code in another. Neither works without the other.',
  },
  {
    title: 'It opens once',
    body: 'The recipient decrypts it in their browser. Wrong codes are rate limited, and you can revoke it any time before.',
  },
  {
    title: 'Then it is gone',
    body: 'Choose destroy on open and the ciphertext is deleted the moment it is read.',
  },
]

const YOU_HOLD = ['Your account login', 'Your vault passphrase', 'The key derived from it, in memory only']
const SERVER_HOLDS = ['Ciphertext it cannot read', 'A salt and the wrapped key', 'Share metadata: expiry and state']

function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="10.5" width="16" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="12" cy="15.5" r="1.4" fill="currentColor" />
    </svg>
  )
}

function PrimaryAction({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  const cls =
    size === 'lg'
      ? 'h-12 px-7 text-base'
      : 'h-9 px-4 text-sm'
  const base =
    'inline-flex shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full bg-l-fg font-medium text-l-bg transition-opacity hover:opacity-85'
  return (
    <>
      <Show when="signed-out">
        <SignUpButton>
          <button className={`${base} ${cls}`}>{size === 'lg' ? 'Create your vault' : 'Get started'}</button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <Link href="/dashboard" className={`${base} ${cls}`}>
          {size === 'sm' ? 'Open vault' : 'Open your vault'}
        </Link>
      </Show>
    </>
  )
}

export default function Home() {
  return (
    <div className="landing flex min-h-full flex-1 flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2 py-2 font-display text-xl tracking-tight">
          <Mark />
          Privault
        </Link>
        <nav className="flex min-w-0 items-center gap-3 text-sm sm:gap-5">
          <a href="#how" className="hidden text-l-muted hover:text-l-fg sm:inline">
            How sharing works
          </a>
          <Show when="signed-out">
            <SignInButton>
              <button className="cursor-pointer px-1 py-3 text-l-muted hover:text-l-fg">Sign in</button>
            </SignInButton>
          </Show>
          <PrimaryAction size="sm" />
          <Show when="signed-in">
            <UserButton />
          </Show>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pt-14 pb-20 sm:px-8 sm:pt-20 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:pb-28">
          <div>
            <h1
              className="rise font-display text-[2.6rem] leading-[1.04] font-medium tracking-[-0.02em] text-balance sm:text-6xl lg:text-[4.25rem]"
              style={{ '--i': 0 } as React.CSSProperties}
            >
              Locked before it leaves your device.
            </h1>
            <p
              className="rise mt-6 max-w-[34rem] text-lg leading-relaxed text-l-muted"
              style={{ '--i': 1 } as React.CSSProperties}
            >
              Privault keeps your passwords encrypted in your browser, so the server only ever holds
              ciphertext. When someone else needs a login, share it once with a link and a separate code.
            </p>
            <div
              className="rise mt-9 flex flex-wrap items-center gap-x-6 gap-y-4"
              style={{ '--i': 2 } as React.CSSProperties}
            >
              <PrimaryAction />
              <a href="#how" className="py-3 text-base text-l-fg underline decoration-l-line hover:decoration-l-fg">
                See how a share works
              </a>
            </div>
          </div>

          <div className="rise" style={{ '--i': 3 } as React.CSSProperties}>
            <SealDemo />
          </div>
        </section>

        <section id="how" className="relative border-t border-l-line">
          <div className="bg-dots" aria-hidden="true" />
          <Reveal className="relative mx-auto w-full max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
            <h2 className="max-w-xl font-display text-3xl leading-tight font-medium tracking-[-0.01em] text-balance sm:text-4xl">
              <Words text="A share that cannot be reused or quietly forwarded." />
            </h2>
            <ol className="mt-20 grid gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => {
                const last = i === STEPS.length - 1
                return (
                  <li key={s.title} className="relative pt-7" style={{ '--i': i } as React.CSSProperties}>
                    <span className="timeline-line" aria-hidden="true" />
                    <span className="node" data-end={last ? '' : undefined} aria-hidden="true" />
                    <div className={`r-item ${last ? 'dissolve' : ''}`} style={{ '--i': i + 2 } as React.CSSProperties}>
                      <span className="sr-only">Step {i + 1}: </span>
                      <h3 className="font-display text-xl font-medium">{s.title}</h3>
                      <p className="mt-3 max-w-[32ch] text-[15px] leading-relaxed text-l-muted">{s.body}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </Reveal>
        </section>

        <section className="relative border-t border-l-line">
          <div className="bg-grid" aria-hidden="true" />
          <Reveal className="relative mx-auto grid w-full max-w-6xl gap-12 px-5 py-24 sm:px-8 sm:py-32 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
            <h2 className="font-display text-3xl leading-tight font-medium tracking-[-0.01em] text-balance sm:text-4xl">
              <Words text="We cannot read what we store." />
            </h2>
            <div className="relative grid gap-10 sm:grid-cols-2">
              <span
                className="v-rule absolute top-0 bottom-0 left-1/2 hidden w-px bg-l-line sm:block"
                aria-hidden="true"
              />
              <div>
                <h3 className="r-item text-sm font-medium text-l-cipher" style={{ '--i': 2 } as React.CSSProperties}>
                  Stays with you
                </h3>
                <ul className="mt-4 space-y-3 text-[15px]">
                  {YOU_HOLD.map((t, i) => (
                    <li
                      key={t}
                      className="r-item border-b border-l-line pb-3"
                      style={{ '--i': i + 3 } as React.CSSProperties}
                    >
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="r-blur r-item text-sm font-medium text-l-muted" style={{ '--i': 3 } as React.CSSProperties}>
                  What our server holds
                </h3>
                <ul className="mt-4 space-y-3 text-[15px] text-l-muted">
                  {SERVER_HOLDS.map((t, i) => (
                    <li
                      key={t}
                      className="r-blur r-item border-b border-l-line pb-3"
                      style={{ '--i': i + 4 } as React.CSSProperties}
                    >
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <p
                className="r-item max-w-[56ch] text-[15px] leading-relaxed text-l-muted sm:col-span-2"
                style={{ '--i': 8 } as React.CSSProperties}
              >
                Your vault key comes from a passphrase you choose, hardened with Argon2id and used with
                AES-256-GCM. It is separate from your login, so a stolen session on its own opens nothing.
                If you forget the passphrase, we cannot recover it for you.
              </p>
            </div>
          </Reveal>
        </section>

        <section className="border-t border-l-line">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-8 px-5 py-20 sm:px-8 sm:py-24 md:flex-row md:items-center md:justify-between">
            <h2 className="max-w-lg font-display text-3xl leading-tight font-medium tracking-[-0.01em] text-balance sm:text-4xl">
              Start with a vault only you can open.
            </h2>
            <PrimaryAction />
          </div>
        </section>
      </main>

      <footer className="border-t border-l-line">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 text-sm text-l-muted sm:px-8">
          <span className="font-display text-base text-l-fg">Privault</span>
          <span>Zero-knowledge by design</span>
        </div>
      </footer>
    </div>
  )
}
