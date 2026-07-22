/**
 * API Key Card - Displays a single API key with its metadata and actions
 */

import { styled, YStack, XStack, Text } from "tamagui";
import { Copy, Pencil, Trash2, AlertCircle } from "lucide-react";
import type { ApiKey } from "@audio-scope-view/api-client/domain/api-key";
import { timestampToDate } from "@audio-scope-view/api-client/domain/api-key/transforms";
import { Button } from "@audio-scope-view/ui/button";

const Card = styled(YStack, {
  backgroundColor: "$gray1",
  borderRadius: "$lg",
  padding: "$md",
  borderWidth: 1,
  borderColor: "$border",
  gap: "$md",
});

const CardHeader = styled(XStack, {
  justifyContent: "space-between",
  alignItems: "flex-start",
});

const KeyInfo = styled(YStack, {
  flex: 1,
  gap: "$xs",
});

const KeyName = styled(Text, {
  fontSize: "$md",
  fontWeight: "600",
  color: "$gray12",
});

const KeyId = styled(Text, {
  fontSize: "$xs",
  color: "$gray9",
  fontFamily: "$mono",
});

const CardActions = styled(XStack, {
  alignItems: "center",
  gap: "$sm",
});

const CardMeta = styled(XStack, {
  gap: "$lg",
  paddingTop: "$sm",
  borderTopWidth: 1,
  borderTopColor: "$border",
});

const MetaItem = styled(YStack, {
  gap: 2,
});

const MetaLabel = styled(Text, {
  fontSize: "$xs",
  color: "$gray8",
  textTransform: "uppercase",
  letterSpacing: 0.5,
});

const MetaValue = styled(Text, {
  fontSize: "$sm",
  color: "$gray11",
});

const StatusBadge = styled(XStack, {
  paddingHorizontal: "$sm",
  paddingVertical: "$xs",
  borderRadius: "$full",
  alignItems: "center",
  gap: "$xs",
});

interface ApiKeyCardProps {
  apiKey: ApiKey;
  onCopy: (key: ApiKey) => void;
  onEdit: (key: ApiKey) => void;
  onDelete: (key: ApiKey) => void;
  isDeleting?: boolean;
}

export function ApiKeyCard({
  apiKey,
  onCopy,
  onEdit,
  onDelete,
  isDeleting,
}: ApiKeyCardProps): React.ReactElement {
  const createdDate = timestampToDate(apiKey.createdAt);
  const expiresDate = timestampToDate(apiKey.expiresAt);
  const lastUsedDate = timestampToDate(apiKey.lastUsedAt);

  const isExpired = expiresDate && expiresDate < new Date();
  const status = !apiKey.isValid ? "revoked" : isExpired ? "expired" : "active";

  const formatDate = (date: Date | null): string => {
    if (!date) return "Never";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (date: Date | null): string => {
    if (!date) return "Never";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <Card>
      <CardHeader>
        <KeyInfo>
          <KeyName>{apiKey.name}</KeyName>
          <KeyId>ID: {apiKey.id.slice(0, 8)}...</KeyId>
        </KeyInfo>
        <CardActions>
          <StatusBadge backgroundColor="$gray3" borderWidth={1} borderColor="$gray5">
            {(status === "expired" || status === "revoked") && (
              <AlertCircle size={12} color="var(--color-gray11)" />
            )}
            <Text fontSize="$xs" fontWeight="500" color="$gray11" textTransform="capitalize">
              {status}
            </Text>
          </StatusBadge>
          <Button
            variant="ghost"
            size="icon"
            onPress={() => onCopy(apiKey)}
            aria-label="Copy key ID"
          >
            <Copy size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onPress={() => onEdit(apiKey)}
            aria-label="Edit key"
          >
            <Pencil size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onPress={() => onDelete(apiKey)}
            loading={isDeleting}
            aria-label="Delete key"
          >
            <Trash2 size={16} />
          </Button>
        </CardActions>
      </CardHeader>
      <CardMeta>
        <MetaItem>
          <MetaLabel>Created</MetaLabel>
          <MetaValue>{formatDate(createdDate)}</MetaValue>
        </MetaItem>
        <MetaItem>
          <MetaLabel>Expires</MetaLabel>
          <MetaValue>{expiresDate ? formatDate(expiresDate) : "Never"}</MetaValue>
        </MetaItem>
        <MetaItem>
          <MetaLabel>Last Used</MetaLabel>
          <MetaValue>{formatTime(lastUsedDate)}</MetaValue>
        </MetaItem>
        <MetaItem>
          <MetaLabel>Rate Limit</MetaLabel>
          <MetaValue>{apiKey.rateLimitPerMinute} req/min</MetaValue>
        </MetaItem>
      </CardMeta>
    </Card>
  );
}
