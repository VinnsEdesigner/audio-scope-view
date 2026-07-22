import * as React from "react";
import { Button as TamaguiButton, styled } from "tamagui";

const StyledButton = styled(TamaguiButton, {
  borderRadius: "$md",
  fontWeight: "500",
  cursor: "pointer",
  transition: "all 150ms",
  justifyContent: "center",
  alignItems: "center",
  flexDirection: "row",

  variants: {
    variant: {
      default: {
        backgroundColor: "$neutral",
        color: "$neutralForeground",
        borderWidth: 1,
        borderColor: "$border",
        "&:hover": {
          backgroundColor: "$neutralStrong",
        },
      },
      destructive: {
        backgroundColor: "$gray12",
        color: "$gray1",
        "&:hover": {
          backgroundColor: "$gray11",
        },
      },
      outline: {
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: "$border",
        color: "$foreground",
        "&:hover": {
          backgroundColor: "$accent",
        },
      },
      secondary: {
        backgroundColor: "$secondary",
        color: "$secondaryForeground",
        "&:hover": {
          backgroundColor: "$muted",
        },
      },
      ghost: {
        backgroundColor: "transparent",
        color: "$foreground",
        "&:hover": {
          backgroundColor: "$accent",
        },
      },
      link: {
        backgroundColor: "transparent",
        color: "$primary",
        textDecorationLine: "underline",
      },
    },
    size: {
      sm: { height: 32, paddingHorizontal: 12, fontSize: 12 },
      md: { height: 40, paddingHorizontal: 16, fontSize: 14 },
      lg: { height: 48, paddingHorizontal: 24, fontSize: 16 },
      icon: { height: 40, width: 40, paddingHorizontal: 0 },
    },
  } as const,

  defaultVariants: {
    variant: "default",
    size: "md",
  },
});

export interface ButtonProps extends React.ComponentProps<typeof StyledButton> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "sm" | "md" | "lg" | "icon";
}

const Button = React.forwardRef<React.ElementRef<typeof StyledButton>, ButtonProps>(
  ({ variant, size, ...props }, ref) => {
    return <StyledButton ref={ref} variant={variant} size={size} {...props} />;
  },
);
Button.displayName = "Button";

export { Button };

