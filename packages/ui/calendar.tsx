import * as React from "react";
import { YStack, Text, XStack, styled } from "tamagui";

const CalendarRoot = styled(YStack, {
  backgroundColor: "$gray1",
  borderRadius: "$md",
  padding: "$md",
  borderWidth: 1,
  borderColor: "$border",
});

export interface CalendarProps extends React.ComponentProps<typeof CalendarRoot> {}

const Calendar = React.forwardRef<React.ElementRef<typeof CalendarRoot>, CalendarProps>(
  ({ ...props }, ref) => {
    return <CalendarRoot ref={ref} {...props} />;
  },
);
Calendar.displayName = "Calendar";

const CalendarHeader = styled(XStack, {
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "$md",
});

const CalendarTitle = styled(Text, {
  fontSize: 16,
  fontWeight: "600",
  color: "$gray12",
});

const CalendarGrid = styled(YStack, {
  gap: 4,
});

const CalendarWeekday = styled(Text, {
  fontSize: 12,
  fontWeight: "600",
  color: "$gray9",
  textAlign: "center",
});

const CalendarDay = styled(XStack, {
  width: 32,
  height: 32,
  justifyContent: "center",
  alignItems: "center",
  borderRadius: "$sm",
  cursor: "pointer",
});

export { Calendar, CalendarHeader, CalendarTitle, CalendarGrid, CalendarWeekday, CalendarDay };

