import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const display = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lockr",
  description: "Zero-knowledge password vault with one-time secure sharing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Wraps the whole app so every page (dashboard, vault, settings)
            gets the Clerk session, not just the landing page. `dynamic`
            makes Clerk stamp its <script> with the per-request CSP nonce
            from proxy.ts -- without it 'strict-dynamic' blocks clerk-js. */}
        <ClerkProvider dynamic appearance={{
            cssLayerName: "clerk",
            variables: { colorPrimary: "#2f4d73", borderRadius: "0.75rem" },
          }}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
