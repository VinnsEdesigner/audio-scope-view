import * as React from "react";
import { YStack, XStack, Text, styled } from "tamagui";

const Card = styled(YStack, {
  backgroundColor: "$gray1",
  borderRadius: "$lg",
  padding: "$md",
  borderWidth: 1,
  borderColor: "$border",
  shadowRadius: 4,
  shadowColor: "black",
  shadowOpacity: 0.05,
  shadowOffset: { width: 0, height: 2 },
});

const CardHeader = React.forwardRef<React.ElementRef<typeof YStack>, React.ComponentProps<typeof YStack>>(
  ({ ...props }, ref) => (
    <YStack ref={ref} flexDirection="column" gap={6} paddingBottom="$md" {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<React.ElementRef<typeof Text>, React.ComponentProps<typeof Text>>(
  ({ ...props }, ref) => (
    <Text ref={ref} fontSize={18} fontWeight="600" color="$gray12" {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<React.ElementRef<typeof Text>, React.ComponentProps<typeof Text>>(
  ({ ...props }, ref) => (
    <Text ref={ref} fontSize={14} color="$gray9" {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<React.ElementRef<typeof YStack>, React.ComponentProps<typeof YStack>>(
  ({ ...props }, ref) => (
    <YStack ref={ref} paddingTop="$md" {...props} />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<React.ElementRef<typeof XStack>, React.ComponentProps<typeof XStack>>(
  ({ ...props }, ref) => (
    <XStack ref={ref} alignItems="center" paddingTop="$md" {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };

