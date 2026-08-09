import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { formatError } from "@/lib/format-error";
import { InlineSelect } from "@/components/ui/inline-select";
import type { ApiKey, UpdateApiKeyInput } from "@/hooks/use-api-keys";
import { useUpdateApiKey } from "@/hooks/use-api-keys";
import { useToast } from "@/hooks";

const RATE_LIMIT_OPTIONS = [
  { value: 30, label: "30 req/min" },
  { value: 60, label: "60 req/min" },
  { value: 100, label: "100 req/min" },
  { value: 120, label: "120 req/min" },
  { value: 200, label: "200 req/min" },
  { value: 500, label: "500 req/min" },
  { value: 1000, label: "1000 req/min" },
] as const;

interface EditApiKeyDialogProperties {
  isOpen: boolean;
  onClose: () => void;
  apiKey: ApiKey | undefined;
}

export function EditApiKeyDialog({ isOpen, onClose, apiKey }: EditApiKeyDialogProperties) {
  const { showToast } = useToast();
  const [updateApiKey, { loading: isPending }] = useUpdateApiKey();

  const [name, setName] = useState(apiKey?.name ?? "");
  const [rateLimit, setRateLimit] = useState(apiKey?.rateLimitPerMinute ?? 60);

  useEffect(() => {
    if (apiKey) {
      setName(apiKey.name);
      setRateLimit(apiKey.rateLimitPerMinute);
    }
  }, [apiKey]);

  const handleSave = () => {
    if (!apiKey || !name.trim()) return;

    const input: UpdateApiKeyInput = {
      name: name.trim(),
      rateLimitPerMinute: rateLimit,
    };

    updateApiKey({
      variables: { id: apiKey.id, input },
      onCompleted: () => {
        showToast({
          message: `API key "${name}" updated successfully`,
          type: "success",
        });
        onClose();
      },
      onError: (error: Error) => {
        showToast({
          message: `Failed to update API key: ${formatError(error, "Unknown error")}`,
          type: "error",
        });
      },
    });
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Edit API Key" maxWidth="max-w-md">
      <div className="mb-5">
        <label className="block text-[13px] font-medium text-foreground mb-2">
          Name <span className="text-text-tertiary font-normal">(required)</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g., Production API Key"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="mb-5">
        <label className="block text-[13px] font-medium text-foreground mb-2">
          Rate Limit (requests/minute)
        </label>
        <InlineSelect
          value={rateLimit}
          options={RATE_LIMIT_OPTIONS}
          onChange={(value) => setRateLimit(Number(value))}
        />
      </div>

      <DialogFooter className="mt-6">
        <button
          onClick={onClose}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none cursor-pointer border border-border bg-transparent shadow-sm hover:bg-bg-hover text-white h-9 px-4 py-2"
        >
          Cancel
        </button>
        <button
          disabled={!name.trim() || isPending}
          onClick={handleSave}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none cursor-pointer border border-border bg-transparent shadow-sm hover:bg-bg-hover text-white h-9 px-4 py-2"
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {isPending ? "Saving..." : "Save Changes"}
        </button>
      </DialogFooter>
    </Dialog>
  );
}
