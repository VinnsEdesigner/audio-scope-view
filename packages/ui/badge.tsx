import * as React from "react";
import { YStack, Text, styled } from "tamagui";

const BadgeRoot = styled(YStack, {
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: "$full",
  borderWidth: 1,

  variants: {
    variant: {
      default: {
        backgroundColor: "$neutral",
        color: "$neutralForeground",
        borderColor: "transparent",
      },
      secondary: {
        backgroundColor: "$secondary",
        color: "$secondaryForeground",
        borderColor: "transparent",
      },
      destructive: {
        backgroundColor: "$gray12",
        color: "$gray1",
        borderColor: "transparent",
      },
      outline: {
        backgroundColor: "transparent",
        color: "$foreground",
        borderColor: "$border",
      },
    },
  } as const,

  defaultVariants: {
    variant: "default",
  },
});

export interface BadgeProps extends React.ComponentProps<typeof BadgeRoot> {
  variant?: "default" | "secondary" | "destructive" | "outline";
}

const Badge = React.forwardRef<React.ElementRef<typeof BadgeRoot>, BadgeProps>(
  ({ variant, children, ...props }, ref) => {
    return (
      <BadgeRoot ref={ref} variant={variant} {...props}>
        <Text fontSize={12} fontWeight="500">
          {children}
        </Text>
      </BadgeRoot>
    );
  },
);
Badge.displayName = "Badge";

export { Badge };

