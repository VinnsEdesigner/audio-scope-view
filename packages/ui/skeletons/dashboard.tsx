/**
 * Dashboard Skeletons - Section-specific loading placeholders
 * Matches exact layout of dashboard components
 */

import { styled, YStack, XStack } from "tamagui";
import { Card } from "@audio-scope-view/ui/card";

const SkeletonBase = styled(YStack, {
  backgroundColor: "$gray4",
  borderRadius: "$sm",
  opacity: 0.6,
});

const SkeletonCard = styled(Card, {
  backgroundColor: "$card",
  borderColor: "$border",
  borderRadius: "$lg",
  padding: "$md",
  flex: 1,
});

/**
 * DashboardStatsSkeleton - Matches StatsGrid layout exactly
 * 2x2 grid of SummaryCards with label, value, trend
 */
export function DashboardStatsSkeleton(): React.ReactElement {
  return (
    <YStack gap="$md" width="100%">
      <XStack gap="$md" width="100%">
        <SkeletonCard>
          <YStack gap="$sm">
            <XStack justifyContent="space-between" alignItems="flex-start">
              <SkeletonBase width={80} height={14} />
            </XStack>
            <SkeletonBase width={60} height={28} />
            <XStack alignItems="center" gap="$xs">
              <SkeletonBase width={12} height={12} borderRadius="$full" />
              <SkeletonBase width={70} height={14} />
            </XStack>
          </YStack>
        </SkeletonCard>
        <SkeletonCard>
          <YStack gap="$sm">
            <XStack justifyContent="space-between" alignItems="flex-start">
              <SkeletonBase width={80} height={14} />
            </XStack>
            <SkeletonBase width={60} height={28} />
            <XStack alignItems="center" gap="$xs">
              <SkeletonBase width={12} height={12} borderRadius="$full" />
              <SkeletonBase width={70} height={14} />
            </XStack>
          </YStack>
        </SkeletonCard>
      </XStack>
      <XStack gap="$md" width="100%">
        <SkeletonCard>
          <YStack gap="$sm">
            <XStack justifyContent="space-between" alignItems="flex-start">
              <SkeletonBase width={80} height={14} />
            </XStack>
            <SkeletonBase width={60} height={28} />
            <XStack alignItems="center" gap="$xs">
              <SkeletonBase width={12} height={12} borderRadius="$full" />
              <SkeletonBase width={70} height={14} />
            </XStack>
          </YStack>
        </SkeletonCard>
        <SkeletonCard>
          <YStack gap="$sm">
            <XStack justifyContent="space-between" alignItems="flex-start">
              <SkeletonBase width={80} height={14} />
            </XStack>
            <SkeletonBase width={60} height={28} />
            <XStack alignItems="center" gap="$xs">
              <SkeletonBase width={12} height={12} borderRadius="$full" />
              <SkeletonBase width={70} height={14} />
            </XStack>
          </YStack>
        </SkeletonCard>
      </XStack>
    </YStack>
  );
}

/**
 * RecentScopesSkeleton - Matches recent scopes list layout exactly
 * List items with name and relative time
 */
export function RecentScopesSkeleton(): React.ReactElement {
  return (
    <YStack gap="$sm">
      {[1, 2, 3, 4, 5].map((i) => (
        <XStack
          key={i}
          padding="$md"
          backgroundColor="$card"
          borderRadius="$md"
          borderWidth={1}
          borderColor="$border"
          justifyContent="space-between"
          alignItems="center"
        >
          <YStack gap="$xs">
            <SkeletonBase width={140} height={16} />
            <SkeletonBase width={80} height={12} />
          </YStack>
          <SkeletonBase width={50} height={16} />
        </XStack>
      ))}
    </YStack>
  );
}
