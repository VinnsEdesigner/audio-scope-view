import * as React from "react";
import { useRenameRecording, useDeleteRecording } from "./use-recordings";

// ─────────────────────────────────────────────────────────────────────────────
// RN SESSION DIALOGS ADAPTATION (DATA LAYER ONLY)
//
// The web hook coupled the rename/delete data mutations with the dialog JSX
// (AnchoredDialog, DisplaySettingsDialog, TriggerSettingsDialog, etc. from
// @/components). The RN dialog components do not exist yet (a later phase), so
// this port DROPS the `Dialogs` memo and its return entirely. What remains is
// the data layer: the open/close state booleans, the rename/delete mutation
// logic (handleRenameConfirm / handleDeleteConfirm), and the `handlers` return
// object that screens wire up to their own (future) RN dialogs.
//
// Other removed web-only dependencies:
//   • @/components/dialogs + @/components/ui/anchored-dialog — no RN dialogs yet.
//   • @/lib/format-error — errors are stringified inline instead.
//   • @/hooks (useToast) — RN has no toast system yet; showToast calls are
//     replaced with console.warn / console.error so failures still surface.
// ─────────────────────────────────────────────────────────────────────────────

export interface Recording {
  id: string;
  name: string;
  duration: number;
  createdAt: string;
  size: number;
}

export interface UseSessionDialogsOptions {
  mode?: "live" | "playback";
  recording?: Recording;
  recordingId?: string;
  // Kept for interface parity with the web hook. RN has no HTMLCanvasElement;
  // the future RN export dialog will take a native view/snapshot ref instead.
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function useSessionDialogs({
  mode = "live",
  recording,
  recordingId,
  canvasRef,
}: UseSessionDialogsOptions) {
  const isPlayback = mode === "playback";

  const [displaySettingsOpen, setDisplaySettingsOpen] = React.useState(false);
  const [triggerSettingsOpen, setTriggerSettingsOpen] = React.useState(false);
  const [measurementsOpen, setMeasurementsOpen] = React.useState(false);
  const [recordingInfoOpen, setRecordingInfoOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);

  const [renameDialogOpen, setRenameDialogOpen] = React.useState(false);
  const [renameValue, setRenameValue] = React.useState("");

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  const [renameRecording, { loading: isRenaming }] = useRenameRecording();
  const [deleteRecording, { loading: isDeleting }] = useDeleteRecording();

  const effectiveRecordingId = recordingId ?? recording?.id;

  const handleOpenDisplaySettings = React.useCallback(() => {
    setDisplaySettingsOpen(true);
  }, []);

  const handleOpenTriggerSettings = React.useCallback(() => {
    setTriggerSettingsOpen(true);
  }, []);

  const handleOpenMeasurements = React.useCallback(() => {
    setMeasurementsOpen(true);
  }, []);

  const handleOpenExport = React.useCallback(() => {
    setExportOpen(true);
  }, []);

  const handleOpenRecordingInfo = React.useCallback(() => {
    setRecordingInfoOpen(true);
  }, []);

  const handleRename = React.useCallback(() => {
    if (recording) {
      setRenameValue(recording.name);
      setRenameDialogOpen(true);
    }
  }, [recording]);

  const handleDelete = React.useCallback(() => {
    setDeleteDialogOpen(true);
  }, []);

  const handleRenameConfirm = React.useCallback(async () => {
    const idToRename = recording?.id;
    const previousName = recording?.name;

    // The web hook read the dialog input via renameDialogInputReference (a DOM
    // ref from @/components/dialogs). That component doesn't exist on RN yet,
    // so we fall back to the renameValue state that the future RN dialog will
    // populate via onChange.
    const nameToSet = renameValue.trim();
    if (idToRename && nameToSet) {
      try {
        setRenameDialogOpen(false);
        await renameRecording({ variables: { id: idToRename, name: nameToSet } });
        console.warn(
          previousName === nameToSet
            ? "Recording name unchanged"
            : `Recording renamed to "${nameToSet}"`,
        );
      } catch (error) {
        console.error(`Failed to rename recording: ${formatError(error)}`);
      }
    }
  }, [recording, renameValue, renameRecording]);

  const handleDeleteConfirm = React.useCallback(async () => {
    const recordingName = recording?.name;
    if (recording) {
      try {
        await deleteRecording({ variables: { id: recording.id } });
        setDeleteDialogOpen(false);
        console.warn(`Recording "${recordingName}" deleted`);
      } catch (error) {
        console.error(`Failed to delete recording: ${formatError(error)}`);
      }
    }
  }, [recording, deleteRecording]);

  const handleCloseDisplaySettings = React.useCallback(() => setDisplaySettingsOpen(false), []);
  const handleCloseTriggerSettings = React.useCallback(() => setTriggerSettingsOpen(false), []);
  const handleCloseMeasurements = React.useCallback(() => setMeasurementsOpen(false), []);
  const handleCloseRecordingInfo = React.useCallback(() => setRecordingInfoOpen(false), []);
  const handleCloseExport = React.useCallback(() => setExportOpen(false), []);
  const handleCloseRename = React.useCallback(() => setRenameDialogOpen(false), []);
  const handleCloseDelete = React.useCallback(() => setDeleteDialogOpen(false), []);

  // The web hook returned a `Dialogs` memo (JSX) here. Dropped on RN — the
  // dialog components don't exist yet. The open/close state and close handlers
  // are exposed instead so screens can drive their own (future) RN dialogs.
  return {
    handlers: {
      onOpenDisplaySettings: handleOpenDisplaySettings,
      onOpenTriggerSettings: handleOpenTriggerSettings,
      onOpenMeasurements: handleOpenMeasurements,
      onOpenExport: handleOpenExport,
      onOpenRecordingInfo: handleOpenRecordingInfo,
      onRename: handleRename,
      onDelete: handleDelete,
    },
    dialogs: {
      isPlayback,
      effectiveRecordingId,
      displaySettingsOpen,
      triggerSettingsOpen,
      measurementsOpen,
      recordingInfoOpen,
      exportOpen,
      renameDialogOpen,
      deleteDialogOpen,
      renameValue,
      isRenaming,
      isDeleting,
      onCloseDisplaySettings: handleCloseDisplaySettings,
      onCloseTriggerSettings: handleCloseTriggerSettings,
      onCloseMeasurements: handleCloseMeasurements,
      onCloseRecordingInfo: handleCloseRecordingInfo,
      onCloseExport: handleCloseExport,
      onCloseRename: handleCloseRename,
      onCloseDelete: handleCloseDelete,
      onRenameChange: setRenameValue,
      onRenameConfirm: handleRenameConfirm,
      onDeleteConfirm: handleDeleteConfirm,
    },
  };
}
