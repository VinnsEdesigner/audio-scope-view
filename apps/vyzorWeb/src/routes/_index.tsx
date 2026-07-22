/**
 * Dashboard - Home route showing overview of audio scopes
 * Displays stats grid and recent scopes
 */

import { useNavigate } from "react-router-dom";
import { styled, YStack, XStack, Text } from "tamagui";
import { useDashboardSummary, useRecentScopes } from "@/hooks";
import { StatsGrid } from "@/components/dashboard";
import { DashboardStatsSkeleton, RecentScopesSkeleton } from "@audio-scope-view/ui/skeletons";

const PageContainer = styled(YStack, {
  padding: "$lg",
  gap: "$lg",
  maxWidth: 1200,
  width: "100%",
});

const PageHeader = styled(YStack, {
  gap: "$xs",
});

const PageTitle = styled(Text, {
  fontSize: "$3xl",
  fontWeight: "bold",
  color: "$foreground",
});

const PageDescription = styled(Text, {
  fontSize: "$md",
  color: "$mutedForeground",
});

const SectionHeader = styled(XStack, {
  justifyContent: "space-between",
  alignItems: "center",
  paddingVertical: "$sm",
});

const SectionTitle = styled(Text, {
  fontSize: "$lg",
  fontWeight: "600",
  color: "$foreground",
});

const EmptyState = styled(YStack, {
  padding: "$xl",
  alignItems: "center",
  gap: "$md",
});

export function Dashboard(): React.ReactElement {
  const navigate = useNavigate();
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();
  const { data: recentScopes, isLoading: scopesLoading } = useRecentScopes();

  const isLoading = summaryLoading || scopesLoading;

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader>
          <PageTitle>Dashboard</PageTitle>
          <PageDescription>Overview of your audio scopes and recent activity</PageDescription>
        </PageHeader>

        <DashboardStatsSkeleton />

        <YStack gap="$md">
          <SectionHeader>
            <SectionTitle>Recent Scopes</SectionTitle>
          </SectionHeader>
          <RecentScopesSkeleton />
        </YStack>
      </PageContainer>
    );
  }

  const stats = [
    {
      label: "Total Scopes",
      value: summary?.totalScopes ?? 0,
      trend: "up" as const,
      trendValue: "+2 this week",
    },
    {
      label: "Active Scopes",
      value: summary?.activeScopes ?? 0,
      trend: summary?.activeScopes ? ("up" as const) : ("neutral" as const),
      trendValue: "Currently capturing",
    },
    {
      label: "Total Waveforms",
      value: summary?.totalWaveforms ?? 0,
      trend: "up" as const,
      trendValue: "+12 today",
    },
    {
      label: "Total Samples",
      value: formatNumber(summary?.totalSamples ?? 0),
      trend: "up" as const,
      trendValue: "+50K today",
    },
  ];

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>Overview</PageTitle>
        <PageDescription>Snapshot of your scopes and recent activity</PageDescription>
      </PageHeader>

      <StatsGrid stats={stats} columns={2} />

      <YStack gap="$md">
        <SectionHeader>
          <SectionTitle>Recent Scopes</SectionTitle>
          <button
            type="button"
            onClick={() => navigate("/scope")}
            style={{
              fontSize: "14px",
              color: "var(--color-primary)",
              cursor: "pointer",
              backgroundColor: "transparent",
              border: "none",
              padding: 0,
            }}
          >
            View all
          </button>
        </SectionHeader>

        {recentScopes && recentScopes.length > 0 ? (
          <YStack gap="$sm">
            {recentScopes.slice(0, 5).map((scope) => (
              <ScopeListItem key={scope.id} scope={scope} />
            ))}
          </YStack>
        ) : (
          <EmptyState>
            <Text color="$mutedForeground">No scopes yet</Text>
            <Text color="$mutedForeground" fontSize="$sm">
              Create your first scope to get started
            </Text>
          </EmptyState>
        )}
      </YStack>
    </PageContainer>
  );
}

function formatNumber(number_: number): string {
  if (number_ >= 1_000_000) {
    return `${(number_ / 1_000_000).toFixed(1)}M`;
  }
  if (number_ >= 1000) {
    return `${(number_ / 1000).toFixed(1)}K`;
  }
  return number_.toString();
}

interface ScopeListItemProperties {
  scope: {
    id: string;
    name: string;
    lastActivity: Date;
  };
}

function ScopeListItem({ scope }: ScopeListItemProperties): React.ReactElement {
  const timeAgo = getRelativeTime(scope.lastActivity);

  return (
    <XStack
      padding="$md"
      backgroundColor="$card"
      borderRadius="$md"
      borderWidth={1}
      borderColor="$border"
      justifyContent="space-between"
      alignItems="center"
    >
      <YStack gap="$xs">
        <Text fontWeight="500" color="$foreground">
          {scope.name}
        </Text>
        <Text fontSize="$sm" color="$mutedForeground">
          {timeAgo}
        </Text>
      </YStack>
      <Text fontSize="$sm" color="$primary">
        View →
      </Text>
    </XStack>
  );
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
