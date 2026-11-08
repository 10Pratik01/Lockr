'use client'

import { useEffect, useRef } from 'react'

// Marks itself armed on mount (so content stays visible without JS), then
// flips data-in once scrolled into view. CSS in globals.css does the motion.
export function Reveal({
  children,
  className = '',
  threshold = 0.25,
}: Readonly<{
  children: React.ReactNode
  className?: string
  threshold?: number
}>) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.dataset.in = 'true'
      return
    }
    el.dataset.armed = 'true'
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.dataset.in = 'true'
          io.disconnect()
        }
      },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])

  return (
    <div ref={ref} data-reveal className={className}>
      {children}
    </div>
  )
}

// Splits a heading into words that rise out of a clipped line, one after another.
export function Words({ text, offset = 0 }: Readonly<{ text: string; offset?: number }>) {
  const words = text.split(' ')
  const seen = new Map<string, number>()
  return (
    <>
      {words.map((w, i) => {
        const n = seen.get(w) ?? 0
        seen.set(w, n + 1)
        return (
        <span key={`${w}:${n}`} className="word-mask ">
          <span className="word px-1" style={{ '--w': i + offset } as React.CSSProperties}>
            {w}
          </span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
        )
      })}
    </>
  )
}
