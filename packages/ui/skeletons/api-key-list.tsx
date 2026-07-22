/**
 * API Key List Skeleton - Matches the layout of the API key list
 */

import { styled, YStack, XStack } from "tamagui";

const SkeletonBase = styled(YStack, {
  backgroundColor: "$gray4",
  borderRadius: "$sm",
  opacity: 0.6,
});

const SkeletonCard = styled(YStack, {
  backgroundColor: "$gray1",
  borderRadius: "$lg",
  padding: "$md",
  borderWidth: 1,
  borderColor: "$border",
  gap: "$md",
});

const SkeletonCardHeader = styled(XStack, {
  justifyContent: "space-between",
  alignItems: "center",
});

const SkeletonCardBody = styled(YStack, {
  gap: "$xs",
  flex: 1,
});

const SkeletonBadge = styled(SkeletonBase, {
  width: 60,
  height: 24,
  borderRadius: "$full",
});

const SkeletonActions = styled(XStack, {
  gap: "$sm",
});

/**
 * Single API key card skeleton
 */
function ApiKeyCardSkeleton(): React.ReactElement {
  return (
    <SkeletonCard>
      <SkeletonCardHeader>
        <SkeletonCardBody>
          <SkeletonBase width={140} height={18} />
          <SkeletonBase width={200} height={14} />
        </SkeletonCardBody>
        <XStack gap="$sm" alignItems="center">
          <SkeletonBadge />
          <SkeletonActions>
            <SkeletonBase width={70} height={32} borderRadius="$md" />
            <SkeletonBase width={70} height={32} borderRadius="$md" />
          </SkeletonActions>
        </XStack>
      </SkeletonCardHeader>
      <XStack gap="$lg" paddingTop="$sm" borderTopWidth={1} borderTopColor="$border">
        <YStack gap={4}>
          <SkeletonBase width={60} height={10} />
          <SkeletonBase width={100} height={12} />
        </YStack>
        <YStack gap={4}>
          <SkeletonBase width={70} height={10} />
          <SkeletonBase width={120} height={12} />
        </YStack>
        <YStack gap={4}>
          <SkeletonBase width={50} height={10} />
          <SkeletonBase width={80} height={12} />
        </YStack>
      </XStack>
    </SkeletonCard>
  );
}

/**
 * API Key List Skeleton - Shows 4 skeleton cards
 */
export function ApiKeyListSkeleton(): React.ReactElement {
  return (
    <YStack gap="$md">
      <ApiKeyCardSkeleton />
      <ApiKeyCardSkeleton />
      <ApiKeyCardSkeleton />
      <ApiKeyCardSkeleton />
    </YStack>
  );
}

/**
 * API Key Page Header Skeleton
 */
export function ApiKeyPageHeaderSkeleton(): React.ReactElement {
  return (
    <XStack justifyContent="space-between" alignItems="center" paddingBottom="$lg">
      <YStack gap="$xs">
        <SkeletonBase width={120} height={28} />
        <SkeletonBase width={200} height={16} />
      </YStack>
      <SkeletonBase width={140} height={40} borderRadius="$md" />
    </XStack>
  );
}
