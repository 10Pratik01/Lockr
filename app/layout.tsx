import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Privault",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Wraps the whole app so every page (dashboard, vault, settings)
            gets the Clerk session, not just the landing page. `dynamic`
            makes Clerk stamp its <script> with the per-request CSP nonce
            from proxy.ts -- without it 'strict-dynamic' blocks clerk-js. */}
        <ClerkProvider dynamic appearance={{ cssLayerName: "clerk" }}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
