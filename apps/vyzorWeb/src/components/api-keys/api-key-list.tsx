/**
 * API Key List - Displays all API keys with actions
 */

import * as React from "react";
import { styled, YStack, XStack, Text } from "tamagui";
import { Plus, Key } from "lucide-react";
import type { ApiKey } from "@audio-scope-view/api-client/domain/api-key";
import { Button } from "@audio-scope-view/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@audio-scope-view/ui/alert-dialog";
import { ApiKeyCard } from "./api-key-card";

const ListContainer = styled(YStack, {
  gap: "$md",
});

const EmptyState = styled(YStack, {
  padding: "$xl",
  alignItems: "center",
  gap: "$md",
  backgroundColor: "$gray2",
  borderRadius: "$lg",
  borderWidth: 1,
  borderColor: "$border",
  borderStyle: "dashed",
});

const EmptyIcon = styled(YStack, {
  width: 64,
  height: 64,
  borderRadius: "$full",
  backgroundColor: "$gray3",
  alignItems: "center",
  justifyContent: "center",
});

interface ApiKeyListProps {
  apiKeys: ApiKey[];
  isLoading?: boolean;
  onCreateNew: () => void;
  onCopyKey: (key: ApiKey) => void;
  onEditKey: (key: ApiKey) => void;
  onDeleteKey: (key: ApiKey) => void;
  deletingKeyId?: string | null;
}

export function ApiKeyList({
  apiKeys,
  isLoading,
  onCreateNew,
  onCopyKey,
  onEditKey,
  onDeleteKey,
  deletingKeyId,
}: ApiKeyListProps): React.ReactElement {
  const [keyToDelete, setKeyToDelete] = React.useState<ApiKey | null>(null);

  if (isLoading) {
    return (
      <ListContainer>
        {/* Loading handled by parent skeleton */}
      </ListContainer>
    );
  }

  if (apiKeys.length === 0) {
    return (
      <ListContainer>
        <EmptyState>
          <EmptyIcon>
            <Key size={28} color="$gray8" />
          </EmptyIcon>
          <YStack gap="$xs" alignItems="center">
            <Text fontSize="$lg" fontWeight="600" color="$gray12">
              No API keys yet
            </Text>
            <Text fontSize="$sm" color="$gray9" textAlign="center" maxWidth={300}>
              Create your first API key to start integrating with the Audio Scope API
            </Text>
          </YStack>
          <Button onPress={onCreateNew}>
            <Plus size={16} />
            Create API Key
          </Button>
        </EmptyState>
      </ListContainer>
    );
  }

  return (
    <ListContainer>
      {apiKeys.map((key) => (
        <ApiKeyCard
          key={key.id}
          apiKey={key}
          onCopy={onCopyKey}
          onEdit={onEditKey}
          onDelete={(k) => setKeyToDelete(k)}
          isDeleting={deletingKeyId === key.id}
        />
      ))}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={keyToDelete !== null} onOpenChange={() => setKeyToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{keyToDelete?.name}"? This action cannot be undone
              and any applications using this key will lose access immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onPress={() => setKeyToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onPress={() => {
                if (keyToDelete) {
                  onDeleteKey(keyToDelete);
                }
                setKeyToDelete(null);
              }}
              loading={deletingKeyId === keyToDelete?.id}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ListContainer>
  );
}
