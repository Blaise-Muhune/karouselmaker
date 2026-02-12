"use client";

import { useEffect, useState } from "react";

/** True when app is running as PWA (standalone) - e.g. installed on iOS home screen. Downloads often fail in this mode. */
export function useIsStandalonePWA(): boolean {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone =
      typeof window !== "undefined" &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as { standalone?: boolean }).standalone === true);
    setIsStandalone(standalone);
  }, []);

  return isStandalone;
}
