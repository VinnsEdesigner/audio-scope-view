// use-mobile.tsx — RN port of the web hook. The web version uses matchMedia
// against viewport widths; RN has no window dimensions in the CSS sense, so
// this uses useWindowDimensions + a breakpoint check. The results still land
// in the ui-store (isMobile/isTablet) so the ported transport hooks that read
// those flags work unchanged.
import { useEffect } from "react";
import { useWindowDimensions } from "react-native";
import { useUIStore } from "../store";

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

export function useIsMobile() {
  const { setIsMobile } = useUIStore();
  const { width } = useWindowDimensions();

  const isMobile = width < MOBILE_BREAKPOINT;
  useEffect(() => {
    setIsMobile(isMobile);
  }, [isMobile, setIsMobile]);

  return isMobile;
}

export function useIsTablet() {
  const { setIsTablet } = useUIStore();
  const { width } = useWindowDimensions();

  const isTablet = width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;
  useEffect(() => {
    setIsTablet(isTablet);
  }, [isTablet, setIsTablet]);

  return isTablet;
}
