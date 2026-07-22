import * as React from "react";
import { Button as TamaguiButton, Spinner, styled } from "tamagui";

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

const LoadingContainer = styled(TamaguiButton, {
  justifyContent: "center",
  alignItems: "center",
  gap: "$sm",
  opacity: 0.7,
  cursor: "wait",

  variants: {
    size: {
      sm: { height: 32, paddingHorizontal: 12 },
      md: { height: 40, paddingHorizontal: 16 },
      lg: { height: 48, paddingHorizontal: 24 },
      icon: { height: 40, width: 40 },
    },
  } as const,

  defaultVariants: {
    size: "md",
  },
});

export interface ButtonProps extends React.ComponentProps<typeof StyledButton> {
  variant?: "default" | "destructive" | "outline" | "outlined" | "secondary" | "ghost" | "link";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
}

const Button = React.forwardRef<React.ElementRef<typeof StyledButton>, ButtonProps>(
  ({ variant, size, loading, children, disabled, ...props }, ref) => {
    if (loading) {
      // Spinner size based on button size - tamagui Spinner uses "small" or "large"
      const spinnerSizes: Record<string, "small" | "large"> = { 
        sm: "small", 
        md: "small", 
        lg: "large", 
        icon: "small" 
      };
      const spinnerSize = spinnerSizes[size ?? "md"];

      return (
        <LoadingContainer
          ref={ref}
          size={size}
          disabled={true}
          aria-disabled={true}
        >
          <Spinner size={spinnerSize} />
          {children}
        </LoadingContainer>
      );
    }

    return (
      <StyledButton
        ref={ref}
        variant={variant}
        size={size}
        disabled={disabled}
        {...props}
      >
        {children}
      </StyledButton>
    );
  },
);
Button.displayName = "Button";

export { Button };

