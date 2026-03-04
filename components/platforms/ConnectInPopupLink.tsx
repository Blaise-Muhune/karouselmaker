"use client";

const POPUP_SPEC = "width=600,height=700,scrollbars=yes";

/**
 * Renders a link that opens the href in a popup (for OAuth connect).
 * Used so the main window (e.g. carousel editor) is not navigated away and the user doesn’t lose their video/export.
 */
export function ConnectInPopupLink({
  href,
  children,
  className,
  title,
  "aria-label": ariaLabel,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.open(href, "oauth", POPUP_SPEC)}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}
