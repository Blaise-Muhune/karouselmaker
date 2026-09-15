"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ImageIcon, Loader2Icon } from "lucide-react";

const GSI_URL = "https://accounts.google.com/gsi/client";
const GAPI_URL = "https://apis.google.com/js/api.js";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const IMAGE_MIME_TYPES =
  "image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif";

type GooglePickerDoc = { id: string; name?: string };
type GooglePickerResponse = { action: string; docs?: GooglePickerDoc[] };

function loadScript(src: string): Promise<void> {
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

type Builder = {
  setAppId: (id: string) => Builder;
  setOAuthToken: (t: string) => Builder;
  setDeveloperKey: (k: string) => Builder;
  setTitle?: (t: string) => Builder;
  enableFeature: (f: string | number) => Builder;
  addView: (v: unknown) => Builder;
  setCallback: (cb: (d: GooglePickerResponse) => void) => Builder;
  setMaxItems?: (n: number) => Builder;
  build: () => { setVisible: (v: boolean) => void };
};

/** Matches Google docs: Feature.MULTISELECT_ENABLED = "multiselectEnabled". */
function resolveMultiselectFeature(picker: Record<string, unknown>): string | number {
  const feature = picker.Feature as { MULTISELECT_ENABLED?: string | number } | undefined;
  if (feature?.MULTISELECT_ENABLED != null) return feature.MULTISELECT_ENABLED;
  return "multiselectEnabled";
}

/**
 * Build an image view the same way as Google's picker sample (`View` + mime filter).
 * Falls back to DocsView when `View` is unavailable.
 */
function createImageDocsView(picker: Record<string, unknown>): unknown {
  const ViewId = picker.ViewId as { DOCS?: number } | undefined;
  const viewId = ViewId?.DOCS ?? 1;
  const ViewCtor = picker.View as
    | (new (viewId?: number) => { setMimeTypes?: (t: string) => unknown })
    | undefined;
  if (typeof ViewCtor === "function") {
    const view = new ViewCtor(viewId);
    view.setMimeTypes?.(IMAGE_MIME_TYPES);
    return view;
  }
  const DocsViewCtor = picker.DocsView as new (viewId?: number) => {
    setIncludeFolders?: (v: boolean) => unknown;
    setSelectFolderEnabled?: (v: boolean) => unknown;
    setMimeTypes?: (t: string) => unknown;
  };
  const docsView = new DocsViewCtor(viewId);
  docsView.setIncludeFolders?.(false);
  docsView.setSelectFolderEnabled?.(false);
  docsView.setMimeTypes?.(IMAGE_MIME_TYPES);
  return docsView;
}

type GoogleDriveMultiFilePickerProps = {
  onFilesPicked: (fileIds: string[], accessToken: string) => void | Promise<void>;
  onError?: (message: string) => void;
  variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm";
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  maxItems?: number;
};

export function GoogleDriveMultiFilePicker({
  onFilesPicked,
  onError,
  variant = "outline",
  size = "sm",
  className,
  children,
  disabled = false,
  maxItems = 50,
}: GoogleDriveMultiFilePickerProps) {
  const [pending, setPending] = useState(false);

  const openPicker = useCallback(async () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const appId = process.env.NEXT_PUBLIC_GOOGLE_APP_ID;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

    if (!clientId || !appId) {
      onError?.("Google Drive is not configured.");
      return;
    }

    setPending(true);
    const finish = () => setPending(false);

    try {
      await loadScript(GSI_URL);
      await loadScript(GAPI_URL);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Failed to load Google scripts.");
      finish();
      return;
    }

    if (!window.google?.accounts?.oauth2) {
      onError?.("Google sign-in failed to load. Refresh and try again.");
      finish();
      return;
    }

    const showPicker = (accessToken: string) => {
      if (!window.gapi) {
        onError?.("Picker failed to load. Refresh and try again.");
        finish();
        return;
      }
      window.gapi.load("picker", () => {
        const picker = window.google?.picker as Record<string, unknown> | undefined;
        if (!picker) {
          onError?.("Picker failed to load. Refresh and try again.");
          finish();
          return;
        }
        try {
          const BuilderCtor = picker.PickerBuilder as unknown as new () => Builder;
          const docsView = createImageDocsView(picker);
          const multiselect = resolveMultiselectFeature(picker);

          // Order matches Google's sample: enable MULTISELECT before views/callback.
          let builder = new BuilderCtor()
            .enableFeature(multiselect)
            .setAppId(appId)
            .setOAuthToken(accessToken)
            .addView(docsView)
            .setCallback((data: GooglePickerResponse) => {
              void (async () => {
                if (data.action !== "picked" || !data.docs?.length) {
                  finish();
                  return;
                }
                const fileIds = data.docs.map((d) => d.id).filter(Boolean);
                try {
                  if (fileIds.length) await Promise.resolve(onFilesPicked(fileIds, accessToken));
                } catch (e) {
                  onError?.(e instanceof Error ? e.message : "Drive import failed.");
                } finally {
                  finish();
                }
              })();
            });

          builder = builder.setTitle?.("Select one or more images") ?? builder;
          if (typeof builder.setMaxItems === "function") {
            builder = builder.setMaxItems(maxItems) ?? builder;
          }
          if (apiKey) builder = builder.setDeveloperKey(apiKey);
          builder.build().setVisible(true);
        } catch (e) {
          onError?.(e instanceof Error ? e.message : "Failed to open Drive picker");
          finish();
        }
      });
    };

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (res) => {
        if (res.access_token) {
          showPicker(res.access_token);
        } else {
          onError?.("Google sign-in was cancelled or failed.");
          finish();
        }
      },
    });
    tokenClient.requestAccessToken();
  }, [onFilesPicked, onError, maxItems]);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={openPicker}
      disabled={disabled || pending}
      title="Select multiple image files from Google Drive"
    >
      {pending ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        children ?? (
          <>
            <ImageIcon className="size-4" />
            Pick images from Drive
          </>
        )
      )}
    </Button>
  );
}
