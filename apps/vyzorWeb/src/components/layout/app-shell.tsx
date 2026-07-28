import * as React from "react";
import { XStack, YStack, styled } from "tamagui";
import { ContentArea } from "./content-area";

const AppShellRoot = styled(YStack, {
  flex: 1,
  height: "100vh",
  backgroundColor: "$gray1",
});

const AppShellBody = styled(XStack, {
  flex: 1,
  overflow: "hidden",
});

export interface AppShellProperties {
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  children?: React.ReactNode;
}

function AppShell({ header, sidebar, children }: AppShellProperties): React.ReactElement {
  return (
    <AppShellRoot>
      {header && header}
      <AppShellBody>
        {sidebar && sidebar}
        <ContentArea>{children}</ContentArea>
      </AppShellBody>
    </AppShellRoot>
  );
}

AppShell.displayName = "AppShell";

export { AppShell, AppShellRoot, AppShellBody };
