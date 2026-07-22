/**
 * API Key Form - Create or Edit API key modal
 */

import * as React from "react";
import { styled, YStack, XStack, Text } from "tamagui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@audio-scope-view/ui/dialog";
import { Button } from "@audio-scope-view/ui/button";
import { Input } from "@audio-scope-view/ui/input";

const Form = styled(YStack, {
  gap: "$md",
});

const FormRow = styled(YStack, {
  gap: "$sm",
});

const FormLabel = styled(Text, {
  fontSize: "$sm",
  fontWeight: "500",
  color: "$gray11",
});

const FormHint = styled(Text, {
  fontSize: "$xs",
  color: "$gray8",
});

const ExpiryOptions = styled(XStack, {
  gap: "$sm",
  flexWrap: "wrap",
});

const ExpiryOptionButton = styled(YStack, {
  paddingHorizontal: "$md",
  paddingVertical: "$sm",
  borderRadius: "$md",
  borderWidth: 1,
  borderColor: "$border",
  backgroundColor: "$gray1",
  alignItems: "center",
  gap: 2,
  cursor: "pointer",
  minWidth: 80,
});

const ExpiryOptionLabel = styled(Text, {
  fontSize: "$sm",
  color: "$gray11",
});

const ExpiryOptionValue = styled(Text, {
  fontSize: "$xs",
  color: "$gray9",
});

interface ApiKeyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ApiKeyFormData) => void;
  onCancel: () => void;
  loading?: boolean;
  mode: "create" | "edit";
  initialData?: ApiKeyFormData;
}

export interface ApiKeyFormData {
  name: string;
  expiresInHours: number | undefined;
  rateLimitPerMinute: number;
}

const PRESET_EXPIRY_OPTIONS = [
  { label: "Never", value: undefined, sublabel: "No expiry" },
  { label: "7 days", value: 24 * 7, sublabel: "1 week" },
  { label: "30 days", value: 24 * 30, sublabel: "1 month" },
  { label: "90 days", value: 24 * 90, sublabel: "3 months" },
  { label: "1 year", value: 24 * 365, sublabel: "365 days" },
];

const DEFAULT_RATE_LIMIT = 60;

export function ApiKeyForm({
  open,
  onOpenChange,
  onSubmit,
  onCancel,
  loading = false,
  mode,
  initialData,
}: ApiKeyFormProps): React.ReactElement {
  const [name, setName] = React.useState(initialData?.name ?? "");
  const [expiresInHours, setExpiresInHours] = React.useState<number | undefined>(
    initialData?.expiresInHours
  );
  const [rateLimitPerMinute, setRateLimitPerMinute] = React.useState(
    initialData?.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT
  );
  const [nameError, setNameError] = React.useState<string | undefined>();

  React.useEffect(() => {
    if (open) {
      setName(initialData?.name ?? "");
      setExpiresInHours(initialData?.expiresInHours);
      setRateLimitPerMinute(initialData?.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT);
      setNameError(undefined);
    }
  }, [open, initialData]);

  const handleSubmit = () => {
    if (!name.trim()) {
      setNameError("Name is required");
      return;
    }

    onSubmit({
      name: name.trim(),
      expiresInHours,
      rateLimitPerMinute,
    });
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen && !loading) {
      onOpenChange(false);
      onCancel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create API Key" : "Edit API Key"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a new API key for programmatic access to your audio scopes."
              : "Update the API key settings."}
          </DialogDescription>
        </DialogHeader>

        <Form>
          <FormRow>
            <Input
              label="Name"
              placeholder="Production API Key"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (nameError) setNameError(undefined);
              }}
              error={nameError}
              disabled={loading}
            />
          </FormRow>

          <FormRow>
            <FormLabel>Expiration</FormLabel>
            <ExpiryOptions>
              {PRESET_EXPIRY_OPTIONS.map((option) => (
                <ExpiryOptionButton
                  key={option.label}
                  onPress={() => {
                    if (mode === "create") {
                      setExpiresInHours(option.value);
                    }
                  }}
                  opacity={mode === "edit" ? 0.5 : 1}
                >
                  <ExpiryOptionLabel>{option.label}</ExpiryOptionLabel>
                  {option.value && <ExpiryOptionValue>{option.sublabel}</ExpiryOptionValue>}
                </ExpiryOptionButton>
              ))}
            </ExpiryOptions>
            {mode === "edit" && (
              <FormHint>Expiration cannot be changed after creation</FormHint>
            )}
          </FormRow>

          <FormRow>
            <Input
              label="Rate Limit (requests per minute)"
              placeholder="60"
              value={rateLimitPerMinute.toString()}
              onChangeText={(text) => {
                const num = parseInt(text, 10);
                if (!isNaN(num) && num > 0) {
                  setRateLimitPerMinute(num);
                } else if (text === "") {
                  setRateLimitPerMinute(DEFAULT_RATE_LIMIT);
                }
              }}
              disabled={loading}
            />
            <FormHint>
              Set to 0 for unlimited requests. Recommended: 60 for typical use.
            </FormHint>
          </FormRow>
        </Form>

        <DialogFooter>
          <Button
            variant="outline"
            onPress={() => handleClose(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onPress={handleSubmit} loading={loading}>
            {mode === "create" ? "Create Key" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
