import * as React from "react";
import { Toggle as TamaguiToggle, styled } from "tamagui";

const StyledToggle = styled(TamaguiToggle, {
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
      sm: { height: 32, paddingHorizontal: 8 },
      md: { height: 36, paddingHorizontal: 12 },
      lg: { height: 40, paddingHorizontal: 16 },
    },
  } as const,

  defaultVariants: {
    variant: "default",
    size: "md",
  },
});

export interface ToggleProps extends React.ComponentProps<typeof StyledToggle> {
  variant?: "default" | "outline";
  size?: "sm" | "md" | "lg";
}

const Toggle = React.forwardRef<React.ElementRef<typeof StyledToggle>, ToggleProps>(
  ({ variant, size, ...props }, ref) => {
    return <StyledToggle ref={ref} variant={variant} size={size} {...props} />;
  },
);
Toggle.displayName = "Toggle";

export { Toggle };

