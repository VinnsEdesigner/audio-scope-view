import * as React from "react";
import { Switch as TamaguiSwitch, XStack, Text } from "tamagui";

export interface SwitchProps extends React.ComponentProps<typeof TamaguiSwitch> {
  label?: string;
}

const Switch = React.forwardRef<React.ElementRef<typeof TamaguiSwitch>, SwitchProps>(
  ({ label, checked, ...props }, ref) => {
    return (
      <XStack alignItems="center" gap={12}>
        <TamaguiSwitch
          ref={ref}
          checked={checked}
          backgroundColor={checked ? "$neutral" : "$gray5"}
          width={44}
          height={24}
          borderRadius="$full"
          padding={2}
          {...props}
        >
          <TamaguiSwitch.Thumb
            backgroundColor="$gray1"
            width={20}
            height={20}
            borderRadius="$full"
          />
        </TamaguiSwitch>
        {label && (
          <Text fontSize={14} color="$gray12">
            {label}
          </Text>
        )}
      </XStack>
    );
  },
);
Switch.displayName = "Switch";

export { Switch };

