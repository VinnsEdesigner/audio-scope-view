import * as React from "react";
import { Input as TamaguiInput, YStack, Text } from "tamagui";

export interface InputProps extends React.ComponentProps<typeof TamaguiInput> {
  label?: string;
  error?: string;
}

const Input = React.forwardRef<React.ElementRef<typeof TamaguiInput>, InputProps>(
  ({ label, error, ...props }, ref) => {
    return (
      <YStack gap={4}>
        {label && (
          <Text fontSize={14} fontWeight="500" color="$gray11">
            {label}
          </Text>
        )}
        <TamaguiInput
          ref={ref}
          borderWidth={1}
          borderColor={error ? "$gray12" : "$border"}
          backgroundColor="$gray1"
          height={40}
          paddingHorizontal={12}
          fontSize={14}
          borderRadius="$md"
          color="$gray12"
          placeholderTextColor="$gray9"
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
Input.displayName = "Input";

export { Input };

