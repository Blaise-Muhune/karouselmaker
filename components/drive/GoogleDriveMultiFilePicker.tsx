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

type GoogleDriveMultiFilePickerProps = {
  onFilesPicked: (fileIds: string[], accessToken: string) => void;
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
        if (!window.google?.picker) {
          onError?.("Picker failed to load. Refresh and try again.");
          finish();
          return;
        }
        type PickerApi = {
          ViewId?: { DOCS: number };
          Feature?: { MULTISELECT_ENABLED: number };
          DocsView: new (viewId?: number) => {
            setIncludeFolders: (v: boolean) => unknown;
            setSelectFolderEnabled: (v: boolean) => unknown;
            setMimeTypes?: (t: string) => unknown;
          };
          PickerBuilder: new () => {
            setAppId: (id: string) => unknown;
            setOAuthToken: (t: string) => unknown;
            setDeveloperKey: (k: string) => unknown;
            enableFeature: (f: number) => unknown;
            addView: (v: unknown) => unknown;
            setCallback: (cb: (d: GooglePickerResponse) => void) => unknown;
            setMaxItems?: (n: number) => unknown;
            build: () => { setVisible: (v: boolean) => void };
          };
        };
        try {
          const pickerApi = window.google.picker as PickerApi;
          const viewId: number = pickerApi.ViewId?.DOCS ?? 1;
          const DocsViewCtor = pickerApi.DocsView as new (viewId?: number) => {
            setIncludeFolders: (v: boolean) => unknown;
            setSelectFolderEnabled: (v: boolean) => unknown;
          };
          const docsView = new DocsViewCtor(viewId) as unknown as {
            setIncludeFolders: (v: boolean) => { setSelectFolderEnabled: (v: boolean) => unknown };
          };
          const view = docsView.setIncludeFolders(false).setSelectFolderEnabled(false);
          type PickerBuilderInstance = {
            setAppId: (id: string) => PickerBuilderInstance;
            setOAuthToken: (t: string) => PickerBuilderInstance;
            setDeveloperKey: (k: string) => PickerBuilderInstance;
            enableFeature?: (f: number) => PickerBuilderInstance;
            addView: (v: unknown) => PickerBuilderInstance;
            setCallback: (cb: (d: GooglePickerResponse) => void) => PickerBuilderInstance;
            setMaxItems?: (n: number) => PickerBuilderInstance;
            build: () => { setVisible: (v: boolean) => void };
          };
          const builderCtor = pickerApi.PickerBuilder as new () => PickerBuilderInstance;
          let builder: PickerBuilderInstance = new builderCtor()
            .setAppId(appId)
            .setOAuthToken(accessToken)
            .addView(view)
            .setCallback((data: GooglePickerResponse) => {
              finish();
              if (data.action !== "picked" || !data.docs?.length) return;
              const fileIds = data.docs.map((d) => d.id).filter(Boolean);
              if (fileIds.length) onFilesPicked(fileIds, accessToken);
            });
          const b = builder as { enableFeature?: (f: number) => unknown };
          if (typeof b.enableFeature === "function" && pickerApi.Feature?.MULTISELECT_ENABLED != null) {
            builder = b.enableFeature(pickerApi.Feature.MULTISELECT_ENABLED) as typeof builder;
          }
          if (typeof (builder as { setMaxItems?: (n: number) => unknown }).setMaxItems === "function") {
            (builder as { setMaxItems: (n: number) => unknown }).setMaxItems(maxItems);
          }
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
  }, [onFilesPicked, onError, maxItems]);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={openPicker}
      disabled={disabled || pending}
      title="Select image files from Google Drive (multi-select)"
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
