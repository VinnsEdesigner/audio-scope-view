import * as React from "react";
import { Checkbox as TamaguiCheckbox, XStack, Text } from "tamagui";

export interface CheckboxProps extends React.ComponentProps<typeof TamaguiCheckbox> {
  label?: string;
}

const Checkbox = React.forwardRef<React.ElementRef<typeof TamaguiCheckbox>, CheckboxProps>(
  ({ label, ...props }, ref) => {
    return (
      <XStack alignItems="center" gap={8}>
        <TamaguiCheckbox
          ref={ref}
          backgroundColor={props.checked ? "$neutral" : "transparent"}
          borderWidth={1}
          borderColor={props.checked ? "$neutral" : "$gray8"}
          size={18}
          borderRadius={4}
          {...props}
        >
          <TamaguiCheckbox.Indicator>
            <Text fontSize={12} fontWeight="bold" color="$gray1">
              ✓
            </Text>
          </TamaguiCheckbox.Indicator>
        </TamaguiCheckbox>
        {label && (
          <Text fontSize={14} color="$gray12" cursor="pointer">
            {label}
          </Text>
        )}
      </XStack>
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };

