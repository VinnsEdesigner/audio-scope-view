import * as React from "react";
import { ToggleGroup as TamaguiToggleGroup, styled, XStack } from "tamagui";

const ToggleGroupRoot = styled(XStack, {
  flexDirection: "row",
  alignItems: "center",
  gap: 4,
});

const ToggleGroupItem = styled(TamaguiToggleGroup.Item, {
  cursor: "pointer",
  transition: "all 150ms",

  variants: {
    variant: {
      default: {
        backgroundColor: "transparent",
      },
      outline: {
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: "$border",
      },
    },
    size: {
      sm: { height: 32, paddingHorizontal: 8, fontSize: 12 },
      md: { height: 36, paddingHorizontal: 12, fontSize: 14 },
      lg: { height: 40, paddingHorizontal: 16, fontSize: 16 },
    },
  } as const,
});

export interface ToggleGroupProps extends React.ComponentProps<typeof ToggleGroupRoot> {
  type?: "single" | "multiple";
}

const ToggleGroup = React.forwardRef<React.ElementRef<typeof ToggleGroupRoot>, ToggleGroupProps>(
  ({ children, ...props }, ref) => {
    return (
      <ToggleGroupRoot ref={ref} {...props}>
        {children}
      </ToggleGroupRoot>
    );
  },
);
ToggleGroup.displayName = "ToggleGroup";

const ToggleGroupItem_ = React.forwardRef<React.ElementRef<typeof ToggleGroupItem>, React.ComponentProps<typeof ToggleGroupItem>>(
  ({ value, children, ...props }, ref) => {
    return (
      <TamaguiToggleGroup.Item value={value}>
        <ToggleGroupItem ref={ref} value={value} {...props}>
          {children}
        </ToggleGroupItem>
      </TamaguiToggleGroup.Item>
    );
  },
);
ToggleGroupItem_.displayName = "ToggleGroupItem";

export { ToggleGroup, ToggleGroupItem_ as ToggleGroupItem };

