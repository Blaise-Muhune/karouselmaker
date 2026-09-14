# Email delivery

Karouselmaker has two email paths:

| Email type | Sender | Purpose |
| --- | --- | --- |
| Authentication | Supabase Auth through SMTP | Confirm sign-up, reset password, and security notices. |
| Transactional product email | Resend API | Contact-us delivery and a confirmation for signed-in customers. |
| Payment receipt | Stripe | Card receipts and invoice emails. |
| Weekly creator note | Resend API + Vercel Cron | Optional, one-per-week carousel prompt. |

## Production setup

1. In Resend, verify the sending domain. `zingocorp.space` is the configured verified sender domain; use `KarouselMaker <hello@zingocorp.space>`.
2. Set these production environment variables:

   ```bash
   RESEND_API_KEY=re_...
   RESEND_FROM_EMAIL="KarouselMaker <hello@zingocorp.space>"
   CONTACT_EMAIL=<a monitored inbox at zingocorp.space>
   NEXT_PUBLIC_APP_URL=https://karouselmaker.com
   CRON_SECRET=<random-32-plus-character-secret>
   EMAIL_PREFERENCE_SECRET=<different-random-32-plus-character-secret>
   ```

3. In Supabase Dashboard → Authentication → SMTP settings, configure Resend SMTP with `KarouselMaker <hello@zingocorp.space>`. Copy the versioned templates in [`supabase/auth-email-templates`](/C:/Users/Admin/OneDrive/Documentos/GitHub/karouselmaker/supabase/auth-email-templates/README.md), then add the production callback and reset-password URLs to the redirect allow list. Keep email click tracking disabled for these single-use authentication links.
4. In Stripe Dashboard → Customer emails, enable successful-payment and invoice receipts. Stripe should remain the source of truth for payment receipts rather than duplicating them in application code.
5. Set `WEEKLY_CREATOR_NOTE_BOOTSTRAP_RECIPIENTS` only for people who explicitly asked for the weekly note. The production cron runs Monday at 14:00 UTC. Every account can independently opt in or out under the account menu.

## Sending rules

- Keep account-security emails separate from product or marketing email.
- Send product emails only for user-requested or account-critical events. Do not email when a carousel finishes generating; the app already shows that result in the workspace.
- The Contact us confirmation is sent only to a signed-in user&apos;s verified account email. The public form never sends an acknowledgement to an arbitrary address.
- The weekly creator note has a one-click unsubscribe link, `List-Unsubscribe` headers, an opt-in setting, and a weekly frequency cap. It never sends to every account automatically.
- Keep `RESEND_FROM_EMAIL` unset in development if you do not want delivery attempts. Resend test senders cannot deliver to arbitrary recipients.
- Before launch, send a sign-up confirmation, password reset, contact request, subscription receipt, and post-pack receipt to real external inboxes and check the Auth and Resend logs.
