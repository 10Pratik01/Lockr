import { clerkMiddleware } from '@clerk/nextjs/server'

// Route protection is NOT done here: createRouteMatcher is deprecated in
// Clerk v7, and path matching can drift from Next's routing. Pages call
// requireSignedIn() and API routes call getCurrentUser() instead.
//
// This proxy only attaches the Clerk session and a nonce-based CSP. Clerk
// merges these directives into its own defaults (which allow its scripts
// and frames).
export default clerkMiddleware({
  contentSecurityPolicy: {
    strict: true,
    directives: {
      // hash-wasm runs Argon2id as WebAssembly in the browser.
      'script-src': ["'wasm-unsafe-eval'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
    },
  },
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
    // Always run for Clerk-specific frontend API routes
    '/__clerk/(.*)',
  ],
}
