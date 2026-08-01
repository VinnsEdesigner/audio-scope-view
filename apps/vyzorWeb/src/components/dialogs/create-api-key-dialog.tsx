import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks";
import { useCreateApiKey } from "@/hooks/use-api-keys";
import type { CreateApiKeyInput } from "@/hooks/use-api-keys";

interface CreateApiKeyDialogProperties {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (result: { id: string; key: string; name: string }) => void;
}

export function CreateApiKeyDialog({ isOpen, onClose, onCreated }: CreateApiKeyDialogProperties) {
  const { showToast } = useToast();
  const [createApiKey, { loading }] = useCreateApiKey();

  const [name, setName] = useState("");
  const [rateLimit, setRateLimit] = useState(60);
  const [expiry, setExpiry] = useState<number | undefined>();
  const [error, setError] = useState<string | undefined>();

  const handleCreate = async () => {
    if (!name.trim()) return;

    setError(undefined);
    const input: CreateApiKeyInput = {
      name: name.trim(),
      rateLimitPerMinute: rateLimit,
      expiresInHours: expiry,
    };

    try {
      const result = await createApiKey({ variables: { input } });
      onCreated(result.data!.createApiKey);
      showToast({
        message: `API key "${result.data!.createApiKey.name}" created successfully`,
        type: "success",
      });
      // Reset form and close
      setName("");
      setRateLimit(60);
      setExpiry(undefined);
      onClose();
    } catch (error_) {
      const message = error_ instanceof Error ? error_.message : "Failed to create API key";
      setError(message);
      showToast({
        message,
        type: "error",
      });
    }
  };

  const handleClose = () => {
    setName("");
    setRateLimit(60);
    setExpiry(undefined);
    setError(undefined);
    onClose();
  };

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title="Create API Key" maxWidth="max-w-md">
      <div className="mb-5">
        <label className="block text-[13px] font-medium text-foreground mb-2">
          Name <span className="text-text-tertiary font-normal">(required)</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(event_) => setName(event_.target.value)}
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
          onChange={(event_) => setRateLimit(Number(event_.target.value))}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {[30, 60, 100, 120, 200, 500, 1000].map((limit) => (
            <option key={limit} value={limit}>
              {limit} req/min
            </option>
          ))}
        </select>
      </div>

      <div className="mb-5">
        <label className="block text-[13px] font-medium text-foreground mb-2">Expires</label>
        <select
          value={expiry ?? ""}
          onChange={(event_) =>
            setExpiry(event_.target.value ? Number(event_.target.value) : undefined)
          }
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Never</option>
          <option value="24">24 hours</option>
          <option value="168">7 days</option>
          <option value="720">30 days</option>
          <option value="2160">90 days</option>
          <option value="8760">1 year</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      <DialogFooter className="mt-6">
        <button
          onClick={handleClose}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none cursor-pointer border border-border bg-transparent shadow-sm hover:bg-bg-hover text-white h-9 px-4 py-2"
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={!name.trim() || loading}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none cursor-pointer border border-border bg-transparent shadow-sm hover:bg-bg-hover text-white h-9 px-4 py-2"
        >
          {loading ? "Creating..." : "Create API Key"}
        </button>
      </DialogFooter>
    </Dialog>
  );
}
