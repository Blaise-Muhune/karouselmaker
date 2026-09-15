"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FolderOpenIcon, Loader2Icon } from "lucide-react";

const GSI_URL = "https://accounts.google.com/gsi/client";
const GAPI_URL = "https://apis.google.com/js/api.js";
/** drive.file only covers items the user opens in Picker — folder pick alone cannot list children. */
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

type GooglePickerDoc = { id: string; name?: string; mimeType?: string };
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
      picker?: Record<string, unknown>;
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

type PickerApi = {
  ViewId?: { DOCS?: number; FOLDERS?: number };
  Feature?: { MULTISELECT_ENABLED?: number; NAV_HIDDEN?: number };
  DocsViewMode?: { LIST?: number; GRID?: number };
  DocsView: new (viewId?: number) => {
    setIncludeFolders: (v: boolean) => unknown;
    setSelectFolderEnabled: (v: boolean) => unknown;
    setParent?: (id: string) => unknown;
    setMimeTypes?: (t: string) => unknown;
    setMode?: (m: number) => unknown;
  };
  PickerBuilder: new () => {
    setAppId: (id: string) => unknown;
    setOAuthToken: (t: string) => unknown;
    setDeveloperKey: (k: string) => unknown;
    setTitle?: (t: string) => unknown;
    enableFeature?: (f: number) => unknown;
    addView: (v: unknown) => unknown;
    setCallback: (cb: (d: GooglePickerResponse) => void) => unknown;
    setMaxItems?: (n: number) => unknown;
    build: () => { setVisible: (v: boolean) => void };
  };
};

type GoogleDriveFolderPickerProps = {
  /**
   * Called after the user picks a folder, then selects image files inside it.
   * (drive.file cannot list folder children from folder id alone.)
   */
  onFilesPicked: (fileIds: string[], accessToken: string) => void | Promise<void>;
  onError?: (message: string) => void;
  variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm";
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  maxItems?: number;
};

export function GoogleDriveFolderPicker({
  onFilesPicked,
  onError,
  variant = "outline",
  size = "sm",
  className,
  children,
  disabled = false,
  maxItems = 50,
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

    const showImagePickerInFolder = (accessToken: string, folderId: string, pickerApi: PickerApi) => {
      try {
        const docsViewId = pickerApi.ViewId?.DOCS ?? 1;
        const docsView = new pickerApi.DocsView(docsViewId);
        docsView.setIncludeFolders(false);
        docsView.setSelectFolderEnabled(false);
        docsView.setParent?.(folderId);
        docsView.setMimeTypes?.(
          "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/jpg"
        );
        if (pickerApi.DocsViewMode?.GRID != null) {
          docsView.setMode?.(pickerApi.DocsViewMode.GRID);
        }

        type Builder = {
          setAppId: (id: string) => Builder;
          setOAuthToken: (t: string) => Builder;
          setDeveloperKey: (k: string) => Builder;
          setTitle?: (t: string) => Builder;
          enableFeature?: (f: number) => Builder;
          addView: (v: unknown) => Builder;
          setCallback: (cb: (d: GooglePickerResponse) => void) => Builder;
          setMaxItems?: (n: number) => Builder;
          build: () => { setVisible: (v: boolean) => void };
        };
        const BuilderCtor = pickerApi.PickerBuilder as unknown as new () => Builder;
        let builder = new BuilderCtor()
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
                else onError?.("No images selected in that folder.");
              } catch (e) {
                onError?.(e instanceof Error ? e.message : "Drive import failed.");
              } finally {
                finish();
              }
            })();
          });

        builder = builder.setTitle?.("Select images in this folder") ?? builder;
        if (typeof builder.enableFeature === "function" && pickerApi.Feature?.MULTISELECT_ENABLED != null) {
          builder = builder.enableFeature(pickerApi.Feature.MULTISELECT_ENABLED);
        }
        if (typeof builder.setMaxItems === "function") {
          builder = builder.setMaxItems(maxItems) ?? builder;
        }
        if (apiKey) builder = builder.setDeveloperKey(apiKey);
        builder.build().setVisible(true);
      } catch (e) {
        onError?.(e instanceof Error ? e.message : "Failed to open folder images picker");
        finish();
      }
    };

    const showFolderPicker = (accessToken: string) => {
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
        try {
          const pickerApi = window.google.picker as unknown as PickerApi;
          const folderViewId = pickerApi.ViewId?.FOLDERS ?? pickerApi.ViewId?.DOCS ?? 1;
          const folderView = new pickerApi.DocsView(folderViewId);
          folderView.setIncludeFolders(true);
          folderView.setSelectFolderEnabled(true);
          if (pickerApi.DocsViewMode?.LIST != null) {
            folderView.setMode?.(pickerApi.DocsViewMode.LIST);
          }

          type Builder = {
            setAppId: (id: string) => Builder;
            setOAuthToken: (t: string) => Builder;
            setDeveloperKey: (k: string) => Builder;
            setTitle?: (t: string) => Builder;
            addView: (v: unknown) => Builder;
            setCallback: (cb: (d: GooglePickerResponse) => void) => Builder;
            build: () => { setVisible: (v: boolean) => void };
          };
          const BuilderCtor = pickerApi.PickerBuilder as unknown as new () => Builder;
          let builder = new BuilderCtor()
            .setAppId(appId)
            .setOAuthToken(accessToken)
            .addView(folderView)
            .setCallback((data: GooglePickerResponse) => {
              if (data.action !== "picked" || !data.docs?.length) {
                finish();
                return;
              }
              const folderId = data.docs[0]?.id;
              if (!folderId) {
                onError?.("Pick a folder, then select the images inside it.");
                finish();
                return;
              }
              // Second step: grant drive.file access to each image the user selects.
              showImagePickerInFolder(accessToken, folderId, pickerApi);
            });

          builder = builder.setTitle?.("Choose a Drive folder") ?? builder;
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
          showFolderPicker(res.access_token);
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
      title="Choose a Drive folder, then select the images inside it"
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
