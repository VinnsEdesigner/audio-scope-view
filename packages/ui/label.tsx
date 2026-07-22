import * as React from "react";
import { Text } from "tamagui";

export interface LabelProps extends React.ComponentProps<typeof Text> {
  htmlFor?: string;
}

const Label = React.forwardRef<React.ElementRef<typeof Text>, LabelProps>(
  ({ children, htmlFor, ...props }, ref) => {
    return (
      <Text
        ref={ref}
        fontSize={14}
        fontWeight="500"
        color="$gray12"
        cursor="pointer"
        {...props}
      >
        {children}
      </Text>
    );
  },
);
Label.displayName = "Label";

export { Label };

