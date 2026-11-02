import { auth } from "@clerk/nextjs/server";

/**
 * Page/layout guard: sends signed-out visitors to sign-in. Call it in each
 * protected page as well as the layout -- layouts don't re-run on client
 * navigation, so a layout-only check isn't enough on its own. API routes
 * use getCurrentUser() instead and answer 401.
 */
export async function requireSignedIn(): Promise<void> {
  const { isAuthenticated, redirectToSignIn } = await auth();
  if (!isAuthenticated) redirectToSignIn();
}
