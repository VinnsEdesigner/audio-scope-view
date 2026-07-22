/**
 * Mobile Hook - Detects mobile/tablet breakpoints
 * Uses ui-store for state management
 */

import { useEffect } from "react";
import { useUIStore } from "../store";

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

export function useIsMobile() {
  const { isMobile, setIsMobile } = useUIStore();

  useEffect(() => {
    const mql = globalThis.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    const onChange = () => {
      setIsMobile(globalThis.innerWidth < MOBILE_BREAKPOINT);
    };

    mql.addEventListener("change", onChange);
    setIsMobile(globalThis.innerWidth < MOBILE_BREAKPOINT);

    return () => mql.removeEventListener("change", onChange);
  }, [setIsMobile]);

  return Boolean(isMobile);
}

export function useIsTablet() {
  const { isTablet, setIsTablet } = useUIStore();

  useEffect(() => {
    const mql = globalThis.matchMedia(
      `(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${TABLET_BREAKPOINT - 1}px)`,
    );

    const onChange = () => {
      setIsTablet(
        globalThis.innerWidth >= MOBILE_BREAKPOINT && globalThis.innerWidth < TABLET_BREAKPOINT,
      );
    };

    mql.addEventListener("change", onChange);
    onChange();

    return () => mql.removeEventListener("change", onChange);
  }, [setIsTablet]);

  return Boolean(isTablet);
}
