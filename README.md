# Build "Privault" — Secure Zero-Knowledge Password Vault

## 1. Project Overview

Build a production-quality, modern, secure password manager called **Privault**.

Privault is a self-hosted-style password vault application that will be deployed on **Vercel** using **Next.js**. It allows authenticated users to securely store website credentials and later retrieve them.

The application must also provide a **one-time secure credential sharing system** where a user can share a stored website URL and password with another person through a temporary link and a separate OTP.

The application must prioritize:

1. Security
2. Privacy
3. Zero-knowledge/client-side encryption where practical
4. Clean architecture
5. Strong authentication
6. One-time credential sharing
7. Modern and polished UI
8. Good developer experience
9. Vercel/serverless compatibility
10. Maintainability

Do not sacrifice security merely to simplify implementation.

---

# 2. Core Technology Stack

Use the following stack unless there is a strong technical reason to change something:

## Frontend / Full-stack framework

* Next.js
* App Router
* TypeScript
* React
* Tailwind CSS

## Authentication

Use **Clerk** for application authentication.

Clerk should handle:

* Registration
* Login
* Logout
* Sessions
* Email verification
* Password authentication
* Account management
* Passkeys/WebAuthn where supported

Do NOT implement a custom authentication/session system unless absolutely necessary.

However, **Clerk authentication and vault encryption are separate concepts**.

Clerk authenticates the user to the application.

The vault must have its own encryption/unlocking mechanism.

---

# 3. Backend Architecture

Do NOT create a separate Express/Node backend initially.

Use:

```text
Next.js
├── Frontend
├── Server Components
├── Client Components
└── API Route Handlers
```

The backend/API will consist of Next.js server-side Route Handlers.

Example:

```text
/api/vault/create
/api/vault/list
/api/vault/get
/api/vault/update
/api/vault/delete

/api/share/create
/api/share/verify

/api/webauthn/register
/api/webauthn/authenticate
```

Prisma must only run on the server.

Never expose Prisma directly to the browser.

The architecture should be:

```text
Browser
   ↓ HTTPS
Next.js
   ↓
Server Route Handler
   ↓
Prisma
   ↓
PostgreSQL
```

---

# 4. Database

Use PostgreSQL with Prisma ORM.

Create a proper Prisma schema.

The database must never store plaintext website passwords.

Prefer storing encrypted data.

Potential entities:

```text
User
VaultCredential
Share
WebAuthnCredential
```

Clerk remains the source of truth for application authentication.

Store the Clerk user ID in the application database to associate vault records with users.

---

# 5. Application Authentication

Use Clerk for normal application authentication.

A user should be able to:

* Create an account
* Sign in
* Sign out
* Verify their email
* Manage their account
* Use passkeys where supported

Protected pages:

```text
/dashboard
/vault/*
```

must require an authenticated Clerk session.

Unauthenticated users attempting to access protected pages should be redirected to the login page.

---

# 6. Important Security Separation

There are TWO different security layers.

## Layer 1 — Application authentication

Handled by Clerk.

Purpose:

```text
"Who is this user?"
```

## Layer 2 — Vault encryption

Handled by Privault.

Purpose:

```text
"Can this authenticated user decrypt their vault?"
```

Do not treat Clerk authentication alone as the vault encryption key.

A stolen/compromised application session should not automatically expose plaintext vault credentials if the vault remains locked.

---

# 7. Master Vault Passphrase

The user must be able to create a separate vault passphrase.

Example:

```text
Create Vault Passphrase
Confirm Vault Passphrase
```

The passphrase is used to derive a cryptographic key.

Do NOT use plain SHA-256 as the password/passphrase hashing mechanism.

Use a password/KDF algorithm such as:

```text
Argon2id
```

with secure parameters.

The exact parameters should be chosen based on current security recommendations and reasonable browser performance.

Generate a unique cryptographic salt for each user/vault.

Never store the plaintext vault passphrase.

---

# 8. Vault Encryption

Stored credentials need encryption, not hashing.

The user will need to retrieve the original website password later, so one-way hashing is inappropriate.

Use authenticated encryption such as:

```text
AES-256-GCM
```

for vault data.

Potential flow:

```text
Vault Passphrase
       ↓
Argon2id
       ↓
Derived Encryption Key
       ↓
AES-256-GCM
       ↓
Encrypted Vault Data
       ↓
Database
```

The application should preferably perform sensitive cryptographic operations on the client where practical.

Do not invent custom cryptography.

Use well-tested Web Crypto APIs and/or well-maintained cryptographic libraries.

---

# 9. Do NOT Use This Architecture

Do NOT implement:

```text
Website Password
      ↓
SHA-256
      ↓
Frontend
      ↓
SHA-256
      ↓
Backend
      ↓
Database
```

This is not appropriate for a password manager because the original password must eventually be recoverable.

Instead:

```text
Website Password
      ↓
AES-256-GCM encryption
      ↓
Encrypted ciphertext
      ↓
Database
```

---

# 10. Stored Credential Model

A user should be able to create a credential containing:

```text
Website Name
Website URL
Username / Email
Password
Optional Notes
```

Example:

```text
Website:
GitHub

URL:
https://github.com

Username:
user@example.com

Password:
************

Notes:
Personal GitHub account
```

The UI should allow:

* Create credential
* View credential
* Edit credential
* Delete credential
* Search credentials
* Copy username
* Copy password
* Open website
* Generate secure password

---

# 11. Password Generator

Add a secure password generator.

Allow configuration:

```text
Length
Uppercase
Lowercase
Numbers
Symbols
```

Use a cryptographically secure random generator.

Do NOT use:

```javascript
Math.random()
```

for security-sensitive random values.

Use the Web Crypto API or another cryptographically secure random source.

Example:

```text
Generate Password

Length: 20

☑ Uppercase
☑ Lowercase
☑ Numbers
☑ Symbols

[Generate]
```

---

# 12. Vault Dashboard

Create a polished dashboard.

The dashboard should show:

```text
Privault

Welcome back

[ + Add Credential ]

Search passwords...

--------------------------------

GitHub
github.com
user@example.com
••••••••••••••

[Open] [Copy] [Share]

--------------------------------

Google
google.com
user@example.com
••••••••••••••

[Open] [Copy] [Share]
```

Do not display passwords in plaintext by default.

Passwords should be hidden behind a reveal action.

---

# 13. Vault Locking

Implement vault locking.

The user should be able to:

```text
Lock Vault
```

When locked:

```text
Encrypted vault remains stored
Decryption key is removed from active application memory where practical
Plaintext credentials should no longer be accessible
```

Display:

```text
Vault Locked

Enter your vault passphrase to unlock.

[Vault Passphrase]

[Unlock Vault]
```

Also implement automatic locking after a configurable inactivity period.

Example options:

```text
5 minutes
10 minutes
15 minutes
30 minutes
Never
```

Use a sensible default such as 10 or 15 minutes.

---

# 14. Biometric / Passkey Unlock

Do NOT collect, upload, or store fingerprint data.

Never implement:

```text
Fingerprint image
Fingerprint template
Fingerprint hash sent to backend
```

Instead use:

```text
WebAuthn / Passkeys
```

The browser/operating system handles biometric authentication.

The fingerprint itself should never be sent to Privault's server.

Conceptually:

```text
Fingerprint
     ↓
Operating System
     ↓
Passkey / WebAuthn
     ↓
Cryptographic authentication
     ↓
Privault
```

Use Clerk's passkey/WebAuthn capabilities for application authentication where appropriate.

If implementing vault-specific biometric unlocking, carefully design key wrapping so that biometric authentication does not expose the actual biometric data.

Do not claim that a fingerprint directly becomes an encryption key.

---

# 15. Secure Sharing Feature

This is one of the core features of Privault.

A user must be able to share a stored credential through a temporary one-time link.

Example:

```text
GitHub
github.com
user@example.com
••••••••

[Share]
```

When the user clicks Share:

```text
Generate secure share
```

The system generates:

1. Cryptographically random share token
2. Cryptographically random OTP
3. Expiration time
4. Encrypted share payload

---

# 16. Share URL

Generate a URL similar to:

```text
https://vault.example.xyz/share/X7k29PmQ8Lz4...
```

Do not use predictable IDs.

Do not use:

```text
/share/1
/share/2
/share/github
/share/pratik
```

Use a cryptographically secure random token.

Prefer at least 128 bits of entropy, and ideally use 256-bit random tokens.

---

# 17. OTP

Generate a separate OTP.

Example:

```text
839421
```

The OTP should be generated using a cryptographically secure random generator.

Do not use:

```javascript
Math.random()
```

The plaintext OTP should not be stored in the database.

Store an appropriate verifier/hash.

Implement strict OTP attempt limits.

For example:

```text
Maximum attempts: 5
```

After too many incorrect attempts:

```text
Share invalidated
```

---

# 18. Never Put OTP in the Share URL

Do NOT generate:

```text
https://vault.example.xyz/share/X7k29PmQ?otp=839421
```

The OTP must be separate from the link.

The intended sharing flow is:

```text
Person A
   │
   ├── Share URL → Person B
   │
   └── OTP → Person B
```

Ideally, the user sends the URL and OTP through separate communication channels.

---

# 19. Share Expiration

Every share must expire.

Default:

```text
10 minutes
```

Allow reasonable configuration such as:

```text
5 minutes
10 minutes
30 minutes
1 hour
```

After expiration:

```text
Share expired
```

The credential must not be accessible.

---

# 20. One-Time Access

The share must be usable only once.

Flow:

```text
Recipient opens share URL
        ↓
Enter OTP
        ↓
OTP verified
        ↓
Retrieve share
        ↓
Return credential
        ↓
Mark share as consumed
```

After successful use:

```text
used_at = current timestamp
```

and the share should no longer be usable.

A second request must fail.

Example:

```text
First access:
SUCCESS

Second access:
Share expired or already used
```

Make the consume operation atomic to prevent race conditions where two requests attempt to redeem the same share simultaneously.

---

# 21. Share Payload Encryption

Do not store plaintext credentials in the share table.

The share payload should be encrypted.

Example:

```text
URL
Username
Password
       ↓
Encryption
       ↓
Encrypted Share Payload
       ↓
Database
```

Use authenticated encryption such as AES-256-GCM.

Design the temporary share key carefully.

Do not invent cryptographic protocols.

The OTP may be used as part of a key derivation process if the resulting design is cryptographically sound.

Do not directly use:

```text
AES key = OTP
```

because a 6-digit OTP has insufficient entropy for use as a standalone encryption key.

Instead use a proper KDF and carefully separate:

```text
OTP verification
```

from:

```text
payload encryption
```

---

# 22. Share Recipient UI

When a recipient opens:

```text
/share/X7k29PmQ...
```

show:

```text
┌──────────────────────────────┐
│        Secure Share          │
│                              │
│ This credential was securely │
│ shared with you.             │
│                              │
│ Enter your OTP               │
│                              │
│ [ _ _ _ _ _ _ ]              │
│                              │
│          [Verify]            │
│                              │
│ Expires in 08:43             │
└──────────────────────────────┘
```

Do not reveal any credential information before OTP verification.

---

# 23. Successful Share UI

After successful verification:

```text
Credential Shared Successfully

Website:
https://example.com

Username:
user@example.com

Password:
••••••••••••

✓ URL copied to clipboard
✓ Password copied to clipboard

This share has now been consumed.
```

Prefer copying the URL and password to the clipboard only after successful verification and an appropriate user interaction.

Do not expose the credentials in unnecessary logs.

---

# 24. Clipboard Security

Use the browser Clipboard API.

Do not log clipboard contents.

Do not send copied credentials to the backend.

Where practical, provide a mechanism to clear the clipboard after a short period, while recognizing that the application cannot control OS-level clipboard history or clipboard managers.

---

# 25. Database Schema

Create a robust Prisma schema.

Suggested conceptual structure:

```text
User
────────────────────────
id
clerkUserId
createdAt
updatedAt


Vault
────────────────────────
id
userId
salt
encryptedVaultKey / key metadata
createdAt
updatedAt


Credential
────────────────────────
id
userId
encryptedData
iv
createdAt
updatedAt


Share
────────────────────────
id
credentialId / encrypted payload reference
tokenHash
otpVerifier
encryptedPayload
expiresAt
usedAt
failedAttempts
createdAt
```

If the architecture requires a different schema for secure key management, modify it accordingly.

Do not blindly follow this schema if it creates a cryptographic weakness.

---

# 26. Important Database Rules

Never store:

```text
plaintext password
plaintext vault passphrase
plaintext OTP
private encryption keys without proper protection
```

Do not log sensitive values.

Never include passwords in:

```text
console.log()
error logs
analytics
telemetry
URLs
query parameters
```

---

# 27. Environment Variables

Sensitive environment variables must only exist server-side.

Example:

```env
DATABASE_URL=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
```

Never expose:

```text
DATABASE_URL
CLERK_SECRET_KEY
server encryption secrets
```

through client-side code.

Create:

```text
.env.example
```

containing variable names but no real secrets.

---

# 28. Security Headers

Configure appropriate security headers.

Consider:

```text
Content-Security-Policy
Strict-Transport-Security
X-Content-Type-Options
Referrer-Policy
Permissions-Policy
Frame protections
```

Use a strict CSP compatible with Next.js and Clerk.

Do not blindly copy a CSP that breaks authentication.

---

# 29. XSS Protection

Treat all user-provided data as untrusted.

Credential fields such as:

```text
Website Name
URL
Username
Notes
```

must be safely rendered.

Do not use unsafe HTML rendering unless absolutely necessary.

Never use:

```text
dangerouslySetInnerHTML
```

for user-controlled credential data.

---

# 30. URL Validation

When saving website URLs:

* Validate the URL format
* Prefer HTTPS
* Clearly warn users if entering HTTP
* Prevent dangerous protocols such as:

```text
javascript:
data:
file:
```

when rendering clickable links.

Never blindly render arbitrary user-controlled URLs.

---

# 31. Rate Limiting

Implement rate limiting for security-sensitive operations.

Especially:

```text
/login
/share/verify
/api/share/verify
/vault/unlock
```

The share OTP endpoint is particularly important.

Example:

```text
5 failed OTP attempts
        ↓
Invalidate share
```

Use a server-compatible rate-limiting solution that works with Vercel/serverless environments.

Do not depend on in-memory variables for persistent rate limiting.

---

# 32. Error Handling

Never reveal sensitive information through errors.

Bad:

```text
Incorrect OTP for user pratik@example.com
```

Better:

```text
Invalid or expired share.
```

Do not reveal whether a credential exists when that information is unnecessary.

Use consistent error responses.

---

# 33. Logging

Never log:

```text
Passwords
Passphrases
OTP values
Encryption keys
Decrypted vault contents
Session secrets
```

Logs should contain only safe metadata.

Example:

```text
Share created
Share consumed
Share expired
Authentication failed
```

without sensitive payloads.

---

# 34. UI / UX Design

Create a polished modern security-product interface.

Design inspiration should be:

```text
Modern
Minimal
Premium
Security-focused
Clean
Fast
Professional
```

Avoid making it look like an old-fashioned password manager.

Use:

* Dark/light mode
* Responsive design
* Smooth transitions
* Subtle animations
* Good empty states
* Loading skeletons
* Toast notifications
* Confirmation dialogs for destructive actions
* Accessible forms
* Keyboard navigation

Do not overuse animations.

Performance is more important than visual effects.

---

# 35. Landing Page

Create:

```text
Privault

Your credentials.
Encrypted. Private. Under your control.

Securely store passwords and share credentials
through one-time encrypted links.

[Get Started]
[Sign In]
```

Feature sections:

```text
🔐 Encrypted Vault
Store your credentials securely.

🛡️ Strong Authentication
Use secure account authentication and passkeys.

🔗 One-Time Sharing
Share credentials through expiring links.

⏱️ Automatic Expiration
Shared credentials disappear after use or expiration.

🔒 Privacy First
Sensitive vault data remains encrypted.
```

---

# 36. Dashboard Navigation

Navigation:

```text
Privault
────────────

Dashboard
Vault
Generator
Shared Links
Settings

────────────

Lock Vault

Account
```

Mobile navigation must also be polished.

---

# 37. Credential Creation UI

Create a modal/page:

```text
Add Credential

Website Name
[________________]

Website URL
[________________]

Username
[________________]

Password
[________________] [Generate]

Notes
[________________]

        [Cancel] [Save Credential]
```

Password strength indicator:

```text
Weak
Fair
Good
Strong
```

The password strength calculation must happen locally.

Do not send the plaintext password to analytics or third-party services.

---

# 38. Credential Details

Show:

```text
GitHub

Website
github.com

Username
user@example.com

Password
••••••••••••

Notes
Personal account

[Show Password]
[Copy Password]
[Open Website]
[Edit]
[Share]
[Delete]
```

---

# 39. Search

Allow searching credentials.

If the vault is truly zero-knowledge/client-side encrypted, prefer decrypting the necessary metadata locally and searching locally rather than sending plaintext search queries to the server.

Do not weaken encryption just to make server-side search easier.

---

# 40. Sharing Dashboard

Create a page:

```text
Shared Links
```

Show:

```text
GitHub
Created: 2 minutes ago
Expires: 8 minutes
Status: Active

[Revoke]
```

Possible states:

```text
Active
Used
Expired
Revoked
```

Allow the owner to revoke an active share before it is used.

---

# 41. Share Revocation

The original user should be able to revoke a share.

Example:

```text
Active Share

[Revoke Share]
```

After revocation:

```text
Share unavailable
```

The recipient must not be able to use the link.

---

# 42. Security Settings

Create:

```text
Settings
```

Sections:

### Authentication

```text
Email
Password
Passkeys
Active Sessions
```

### Vault

```text
Change Vault Passphrase
Auto-lock timeout
```

### Security

```text
Recent activity
Active sessions
```

Do not allow changing the vault passphrase in a way that destroys the ability to decrypt existing data unless the re-encryption process is handled correctly.

---

# 43. Vault Passphrase Change

When changing the vault passphrase:

```text
Old passphrase
        ↓
Decrypt vault key
        ↓
New passphrase
        ↓
Argon2id
        ↓
New key
        ↓
Re-wrap/re-encrypt vault key
```

Do not simply change a database hash and accidentally make existing encrypted credentials undecryptable.

---

# 44. Data Ownership

Every database query involving vault data must verify ownership.

Never trust a client-provided:

```text
userId
```

Instead derive the authenticated user identity from the Clerk server-side session.

Bad:

```text
POST /api/vault/get

{
  "userId": "someone-else"
}
```

Good:

```text
Clerk session
      ↓
authenticated user
      ↓
query only records belonging to that user
```

This is extremely important.

---

# 45. Authorization

Authentication answers:

```text
Who are you?
```

Authorization answers:

```text
Are you allowed to access this record?
```

Every protected API endpoint must enforce authorization.

For example:

```text
Credential ID
      ↓
Find credential
      ↓
Check credential.userId === authenticatedUserId
      ↓
Only then continue
```

---

# 46. API Design

Use REST-like route handlers.

Example:

```text
POST   /api/vault/create
GET    /api/vault/list
GET    /api/vault/:id
PATCH  /api/vault/:id
DELETE /api/vault/:id

POST   /api/share/create
POST   /api/share/verify
POST   /api/share/revoke
GET    /api/share/list
```

Validate all request bodies using a schema validation library such as Zod.

Never trust client-side validation alone.

---

# 47. Server-side Validation

Every API request must validate:

```text
type
length
format
required fields
authorization
```

Example:

```text
password length
URL validity
share expiration
OTP format
credential ID
```

Use safe maximum lengths to prevent abuse.

---

# 48. Vercel Deployment

The application must be designed specifically for Vercel serverless deployment.

Do not depend on:

```text
local filesystem
long-running background processes
in-memory persistent state
local SQLite database
```

Use:

```text
Vercel
+
PostgreSQL
+
Prisma
```

Prisma should be configured correctly for serverless environments.

Use connection pooling/serverless-compatible PostgreSQL configuration where necessary.

---

# 49. Domain

The application will eventually be deployed to a subdomain such as:

```text
vault.example.xyz
```

The share URLs should therefore look like:

```text
https://vault.example.xyz/share/X7k29PmQ...
```

Do not hardcode the production domain throughout the application.

Use an environment variable/configuration for the public application URL.

Example:

```env
NEXT_PUBLIC_APP_URL=https://vault.example.xyz
```

---

# 50. Development Environment

The project must work locally.

Example:

```text
http://localhost:3000
```

Use:

```text
.env.local
```

for local configuration.

Provide:

```text
.env.example
```

for documentation.

---

# 51. Prisma Commands

Document commands such as:

```bash
npx prisma generate
npx prisma migrate dev
npx prisma studio
```

and production migration/deployment commands as appropriate.

Do not run destructive database commands automatically.

---

# 52. Git Security

Create a proper `.gitignore`.

Never commit:

```text
.env
.env.local
.env.production
database credentials
Clerk secret keys
private keys
encryption secrets
```

Add security warnings to the README.

---

# 53. README

Create a professional README containing:

```text
# Privault

Secure Zero-Knowledge Password Vault
```

Sections:

```text
Features
Architecture
Tech Stack
Security Model
Encryption Model
Authentication
One-Time Sharing
Database Architecture
Environment Variables
Local Development
Database Setup
Deployment
Vercel Deployment
Domain Configuration
Security Considerations
Threat Model
Limitations
Future Improvements
```

Include an architecture diagram using Mermaid if appropriate.

---

# 54. Threat Model

Document threats such as:

```text
Database leak
Stolen session
XSS
CSRF
Brute-force OTP attacks
Share URL leakage
Expired share reuse
Race-condition double redemption
Malicious credential URL
Server compromise
Client compromise
Clipboard leakage
Weak master passphrase
```

For each threat, document the mitigation.

---

# 55. Security Principle

Follow this principle throughout the project:

> The backend should know as little sensitive information as reasonably possible.

The database should contain encrypted vault data rather than plaintext credentials.

Do not build unnecessary systems that send plaintext credentials through third-party services.

---

# 56. Do Not Invent Cryptography

This is extremely important.

Do not create custom:

```text
encryption algorithm
key derivation algorithm
random generator
password hashing scheme
token generation algorithm
authentication protocol
```

Use established standards and well-maintained libraries/APIs.

---

# 57. Security Testing

Create tests for:

### Authentication

```text
Unauthenticated access rejected
Authenticated access works
Wrong credentials rejected
```

### Authorization

```text
User A cannot access User B's credential
User A cannot modify User B's credential
User A cannot delete User B's credential
```

### Sharing

```text
Correct OTP → success
Wrong OTP → failure
Expired share → failure
Used share → failure
Revoked share → failure
Too many attempts → invalidated
Concurrent redemption → only one succeeds
```

### Encryption

```text
Database does not contain plaintext passwords
Database does not contain plaintext vault passphrase
```

### Security

```text
No sensitive console logs
No secret environment variables in client bundle
No password in URL
No OTP in URL
```

---

# 58. Implementation Order

Do not attempt to build the entire application at once.

Build in phases.

## Phase 1 — Project Setup

Implement:

```text
Next.js
TypeScript
Tailwind
ESLint
Prettier
Prisma
PostgreSQL
Clerk
```

Verify the project runs.

---

## Phase 2 — Clerk Authentication

Implement:

```text
Sign up
Sign in
Sign out
Protected routes
User information
```

Verify authentication before building the vault.

---

## Phase 3 — Database

Create Prisma schema.

Implement:

```text
User
Vault
Credential
Share
```

Run migrations.

---

## Phase 4 — Vault Cryptography

Implement:

```text
Argon2id
AES-256-GCM
Secure random generation
Key derivation
Vault locking
Vault unlocking
```

Write tests before continuing.

---

## Phase 5 — Credential CRUD

Implement:

```text
Create
Read
Update
Delete
Search
Copy
Password generator
```

Ensure all credential data is encrypted correctly.

---

## Phase 6 — Sharing

Implement:

```text
Share creation
Random token
OTP
Expiration
Encrypted share payload
OTP verification
Atomic one-time consumption
Revoke
```

Test extensively.

---

## Phase 7 — Passkeys

Integrate Clerk passkeys/WebAuthn.

Do not store biometric data.

---

## Phase 8 — Security Hardening

Implement:

```text
Rate limiting
Security headers
CSP
Input validation
Authorization checks
Secure cookies/session configuration
Error handling
Audit-safe logging
```

---

## Phase 9 — UI Polish

Improve:

```text
Animations
Loading states
Empty states
Mobile responsiveness
Dark mode
Accessibility
Toast notifications
Dialogs
```

---

## Phase 10 — Deployment

Deploy to:

```text
Vercel
```

Configure:

```text
PostgreSQL
Prisma
Clerk
Environment variables
Production domain
HTTPS
```

Then test the complete production flow.

---

# 59. Coding Rules

Follow these rules throughout development:

1. TypeScript strict mode.
2. Avoid `any` unless absolutely necessary.
3. Keep components modular.
4. Keep cryptographic functions isolated.
5. Keep database operations isolated.
6. Keep API validation isolated.
7. Do not duplicate security logic.
8. Never trust client input.
9. Never trust client-provided user IDs.
10. Never log secrets.
11. Never put credentials or OTPs in URLs.
12. Never store plaintext vault passwords.
13. Never store fingerprints.
14. Never use `Math.random()` for security-sensitive randomness.
15. Never use SHA-256 as a password hashing/KDF replacement.
16. Never invent cryptographic algorithms.
17. Add tests for security-sensitive code.
18. Prefer server-side authorization checks.
19. Make one-time share redemption atomic.
20. Keep the application compatible with Vercel serverless execution.

---

# 60. Expected Final Project Structure

Use a structure similar to:

```text
privault/
│
├── app/
│   ├── page.tsx
│   │
│   ├── login/
│   ├── register/
│   │
│   ├── dashboard/
│   │
│   ├── vault/
│   │   └── [id]/
│   │
│   ├── share/
│   │   └── [token]/
│   │
│   ├── settings/
│   │
│   └── api/
│       ├── vault/
│       │   ├── create/
│       │   ├── list/
│       │   ├── [id]/
│       │   └── ...
│       │
│       ├── share/
│       │   ├── create/
│       │   ├── verify/
│       │   ├── revoke/
│       │   └── list/
│       │
│       └── webauthn/
│
├── components/
│   ├── ui/
│   ├── auth/
│   ├── vault/
│   ├── share/
│   └── layout/
│
├── lib/
│   ├── prisma.ts
│   │
│   ├── auth/
│   │
│   ├── crypto/
│   │   ├── encryption.ts
│   │   ├── key-derivation.ts
│   │   └── random.ts
│   │
│   ├── vault/
│   ├── share/
│   └── validation/
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── types/
│
├── public/
│
├── tests/
│   ├── auth/
│   ├── vault/
│   ├── crypto/
│   └── share/
│
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.ts
└── README.md
```

---

# 61. Important Development Behavior

Before writing significant code:

1. Analyze the architecture.
2. Identify security risks.
3. Explain any assumptions.
4. Implement one phase at a time.
5. Run/build/test after each major phase.
6. Do not silently change the security architecture.
7. If a requested implementation is cryptographically unsafe, stop and explain why, then propose a safer alternative.
8. Never implement insecure cryptography just because it is simpler.
9. Prefer established standards and maintained libraries.
10. Keep the code production-ready rather than creating a disposable demo.

When making architectural decisions, prioritize:

```text
Security
>
Correctness
>
Privacy
>
Reliability
>
Maintainability
>
Performance
>
Convenience
```

---

# 62. Final Product Goal

The final application should feel like a legitimate modern password-security product.

A user should be able to:

```text
1. Create a Privault account
        ↓
2. Authenticate through Clerk
        ↓
3. Set up their vault
        ↓
4. Create a secure vault passphrase
        ↓
5. Unlock their vault
        ↓
6. Save website credentials
        ↓
7. Encrypt credentials
        ↓
8. Store encrypted data through Prisma/PostgreSQL
        ↓
9. Retrieve/decrypt credentials when needed
        ↓
10. Generate a secure sharing link
        ↓
11. Generate a separate OTP
        ↓
12. Send link + OTP to another person
        ↓
13. Recipient opens link
        ↓
14. Recipient enters OTP
        ↓
15. Credential is revealed
        ↓
16. URL/password are copied to clipboard
        ↓
17. Share is atomically consumed
        ↓
18. Link can never be reused
```

The final application must be designed so that **security is part of the architecture from the beginning rather than an additional feature added at the end.**
