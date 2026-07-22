import * as React from "react";
import { YStack, styled } from "tamagui";

const ContentRoot = styled(YStack, {
  flex: 1,
  height: "100%",
  backgroundColor: "$gray1",
  padding: "$md",
  overflow: "auto",
});

export interface ContentAreaProperties {
  children?: React.ReactNode;
}

function ContentArea({ children }: ContentAreaProperties): React.ReactElement {
  return <ContentRoot>{children}</ContentRoot>;
}

ContentArea.displayName = "ContentArea";

export { ContentArea, ContentRoot };
