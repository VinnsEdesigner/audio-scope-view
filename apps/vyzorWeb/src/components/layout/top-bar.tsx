/**
 * TopBar - Slim top bar with hamburger (mobile) and current section title.
 * Neutral tokens only.
 */

import * as React from "react";
import { useLocation } from "react-router-dom";
import { styled, XStack, Text } from "tamagui";
import { Menu } from "lucide-react";

const Bar = styled(XStack, {
  height: 52,
  paddingHorizontal: "$md",
  alignItems: "center",
  gap: "$sm",
  backgroundColor: "$gray1",
  borderBottomWidth: 1,
  borderBottomColor: "$gray5",
});

const IconButton = styled(XStack, {
  width: 36,
  height: 36,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "$md",
  cursor: "pointer",
  hoverStyle: { backgroundColor: "$gray3" },
});

function titleFor(pathname: string): string {
  if (pathname === "/" || pathname === "") return "Dashboard";
  if (pathname.startsWith("/scope")) return "Scopes";
  if (pathname.startsWith("/api-keys")) return "API Keys";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Vyzor";
}

export interface TopBarProperties {
  onMenuToggle?: () => void;
  showMenu?: boolean;
}

export function TopBar({ onMenuToggle, showMenu }: TopBarProperties): React.ReactElement {
  const { pathname } = useLocation();
  const title = titleFor(pathname);

  return (
    <Bar>
      {showMenu && (
        <IconButton onPress={onMenuToggle} role="button" aria-label="Toggle menu">
          <Menu size={18} color="var(--color-gray12)" />
        </IconButton>
      )}
      <Text fontSize={15} fontWeight="600" color="$gray12">
        {title}
      </Text>
    </Bar>
  );
}

TopBar.displayName = "TopBar";