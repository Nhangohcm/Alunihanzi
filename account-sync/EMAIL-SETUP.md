# Email accounts — staging only

Optional: guests can use all existing free web features and local saved words/sentences without an account. No automatic account creation, redirect, modal or local library upload.

Registration collects name, email and a user-selected password. No session is created before verification; after verifying, the user returns to login. The email link asks for the registration password before activating, preventing someone else's pre-registration from being silently adopted. Forgotten passwords are reset via an expiring email link. Reset invalidates earlier sessions and links without deleting saved words/sentences.

## Remaining deployment requirements

1. Connect Resend and verify the sender domain. API documentation: https://resend.com/docs/api-reference/emails/send-email . Set a sending-only API key restricted to the sender domain in Worker secrets (never frontend or chat).
2. Apply `email-schema.sql` only to `aluni-access-staging`; preserve existing tables. Existing username/generated-secret accounts remain supported by their legacy routes; email accounts use the same table and negative library owner ID.
3. Integrate `email-accounts.mjs` plus the changed `accounts.mjs` with the current staging Worker. `integrate-worker.py` accepts an unmodified source, not an already integrated deployed Worker; inspect/export the current Worker before updating. Single-file inline Worker copies require the same module bundled, not pasted as a second duplicate function.
4. Worker flags: `FREE_ACCOUNT_SYNC=true`, `SAVED_LIBRARY_SYNC=true`, `EMAIL_ACCOUNT_SYNC=true`. Secrets: `RESEND_API_KEY` and `ACCOUNT_PASSWORD_PEPPER` (at least 32 cryptographically random characters; keep stable and backed up). Variables: `ACCOUNT_EMAIL_FROM` (verified sender) and `ACCOUNT_PUBLIC_URL=https://codex-account-saved-sync.aluni-v47-test.pages.dev/email-verify.html`.
5. Verify CORS allows the preview origin for POST and Content-Type. No production enablement/merge is included.
6. Real-mail gate: register using an owned email, confirm no login before verification, receive and confirm mail, return to login, test resend and expired links, reset password, confirm old session rejected, sync between two devices and confirm guest local use remains available. Mail acceptance is not a guarantee of inbox delivery; check delivery/bounce logs.

Passwords use PBKDF2-HMAC-SHA256 with 100,000 iterations (Workers Web Crypto supported limit), random per-account salt and a server-only HMAC pepper. Only hashes of session/email tokens are stored. Email links expire after 30 minutes and are single-use across races; reset bumps auth_version. Origin comes from fixed server configuration, never request Host/Origin. Tokens use a dedicated page with no external assets and fragment cleanup. Rate limits: 30 requests/IP/hour, 12/email/hour, 3 email requests/address/hour, 100 mail requests/hour across staging; 1,000 account staging cap. Preserve pepper across deployments; losing it requires password resets. Before production, review password derivation cost, rate limits and use real delivery tests.

Without provider configuration, the route reports service unavailable; it does not claim email was sent. The frontend remains usable but account creation will not work until Worker, schema and secrets are configured.
