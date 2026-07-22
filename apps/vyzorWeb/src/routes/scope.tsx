/**
 * ScopeList - Route displaying all audio scopes
 * Shows list of scopes with status and actions
 */

import { styled, YStack, XStack, Text, Spinner } from "tamagui";
import { useScopes, useCreateScope } from "@/hooks";
import { Button } from "@audio-scope-view/ui/button";

const PageContainer = styled(YStack, {
  padding: "$lg",
  gap: "$lg",
  maxWidth: 1000,
  alignSelf: "center",
  width: "100%",
});

const PageHeader = styled(YStack, {
  gap: "$xs",
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "flex-start",
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

const HeaderActions = styled(XStack, {
  gap: "$sm",
});

const ScopeListContainer = styled(YStack, {
  gap: "$sm",
});

const ScopeInfo = styled(YStack, {
  flex: 1,
  gap: "$xs",
});

const ScopeName = styled(Text, {
  fontSize: "$md",
  fontWeight: "600",
  color: "$foreground",
});

const ScopeMeta = styled(Text, {
  fontSize: "$sm",
  color: "$mutedForeground",
});

const StatusBadge = styled(XStack, {
  paddingHorizontal: "$sm",
  paddingVertical: "$xs",
  borderRadius: "$full",
  alignItems: "center",
  gap: "$xs",
});

const StatusDot = styled("div", {
  width: 8,
  height: 8,
  borderRadius: "$full",
});

const LoadingContainer = styled(YStack, {
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  padding: "$xl",
});

const EmptyState = styled(YStack, {
  padding: "$xl",
  alignItems: "center",
  gap: "$md",
});

export function ScopeList(): React.ReactElement {
  const { data: scopes, isLoading } = useScopes();
  const createScope = useCreateScope();

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingContainer>
          <Spinner size="large" />
          <Text color="$mutedForeground">Loading scopes...</Text>
        </LoadingContainer>
      </PageContainer>
    );
  }

  const handleCreateScope = () => {
    createScope.mutate({
      name: "New Scope",
      description: "Created from web app",
    });
  };

  return (
    <PageContainer>
      <PageHeader>
        <YStack gap="$xs">
          <PageTitle>Scopes</PageTitle>
          <PageDescription>Manage your audio capture scopes</PageDescription>
        </YStack>
        <HeaderActions>
          <Button onPress={handleCreateScope}>+ New Scope</Button>
        </HeaderActions>
      </PageHeader>

      {scopes && scopes.length > 0 ? (
        <ScopeListContainer>
          {scopes.map((scope) => (
            <ScopeCardLink key={scope.id} scope={scope} />
          ))}
        </ScopeListContainer>
      ) : (
        <EmptyState>
          <Text fontSize="$lg" color="$foreground">
            No scopes yet
          </Text>
          <Text color="$mutedForeground" textAlign="center">
            Create your first scope to start capturing audio waveforms
          </Text>
          <Button onPress={handleCreateScope} variant="primary">
            Create First Scope
          </Button>
        </EmptyState>
      )}
    </PageContainer>
  );
}

interface ScopeCardLinkProperties {
  scope: {
    id: string;
    name: string;
    isActive: boolean;
    sampleRate: number;
    updatedAt: Date;
  };
}

function ScopeCardLink({ scope }: ScopeCardLinkProperties): React.ReactElement {
  return (
    <XStack
      as="a"
      href={`/scope/${scope.id}`}
      padding="$md"
      backgroundColor="$card"
      borderRadius="$lg"
      borderWidth={1}
      borderColor="$border"
      gap="$md"
      textDecorationLine="none"
      cursor="pointer"
      hoverStyle={{
        backgroundColor: "$accent",
      }}
    >
      <ScopeInfo>
        <ScopeName>{scope.name}</ScopeName>
        <ScopeMeta>
          {scope.sampleRate.toLocaleString()} Hz • Updated {formatRelativeTime(scope.updatedAt)}
        </ScopeMeta>
      </ScopeInfo>

      <StatusBadge backgroundColor={scope.isActive ? "oklch(0.72 0.18 145)" : "$muted"}>
        <StatusDot backgroundColor={scope.isActive ? "#22c55e" : "$mutedForeground"} />
        <Text
          fontSize="$xs"
          fontWeight="500"
          color={scope.isActive ? "#22c55e" : "$mutedForeground"}
        >
          {scope.isActive ? "Active" : "Inactive"}
        </Text>
      </StatusBadge>
    </XStack>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
