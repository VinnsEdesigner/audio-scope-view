import * as React from "react";
import { styled, YStack, XStack } from "tamagui";

const SkeletonBase = styled(YStack, {
  borderRadius: "$md",
  backgroundColor: "$gray4",
  opacity: 0.6,

  variants: {
    variant: {
      circle: {
        borderRadius: "$full",
      },
      rect: {
        borderRadius: "$md",
      },
      text: {
        borderRadius: "$sm",
        height: 16,
      },
      card: {
        borderRadius: "$lg",
        padding: "$md",
        backgroundColor: "$card",
        borderWidth: 1,
        borderColor: "$border",
      },
    },
    size: {
      sm: { height: 12 },
      md: { height: 16 },
      lg: { height: 20 },
      xl: { height: 24 },
    },
  } as const,

  defaultVariants: {
    variant: "rect",
  },
});

export interface SkeletonProps extends React.ComponentProps<typeof SkeletonBase> {}

const Skeleton = React.forwardRef<React.ElementRef<typeof SkeletonBase>, SkeletonProps>(
  (props, ref) => <SkeletonBase ref={ref} {...props} />,
);
Skeleton.displayName = "Skeleton";

interface SkeletonTextProps {
  lines?: number;
  width?: number | string;
  lastLineWidth?: number | string;
  gap?: number | string;
}

export function SkeletonText({ lines = 3, width = "100%", lastLineWidth = "60%", gap = "$xs" }: SkeletonTextProps) {
  return (
    <YStack gap={gap} width={width}>
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonBase
          key={index}
          variant="text"
          width={index === lines - 1 ? lastLineWidth : "100%"}
        />
      ))}
    </YStack>
  );
}

interface SkeletonCardProps {
  titleWidth?: number | string;
  descriptionLines?: number;
}

export function SkeletonCard({ titleWidth = "60%", descriptionLines = 2 }: SkeletonCardProps) {
  return (
    <YStack variant="card" gap="$sm">
      <SkeletonBase variant="rect" width={titleWidth} height={20} />
      <SkeletonText lines={descriptionLines} />
    </YStack>
  );
}

interface SkeletonStatProps {
  labelWidth?: number | string;
  valueWidth?: number | string;
}

export function SkeletonStat({ labelWidth = "40%", valueWidth = "50%" }: SkeletonStatProps) {
  return (
    <YStack gap="$xs">
      <SkeletonBase variant="rect" width={labelWidth} height={12} />
      <SkeletonBase variant="rect" width={valueWidth} height={24} />
    </YStack>
  );
}

interface SkeletonListItemProps {
  showAvatar?: boolean;
  avatarSize?: number;
}

export function SkeletonListItem({ showAvatar = true, avatarSize = 40 }: SkeletonListItemProps) {
  return (
    <XStack
      padding="$md"
      backgroundColor="$card"
      borderRadius="$md"
      borderWidth={1}
      borderColor="$border"
      alignItems="center"
      gap="$md"
    >
      {showAvatar && <SkeletonBase variant="circle" width={avatarSize} height={avatarSize} />}
      <YStack flex={1} gap="$xs">
        <SkeletonBase variant="rect" width="70%" height={14} />
        <SkeletonBase variant="rect" width="40%" height={12} />
      </YStack>
    </XStack>
  );
}

interface SkeletonListProps {
  count?: number;
  showAvatar?: boolean;
}

export function SkeletonList({ count = 5, showAvatar = true }: SkeletonListProps) {
  return (
    <YStack gap="$sm">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonListItem key={index} showAvatar={showAvatar} />
      ))}
    </YStack>
  );
}

interface SkeletonGridProps {
  columns?: number;
  count?: number;
  height?: number;
}

export function SkeletonGrid({ columns = 2, count = 4, height = 100 }: SkeletonGridProps) {
  return (
    <XStack flexWrap="wrap" gap="$md">
      {Array.from({ length: count }).map((_, index) => (
        <YStack
          key={index}
          width={`calc(${100 / columns}% - $gap)`}
          minWidth={150}
          height={height}
          backgroundColor="$card"
          borderRadius="$lg"
          borderWidth={1}
          borderColor="$border"
        />
      ))}
    </XStack>
  );
}

interface SkeletonButtonProps {
  width?: number | string;
  height?: number;
}

export function SkeletonButton({ width = 120, height = 40 }: SkeletonButtonProps) {
  return <SkeletonBase variant="rect" width={width} height={height} borderRadius="$md" />;
}

export { Skeleton };


