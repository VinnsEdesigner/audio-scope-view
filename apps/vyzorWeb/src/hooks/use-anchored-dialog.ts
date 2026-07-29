import * as React from "react";

export function useAnchoredDialog() {
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | undefined>();

  const openAtCurrentTarget = React.useCallback((event: React.MouseEvent) => {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    setAnchorRect(rect);
  }, []);

  const close = React.useCallback(() => {
    setAnchorRect(undefined);
  }, []);

  return {
    anchorRect,
    openAtCurrentTarget,
    close,
  };
}
