"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ImageIcon, Loader2Icon } from "lucide-react";

const GSI_URL = "https://accounts.google.com/gsi/client";
const GAPI_URL = "https://apis.google.com/js/api.js";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

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

const IMAGE_MIME_TYPES = "image/jpeg,image/jpg,image/png,image/webp,image/gif";

type GoogleDriveFilePickerProps = {
  onFilePicked: (fileId: string, accessToken: string) => void;
  onError?: (message: string) => void;
  variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm";
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
};

export function GoogleDriveFilePicker({
  onFilePicked,
  onError,
  variant = "outline",
  size = "sm",
  className,
  children,
  disabled = false,
}: GoogleDriveFilePickerProps) {
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
        if (!(window as unknown as { google?: { picker?: unknown } }).google?.picker) {
          onError?.("Picker failed to load. Refresh and try again.");
          finish();
          return;
        }
        try {
          const pickerApi = (window as unknown as { google?: { picker?: unknown } }).google?.picker as {
            ViewId?: { DOCS: number };
            DocsView: new (viewId?: number) => {
              setMimeTypes: (mimes: string) => unknown;
            };
            PickerBuilder: new () => {
              setAppId: (id: string) => unknown;
              setOAuthToken: (t: string) => unknown;
              setDeveloperKey: (k: string) => unknown;
              addView: (v: unknown) => unknown;
              setCallback: (cb: (d: GooglePickerResponse) => void) => unknown;
              build: () => { setVisible: (v: boolean) => void };
            };
          };
          const viewId = pickerApi.ViewId?.DOCS ?? 1;
          const docsView = new (pickerApi.DocsView as new (viewId?: number) => { setMimeTypes: (m: string) => unknown })(viewId)
            .setMimeTypes(IMAGE_MIME_TYPES);

          const PickerBuilderCtor = pickerApi.PickerBuilder as new () => {
            setAppId: (id: string) => unknown;
            setOAuthToken: (t: string) => unknown;
            setDeveloperKey: (k: string) => unknown;
            addView: (v: unknown) => unknown;
            setCallback: (cb: (d: GooglePickerResponse) => void) => unknown;
            build: () => { setVisible: (v: boolean) => void };
          };
          // @ts-expect-error - Google Picker constructor from external script
          const builder = new PickerBuilderCtor()
            .setAppId(appId)
            .setOAuthToken(accessToken)
            .addView(docsView)
            .setCallback((data: GooglePickerResponse) => {
              finish();
              if (data.action !== "picked" || !data.docs?.length) return;
              const fileId = data.docs[0]!.id;
              if (fileId) onFilePicked(fileId, accessToken);
            });

          if (apiKey) builder.setDeveloperKey(apiKey);
          builder.build().setVisible(true);
        } catch (e) {
          onError?.(e instanceof Error ? e.message : "Failed to open Drive picker");
          finish();
        }
      });
    };

    const tokenClient = (window as unknown as { google: { accounts: { oauth2: { initTokenClient: (c: { client_id: string; scope: string; callback: (r: { access_token: string }) => void }) => { requestAccessToken: () => void }; }; }; }; }).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (res) => {
        if (res.access_token) showPicker(res.access_token);
        else {
          onError?.("Google sign-in was cancelled or failed.");
          finish();
        }
      },
    });
    tokenClient.requestAccessToken();
  }, [onError]);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={openPicker}
      disabled={disabled || pending}
      title="Choose one image from Google Drive"
    >
      {pending ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        children ?? (
          <>
            <ImageIcon className="size-4" />
            From Drive
          </>
        )
      )}
    </Button>
  );
}
