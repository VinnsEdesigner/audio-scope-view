import { useState, useEffect } from "react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import type { ApiKey, UpdateApiKeyInput } from "@/hooks/use-api-keys";
import { useUpdateApiKey } from "@/hooks/use-api-keys";
import { useToast } from "@/hooks";

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
          message: `Failed to update API key: ${error.message || "Unknown error"}`,
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
        <select
          value={rateLimit}
          onChange={(event) => setRateLimit(Number(event.target.value))}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {[30, 60, 100, 120, 200, 500, 1000].map((limit) => (
            <option key={limit} value={limit}>
              {limit} req/min
            </option>
          ))}
        </select>
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
          {isPending ? "Saving..." : "Save Changes"}
        </button>
      </DialogFooter>
    </Dialog>
  );
}
