# Account management: design

Date: 2026-10-01. Apps: passenger and driver. Origin: a panelist recommended that the profile page not reveal full personal details; they belong in one account-management place.

## Findings in the current code (checked 2026-10-01)

- Passenger and driver Profile tabs show email and phone in plain text, and edit name and phone in place.
- The passenger **Change password** screen has a permanently disabled Save button ("not available yet in this prototype"). The driver screen is the same. `updatePassword` and `verifyCurrentPassword` already exist in `packages/services/src/auth/index.ts`, so the screens only need wiring.
- Passenger Settings already has "Deactivate account" (`app/deactivate-account.tsx` → `self_deactivate_account()` RPC). Today it can only be undone at the PSO office. The driver app has no deactivation at all.
- There is no two-factor sign-in and no device/session list anywhere.

## Decisions (user-approved 2026-10-01)

1. **Profile page** keeps only photo, name, ride stats and the discount banner. Email and phone leave it.
2. **Account screen** (new, one row in each app's Profile/Settings) holds, in this order: email and phone (masked, with a password-protected Show), edit phone, change password, two-factor sign-in, signed-in devices, deactivate account.
3. **Masking:** `j***@gmail.com`, `09•• ••• 4955`. Show asks for the current password (existing `verifyCurrentPassword`), unmasks for 60 seconds, then re-masks. Editing the phone number requires the same re-check (existing rule P19 stays).
4. **Email is read-only** in the app (changing it needs re-verification; out of scope).
5. **Deactivation is reversible.** After a self-deactivation the person can sign in and tap "Reactivate my account". An account deactivated by the PSO still needs the PSO office; the app tells them apart by who performed the last `deactivate` row in `account_actions`. Deactivation is refused while the person has an active ride or trip, or a completed-but-unpaid ride. Ride and payment history is kept. A "request deletion" option is a follow-up, not in this plan.
6. **Two-factor sign-in** uses Supabase authenticator-app codes (TOTP), optional for passengers and drivers. Setup shows the secret key and an "Open authenticator app" button (no QR library needed, since the authenticator is on the same phone). After password sign-in, an account with a verified factor must enter a 6-digit code before reaching the app.
7. **Devices:** a list of signed-in devices with "Sign out" for each other device and "Sign out all other devices".

## Out of scope (stated, not silent)

- Required two-factor sign-in for admin accounts (separate spec; the admin web login was not examined here).
- Server-side enforcement of two-factor (RLS aal2 checks). This plan gates in the app only.
- Account deletion request, email change.
