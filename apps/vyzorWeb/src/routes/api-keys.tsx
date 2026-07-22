/**
 * API Keys - Management page for API keys
 * Create, edit, view, and delete API keys
 */

import * as React from "react";
import { styled, YStack, XStack, Text } from "tamagui";
import { Plus, Copy, Check } from "lucide-react";
import { useApiKeys, useCreateApiKey, useUpdateApiKey, useDeleteApiKey } from "@/hooks";
import { Button } from "@audio-scope-view/ui/button";
import { ApiKeyList, ApiKeyForm, ApiKeyFormData, ApiKeyCreatedDialog } from "@/components/api-keys";
import { ApiKeyListSkeleton, ApiKeyPageHeaderSkeleton } from "@audio-scope-view/ui/skeletons";
import type { ApiKey } from "@audio-scope-view/api-client/domain/api-key";
import type { CreatedApiKey } from "@audio-scope-view/api-client/domain/api-key";

const PageContainer = styled(YStack, {
  padding: "$lg",
  gap: "$lg",
  maxWidth: 900,
  alignSelf: "center",
  width: "100%",
});

const PageHeader = styled(XStack, {
  justifyContent: "space-between",
  alignItems: "flex-start",
});

const PageTitleSection = styled(YStack, {
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

const HeaderActions = styled(XStack, {
  gap: "$sm",
});

export function ApiKeys(): React.ReactElement {
  const { data: apiKeys, isLoading, error } = useApiKeys();
  const createApiKey = useCreateApiKey();
  const updateApiKey = useUpdateApiKey();
  const deleteApiKey = useDeleteApiKey();

  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [editingKey, setEditingKey] = React.useState<ApiKey | null>(null);
  const [createdKey, setCreatedKey] = React.useState<CreatedApiKey | null>(null);
  const [showCreatedDialog, setShowCreatedDialog] = React.useState(false);
  const [deletingKeyId, setDeletingKeyId] = React.useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = React.useState<string | null>(null);

  const handleCreate = async (data: ApiKeyFormData) => {
    try {
      const result = await createApiKey.mutateAsync({
        name: data.name,
        expiresInHours: data.expiresInHours ?? undefined,
        rateLimitPerMinute: data.rateLimitPerMinute,
      });
      setShowCreateForm(false);
      setCreatedKey(result);
      setShowCreatedDialog(true);
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleEdit = async (data: ApiKeyFormData) => {
    if (!editingKey) return;
    try {
      await updateApiKey.mutateAsync({
        id: editingKey.id,
        name: data.name,
        rateLimitPerMinute: data.rateLimitPerMinute,
        expiresInHours: data.expiresInHours,
      });
      setEditingKey(null);
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleDelete = async (key: ApiKey) => {
    setDeletingKeyId(key.id);
    try {
      await deleteApiKey.mutateAsync(key.id);
    } catch {
      // Error is handled by the mutation
    } finally {
      setDeletingKeyId(null);
    }
  };

  const handleCopyKey = async (key: ApiKey) => {
    try {
      await navigator.clipboard.writeText(key.id);
      setCopiedKeyId(key.id);
      setTimeout(() => setCopiedKeyId(null), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  const isFormLoading = createApiKey.isPending || updateApiKey.isPending;

  return (
    <PageContainer>
      <PageHeader>
        <PageTitleSection>
          <PageTitle>API Keys</PageTitle>
          <PageDescription>
            Manage API keys for programmatic access to your audio scopes
          </PageDescription>
        </PageTitleSection>
        <HeaderActions>
          <Button onPress={() => setShowCreateForm(true)}>
            <Plus size={16} />
            Create API Key
          </Button>
        </HeaderActions>
      </PageHeader>

      {isLoading ? (
        <YStack gap="$lg">
          <ApiKeyPageHeaderSkeleton />
          <ApiKeyListSkeleton />
        </YStack>
      ) : error ? (
        <YStack
          padding="$xl"
          alignItems="center"
          justifyContent="center"
          gap="$md"
          backgroundColor="$gray2"
          borderRadius="$lg"
          borderWidth={1}
          borderColor="$gray5"
        >
          <Text color="$gray12" fontSize="$md">
            Failed to load API keys. Please try again.
          </Text>
          <Button variant="outline" onPress={() => window.location.reload()}>
            Retry
          </Button>
        </YStack>
      ) : (
        <ApiKeyList
          apiKeys={apiKeys ?? []}
          onCreateNew={() => setShowCreateForm(true)}
          onCopyKey={handleCopyKey}
          onEditKey={(key) => setEditingKey(key)}
          onDeleteKey={handleDelete}
          deletingKeyId={deletingKeyId}
        />
      )}

      {/* Create Form Dialog */}
      <ApiKeyForm
        open={showCreateForm}
        onOpenChange={setShowCreateForm}
        onSubmit={handleCreate}
        onCancel={() => setShowCreateForm(false)}
        loading={isFormLoading}
        mode="create"
      />

      {/* Edit Form Dialog */}
      <ApiKeyForm
        open={editingKey !== null}
        onOpenChange={(open) => !open && setEditingKey(null)}
        onSubmit={handleEdit}
        onCancel={() => setEditingKey(null)}
        loading={isFormLoading}
        mode="edit"
        initialData={
          editingKey
            ? {
                name: editingKey.name,
                expiresInHours: editingKey.expiresAt
                  ? Math.floor((editingKey.expiresAt - editingKey.createdAt) / 3600)
                  : undefined,
                rateLimitPerMinute: editingKey.rateLimitPerMinute,
              }
            : undefined
        }
      />

      {/* Created Key Dialog */}
      <ApiKeyCreatedDialog
        open={showCreatedDialog}
        onOpenChange={setShowCreatedDialog}
        createdKey={createdKey}
      />
    </PageContainer>
  );
}
