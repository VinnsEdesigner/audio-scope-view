/**
 * SummaryCard - Dashboard summary card displaying a key metric
 * Uses Card from @audio-scope-view/ui with styled content
 */

import { styled, YStack, XStack, Text } from "tamagui";
import { Card } from "@audio-scope-view/ui/card";

const StyledCard = styled(Card, {
  backgroundColor: "$card",
  borderColor: "$border",
  borderRadius: "$lg",
  padding: "$md",
  flex: 1,
});

const LabelText = styled(Text, {
  fontSize: "$sm",
  color: "$mutedForeground",
  fontWeight: "500",
});

const ValueText = styled(Text, {
  fontSize: "$2xl",
  fontWeight: "bold",
  color: "$foreground",
  fontVariantNumeric: "tabular-nums",
});

const TrendText = styled(Text, {
  fontSize: "$sm",
});

interface SummaryCardProperties {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: React.ReactNode;
}

function getTrendArrow(trend: "up" | "down" | "neutral" | undefined): string {
  if (trend === "up") return "↑";
  if (trend === "down") return "↓";
  return "→";
}

function getTrendColor(trend: "up" | "down" | "neutral" | undefined): string {
  if (trend === "up") return "$positive";
  if (trend === "down") return "$destructive";
  return "$mutedForeground";
}

export function SummaryCard({
  label,
  value,
  trend,
  trendValue,
  icon,
}: SummaryCardProperties): React.ReactElement {
  return (
    <StyledCard>
      <YStack gap="$sm">
        <XStack justifyContent="space-between" alignItems="flex-start">
          <LabelText>{label}</LabelText>
          {icon}
        </XStack>

        <ValueText>{value}</ValueText>

        {trend && trendValue && (
          <XStack alignItems="center" gap="$xs">
            <Text fontSize="$sm" color={getTrendColor(trend)}>
              {getTrendArrow(trend)}
            </Text>
            <TrendText color={getTrendColor(trend)}>{trendValue}</TrendText>
          </XStack>
        )}
      </YStack>
    </StyledCard>
  );
}
