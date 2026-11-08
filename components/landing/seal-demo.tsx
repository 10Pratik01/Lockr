'use client'

import { useEffect, useState } from 'react'
import { randomInt } from '@/lib/crypto/random'

type Phase = 'plain' | 'scramble' | 'sealed' | 'shared' | 'burned'

const SECRET = 'prod-db-7Hq!x2Lm'
// Fixed so server and client render the same markup before the loop starts.
const CIPHER = 'k3Zr9WvT0pYb8QeN'
const GLYPHS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

const HOLD: Record<Phase, number> = {
  plain: 1500,
  scramble: 0,
  sealed: 1300,
  shared: 2400,
  burned: 1900,
}

const NEXT: Record<Phase, Phase> = {
  plain: 'scramble',
  scramble: 'sealed',
  sealed: 'shared',
  shared: 'burned',
  burned: 'plain',
}

function scrambled(progress: number): string {
  return SECRET.split('')
    .map((ch, i) => {
      if (i / SECRET.length < progress * 0.35) return CIPHER[i]
      return GLYPHS[randomInt(GLYPHS.length)]
    })
    .join('')
}

const STATUS: Record<Phase, string> = {
  plain: 'Typed in your browser',
  scramble: 'Encrypting with AES-256-GCM',
  sealed: 'Only ciphertext leaves your device',
  shared: 'Link and code sent separately',
  burned: 'Opened once. Gone.',
}

export function SealDemo() {
  const [phase, setPhase] = useState<Phase>('sealed')
  const [mix, setMix] = useState(CIPHER)

  // Starts from "sealed" so the first paint (and reduced-motion users) see the
  // finished state; the loop begins after mount unless motion is reduced.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timers: number[] = []
    let interval: number | undefined
    let current: Phase = 'sealed'

    const step = () => {
      current = NEXT[current]
      setPhase(current)
      window.clearInterval(interval)
      if (current === 'scramble') {
        let tick = 0
        interval = window.setInterval(() => {
          tick += 1
          setMix(scrambled(tick / 14))
          if (tick >= 14) {
            window.clearInterval(interval)
            setMix(CIPHER)
            step()
          }
        }, 60)
        return
      }
      timers.push(window.setTimeout(step, HOLD[current]))
    }

    timers.push(window.setTimeout(step, 600))
    return () => {
      timers.forEach(window.clearTimeout)
      window.clearInterval(interval)
    }
  }, [])

  const showPlain = phase === 'plain'
  const value = showPlain ? SECRET : mix

  return (
    <figure
      className="rounded-2xl border border-l-line bg-l-card p-5 shadow-[0_18px_40px_-24px_rgba(22,25,31,0.35)] sm:p-6"
      aria-label="Animated example: a password is encrypted in the browser, then shared once and destroyed"
    >
      <div className="flex items-center justify-between text-xs text-l-muted">
        <span>Production database</span>
        <span className="flex items-center gap-1.5">
          <span
            className="size-1.5 rounded-full transition-colors duration-500"
            style={{ background: showPlain ? 'var(--l-ember)' : 'var(--l-cipher)' }}
          />
          {showPlain ? 'Plaintext' : 'Encrypted'}
        </span>
      </div>

      <div
        className="mt-3 overflow-hidden rounded-lg border border-l-line bg-l-bg px-4 py-3.5 font-mono text-[15px] tracking-wide sm:text-base"
        style={{ color: showPlain ? 'var(--l-fg)' : 'var(--l-cipher)' }}
      >
        <span className="block truncate" aria-hidden="true">
          {value}
        </span>
      </div>

      <p className="mt-3 min-h-5 text-sm text-l-muted" aria-live="off">
        {STATUS[phase]}
      </p>

      <div className="mt-5 space-y-2 border-t border-l-line pt-4">
        <p className="text-xs text-l-muted">One-time share</p>
        <div className="share-chip space-y-2" data-phase={phase}>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-l-line bg-l-bg px-3 py-2 text-sm">
            <span className="truncate font-mono text-[13px]">lockr.app/s/9fK2…xQ</span>
            <span className="shrink-0 text-xs text-l-muted">link</span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-l-line bg-l-bg px-3 py-2 text-sm">
            <span className="font-mono text-[13px] tracking-[0.3em]">482 913</span>
            <span className="shrink-0 text-xs text-l-muted">code, sent elsewhere</span>
          </div>
        </div>
      </div>

      <figcaption className="sr-only">
        Your password is encrypted in your browser. You share a link and a separate code. It opens
        once, then the share is destroyed.
      </figcaption>
    </figure>
  )
}
