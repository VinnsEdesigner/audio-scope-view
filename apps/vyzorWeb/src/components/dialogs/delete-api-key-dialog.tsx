import { useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import type { ApiKey } from "@/hooks/use-api-keys";
import { useDeleteApiKey } from "@/hooks/use-api-keys";
import { useToast } from "@/hooks";
import { cn } from "@/lib/utilities";

interface DeleteApiKeyDialogProperties {
  isOpen: boolean;
  onClose: () => void;
  apiKey: ApiKey | undefined;
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label
      className={`flex items-center gap-3 p-3 rounded-md cursor-pointer transition-all ${
        checked
          ? "bg-destructive/10 border border-destructive/40"
          : "bg-destructive/5 border border-destructive/20 hover:bg-destructive/8"
      }`}
    >
      <div
        className={`w-[18px] h-[18px] border rounded flex items-center justify-center transition-all ${
          checked ? "bg-destructive border-destructive" : "border border-border-default"
        }`}
        onClick={(event_) => {
          event_.preventDefault();
          onChange(!checked);
        }}
      >
        {checked && <Check size={12} className="text-white" />}
      </div>
      <span className="text-sm text-foreground" onClick={() => onChange(!checked)}>
        {label}
      </span>
    </label>
  );
}

export function DeleteApiKeyDialog({ isOpen, onClose, apiKey }: DeleteApiKeyDialogProperties) {
  const { showToast } = useToast();
  const [deleteApiKey, { loading: isPending }] = useDeleteApiKey();
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);

  const handleDelete = () => {
    if (!apiKey) return;
    deleteApiKey({
      variables: { id: apiKey.id },
      onCompleted: () => {
        onClose();
        showToast({
          message: `API key "${apiKey.name}" deleted successfully`,
          type: "success",
        });
        setDeleteConfirmed(false);
      },
      onError: (error: Error) => {
        showToast({
          message: `Failed to delete API key: ${error.message || "Unknown error"}`,
          type: "error",
        });
      },
    });
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Delete API Key" maxWidth="max-w-sm">
      <div className="flex flex-col items-center mb-6">
        <div className="w-12 h-12 bg-destructive/15 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6 text-destructive" />
        </div>
        <div className="text-center">
          <h3 className="text-[15px] font-semibold text-foreground mb-2">
            Are you sure you want to delete this API key?
          </h3>
          <p className="text-[13px] text-text-secondary leading-relaxed">
            This action cannot be undone. Any applications using this key will immediately lose
            access.
          </p>
        </div>
      </div>

      {apiKey && (
        <div className="bg-bg-primary border border-border-subtle rounded-md p-3.5 mb-5">
          <div className="text-sm font-medium text-foreground mb-1">{apiKey.name}</div>
          <div className="text-xs font-mono text-text-tertiary">
            vyz_live_••••••••••••{apiKey.id.slice(-4)}
          </div>
        </div>
      )}

      <Checkbox
        checked={deleteConfirmed}
        onChange={setDeleteConfirmed}
        label="Yes, delete this API key permanently"
      />

      <DialogFooter className="mt-6">
        <button
          onClick={onClose}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer border border-border bg-transparent shadow-sm hover:bg-bg-hover hover:text-foreground h-9 px-4 py-2"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={!deleteConfirmed || isPending}
          className={cn(
            "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer h-9 px-4 py-2",
            !deleteConfirmed || isPending
              ? "bg-transparent text-text-secondary border border-border"
              : "bg-transparent text-destructive border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive",
          )}
        >
          {isPending ? "Deleting..." : "Delete API Key"}
        </button>
      </DialogFooter>
    </Dialog>
  );
}
