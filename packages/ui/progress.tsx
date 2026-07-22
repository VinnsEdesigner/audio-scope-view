import * as React from "react";
import { Progress as TamaguiProgress, XStack, Text, YStack } from "tamagui";

export interface ProgressProps extends React.ComponentProps<typeof TamaguiProgress> {
  value?: number;
  label?: string;
  showValue?: boolean;
}

const Progress = React.forwardRef<React.ElementRef<typeof TamaguiProgress>, ProgressProps>(
  ({ value = 0, label, showValue, ...props }, ref) => {
    const percentage = Math.min(Math.max(value, 0), 100);

    return (
      <YStack gap={6} width="100%">
        {(label || showValue) && (
          <XStack justifyContent="space-between" alignItems="center">
            {label && (
              <Text fontSize={14} color="$gray11">
                {label}
              </Text>
            )}
            {showValue && (
              <Text fontSize={14} color="$gray12" fontWeight="500">
                {Math.round(percentage)}%
              </Text>
            )}
          </XStack>
        )}
        <TamaguiProgress ref={ref} value={value} height={8} borderRadius="$full" overflow="hidden" backgroundColor="$gray4" {...props}>
          <TamaguiProgress.Indicator
            width={`${percentage}%`}
            height="100%"
            backgroundColor="$neutral"
            borderRadius="$full"
          />
        </TamaguiProgress>
      </YStack>
    );
  },
);
Progress.displayName = "Progress";

export { Progress };

