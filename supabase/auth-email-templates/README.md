# KarouselMaker Supabase Auth email templates

These templates are for **Supabase Dashboard → Authentication → Email Templates**. Copy each HTML file into the matching template and use the listed subject.

| Supabase template | Subject | File |
| --- | --- | --- |
| Confirm sign up | `Confirm your KarouselMaker email` | `confirmation.html` |
| Invite user | `You’re invited to KarouselMaker` | `invite.html` |
| Magic link or OTP | `Your KarouselMaker sign-in link` | `magic-link.html` |
| Change email address | `Confirm your new KarouselMaker email` | `email-change.html` |
| Reset password | `Reset your KarouselMaker password` | `recovery.html` |
| Reauthentication | `Verify it’s you — KarouselMaker` | `reauthentication.html` |

## Required hosted-project settings

In **Authentication → SMTP settings**, use the Resend SMTP account that is already verified for `zingocorp.space`:

- Sender name: `KarouselMaker`
- Sender email: `hello@zingocorp.space`
- SMTP host: `smtp.resend.com`
- Port: `465` (TLS) or `587` (STARTTLS)
- Username: `resend`
- Password: a Resend API key

In **Authentication → URL Configuration**:

- Site URL: `https://karouselmaker.com`
- Add `https://karouselmaker.com/auth/callback` to Redirect URLs.
- Add `https://karouselmaker.com/reset-password` to Redirect URLs.
- Add the equivalent `http://localhost:3000/...` URLs only for local development.

Keep click tracking disabled for Supabase authentication mail in Resend. These links are single-use security links; link rewriting can break them.

The current app uses password sign-up and password reset. The other templates are included so the account is ready if an admin invite, passwordless sign-in, email change, or reauthentication flow is enabled later.
