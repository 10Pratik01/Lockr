import Link from 'next/link'
import { SignInButton, SignUpButton, Show, UserButton } from '@clerk/nextjs'

const FEATURES = [
  {
    title: 'Zero-knowledge encryption',
    body: 'Credentials are encrypted with AES-256-GCM in your browser. The server only ever stores ciphertext.',
  },
  {
    title: 'Separate vault passphrase',
    body: 'Your account login and your vault key are different secrets. A stolen session alone opens nothing.',
  },
  {
    title: 'One-time secure sharing',
    body: 'Share a credential with a link and a separate code. It expires, works once, and can be revoked.',
  },
]

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
        <span className="font-semibold tracking-tight">🔐 Privault</span>
        <div className="flex items-center gap-3">
          <Show when="signed-out">
            <SignInButton>
              <button className="cursor-pointer text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton>
              <button className="h-9 cursor-pointer rounded-lg bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-500">
                Get started
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <Link href="/dashboard" className="text-sm font-medium text-violet-600 hover:underline">
              Open vault
            </Link>
            <UserButton />
          </Show>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-20">
        <section className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Your passwords, encrypted before they leave your device.
          </h1>
          <p className="mt-5 text-lg text-zinc-600 dark:text-zinc-400">
            Privault is a zero-knowledge password vault with one-time, OTP-protected credential sharing.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Show when="signed-out">
              <SignUpButton>
                <button className="h-11 cursor-pointer rounded-lg bg-violet-600 px-6 font-medium text-white hover:bg-violet-500">
                  Create your vault
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="inline-flex h-11 items-center rounded-lg bg-violet-600 px-6 font-medium text-white hover:bg-violet-500"
              >
                Open your vault
              </Link>
            </Show>
          </div>
        </section>

        <section className="mt-20 grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <h2 className="font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{f.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}
