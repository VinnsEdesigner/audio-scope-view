import * as React from "react";
import { XStack, YStack } from "tamagui";

export interface SeparatorProps extends React.ComponentProps<typeof XStack> {
  orientation?: "horizontal" | "vertical";
}

const Separator = React.forwardRef<React.ElementRef<typeof XStack | typeof YStack>, SeparatorProps>(
  ({ orientation = "horizontal", ...props }, ref) => {
    if (orientation === "vertical") {
      return (
        <YStack
          ref={ref}
          width={1}
          height="100%"
          backgroundColor="$border"
          {...props}
        />
      );
    }
    return (
      <XStack
        ref={ref}
        height={1}
        width="100%"
        backgroundColor="$border"
        {...props}
      />
    );
  },
);
Separator.displayName = "Separator";

export { Separator };

