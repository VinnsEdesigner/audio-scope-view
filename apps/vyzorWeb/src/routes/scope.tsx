/**
 * ScopeList - Route displaying all audio scopes
 * Shows list of scopes with status and actions
 */

import { useNavigate } from "react-router-dom";
import { styled, YStack, XStack, Text, Stack } from "tamagui";
import { useScopes, useCreateScope } from "@/hooks";
import { Button } from "@audio-scope-view/ui/button";
import { ScopeListSkeleton } from "@audio-scope-view/ui/skeletons";

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

const StatusDot = styled(Stack, {
  width: 8,
  height: 8,
  borderRadius: "$full",
});

const EmptyState = styled(YStack, {
  padding: "$xl",
  alignItems: "center",
  gap: "$md",
});

export function ScopeList(): React.ReactElement {
  const navigate = useNavigate();
  const { data: scopes, isLoading } = useScopes();
  const createScope = useCreateScope();

  const handleCreateScope = () => {
    createScope.mutate({
      name: "New Scope",
      description: "Created from web app",
    });
  };

  if (isLoading) {
    return (
      <PageContainer>
        <ScopeListSkeleton />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader>
        <YStack gap="$xs">
          <PageTitle>Scopes</PageTitle>
          <PageDescription>Manage your audio capture scopes</PageDescription>
        </YStack>
        <HeaderActions>
          <Button onPress={handleCreateScope} loading={createScope.isPending}>
            + New Scope
          </Button>
        </HeaderActions>
      </PageHeader>

      {scopes && scopes.length > 0 ? (
        <ScopeListContainer>
          {scopes.map((scope) => (
            <button
              key={scope.id}
              type="button"
              onClick={() => navigate(`/scope/${scope.id}`)}
              style={{
                display: "flex",
                flexDirection: "row",
                padding: "16px",
                backgroundColor: "var(--color-card)",
                borderRadius: "8px",
                borderWidth: 1,
                borderColor: "var(--color-border)",
                gap: "16px",
                cursor: "pointer",
                width: "100%",
                alignItems: "center",
                textDecorationLine: "none",
                borderStyle: "solid",
              }}
            >
              <ScopeInfo>
                <ScopeName>{scope.name}</ScopeName>
                <ScopeMeta>
                  {scope.sampleRate.toLocaleString()} Hz • Updated{" "}
                  {formatRelativeTime(scope.updatedAt)}
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
            </button>
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
          <Button onPress={handleCreateScope} variant="outline" loading={createScope.isPending}>
            Create First Scope
          </Button>
        </EmptyState>
      )}
    </PageContainer>
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
