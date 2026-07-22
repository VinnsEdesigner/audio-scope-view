import * as React from "react";
import { TextArea as TamaguiTextArea, YStack, Text } from "tamagui";

export interface TextareaProps extends React.ComponentProps<typeof TamaguiTextArea> {
  label?: string;
  error?: string;
}

const Textarea = React.forwardRef<React.ElementRef<typeof TamaguiTextArea>, TextareaProps>(
  ({ label, error, ...props }, ref) => {
    return (
      <YStack gap={4}>
        {label && (
          <Text fontSize={14} fontWeight="500" color="$gray11">
            {label}
          </Text>
        )}
        <TamaguiTextArea
          ref={ref}
          borderWidth={1}
          borderColor={error ? "$gray12" : "$border"}
          backgroundColor="$gray1"
          padding={12}
          fontSize={14}
          borderRadius="$md"
          color="$gray12"
          placeholderTextColor="$gray9"
          minHeight={100}
          {...props}
        />
        {error && (
          <Text fontSize={12} color="$gray11">
            {error}
          </Text>
        )}
      </YStack>
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };

