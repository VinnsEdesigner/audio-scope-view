import * as React from "react";
import { styled, XStack, Text, YStack } from "tamagui";

interface SelectProps extends React.ComponentProps<typeof SelectRoot> {
  value?: string;
  onValueChange?: (value: string) => void;
}

const SelectRoot = styled(XStack, {
  backgroundColor: "$gray1",
  borderWidth: 1,
  borderColor: "$border",
  borderRadius: "$md",
  height: 40,
  paddingHorizontal: 12,
  alignItems: "center",
  justifyContent: "space-between",
  cursor: "pointer",
});

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof StyledSelectTrigger>,
  React.ComponentProps<typeof StyledSelectTrigger>
>(({ children, ...props }, ref) => {
  return (
    <StyledSelectTrigger ref={ref} {...props}>
      {children}
    </StyledSelectTrigger>
  );
});
SelectTrigger.displayName = "SelectTrigger";

const StyledSelectTrigger = styled(XStack, {
  backgroundColor: "$gray1",
  borderWidth: 1,
  borderColor: "$border",
  borderRadius: "$md",
  height: 40,
  paddingHorizontal: 12,
  alignItems: "center",
  justifyContent: "space-between",
  cursor: "pointer",
});

const SelectValue = React.forwardRef<
  React.ElementRef<typeof StyledSelectValue>,
  React.ComponentProps<typeof StyledSelectValue>
>(({ children, placeholder, ...props }, ref) => {
  return (
    <StyledSelectValue ref={ref} {...props}>
      {children || placeholder || "Select..."}
    </StyledSelectValue>
  );
});
SelectValue.displayName = "SelectValue";

const StyledSelectValue = styled(Text, {
  flex: 1,
  color: "$foreground",
});

const SelectContent = styled(YStack, {
  backgroundColor: "$gray1",
  borderRadius: "$md",
  borderWidth: 1,
  borderColor: "$border",
  padding: 8,
  shadowRadius: 8,
  shadowColor: "black",
  shadowOpacity: 0.15,
  shadowOffset: { width: 0, height: 2 },
  zIndex: 100,
});

const SelectItem = styled(XStack, {
  paddingVertical: 10,
  paddingHorizontal: 12,
  cursor: "pointer",
  borderRadius: "$sm",
});

const SelectLabel = styled(Text, {
  fontSize: 13,
  fontWeight: "600",
  paddingVertical: 8,
  paddingHorizontal: 12,
  color: "$gray10",
});

const SelectViewport = styled(XStack, {});

// Compound component pattern
const SelectCompound = React.forwardRef<
  React.ElementRef<typeof SelectRoot>,
  SelectProps
>(({ children, value, onValueChange, ...props }, ref) => {
  const [open, setOpen] = React.useState(false);

  const handleTriggerPress = () => {
    setOpen(!open);
  };

  return (
    <YStack position="relative">
      <SelectRoot ref={ref} {...props} onPress={handleTriggerPress}>
        {children}
      </SelectRoot>
      {open && <SelectContent>{children}</SelectContent>}
    </YStack>
  );
});
SelectCompound.displayName = "Select";

// Attach sub-components
SelectCompound.Trigger = SelectTrigger;
SelectCompound.Value = SelectValue;
SelectCompound.Content = SelectContent;
SelectCompound.Item = SelectItem;
SelectCompound.Label = SelectLabel;
SelectCompound.Viewport = SelectViewport;

export { SelectCompound as Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectLabel, SelectViewport };

