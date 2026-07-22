/**
 * API Key Created Dialog - Shows the full API key after creation (one-time view)
 */

import * as React from "react";
import { styled, YStack, XStack, Text } from "tamagui";
import { Copy, Check, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@audio-scope-view/ui/dialog";
import { Button } from "@audio-scope-view/ui/button";
import type { CreatedApiKey } from "@audio-scope-view/api-client/domain/api-key";

const WarningBanner = styled(YStack, {
  flexDirection: "row",
  alignItems: "flex-start",
  gap: "$sm",
  padding: "$md",
  backgroundColor: "oklch(0.65 0.2 85 / 0.15)",
  borderRadius: "$md",
  borderWidth: 1,
  borderColor: "oklch(0.65 0.2 85 / 0.3)",
});

const KeyDisplay = styled(YStack, {
  backgroundColor: "$gray3",
  borderRadius: "$md",
  padding: "$md",
  gap: "$sm",
});

const KeyLabel = styled(Text, {
  fontSize: "$xs",
  color: "$gray8",
  textTransform: "uppercase",
  letterSpacing: 0.5,
});

const KeyValue = styled(XStack, {
  alignItems: "center",
  justifyContent: "space-between",
  backgroundColor: "$gray1",
  borderRadius: "$sm",
  padding: "$sm",
  paddingHorizontal: "$md",
  borderWidth: 1,
  borderColor: "$border",
});

const KeyText = styled(Text, {
  fontFamily: "$mono",
  fontSize: "$sm",
  color: "$gray12",
  flex: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
});

const CopyButton = styled(Button, {
  paddingHorizontal: "$sm",
});

interface ApiKeyCreatedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createdKey: CreatedApiKey | null;
}

export function ApiKeyCreatedDialog({
  open,
  onOpenChange,
  createdKey,
}: ApiKeyCreatedDialogProps): React.ReactElement {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setCopied(false);
    }
  }, [open]);

  const handleCopy = async () => {
    if (!createdKey) return;

    try {
      await navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = createdKey.key;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!createdKey) return <></>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>API Key Created</DialogTitle>
          <DialogDescription>
            Your new API key has been created. Copy the key below — it will not be shown again.
          </DialogDescription>
        </DialogHeader>

        <WarningBanner>
          <AlertTriangle size={20} color="#ca8a04" style={{ flexShrink: 0, marginTop: 2 }} />
          <YStack gap={4}>
            <Text fontSize="$sm" fontWeight="600" color="$gray12">
              Save your API key now
            </Text>
            <Text fontSize="$sm" color="$gray11">
              This is the only time your full API key will be displayed. If you lose it, you will
              need to create a new API key.
            </Text>
          </YStack>
        </WarningBanner>

        <KeyDisplay>
          <KeyLabel>Your API Key</KeyLabel>
          <KeyValue>
            <KeyText selectable>{createdKey.key}</KeyText>
            <CopyButton
              variant="ghost"
              size="sm"
              onPress={handleCopy}
              aria-label="Copy API key"
            >
              {copied ? <Check size={16} color="#16a34a" /> : <Copy size={16} />}
            </CopyButton>
          </KeyValue>
        </KeyDisplay>

        <YStack gap="$sm" paddingTop="$sm">
          <Text fontSize="$sm" color="$mutedForeground">
            <Text fontWeight="500">Key ID:</Text> {createdKey.id}
          </Text>
          <Text fontSize="$sm" color="$mutedForeground">
            <Text fontWeight="500">Name:</Text> {createdKey.name}
          </Text>
        </YStack>

        <XStack justifyContent="flex-end" paddingTop="$md">
          <Button onPress={() => onOpenChange(false)}>Done</Button>
        </XStack>
      </DialogContent>
    </Dialog>
  );
}
