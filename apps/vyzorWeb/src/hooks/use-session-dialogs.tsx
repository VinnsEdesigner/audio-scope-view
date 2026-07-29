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

export interface UseSessionDialogsOptions {
  mode?: "live" | "playback";
  recording?: Recording;
  recordingId?: string;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

export function useSessionDialogs({
  mode = "live",
  recording,
  recordingId,
  canvasRef,
}: UseSessionDialogsOptions) {
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

  // Recording hooks
  const renameRecording = useRenameRecording();
  const deleteRecording = useDeleteRecording();

  // Effective recording ID
  const effectiveRecordingId = recordingId ?? recording?.id;

  // Handlers for SessionSidebar callbacks
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
        {/* Display Settings */}
        <AnchoredDialog isOpen={displaySettingsOpen} onClose={handleCloseDisplaySettings}>
          <DisplaySettingsDialog
            isOpen={displaySettingsOpen}
            onClose={handleCloseDisplaySettings}
          />
        </AnchoredDialog>

        {/* Trigger Settings */}
        {!isPlayback && (
          <AnchoredDialog isOpen={triggerSettingsOpen} onClose={handleCloseTriggerSettings}>
            <TriggerSettingsDialog
              isOpen={triggerSettingsOpen}
              onClose={handleCloseTriggerSettings}
              mode={mode}
            />
          </AnchoredDialog>
        )}

        {/* Measurements */}
        <AnchoredDialog isOpen={measurementsOpen} onClose={handleCloseMeasurements}>
          <MeasurementsDialog isOpen={measurementsOpen} onClose={handleCloseMeasurements} />
        </AnchoredDialog>

        {/* Export */}
        {canvasRef && (
          <AnchoredDialog isOpen={exportOpen} onClose={handleCloseExport}>
            <ExportDialog
              isOpen={exportOpen}
              onClose={handleCloseExport}
              canvasRef={canvasRef}
              mode={mode}
            />
          </AnchoredDialog>
        )}

        {/* Recording Info */}
        {isPlayback && effectiveRecordingId && (
          <AnchoredDialog isOpen={recordingInfoOpen} onClose={handleCloseRecordingInfo}>
            <RecordingInfoDialog
              isOpen={recordingInfoOpen}
              onClose={handleCloseRecordingInfo}
              recordingId={effectiveRecordingId}
            />
          </AnchoredDialog>
        )}

        {/* Rename Dialog */}
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

        {/* Delete Dialog */}
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
