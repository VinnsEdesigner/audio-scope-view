import * as React from "react";
import { Slider as TamaguiSlider, XStack, Text } from "tamagui";

export interface SliderProps extends React.ComponentProps<typeof TamaguiSlider> {
  label?: string;
  showValue?: boolean;
}

const Slider = React.forwardRef<React.ElementRef<typeof TamaguiSlider>, SliderProps>(
  ({ label, showValue, value, ...props }, ref) => {
    return (
      <XStack alignItems="center" gap={12} width="100%">
        {label && (
          <Text fontSize={14} color="$gray11" width={80}>
            {label}
          </Text>
        )}
        <TamaguiSlider
          ref={ref}
          flex={1}
          defaultValue={value ? [value] : [0]}
          {...props}
        >
          <TamaguiSlider.Track backgroundColor="$gray5" height={6} borderRadius="$full">
            <TamaguiSlider.TrackActive backgroundColor="$neutral" borderRadius="$full" />
          </TamaguiSlider.Track>
          <TamaguiSlider.Thumb
            backgroundColor="$gray12"
            borderRadius="$full"
            width={20}
            height={20}
            borderWidth={2}
            borderColor="$gray1"
          />
        </TamaguiSlider>
        {showValue && value !== undefined && (
          <Text fontSize={14} color="$gray12" fontWeight="500" width={40} textAlign="right">
            {value}
          </Text>
        )}
      </XStack>
    );
  },
);
Slider.displayName = "Slider";

export { Slider };

