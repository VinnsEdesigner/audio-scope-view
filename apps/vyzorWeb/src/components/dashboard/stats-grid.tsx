/**
 * StatsGrid - Grid layout for summary cards on dashboard
 * Displays key metrics in a responsive grid
 */

import { styled, XStack, YStack } from "tamagui";
import { SummaryCard } from "./summary-card";

const GridContainer = styled(YStack, {
  gap: "$md",
  width: "100%",
});

const CardRow = styled(XStack, {
  gap: "$md",
  width: "100%",

  variants: {
    responsive: {
      true: {
        flexDirection: "column",
        "@md": {
          flexDirection: "row",
        },
      },
    },
  } as const,
});

interface StatItem {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: React.ReactNode;
}

interface StatsGridProperties {
  stats: StatItem[];
  columns?: 2 | 3 | 4;
}

export function StatsGrid({ stats, columns = 2 }: StatsGridProperties): React.ReactElement {
  const rows: StatItem[][] = [];

  for (let index = 0; index < stats.length; index += columns) {
    rows.push(stats.slice(index, index + columns));
  }

  return (
    <GridContainer>
      {rows.map((row, rowIndex) => (
        <CardRow key={rowIndex} justifyContent="flex-start">
          {row.map((stat, statIndex) => (
            <SummaryCard
              key={statIndex}
              label={stat.label}
              value={stat.value}
              trend={stat.trend}
              trendValue={stat.trendValue}
              icon={stat.icon}
            />
          ))}
        </CardRow>
      ))}
    </GridContainer>
  );
}
