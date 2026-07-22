/**
 * TriggerIndicator - Visual indicator showing oscilloscope trigger level
 * Displays a horizontal line at the trigger voltage with a label
 */

import { styled, Text, Stack } from "tamagui";
import { useTheme } from "@/hooks";

const TriggerContainer = styled(Stack, {
  position: "absolute",
  left: 8,
  right: 8,
  height: "100%",
  pointerEvents: "none",
});

interface TriggerIndicatorProperties {
  width: number;
  height: number;
  level?: number;
  label?: string;
}

export function TriggerIndicator({
  width,
  height,
  level = 0,
  label = "TRG",
}: TriggerIndicatorProperties): React.ReactElement {
  const theme = useTheme();
  const triggerColor = theme === "dark" ? "#60a5fa" : "#3b82f6";
  const textColor = theme === "dark" ? "#ffffff" : "#000000";

  // level is -1 to 1 (normalized voltage), map to pixel position
  const triggerY = ((1 - level) / 2) * height;

  return (
    <TriggerContainer width={width}>
      {/* Trigger level line */}
      <Stack
        style={{
          position: "absolute",
          top: triggerY,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: triggerColor,
          opacity: 0.8,
        }}
      />

      {/* Trigger label */}
      <Stack
        style={{
          position: "absolute",
          top: triggerY - 18,
          left: 0,
          backgroundColor: triggerColor,
          padding: "2px 6px",
          borderRadius: 3,
        }}
      >
        <Text fontSize={9} fontWeight="600" color={textColor} lineHeight={12}>
          {label}
        </Text>
      </Stack>

      {/* Arrow indicator */}
      <Stack
        style={{
          position: "absolute",
          top: triggerY - 5,
          right: 0,
          width: 0,
          height: 0,
          borderTop: "5px solid transparent",
          borderBottom: "5px solid transparent",
          borderRight: `6px solid ${triggerColor}`,
        }}
      />
    </TriggerContainer>
  );
}
