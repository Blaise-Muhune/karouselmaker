# Google Drive folder import

Users can import images from a **Google Drive folder** into the asset library and use them as slide backgrounds.

## Where it appears

- **Single slide (slide editor)**: "From Drive" button next to "Pick" and "Upload". User selects **one image file** from Drive → that image is imported and set as the slide background. (One image at a time.)
- **Choose background image modal**: "Pick one from Drive" at the top. User selects **one image file** → it is imported and the list refreshes so they can use it.
- **New carousel (before Generate slides)**: "Import folder from Drive" next to "Pick from library". User selects a **folder** → all images in that folder are imported (up to 50) and the first 4 are set as background images for the carousel. Then user clicks "Generate slides".

## Setup (Google Cloud)

1. **Google Cloud Console** → your project (or create one).
2. **APIs & Services** → **Library** → enable:
   - **Google Drive API**
   - **Google Picker API** (or "Picker API")
3. **APIs & Services** → **Credentials**:
   - Create **OAuth 2.0 Client ID** (Web application). Add your app origin (e.g. `http://localhost:3000`, `https://yourapp.com`). Copy the **Client ID**.
   - Create **API key** (for Picker). Copy the key.
4. **OAuth consent screen**: add scope `https://www.googleapis.com/auth/drive.file` (or use "Add or remove scopes" and add "See and manage all your Google Drive files that this app has opened or created").
5. **Project number**: in Cloud Console home/dashboard, copy the **Project number** (numeric).

## Environment variables

Add to `.env` (and `.env.example` for documentation):

```bash
# Google Drive import
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_APP_ID=123456789012
NEXT_PUBLIC_GOOGLE_API_KEY=AIza...
```

- **NEXT_PUBLIC_GOOGLE_CLIENT_ID**: OAuth 2.0 Web client ID.
- **NEXT_PUBLIC_GOOGLE_APP_ID**: Project number (numeric string).
- **NEXT_PUBLIC_GOOGLE_API_KEY**: API key for the Picker.

If these are not set, the "From Drive" / "Import from Drive" buttons show "Google Drive is not configured." when clicked.

## Flow

1. User clicks "From Drive" or "Import from Drive".
2. Google Identity Services (GSI) requests an access token with scope `drive.file` (user may see a consent popup). This scope only grants access to files/folders the user opens with the app (e.g. the folder they pick), so it typically does not require Google’s restricted-scope verification.
3. Google Picker opens in **folder selection** mode (`setSelectFolderEnabled(true)`).
4. User selects one folder → callback receives the folder ID.
5. Frontend calls server action `importFromGoogleDrive(folderId, accessToken, projectId)`.
6. Server uses Drive API to list image files in the folder (JPEG, PNG, WebP, GIF), then for each file (up to 50, respecting asset limit) downloads bytes via `GET .../files/{id}?alt=media`, uploads to Supabase Storage, and creates an Asset row. Returns created assets with signed URLs.
7. **Slide edit**: first returned asset is applied as the slide background. **Modal**: asset list is refetched so the new images appear.

## Limits

- Max **50 images** per folder import (and never more than the user’s asset limit).
- Each file **max 8MB** (same as manual upload).
- Only **image** MIME types are listed and imported.

## Server action

- **File**: `app/actions/assets/importFromGoogleDrive.ts`
- **Parameters**: `folderId`, `accessToken`, `projectId?`, `limit?`
- **Returns**: `{ ok: true, assets: { id, storage_path, file_name, url }[] }` or `{ ok: false, error: string }`

Uses Drive API v3 `files.list` with `q: "'folderId' in parents and (mimeType=...)"` and `files.get` with `alt=media` for each file.
