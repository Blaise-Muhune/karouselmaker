# Google Sign-In Setup

This app uses Supabase Auth with Google OAuth. Follow these steps to enable it.

## 1. Supabase Dashboard

1. Go to your [Supabase project](https://supabase.com/dashboard) → **Authentication** → **Providers** → **Google**
2. Enable the Google provider
3. You'll see the **Callback URL** (e.g. `https://xxxxxxxx.supabase.co/auth/v1/callback`) — copy it
4. Add your app's redirect URL to **Redirect URLs**:
   - Local: `http://localhost:3000/auth/callback`
   - Production: `https://yourdomain.com/auth/callback`
5. Paste your Google **Client ID** and **Client Secret** from Google Cloud Console
6. Save

## 2. Google Cloud Console

In [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials** → your OAuth 2.0 Client ID:

### Authorized JavaScript origins

Add the URLs where your app runs (no trailing slash):

| Environment | URI |
|-------------|-----|
| Local dev | `http://localhost:3000` |
| Production | `https://yourdomain.com` |

### Authorized redirect URIs

Add your **Supabase** callback URL (from step 1 above):

```
https://<YOUR_PROJECT_REF>.supabase.co/auth/v1/callback
```

Replace `<YOUR_PROJECT_REF>` with your Supabase project reference (from `NEXT_PUBLIC_SUPABASE_URL`, e.g. `https://abcdefgh.supabase.co` → use `abcdefgh`).

**Example:** If your Supabase URL is `https://xyzcompany.supabase.co`, use:
```
https://xyzcompany.supabase.co/auth/v1/callback
```

> ⚠️ Do **not** use `https://www.example.com` or your app URL here. Google must redirect to Supabase's callback, not your app. Your app receives the user after Supabase processes the OAuth flow.

## 3. Environment

Ensure `NEXT_PUBLIC_APP_URL` is set in production (e.g. `https://yourdomain.com`). For local dev it defaults to `http://localhost:3000`.

## 4. Notes

- Changes in Google Cloud Console may take 5 minutes to a few hours to propagate
- Remove `http://localhost:3000` from production OAuth clients when going live
- Add your production domain to both Supabase redirect URLs and Google authorized origins
