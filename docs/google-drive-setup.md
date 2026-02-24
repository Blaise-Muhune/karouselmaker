# How to get Google Drive API keys and IDs

Follow these steps in **Google Cloud Console** to enable "Import from Drive" in KarouselMaker.

The app uses the **`drive.file`** scope (only files/folders the user opens with the app, e.g. the folder they pick). This scope typically **does not require** Google’s restricted-scope verification, so you can avoid the approval process.

---

## 1. Open Google Cloud Console

- Go to: **https://console.cloud.google.com/**
- Sign in with the Google account you want to use for the project.

---

## 2. Create or select a project

- At the top of the page, click the **project dropdown** (it may say "Select a project" or show an existing project name).
- Click **"New Project"**.
  - **Project name**: e.g. `KarouselMaker` (any name is fine).
  - **Organization**: leave default if you have one, or "No organization".
- Click **Create**. Wait until the project is created, then **select it** in the dropdown.

---

## 3. Get your Project number (→ `NEXT_PUBLIC_GOOGLE_APP_ID`)

- With your project selected, click the **project dropdown** again (or go to **Home** in the left menu).
- On the project card / dashboard you’ll see:
  - **Project name**
  - **Project ID** (e.g. `karouselmaker-123456`) 
  - **Project number** (e.g. `123456789012`) ← **this is what you need**
- Copy the **Project number** (digits only). You’ll use it as **`NEXT_PUBLIC_GOOGLE_APP_ID`** in `.env`.

*(You can also find it later under **APIs & Services → Dashboard**: the number is shown under the project name.)*

---

## 4. Enable the APIs

- In the left sidebar, go to **APIs & Services → Library** (or search "Library" in the top search).
- Search for **"Google Drive API"**:
  - Click it → click **Enable**.
- Search for **"Google Picker API"** (or "Picker API"):
  - Click it → click **Enable**.

---

## 5. Configure the OAuth consent screen (required for Drive access)

- Go to **APIs & Services → OAuth consent screen**.
- Choose **External** (unless you use a Google Workspace org and want Internal only) → **Create**.
- **App information**:
  - **App name**: e.g. `KarouselMaker`
  - **User support email**: your email
  - **Developer contact**: your email
- Click **Save and Continue**.
- **Scopes**:
  - Click **Add or Remove Scopes**.
  - In the filter/search box, type **drive**.
  - Find **"See and manage all your Google Drive files that this app has opened or created"** and check it  
    (scope: `https://www.googleapis.com/auth/drive.file`).  
    This scope only grants access to the folder the user selects in the Picker, so it usually does **not** require Google’s restricted-scope verification.
  - Click **Update** → **Save and Continue**.
- **Test users** (if app is in "Testing"):
  - Click **Add Users** and add the Gmail addresses that will use "Import from Drive".
  - Click **Save and Continue**.
- Review and go back to the OAuth consent screen. You can leave "Publishing status" as **Testing** for development.

---

## 6. Create OAuth 2.0 Client ID (→ `NEXT_PUBLIC_GOOGLE_CLIENT_ID`)

- Go to **APIs & Services → Credentials**.
- Click **+ Create Credentials** → **OAuth client ID**.
- **Application type**: **Web application**.
- **Name**: e.g. `KarouselMaker Web`.
- **Authorized JavaScript origins**:
  - Click **+ Add URI**.
  - For local dev: `http://localhost:3000`
  - For production: `https://yourdomain.com` (no trailing slash)
- **Authorized redirect URIs** (optional for this flow, but needed for normal Google sign-in if you use it):
  - Add your app’s redirect URL if you use Google login (e.g. `https://yourdomain.com/auth/callback`).
- Click **Create**.
- A modal shows **Client ID** and **Client secret**.
  - Copy the **Client ID** (looks like `123456789-xxxx.apps.googleusercontent.com`).
  - This is **`NEXT_PUBLIC_GOOGLE_CLIENT_ID`** in `.env`.  
  - You don’t need to put the Client secret in the app for the Drive picker.

---

## 7. Create an API key (→ `NEXT_PUBLIC_GOOGLE_API_KEY`)

- Still in **APIs & Services → Credentials**.
- Click **+ Create Credentials** → **API key**.
- The key is created. You can optionally click **Restrict key**:
  - **API restrictions**: "Restrict key" → select **Google Picker API** (and **Google Drive API** if you want).
  - **Application restrictions**: you can leave "Don't restrict" for dev, or set "HTTP referrers" later for production.
- Copy the **API key** (starts with `AIza...`).
  - This is **`NEXT_PUBLIC_GOOGLE_API_KEY`** in `.env`.

---

## 8. Put the values in `.env`

Open your project’s `.env` (create from `.env.example` if needed) and set:

```bash
# Google Drive import
NEXT_PUBLIC_GOOGLE_CLIENT_ID=123456789-xxxxxxxxxx.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_APP_ID=123456789012
NEXT_PUBLIC_GOOGLE_API_KEY=AIzaSy...
```

- **NEXT_PUBLIC_GOOGLE_CLIENT_ID** = OAuth Client ID from step 6  
- **NEXT_PUBLIC_GOOGLE_APP_ID** = Project number from step 3  
- **NEXT_PUBLIC_GOOGLE_API_KEY** = API key from step 7  

Restart the dev server after changing `.env`.

---

## Quick checklist

| What you need              | Where to get it                          | Env variable                      |
|---------------------------|-------------------------------------------|-----------------------------------|
| Project number            | Project dropdown / Dashboard / APIs & Services | `NEXT_PUBLIC_GOOGLE_APP_ID`       |
| OAuth Web Client ID       | Credentials → Create → OAuth client ID   | `NEXT_PUBLIC_GOOGLE_CLIENT_ID`    |
| API key                   | Credentials → Create → API key           | `NEXT_PUBLIC_GOOGLE_API_KEY`      |

---

## Troubleshooting

- **"Google Drive is not configured"**  
  One of the three env vars is missing or wrong. Check spelling and that the server was restarted after editing `.env`.

- **"Access blocked: This app's request is invalid"**  
  Add your app URL to **OAuth consent screen → Authorized domains** and to **Credentials → OAuth client → Authorized JavaScript origins**.

- **"Sign-in cancelled" or no folder picker**  
  User must allow the app to "See and manage all your Google Drive files that this app has opened or created" when the consent screen appears. If the scope isn’t there, add it in **OAuth consent screen → Scopes**.

- **Picker doesn’t open**  
  Ensure **Google Picker API** is enabled and **NEXT_PUBLIC_GOOGLE_APP_ID** is the **numeric** project number, not the project ID string.
