"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FolderOpenIcon, Loader2Icon } from "lucide-react";

const GSI_URL = "https://accounts.google.com/gsi/client";
const GAPI_URL = "https://apis.google.com/js/api.js";
/** drive.file = only files/folders the user opens with this app (e.g. folder picked in Picker). Avoids restricted-scope verification. */
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

type GooglePickerDoc = { id: string; name?: string };
type GooglePickerResponse = { action: string; docs?: GooglePickerDoc[] };

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (tokenResponse: { access_token: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
      picker?: {
        PickerBuilder: new () => {
          setAppId: (id: string) => unknown;
          setOAuthToken: (token: string) => unknown;
          setDeveloperKey: (key: string) => unknown;
          addView: (view: unknown) => unknown;
          setCallback: (cb: (data: GooglePickerResponse) => void) => unknown;
          build: () => { setVisible: (visible: boolean) => void };
        };
        DocsView: new (viewId?: number) => {
          setIncludeFolders: (include: boolean) => unknown;
          setSelectFolderEnabled: (enabled: boolean) => unknown;
        };
        ViewId?: { DOCS: number };
      };
    };
    gapi?: { load: (api: string, cb: () => void) => void };
  }
}

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

type GoogleDriveFolderPickerProps = {
  onFolderPicked: (folderId: string, accessToken: string) => void;
  onError?: (message: string) => void;
  variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm";
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
};

export function GoogleDriveFolderPicker({
  onFolderPicked,
  onError,
  variant = "outline",
  size = "sm",
  className,
  children,
  disabled = false,
}: GoogleDriveFolderPickerProps) {
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
        if (!window.google?.picker) {
          onError?.("Picker failed to load. Refresh and try again.");
          finish();
          return;
        }
type PickerApi = {
  ViewId?: { DOCS: number };
  DocsView: new (viewId?: number) => {
    setIncludeFolders: (v: boolean) => unknown;
    setSelectFolderEnabled: (v: boolean) => unknown;
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

        try {
          const pickerApi = window.google.picker as PickerApi;
          const viewId = pickerApi.ViewId?.DOCS ?? 1;
          const DocsViewCtor = pickerApi.DocsView as new (viewId?: number) => {
            setIncludeFolders: (v: boolean) => { setSelectFolderEnabled: (v: boolean) => unknown };
            setSelectFolderEnabled: (v: boolean) => unknown;
          };
          const docsView = new DocsViewCtor(viewId)
            .setIncludeFolders(true)
            .setSelectFolderEnabled(true);

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
              const folderId = data.docs[0]!.id;
              if (folderId) onFolderPicked(folderId, accessToken);
            });

          if (apiKey) builder.setDeveloperKey(apiKey);
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
  }, [onError]);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={openPicker}
      disabled={disabled || pending}
      title="Choose a folder from Google Drive to import images"
    >
      {pending ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        children ?? (
          <>
            <FolderOpenIcon className="size-4" />
            From Drive
          </>
        )
      )}
    </Button>
  );
}
