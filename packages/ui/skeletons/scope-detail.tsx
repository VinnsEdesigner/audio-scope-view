/**
 * Scope Detail Skeletons - Section-specific loading placeholders
 * Matches exact layout of scope detail page components
 */

import { styled, YStack, XStack } from "tamagui";

const SkeletonBase = styled(YStack, {
  backgroundColor: "$gray4",
  borderRadius: "$sm",
  opacity: 0.6,
});

const SkeletonButton = styled(YStack, {
  backgroundColor: "$gray4",
  borderRadius: "$md",
  opacity: 0.6,
});

/**
 * ScopeDetailHeaderSkeleton - Matches page header layout
 * Back button, title, description
 */
export function ScopeDetailHeaderSkeleton(): React.ReactElement {
  return (
    <YStack gap="$xs">
      <SkeletonBase width={120} height={16} />
      <SkeletonBase width={250} height={32} />
      <SkeletonBase width={350} height={16} />
    </YStack>
  );
}

/**
 * WaveformSkeleton - Matches waveform display area
 * Large area with grid placeholder
 */
export function WaveformSkeleton(): React.ReactElement {
  return (
    <YStack
      backgroundColor="$card"
      borderRadius="$lg"
      borderWidth={1}
      borderColor="$border"
      padding="$md"
      minHeight={350}
    >
      <YStack
        flex={1}
        backgroundColor="$gray5"
        borderRadius="$md"
        minHeight={300}
      />
    </YStack>
  );
}

/**
 * StatsRowSkeleton - Matches stats row with 4 stat items
 * Sample rate, buffer size, samples, status
 */
export function StatsRowSkeleton(): React.ReactElement {
  return (
    <XStack
      gap="$lg"
      padding="$md"
      backgroundColor="$muted"
      borderRadius="$md"
    >
      {[1, 2, 3, 4].map((i) => (
        <YStack key={i} alignItems="center" gap="$xs">
          <SkeletonBase width={60} height={24} />
          <SkeletonBase width={80} height={12} />
        </YStack>
      ))}
    </XStack>
  );
}

/**
 * ControlRowSkeleton - Matches single control row
 * Label + control (slider/text)
 */
export function ControlRowSkeleton(): React.ReactElement {
  return (
    <XStack
      justifyContent="space-between"
      alignItems="center"
      paddingVertical="$sm"
      borderBottomWidth={1}
      borderBottomColor="$border"
    >
      <SkeletonBase width={100} height={16} />
      <XStack alignItems="center" gap="$md">
        <SkeletonBase width={120} height={24} borderRadius="$md" />
        <SkeletonBase width={60} height={16} />
      </XStack>
    </XStack>
  );
}

/**
 * ControlsSectionSkeleton - Matches controls section
 * Multiple control rows
 */
export function ControlsSectionSkeleton(): React.ReactElement {
  return (
    <YStack gap="$md">
      <ControlRowSkeleton />
      <ControlRowSkeleton />
      <ControlRowSkeleton />
      <ControlRowSkeleton />
      <ControlRowSkeleton />
    </YStack>
  );
}

/**
 * ActionRowSkeleton - Matches action buttons row
 */
export function ActionRowSkeleton(): React.ReactElement {
  return (
    <XStack gap="$md" justifyContent="flex-end">
      <SkeletonButton width={120} height={40} />
      <SkeletonButton width={100} height={40} />
    </XStack>
  );
}

/**
 * ScopeDetailSkeleton - Full scope detail page skeleton
 */
export function ScopeDetailSkeleton(): React.ReactElement {
  return (
    <YStack gap="$lg">
      <ScopeDetailHeaderSkeleton />
      <YStack gap="$md">
        <WaveformSkeleton />
        <StatsRowSkeleton />
      </YStack>
      <ControlsSectionSkeleton />
      <ActionRowSkeleton />
    </YStack>
  );
}
