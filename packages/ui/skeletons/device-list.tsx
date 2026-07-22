/**
 * Device List Skeleton - Section-specific loading placeholder
 * Matches exact layout of device selector in settings
 */

import { styled, XStack, YStack } from "tamagui";

const SkeletonBase = styled(YStack, {
  backgroundColor: "$gray4",
  borderRadius: "$sm",
  opacity: 0.6,
});

/**
 * DeviceButtonSkeleton - Matches DeviceButton component layout
 * Pill-shaped button with text inside
 */
function DeviceButtonSkeleton({ width = 160 }: { width?: number }): React.ReactElement {
  return (
    <XStack
      padding="$sm"
      paddingHorizontal="$md"
      borderRadius="$md"
      borderWidth={1}
      borderColor="$border"
      backgroundColor="transparent"
      style={{ minWidth: width }}
    >
      <SkeletonBase width={width - 32} height={16} />
    </XStack>
  );
}

/**
 * DeviceListSkeleton - Matches device selector row
 * Multiple device buttons in a flex wrap container
 */
export function DeviceListSkeleton(): React.ReactElement {
  return (
    <XStack flexWrap="wrap" gap="$sm">
      <DeviceButtonSkeleton width={180} />
      <DeviceButtonSkeleton width={160} />
      <DeviceButtonSkeleton width={200} />
      <DeviceButtonSkeleton width={140} />
    </XStack>
  );
}
