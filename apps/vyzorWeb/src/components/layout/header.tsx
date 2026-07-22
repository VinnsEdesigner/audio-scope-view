import * as React from "react";
import { XStack, Text, styled } from "tamagui";

const HeaderRoot = styled(XStack, {
  height: 56,
  paddingHorizontal: "$md",
  alignItems: "center",
  justifyContent: "space-between",
  backgroundColor: "$gray1",
  borderBottomWidth: 1,
  borderBottomColor: "$border",
});

const HeaderTitle = styled(Text, {
  fontSize: 18,
  fontWeight: "600",
  color: "$gray12",
});

const HeaderNav = styled(XStack, {
  alignItems: "center",
  gap: "$sm",
});

export interface HeaderProperties {
  title?: string;
  children?: React.ReactNode;
}

function Header({ title = "Audio Scope View", children }: HeaderProperties): React.ReactElement {
  return (
    <HeaderRoot>
      <HeaderTitle>{title}</HeaderTitle>
      {children && <HeaderNav>{children}</HeaderNav>}
    </HeaderRoot>
  );
}

Header.displayName = "Header";

export { Header, HeaderRoot, HeaderTitle, HeaderNav };
