import * as React from "react";
import { styled, YStack } from "tamagui";

const Skeleton = styled(YStack, {
  borderRadius: "$md",
  backgroundColor: "$gray4",
  opacity: 0.6,

  variants: {
    variant: {
      circle: {
        borderRadius: "$full",
      },
      rect: {
        borderRadius: "$md",
      },
      text: {
        borderRadius: "$sm",
        height: 16,
      },
    },
  } as const,

  defaultVariants: {
    variant: "rect",
  },
});

export { Skeleton };

