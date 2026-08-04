import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { InlineSelect } from "@/components/ui/inline-select";
import { useToast } from "@/hooks";
import { useCreateApiKey } from "@/hooks/use-api-keys";
import type { CreateApiKeyInput } from "@/hooks/use-api-keys";

const RATE_LIMIT_OPTIONS = [
  { value: 30, label: "30 req/min" },
  { value: 60, label: "60 req/min" },
  { value: 100, label: "100 req/min" },
  { value: 120, label: "120 req/min" },
  { value: 200, label: "200 req/min" },
  { value: 500, label: "500 req/min" },
  { value: 1000, label: "1000 req/min" },
] as const;

const EXPIRY_OPTIONS = [
  { value: "", label: "Never" },
  { value: 24, label: "24 hours" },
  { value: 168, label: "7 days" },
  { value: 720, label: "30 days" },
  { value: 2160, label: "90 days" },
  { value: 8760, label: "1 year" },
] as const;

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
        <InlineSelect
          value={rateLimit}
          options={RATE_LIMIT_OPTIONS}
          onChange={(value) => setRateLimit(Number(value))}
        />
      </div>

      <div className="mb-5">
        <label className="block text-[13px] font-medium text-foreground mb-2">Expires</label>
        <InlineSelect
          value={expiry}
          options={EXPIRY_OPTIONS}
          onChange={(value) => setExpiry(value === "" ? undefined : Number(value))}
          placeholder="Never"
        />
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
