"use client";

import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { ImageIcon, Loader2Icon } from "lucide-react";
import {
  DRIVE_FILE_SCOPE,
  GAPI_URL,
  GSI_URL,
  applyStandardPickerAuth,
  createBrowsableImageView,
  loadScript,
  lockPageBehindDrivePicker,
  resolveDrivePickerEnv,
  resolveMultiselectFeature,
  tokenResponseError,
  unlockPageBehindDrivePicker,
  type GooglePickerResponse,
  type PickerBuilderLike,
} from "@/components/drive/drivePickerShared";

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

  useEffect(() => {
    if (!pending) return;
    lockPageBehindDrivePicker();
    return () => unlockPageBehindDrivePicker();
  }, [pending]);

  const openPicker = useCallback(async () => {
    const env = resolveDrivePickerEnv();
    if ("error" in env) {
      onError?.(env.error);
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
          const BuilderCtor = picker.PickerBuilder as unknown as new () => PickerBuilderLike;
          const docsView = createBrowsableImageView(picker);
          const multiselect = resolveMultiselectFeature(picker);

          let builder = new BuilderCtor().enableFeature(multiselect);
          builder = applyStandardPickerAuth(builder, env, accessToken)
            .addView(docsView)
            .setCallback((data: GooglePickerResponse) => {
              void (async () => {
                if (data.action !== "picked" || !data.docs?.length) {
                  finish();
                  return;
                }
                const fileIds = data.docs
                  .filter((d) => !d.mimeType?.includes("folder"))
                  .map((d) => d.id)
                  .filter(Boolean);
                try {
                  if (fileIds.length) await Promise.resolve(onFilesPicked(fileIds, accessToken));
                  else onError?.("Select image files (not folders), then Select.");
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
          builder.build().setVisible(true);
        } catch (e) {
          onError?.(e instanceof Error ? e.message : "Failed to open Drive picker");
          finish();
        }
      });
    };

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: env.clientId,
      scope: DRIVE_FILE_SCOPE,
      callback: (res) => {
        const err = tokenResponseError(res);
        if (err) {
          onError?.(err);
          finish();
          return;
        }
        showPicker(res.access_token!);
      },
    });
    tokenClient.requestAccessToken();
  }, [onFilesPicked, onError, maxItems]);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={openPicker}
        disabled={disabled || pending}
        title="Select multiple images from Google Drive"
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
      {pending &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            aria-hidden
            className="fixed inset-0 z-[900] bg-black/25"
            style={{ touchAction: "none" }}
            onTouchMove={(e) => e.preventDefault()}
            onClick={(e) => e.preventDefault()}
          />,
          document.body
        )}
    </>
  );
}
