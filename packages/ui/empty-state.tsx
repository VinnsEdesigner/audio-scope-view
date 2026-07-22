import * as React from "react";
import { YStack, Text, styled } from "tamagui";

const EmptyStateRoot = styled(YStack, {
  alignItems: "center",
  justifyContent: "center",
  gap: "$sm",
  padding: "$lg",
});

export interface EmptyStateProperties {
  children?: React.ReactNode;
  title?: string;
  description?: string;
}

function EmptyState({ children, title, description }: EmptyStateProperties): React.ReactElement {
  return (
    <EmptyStateRoot>
      {title && (
        <Text fontSize={16} fontWeight="600" color="$gray12">
          {title}
        </Text>
      )}
      {description && (
        <Text fontSize={14} color="$gray11" textAlign="center">
          {description}
        </Text>
      )}
      {children}
    </EmptyStateRoot>
  );
}

EmptyState.displayName = "EmptyState";

export { EmptyState, EmptyStateRoot };
