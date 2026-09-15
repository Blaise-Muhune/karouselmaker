/**
 * Shared Google Drive Picker helpers (client-only).
 * Keep picker construction aligned with Google's web sample.
 */

export const GSI_URL = "https://accounts.google.com/gsi/client";
export const GAPI_URL = "https://apis.google.com/js/api.js";
export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export const DRIVE_IMAGE_MIME_TYPES =
  "image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif";

export type GooglePickerDoc = { id: string; name?: string; mimeType?: string };
export type GooglePickerResponse = { action: string; docs?: GooglePickerDoc[] };

export type DrivePickerEnv = {
  clientId: string;
  appId: string;
  apiKey: string;
};

/** App ID must be the numeric Cloud project number (also the prefix of the OAuth client id). */
export function resolveDrivePickerEnv(): DrivePickerEnv | { error: string } {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "";
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY?.trim() ?? "";
  let appId = process.env.NEXT_PUBLIC_GOOGLE_APP_ID?.trim() ?? "";

  if (!clientId) {
    return { error: "Google Drive is not configured (missing client ID)." };
  }
  if (!apiKey) {
    return {
      error:
        "Google Drive picker needs an API key (NEXT_PUBLIC_GOOGLE_API_KEY). Without it Google shows Sign in to access this content.",
    };
  }
  if (!appId) {
    // Client IDs look like: 123456789012-xxxx.apps.googleusercontent.com
    const prefix = clientId.split("-")[0] ?? "";
    if (/^\d{6,}$/.test(prefix)) appId = prefix;
  }
  if (!appId) {
    return { error: "Google Drive is not configured (missing app ID / project number)." };
  }
  return { clientId, appId, apiKey };
}

export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("No document"));
      return;
    }
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

export function resolveMultiselectFeature(picker: Record<string, unknown>): string | number {
  const feature = picker.Feature as { MULTISELECT_ENABLED?: string | number } | undefined;
  if (feature?.MULTISELECT_ENABLED != null) return feature.MULTISELECT_ENABLED;
  return "multiselectEnabled";
}

export type PickerBuilderLike = {
  setAppId: (id: string) => PickerBuilderLike;
  setOAuthToken: (t: string) => PickerBuilderLike;
  setDeveloperKey: (k: string) => PickerBuilderLike;
  setTitle?: (t: string) => PickerBuilderLike;
  enableFeature: (f: string | number) => PickerBuilderLike;
  addView: (v: unknown) => PickerBuilderLike;
  setCallback: (cb: (d: GooglePickerResponse) => void) => PickerBuilderLike;
  setMaxItems?: (n: number) => PickerBuilderLike;
  setOrigin?: (origin: string) => PickerBuilderLike;
  build: () => { setVisible: (v: boolean) => void };
};

/**
 * Image picker view: browse Drive (including folders) but only select image files.
 * Prefer DocsView so users can open folders like Photos without a separate step.
 */
export function createBrowsableImageView(picker: Record<string, unknown>): unknown {
  const ViewId = picker.ViewId as { DOCS?: number } | undefined;
  const DocsViewMode = picker.DocsViewMode as { GRID?: number; LIST?: number } | undefined;
  const viewId = ViewId?.DOCS ?? 1;
  const DocsViewCtor = picker.DocsView as
    | (new (viewId?: number) => {
        setIncludeFolders?: (v: boolean) => unknown;
        setSelectFolderEnabled?: (v: boolean) => unknown;
        setMimeTypes?: (t: string) => unknown;
        setMode?: (m: number) => unknown;
      })
    | undefined;

  if (typeof DocsViewCtor === "function") {
    const docsView = new DocsViewCtor(viewId);
    docsView.setIncludeFolders?.(true);
    docsView.setSelectFolderEnabled?.(false);
    docsView.setMimeTypes?.(DRIVE_IMAGE_MIME_TYPES);
    if (DocsViewMode?.GRID != null) docsView.setMode?.(DocsViewMode.GRID);
    return docsView;
  }

  const ViewCtor = picker.View as
    | (new (viewId?: number) => { setMimeTypes?: (t: string) => unknown })
    | undefined;
  if (typeof ViewCtor === "function") {
    const view = new ViewCtor(viewId);
    view.setMimeTypes?.(DRIVE_IMAGE_MIME_TYPES);
    return view;
  }

  throw new Error("Google Picker views failed to load.");
}

export function applyStandardPickerAuth(
  builder: PickerBuilderLike,
  env: DrivePickerEnv,
  accessToken: string
): PickerBuilderLike {
  let next = builder.setAppId(env.appId).setOAuthToken(accessToken).setDeveloperKey(env.apiKey);
  if (typeof window !== "undefined" && typeof next.setOrigin === "function") {
    next = next.setOrigin(window.location.origin) ?? next;
  }
  return next;
}

export function tokenResponseError(res: {
  access_token?: string;
  error?: string;
  error_description?: string;
}): string | null {
  if (res.access_token) return null;
  if (res.error === "popup_closed_by_user" || res.error === "access_denied") {
    return "Google sign-in was cancelled.";
  }
  if (res.error) {
    return res.error_description?.trim() || `Google sign-in failed (${res.error}).`;
  }
  return "Google sign-in was cancelled or failed.";
}

type PageLockState = {
  scrollY: number;
  bodyOverflow: string;
  bodyPosition: string;
  bodyTop: string;
  bodyWidth: string;
  bodyTouchAction: string;
  htmlOverflow: string;
  htmlOverscroll: string;
  rootPointerEvents: string | null;
  rootEl: HTMLElement | null;
};

let pageLockDepth = 0;
let pageLockSaved: PageLockState | null = null;

function getAppRootEl(): HTMLElement | null {
  return (
    (document.getElementById("__next") as HTMLElement | null) ??
    (document.querySelector("body > div") as HTMLElement | null)
  );
}

/**
 * Freeze the app behind Google Picker so mobile scroll/taps don't hit buttons underneath.
 * Safe to call nested (ref-counted). Google's picker nodes are usually appended to `document.body`,
 * so disabling pointer-events on the app root still leaves the picker interactive.
 */
export function lockPageBehindDrivePicker(): void {
  if (typeof document === "undefined") return;
  pageLockDepth += 1;
  if (pageLockDepth > 1) return;

  const body = document.body;
  const html = document.documentElement;
  const rootEl = getAppRootEl();
  pageLockSaved = {
    scrollY: window.scrollY || window.pageYOffset || 0,
    bodyOverflow: body.style.overflow,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyWidth: body.style.width,
    bodyTouchAction: body.style.touchAction,
    htmlOverflow: html.style.overflow,
    htmlOverscroll: html.style.overscrollBehavior,
    rootPointerEvents: rootEl?.style.pointerEvents ?? null,
    rootEl,
  };

  html.style.overflow = "hidden";
  html.style.overscrollBehavior = "none";
  body.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${pageLockSaved.scrollY}px`;
  body.style.width = "100%";
  body.style.touchAction = "none";
  body.dataset.drivePickerOpen = "1";
  if (rootEl) rootEl.style.pointerEvents = "none";
}

export function unlockPageBehindDrivePicker(): void {
  if (typeof document === "undefined") return;
  if (pageLockDepth === 0) return;
  pageLockDepth -= 1;
  if (pageLockDepth > 0 || !pageLockSaved) return;

  const body = document.body;
  const html = document.documentElement;
  const saved = pageLockSaved;
  pageLockSaved = null;

  html.style.overflow = saved.htmlOverflow;
  html.style.overscrollBehavior = saved.htmlOverscroll;
  body.style.overflow = saved.bodyOverflow;
  body.style.position = saved.bodyPosition;
  body.style.top = saved.bodyTop;
  body.style.width = saved.bodyWidth;
  body.style.touchAction = saved.bodyTouchAction;
  delete body.dataset.drivePickerOpen;
  if (saved.rootEl) {
    saved.rootEl.style.pointerEvents = saved.rootPointerEvents ?? "";
  }
  window.scrollTo(0, saved.scrollY);
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (tokenResponse: {
              access_token?: string;
              error?: string;
              error_description?: string;
            }) => void;
          }) => { requestAccessToken: (override?: { prompt?: string }) => void };
        };
      };
      picker?: Record<string, unknown>;
    };
    gapi?: { load: (api: string, cb: () => void) => void };
  }
}
