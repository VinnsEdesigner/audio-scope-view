import * as React from "react";
import { Dialog, DialogFooter } from "../ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useCreateScope, useUIStore } from "../../hooks";

interface CreateScopeDialogProperties {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateScopeDialog({
  isOpen,
  onClose,
}: CreateScopeDialogProperties): React.ReactElement | undefined {
  const { showToast } = useToast();
  const createScope = useCreateScope();
  const { waveformColor } = useUIStore();

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [sampleRate, setSampleRate] = React.useState(48000);
  const [bufferSize, setBufferSize] = React.useState(1024);

  const isLoading = createScope.isPending;

  React.useEffect(() => {
    if (isOpen && !name) {
      const now = new Date();
      const dateString = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const timeString = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      setName(`Scope ${dateString} ${timeString}`);
    }
  }, [isOpen, name]);

  const handleClose = () => {
    if (!isLoading) {
      setName("");
      setDescription("");
      setSampleRate(48000);
      setBufferSize(1024);
      onClose();
    }
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      showToast({ message: "Scope name is required", type: "warning" });
      return;
    }

    try {
      await createScope.mutateAsync({
        name: trimmedName,
        description: description.trim() || undefined,
        sampleRate,
        bufferSize,
      });
      showToast({ message: "Scope created successfully!", type: "success" });
      handleClose();
    } catch (error) {
      showToast({
        message: `Failed to create scope: ${error instanceof Error ? error.message : "Unknown error"}`,
        type: "error",
      });
    }
  };

  if (!isOpen) return undefined;

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title="Create New Scope" maxWidth="max-w-[480px]">
      <div className="space-y-5">
        {/* Scope Name */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Scope Name</label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter scope name"
            disabled={isLoading}
            className="w-full px-4 py-2.5 bg-bg-primary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent disabled:opacity-50"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Description <span className="text-text-tertiary font-normal">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Enter a description for this scope"
            rows={3}
            disabled={isLoading}
            className="w-full px-4 py-2.5 bg-bg-primary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent disabled:opacity-50 resize-none"
          />
        </div>

        {/* Sample Rate */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Sample Rate</label>
          <div className="relative">
            <select
              value={sampleRate}
              onChange={(event) => setSampleRate(Number(event.target.value))}
              disabled={isLoading}
              className="w-full px-4 py-2.5 pr-10 bg-bg-primary border border-border rounded-lg text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent disabled:opacity-50"
            >
              <option value={8000}>8,000 Hz</option>
              <option value={11025}>11,025 Hz</option>
              <option value={16000}>16,000 Hz</option>
              <option value={22050}>22,050 Hz</option>
              <option value={44100}>44,100 Hz</option>
              <option value={48000}>48,000 Hz</option>
              <option value={96000}>96,000 Hz</option>
              <option value={192000}>192,000 Hz</option>
            </select>
          </div>
          <p className="mt-1.5 text-xs text-text-tertiary">
            Higher sample rates capture more detail but use more storage
          </p>
        </div>

        {/* Buffer Size */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Buffer Size</label>
          <div className="relative">
            <select
              value={bufferSize}
              onChange={(event) => setBufferSize(Number(event.target.value))}
              disabled={isLoading}
              className="w-full px-4 py-2.5 pr-10 bg-bg-primary border border-border rounded-lg text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent disabled:opacity-50"
            >
              <option value={256}>256 samples</option>
              <option value={512}>512 samples</option>
              <option value={1024}>1,024 samples</option>
              <option value={2048}>2,048 samples</option>
              <option value={4096}>4,096 samples</option>
              <option value={8192}>8,192 samples</option>
              <option value={16384}>16,384 samples</option>
            </select>
          </div>
          <p className="mt-1.5 text-xs text-text-tertiary">
            Buffer size affects how much data is captured per read cycle
          </p>
        </div>
      </div>

      <DialogFooter className="flex gap-2">
        <button
          onClick={handleClose}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none cursor-pointer border border-border bg-transparent shadow-sm hover:bg-bg-hover text-white h-9 px-4 py-2"
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={isLoading || !name.trim()}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none cursor-pointer border border-border bg-accent shadow-sm hover:bg-accent/90 text-white h-9 px-4 py-2 flex-1"
        >
          {isLoading ? "Creating..." : "Create Scope"}
        </button>
      </DialogFooter>
    </Dialog>
  );
}
