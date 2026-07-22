import * as React from "react";
import { YStack, Text, styled } from "tamagui";

const AlertRoot = styled(YStack, {
  borderRadius: "$md",
  padding: "$md",
  borderLeftWidth: 4,

  variants: {
    variant: {
      default: {
        backgroundColor: "$gray2",
        borderLeftColor: "$gray8",
      },
      destructive: {
        backgroundColor: "$gray3",
        borderLeftColor: "$gray12",
      },
    },
  } as const,

  defaultVariants: {
    variant: "default",
  },
});

export interface AlertProps extends React.ComponentProps<typeof AlertRoot> {
  variant?: "default" | "destructive";
}

const Alert = React.forwardRef<React.ElementRef<typeof AlertRoot>, AlertProps>(
  ({ variant, children, ...props }, ref) => {
    return (
      <AlertRoot ref={ref} variant={variant} role="alert" {...props}>
        {children}
      </AlertRoot>
    );
  },
);
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<React.ElementRef<typeof Text>, React.ComponentProps<typeof Text>>(
  ({ ...props }, ref) => (
    <Text ref={ref} fontSize={14} fontWeight="600" color="$gray12" marginBottom={4} {...props} />
  ),
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<React.ElementRef<typeof Text>, React.ComponentProps<typeof Text>>(
  ({ ...props }, ref) => (
    <Text ref={ref} fontSize={14} color="$gray11" {...props} />
  ),
);
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };

