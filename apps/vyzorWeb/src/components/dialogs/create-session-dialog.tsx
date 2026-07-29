import * as React from "react";
import { Dialog, DialogFooter } from "../ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useStartSession } from "../../hooks";

interface CreateSessionDialogProperties {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateSessionDialog({
  isOpen,
  onClose,
}: CreateSessionDialogProperties): React.ReactElement | undefined {
  const { showToast } = useToast();
  const startSession = useStartSession();

  const [name, setName] = React.useState("");

  const isLoading = startSession.isPending;

  React.useEffect(() => {
    if (isOpen && !name) {
      const now = new Date();
      const dateString = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const timeString = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      setName(`Session ${dateString} ${timeString}`);
    }
  }, [isOpen, name]);

  const handleClose = () => {
    if (!isLoading) {
      setName("");
      onClose();
    }
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      showToast({ message: "Session name is required", type: "warning" });
      return;
    }

    try {
      await startSession.mutateAsync();
      showToast({ message: "Session started successfully!", type: "success" });
      handleClose();
    } catch (error) {
      showToast({
        message: `Failed to start session: ${error instanceof Error ? error.message : "Unknown error"}`,
        type: "error",
      });
    }
  };

  if (!isOpen) return undefined;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Start New Session"
      maxWidth="max-w-[480px]"
    >
      <div className="space-y-5">
        {/* Session Name */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Session Name</label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter session name"
            disabled={isLoading}
            className="w-full px-4 py-2.5 bg-bg-primary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent disabled:opacity-50"
          />
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
          {isLoading ? "Starting..." : "Start Session"}
        </button>
      </DialogFooter>
    </Dialog>
  );
}
