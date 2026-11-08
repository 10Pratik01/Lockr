'use client'

import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react'

// One password, followed from the keyboard to the database. Each station plays
// the real step (typing, key stretching, wrapping, sealing, storing) and names
// the attack that step defeats. All copy mirrors lib/crypto + lib/vault/keys.

interface Stage {
  label: string
  zone: 'browser' | 'server'
  title: string
  body: string
  /** Completes "If someone …," */
  threat: string
  /** Completes the sentence after the comma. */
  outcome: string
}

const STAGES: Stage[] = [
  {
    label: 'Passphrase',
    zone: 'browser',
    title: 'You type a passphrase that never travels',
    body: 'It is separate from your login. It stays in this tab and is never sent to Lockr.',
    threat: 'hijacks your login session',
    outcome: 'they are in the app but still cannot open the vault. The passphrase was never on our server.',
  },
  {
    label: 'Stretch',
    zone: 'browser',
    title: 'Argon2id turns it into a key, slowly on purpose',
    body: 'Every attempt needs 19 MiB of memory and two passes over it, mixed with a random salt unique to your vault.',
    threat: 'steals the database and starts guessing passphrases',
    outcome: 'each guess costs real memory and time, and the salt stops them reusing work across accounts.',
  },
  {
    label: 'Unwrap',
    zone: 'browser',
    title: 'That key opens a random vault key',
    body: 'Your data is encrypted with a random 256-bit key. We store only a copy wrapped by your passphrase key, so changing the passphrase never re-encrypts your data.',
    threat: 'reads the wrapped key from the database',
    outcome: 'it is AES-GCM ciphertext. Without the key from your passphrase it is just noise.',
  },
  {
    label: 'Seal',
    zone: 'browser',
    title: 'AES-256-GCM seals each login',
    body: 'Every credential gets a fresh random IV and an authentication tag, all inside your browser before any request is made.',
    threat: 'edits a stored credential',
    outcome: 'the authentication tag no longer matches, so it refuses to decrypt instead of returning altered data.',
  },
  {
    label: 'Store',
    zone: 'server',
    title: 'Only ciphertext reaches our server',
    body: 'We keep the ciphertext, its IV, your salt and the wrapped key. Nothing we hold can decrypt it.',
    threat: 'breaches or compels us',
    outcome: 'they get ciphertext we cannot read. It also means we cannot recover a forgotten passphrase.',
  },
]

const STATUS = [
  { text: 'Plaintext · this tab', plain: true },
  { text: 'Key · memory only', plain: true },
  { text: 'Key · memory only', plain: true },
  { text: 'Ciphertext', plain: false },
  { text: 'Ciphertext · our server', plain: false },
]

const GLYPHS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

function subscribeMotion(onChange: () => void) {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)')
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
function useReducedMotion() {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  )
}

// Starts as `from`, churns through noise, then resolves left to right into
// `to`. Deterministic (no Math.random) so renders stay pure; reduced motion
// shows `to` straight away.
function Morph({ from, to, ticks = 18 }: Readonly<{ from: string; to: string; ticks?: number }>) {
  const reduced = useReducedMotion()
  const [t, setT] = useState(0)

  useEffect(() => {
    if (reduced) return
    const id = window.setInterval(() => setT((x) => Math.min(ticks, x + 1)), 60)
    return () => window.clearInterval(id)
  }, [reduced, ticks])

  const done = reduced ? ticks : t
  if (done === 0) return <>{from}</>
  return (
    <>
      {to
        .split('')
        .map((ch, i) => (i / to.length < done / ticks ? ch : GLYPHS[(i * 7 + done * 13) % GLYPHS.length]))
        .join('')}
    </>
  )
}

function stationState(i: number, active: number) {
  if (i < active) return 'done'
  return i === active ? 'active' : 'todo'
}

function Screen({ label, children, stage }: Readonly<{ label: string; children: ReactNode; stage: number }>) {
  const status = STATUS[stage]
  return (
    <div className="rounded-xl border border-l-line bg-l-bg p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 font-sans text-xs text-l-muted">
        <span>{label}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span
            className="size-1.5 rounded-full"
            style={{ background: status.plain ? 'var(--l-ember)' : 'var(--l-cipher)' }}
          />
          {status.text}
        </span>
      </div>
      <div className="mt-4 space-y-3 font-mono text-[13px] leading-relaxed sm:text-sm">{children}</div>
    </div>
  )
}

function Row({ i, name, children, muted }: Readonly<{ i: number; name: string; children: ReactNode; muted?: boolean }>) {
  return (
    <div
      className="flow-row grid grid-cols-[6.5rem_1fr] items-baseline gap-3"
      style={{ '--i': i } as React.CSSProperties}
    >
      <span className="font-sans text-xs text-l-muted">{name}</span>
      <span className={`min-w-0 truncate ${muted ? 'text-l-muted italic' : 'text-l-cipher'}`}>{children}</span>
    </div>
  )
}

function StageScreen({ stage }: Readonly<{ stage: number }>) {
  if (stage === 0) {
    return (
      <Screen stage={0} label="Typed in your browser">
        <div className="rounded-lg border border-l-line bg-l-card px-3.5 py-3 text-l-fg">
          <span className="flow-type">correct horse battery</span>
          <span className="flow-caret" aria-hidden="true" />
        </div>
        <p className="font-sans text-xs text-l-muted">Not sent. Not stored. Not in a cookie.</p>
      </Screen>
    )
  }
  if (stage === 1) {
    return (
      <Screen stage={1} label="Argon2id · in your browser">
        <Row i={0} name="salt">
          7d2eb9c41f08a3d6
        </Row>
        <div className="flow-row grid grid-cols-[6.5rem_1fr] items-center gap-3" style={{ '--i': 1 } as React.CSSProperties}>
          <span className="font-sans text-xs text-l-muted">memory</span>
          <span className="flex flex-wrap gap-1" aria-label="19 MiB of working memory">
            {Array.from({ length: 19 }, (_, i) => (
              <span key={i} className="flow-cell size-2.5 rounded-[3px] bg-l-cipher" style={{ '--i': i } as React.CSSProperties} />
            ))}
          </span>
        </div>
        <Row i={2} name="key (32 B)">
          <Morph from="················" to="a91c07e4b2d85f36c1e9" />
        </Row>
      </Screen>
    )
  }
  if (stage === 2) {
    return (
      <Screen stage={2} label="Vault key · in your browser">
        <Row i={0} name="wrapped key">
          9fK2xQ7vL0pYb8QeN3Zr…
        </Row>
        <p className="flow-row pl-[7.25rem] font-sans text-xs text-l-muted" style={{ '--i': 1 } as React.CSSProperties}>
          opened with the key from your passphrase
        </p>
        <Row i={2} name="vault key">
          <Morph from="9fK2xQ7vL0pYb8QeN3Zr" to="f48b12d96a03ce7751b4" />
        </Row>
        <p className="flow-row font-sans text-xs text-l-muted" style={{ '--i': 3 } as React.CSSProperties}>
          Held in memory only. Gone the moment you lock.
        </p>
      </Screen>
    )
  }
  if (stage === 3) {
    return (
      <Screen stage={3} label="Encrypting a login">
        <div className="rounded-lg border border-l-line bg-l-card px-3.5 py-3 text-l-fg">
          <Morph from="prod-db-7Hq!x2Lm" to="k3Zr9WvT0pYb8QeN" />
        </div>
        <Row i={1} name="random IV">
          aXZpdml2aXZp (12 B, new each time)
        </Row>
        <Row i={2} name="auth tag">
          16 B, checked on every open
        </Row>
      </Screen>
    )
  }
  return (
    <Screen stage={4} label="What our database row holds">
      <Row i={0} name="ciphertext">
        k3Zr9WvT0pYb8QeN…
      </Row>
      <Row i={1} name="iv">
        aXZpdml2aXZp
      </Row>
      <Row i={2} name="salt">
        7d2eb9c41f08a3d6
      </Row>
      <Row i={3} name="wrapped key">
        9fK2xQ7vL0pYb8QeN3Zr…
      </Row>
      <div className="border-t border-l-line pt-3" />
      <Row i={4} name="passphrase" muted>
        not stored
      </Row>
      <Row i={5} name="vault key" muted>
        not stored
      </Row>
      <Row i={6} name="plaintext" muted>
        not stored
      </Row>
    </Screen>
  )
}

export function FlowDemo() {
  const reduced = useReducedMotion()
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [inView, setInView] = useState(false)
  const [hold, setHold] = useState(false)
  const root = useRef<HTMLElement>(null)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    const el = root.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Advancing is driven by the timer bar's own CSS animation ending, so the
  // visible progress and the step change can never drift apart, and pausing
  // is just `animation-play-state`.
  const running = playing && inView && !hold
  const stage = STAGES[active]

  function select(i: number, focus = false) {
    setActive(i)
    setPlaying(false) // choosing a step means "let me read this one"
    if (focus) tabs.current[i]?.focus()
  }

  function onKeyDown(e: KeyboardEvent) {
    const last = STAGES.length - 1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      select(active === last ? 0 : active + 1, true)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      select(active === 0 ? last : active - 1, true)
    } else if (e.key === 'Home') {
      e.preventDefault()
      select(0, true)
    } else if (e.key === 'End') {
      e.preventDefault()
      select(last, true)
    }
  }

  return (
    <figure
      ref={root}
      className="rounded-2xl border border-l-line bg-l-card p-5 shadow-[0_18px_40px_-24px_rgba(22,25,31,0.35)] sm:p-8"
      aria-label="Animated walkthrough: how a password is encrypted in your browser before it reaches the server"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={() => setHold(false)}
    >
      <div className="flow-track">
        <div className="hidden grid-cols-5 pb-5 text-xs text-l-muted md:grid" aria-hidden="true">
          <span className="col-span-4 text-center">Your browser · readable only here</span>
          <span className="text-center">Our server · ciphertext only</span>
        </div>
        <span className="flow-boundary" aria-hidden="true" />

        <div role="tablist" tabIndex={-1} aria-label="Encryption steps" onKeyDown={onKeyDown} className="flow-stations">
          {STAGES.map((s, i) => (
            <button
              key={s.label}
              ref={(el) => {
                tabs.current[i] = el
              }}
              type="button"
              role="tab"
              id={`flow-tab-${i}`}
              aria-selected={active === i}
              aria-controls="flow-panel"
              tabIndex={active === i ? 0 : -1}
              data-state={stationState(i, active)}
              data-last={i === STAGES.length - 1 ? '' : undefined}
              data-zone={s.zone}
              onClick={() => select(i)}
              className="flow-station"
            >
              <span className="flow-node" aria-hidden="true" />
              <span>
                <span className="flow-label">{s.label}</span>
                <span className="flow-zone">{s.zone === 'browser' ? 'In your browser' : 'On our server'}</span>
              </span>
              {active === i && !reduced && (
                <span
                  className="flow-timer"
                  data-paused={running ? undefined : ''}
                  aria-hidden="true"
                  onAnimationEnd={() => setActive((a) => (a + 1) % STAGES.length)}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <div
        key={active}
        role="tabpanel"
        id="flow-panel"
        aria-labelledby={`flow-tab-${active}`}
        className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-12"
      >
        <div className="flow-in">
          <h3 className="font-display text-2xl leading-snug font-medium text-balance sm:text-[1.65rem]">
            {stage.title}
          </h3>
          <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-l-muted">{stage.body}</p>
        </div>
        <div className="flow-in" style={{ '--i': 1 } as React.CSSProperties}>
          <StageScreen stage={active} />
        </div>
        <p className="flow-in border-t border-l-line pt-5 text-[15px] leading-relaxed lg:col-span-2" style={{ '--i': 2 } as React.CSSProperties}>
          <span className="text-l-muted">If someone </span>
          <strong className="font-medium">{stage.threat}</strong>
          <span className="text-l-muted">, </span>
          {stage.outcome}
        </p>
      </div>

      {!reduced && (
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-pressed={!playing}
            className="cursor-pointer rounded-full px-3 py-2.5 text-sm text-l-muted hover:text-l-fg"
          >
            {playing ? 'Pause animation' : 'Play animation'}
          </button>
        </div>
      )}
    </figure>
  )
}
