import * as React from "react";
import { useRenameRecording, useDeleteRecording } from "./use-recordings";
import { AnchoredDialog } from "@/components/ui/anchored-dialog";
import {
  DisplaySettingsDialog,
  TriggerSettingsDialog,
  MeasurementsDialog,
  ExportDialog,
  RecordingInfoDialog,
  RenameDialog,
  DeleteConfirmationDialog,
} from "@/components/dialogs";

export interface Recording {
  id: string;
  name: string;
  duration: number;
  createdAt: string;
  size: number;
}

export interface UseScopeDialogsOptions {
  mode?: "live" | "playback";
  recording?: Recording;
  recordingId?: string;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

export function useScopeDialogs({
  mode = "live",
  recording,
  recordingId,
  canvasRef,
}: UseScopeDialogsOptions) {
  const isPlayback = mode === "playback";

  // Dialog open states
  const [displaySettingsOpen, setDisplaySettingsOpen] = React.useState(false);
  const [triggerSettingsOpen, setTriggerSettingsOpen] = React.useState(false);
  const [measurementsOpen, setMeasurementsOpen] = React.useState(false);
  const [recordingInfoOpen, setRecordingInfoOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);

  // Rename dialog state
  const [renameDialogOpen, setRenameDialogOpen] = React.useState(false);
  const [renameValue, setRenameValue] = React.useState("");

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  // Anchor rect for dialog positioning
  const [dialogAnchorRects, setDialogAnchorRects] = React.useState<Record<string, DOMRect | null>>({});

  // Recording hooks
  const renameRecording = useRenameRecording();
  const deleteRecording = useDeleteRecording();

  // Effective recording ID
  const effectiveRecordingId = recordingId ?? recording?.id;

  // Helper to capture anchor rect
  const captureAnchor = React.useCallback((event: React.MouseEvent) => {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    return rect;
  }, []);

  // Handlers for ScopeSidebar callbacks - they capture the button rect
  const handleOpenDisplaySettings = React.useCallback((event?: React.MouseEvent) => {
    if (event?.currentTarget) {
      setDialogAnchorRects(prev => ({ ...prev, display: (event.currentTarget as HTMLElement).getBoundingClientRect() }));
    }
    setDisplaySettingsOpen(true);
  }, []);

  const handleOpenTriggerSettings = React.useCallback((event?: React.MouseEvent) => {
    if (event?.currentTarget) {
      setDialogAnchorRects(prev => ({ ...prev, trigger: (event.currentTarget as HTMLElement).getBoundingClientRect() }));
    }
    setTriggerSettingsOpen(true);
  }, []);

  const handleOpenMeasurements = React.useCallback((event?: React.MouseEvent) => {
    if (event?.currentTarget) {
      setDialogAnchorRects(prev => ({ ...prev, measure: (event.currentTarget as HTMLElement).getBoundingClientRect() }));
    }
    setMeasurementsOpen(true);
  }, []);

  const handleOpenExport = React.useCallback((event?: React.MouseEvent) => {
    if (event?.currentTarget) {
      setDialogAnchorRects(prev => ({ ...prev, export: (event.currentTarget as HTMLElement).getBoundingClientRect() }));
    }
    setExportOpen(true);
  }, []);

  const handleOpenRecordingInfo = React.useCallback((event?: React.MouseEvent) => {
    if (event?.currentTarget) {
      setDialogAnchorRects(prev => ({ ...prev, info: (event.currentTarget as HTMLElement).getBoundingClientRect() }));
    }
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
    if (recording && renameValue.trim()) {
      await renameRecording.mutateAsync({ id: recording.id, name: renameValue.trim() });
      setRenameDialogOpen(false);
    }
  }, [recording, renameValue, renameRecording]);

  const handleDeleteConfirm = React.useCallback(async () => {
    if (recording) {
      await deleteRecording.mutateAsync(recording.id);
      setDeleteDialogOpen(false);
    }
  }, [recording, deleteRecording]);

  // Close handlers for dialogs
  const handleCloseDisplaySettings = React.useCallback(() => setDisplaySettingsOpen(false), []);
  const handleCloseTriggerSettings = React.useCallback(() => setTriggerSettingsOpen(false), []);
  const handleCloseMeasurements = React.useCallback(() => setMeasurementsOpen(false), []);
  const handleCloseRecordingInfo = React.useCallback(() => setRecordingInfoOpen(false), []);
  const handleCloseExport = React.useCallback(() => setExportOpen(false), []);
  const handleCloseRename = React.useCallback(() => setRenameDialogOpen(false), []);
  const handleCloseDelete = React.useCallback(() => setDeleteDialogOpen(false), []);

  const Dialogs = React.useMemo(
    () => () => (
      <>
        {/* Display Settings - Anchored */}
        <AnchoredDialog
          isOpen={displaySettingsOpen}
          onClose={handleCloseDisplaySettings}
          title="Display Settings"
          anchorRect={dialogAnchorRects.display}
          maxWidth="max-w-sm"
        >
          <DisplaySettingsDialog isOpen={displaySettingsOpen} onClose={handleCloseDisplaySettings} />
        </AnchoredDialog>

        {/* Trigger Settings - Anchored */}
        {!isPlayback && (
          <AnchoredDialog
            isOpen={triggerSettingsOpen}
            onClose={handleCloseTriggerSettings}
            title="Trigger Settings"
            anchorRect={dialogAnchorRects.trigger}
            maxWidth="max-w-sm"
          >
            <TriggerSettingsDialog
              isOpen={triggerSettingsOpen}
              onClose={handleCloseTriggerSettings}
              mode={mode}
            />
          </AnchoredDialog>
        )}

        {/* Measurements - Anchored */}
        <AnchoredDialog
          isOpen={measurementsOpen}
          onClose={handleCloseMeasurements}
          title="Measurements"
          anchorRect={dialogAnchorRects.measure}
          maxWidth="max-w-sm"
        >
          <MeasurementsDialog isOpen={measurementsOpen} onClose={handleCloseMeasurements} />
        </AnchoredDialog>

        {/* Export - Anchored */}
        {canvasRef && (
          <AnchoredDialog
            isOpen={exportOpen}
            onClose={handleCloseExport}
            title="Export"
            anchorRect={dialogAnchorRects.export}
            maxWidth="max-w-sm"
          >
            <ExportDialog
              isOpen={exportOpen}
              onClose={handleCloseExport}
              canvasRef={canvasRef}
              mode={mode}
            />
          </AnchoredDialog>
        )}

        {/* Recording Info - Anchored */}
        {isPlayback && effectiveRecordingId && (
          <AnchoredDialog
            isOpen={recordingInfoOpen}
            onClose={handleCloseRecordingInfo}
            title="Recording Info"
            anchorRect={dialogAnchorRects.info}
            maxWidth="max-w-sm"
          >
            <RecordingInfoDialog
              isOpen={recordingInfoOpen}
              onClose={handleCloseRecordingInfo}
              recordingId={effectiveRecordingId}
            />
          </AnchoredDialog>
        )}

        {/* Rename Dialog - centered modal (for forms) */}
        {renameDialogOpen && (
          <RenameDialog
            isOpen={renameDialogOpen}
            value={renameValue}
            onChange={setRenameValue}
            onConfirm={handleRenameConfirm}
            onCancel={handleCloseRename}
            isLoading={renameRecording.isPending}
          />
        )}

        {/* Delete Dialog - centered modal (for confirmations) */}
        {deleteDialogOpen && (
          <DeleteConfirmationDialog
            isOpen={deleteDialogOpen}
            recordingName={recording?.name}
            onConfirm={handleDeleteConfirm}
            onCancel={handleCloseDelete}
            isLoading={deleteRecording.isPending}
          />
        )}
      </>
    ),
    [
      isPlayback,
      mode,
      displaySettingsOpen,
      triggerSettingsOpen,
      measurementsOpen,
      exportOpen,
      recordingInfoOpen,
      renameDialogOpen,
      renameValue,
      deleteDialogOpen,
      recording,
      effectiveRecordingId,
      canvasRef,
      dialogAnchorRects,
      handleCloseDisplaySettings,
      handleCloseTriggerSettings,
      handleCloseMeasurements,
      handleCloseExport,
      handleCloseRecordingInfo,
      handleCloseRename,
      handleCloseDelete,
      handleRenameConfirm,
      handleDeleteConfirm,
      renameRecording.isPending,
      deleteRecording.isPending,
    ],
  );

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
    Dialogs,
  };
}
