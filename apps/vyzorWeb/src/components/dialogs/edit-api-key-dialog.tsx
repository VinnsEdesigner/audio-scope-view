import { Dialog, DialogFooter } from "@/components/ui/dialog";
import type { ApiKey } from "@/hooks/use-api-keys";

interface EditApiKeyDialogProperties {
  isOpen: boolean;
  onClose: () => void;
  apiKey: ApiKey | undefined;
  onSave?: (name: string) => void;
}

export function EditApiKeyDialog({ isOpen, onClose, apiKey, onSave }: EditApiKeyDialogProperties) {
  const handleSave = () => {
    if (onSave && apiKey) {
      onSave(apiKey.name);
    }
    onClose();
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Edit API Key" maxWidth="max-w-md">
      <div className="mb-5">
        <label className="block text-[13px] font-medium text-foreground mb-2">
          Name <span className="text-text-tertiary font-normal">(required)</span>
        </label>
        <input
          type="text"
          defaultValue={apiKey?.name}
          placeholder="e.g., Production API Key"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="mb-5">
        <label className="block text-[13px] font-medium text-foreground mb-2">
          Description <span className="text-text-tertiary font-normal">(optional)</span>
        </label>
        <textarea
          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
          placeholder="Add a description..."
        />
      </div>

      <div className="mb-5">
        <label className="block text-[13px] font-medium text-foreground mb-2">
          Rate Limit (requests/minute)
        </label>
        <select
          defaultValue={apiKey?.rateLimitPerMinute ?? 60}
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
          onClick={handleSave}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none cursor-pointer border border-border bg-transparent shadow-sm hover:bg-bg-hover text-white h-9 px-4 py-2"
        >
          Save Changes
        </button>
      </DialogFooter>
    </Dialog>
  );
}
