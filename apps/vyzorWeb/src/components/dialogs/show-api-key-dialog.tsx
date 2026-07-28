import * as React from "react";
import { useState } from "react";
import { Copy, Check, AlertTriangle } from "lucide-react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utilities";

interface ShowApiKeyDialogProperties {
  isOpen: boolean;
  onClose: () => void;
  createdKey:
    | {
        id: string;
        key: string;
        name: string;
      }
    | undefined;
}

export function ShowApiKeyDialog({
  isOpen,
  onClose,
  createdKey,
}: ShowApiKeyDialogProperties): React.ReactElement | undefined {
  const [copied, setCopied] = useState(false);

  const handleCopyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setCopied(false);
    onClose();
  };

  if (!createdKey) return undefined;

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title="API Key Created" maxWidth="max-w-md">
      <div className="flex flex-col items-center mb-6">
        <div className="w-12 h-12 bg-bg-elevated rounded-full flex items-center justify-center mb-4">
          <Check className="w-6 h-6 text-success" />
        </div>
        <div className="text-center">
          <h3 className="text-[15px] font-semibold text-foreground mb-2">
            {createdKey.name} has been created
          </h3>
          <p className="text-[13px] text-text-secondary leading-relaxed">
            Copy your API key now. You won't be able to see it again.
          </p>
        </div>
      </div>

      <div className="mb-5">
        <label className="block text-[12px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">
          Your API Key
        </label>
        <div className="flex items-center gap-3 bg-bg-primary border border-border-subtle rounded-md p-3.5">
          <code className="flex-1 text-sm font-mono text-foreground break-all">
            {createdKey.key}
          </code>
          <button
            onClick={handleCopyKey}
            className={cn(
              "flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-md border transition-all",
              copied
                ? "bg-success/15 border-success text-success"
                : "bg-bg-elevated border-border-default text-text-secondary hover:border-accent hover:text-accent",
            )}
            title="Copy to clipboard"
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>
      </div>

      <div className="flex gap-3 bg-bg-elevated border border-border-default rounded-md p-3.5 mb-5">
        <AlertTriangle className="w-5 h-5 text-text-tertiary flex-shrink-0 mt-0.5" />
        <div>
          <div className="text-[13px] font-semibold text-foreground mb-1">
            Save your API key securely
          </div>
          <div className="text-[12px] text-text-secondary leading-relaxed">
            This is the only time you'll see this key. Copy it now and store it securely.
          </div>
        </div>
      </div>

      <div className="flex gap-3 mb-5">
        <div className="flex-1 bg-bg-primary border border-border-subtle rounded-md p-3 text-center">
          <div className="text-sm font-medium text-foreground mb-0.5">Read</div>
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Permissions</div>
        </div>
        <div className="flex-1 bg-bg-primary border border-border-subtle rounded-md p-3 text-center">
          <div className="text-sm font-medium text-foreground mb-0.5">-</div>
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Last used</div>
        </div>
        <div className="flex-1 bg-bg-primary border border-border-subtle rounded-md p-3 text-center">
          <div className="text-sm font-medium text-foreground mb-0.5">Today</div>
          <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Created</div>
        </div>
      </div>

      <DialogFooter className="mt-6 justify-center">
        <button
          onClick={handleClose}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none cursor-pointer border border-border bg-transparent shadow-sm hover:bg-bg-hover text-white h-9 px-4 py-2"
        >
          Done
        </button>
      </DialogFooter>
    </Dialog>
  );
}
