/**
 * Scope List Skeletons - Section-specific loading placeholders
 * Matches exact layout of scope list page components
 */

import { styled, YStack, XStack } from "tamagui";

const SkeletonBase = styled(YStack, {
  backgroundColor: "$gray4",
  borderRadius: "$sm",
  opacity: 0.6,
});

const StatusBadgeSkeleton = styled(XStack, {
  paddingHorizontal: "$sm",
  paddingVertical: "$xs",
  borderRadius: "$full",
  backgroundColor: "$gray4",
  opacity: 0.6,
  alignItems: "center",
  gap: "$xs",
});

/**
 * ScopeListHeaderSkeleton - Matches page header layout
 * Title + description + button
 */
export function ScopeListHeaderSkeleton(): React.ReactElement {
  return (
    <YStack gap="$xs">
      <SkeletonBase width={100} height={36} borderRadius="$md" />
      <SkeletonBase width={280} height={20} />
      <SkeletonBase width={350} height={16} />
    </YStack>
  );
}

/**
 * ScopeListItemSkeleton - Matches single scope card layout exactly
 * Scope name, sample rate, time, and status badge
 */
export function ScopeListItemSkeleton(): React.ReactElement {
  return (
    <XStack
      padding="$md"
      backgroundColor="$card"
      borderRadius="$md"
      borderWidth={1}
      borderColor="$border"
      width="100%"
      alignItems="center"
      gap="$md"
    >
      <YStack flex={1} gap="$xs">
        <SkeletonBase width={160} height={18} />
        <SkeletonBase width={200} height={14} />
      </YStack>
      <StatusBadgeSkeleton>
        <SkeletonBase width={8} height={8} borderRadius="$full" />
        <SkeletonBase width={50} height={12} />
      </StatusBadgeSkeleton>
    </XStack>
  );
}

/**
 * ScopeListSkeleton - Full scope list page skeleton
 * Header + multiple scope items
 */
export function ScopeListSkeleton(): React.ReactElement {
  return (
    <YStack gap="$lg">
      <ScopeListHeaderSkeleton />
      <YStack gap="$sm">
        <ScopeListItemSkeleton />
        <ScopeListItemSkeleton />
        <ScopeListItemSkeleton />
        <ScopeListItemSkeleton />
        <ScopeListItemSkeleton />
      </YStack>
    </YStack>
  );
}
