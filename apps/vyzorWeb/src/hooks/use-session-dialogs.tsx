import * as React from "react";
import { useRenameRecording, useDeleteRecording } from "./use-recordings";
import { AnchoredDialog } from "@/components/ui/anchored-dialog";
import { formatError } from "@/lib/format-error";
import { renameDialogInputReference } from "@/components/dialogs/rename-dialog-constants";
import { useToast } from "@/hooks";
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
  const { showToast } = useToast();

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

    const nameToSet = renameDialogInputReference.current?.value.trim() || renameValue.trim();
    if (idToRename && nameToSet) {
      try {
        setRenameDialogOpen(false);
        await renameRecording({ variables: { id: idToRename, name: nameToSet } });
        showToast({
          message:
            previousName === nameToSet
              ? "Recording name unchanged"
              : `Recording renamed to "${nameToSet}"`,
          type: "success",
        });
      } catch (error) {
        showToast({
          message: `Failed to rename recording: ${formatError(error)}`,
          type: "error",
        });
      }
    }
  }, [recording, renameValue, renameRecording, showToast]);

  const handleDeleteConfirm = React.useCallback(async () => {
    const recordingName = recording?.name;
    if (recording) {
      try {
        await deleteRecording({ variables: { id: recording.id } });
        setDeleteDialogOpen(false);
        showToast({
          message: `Recording "${recordingName}" deleted`,
          type: "success",
        });
      } catch (error) {
        showToast({
          message: `Failed to delete recording: ${formatError(error)}`,
          type: "error",
        });
      }
    }
  }, [recording, deleteRecording, showToast]);

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
        {}
        <AnchoredDialog isOpen={displaySettingsOpen} onClose={handleCloseDisplaySettings}>
          <DisplaySettingsDialog
            isOpen={displaySettingsOpen}
            onClose={handleCloseDisplaySettings}
          />
        </AnchoredDialog>

        {}
        {!isPlayback && (
          <AnchoredDialog isOpen={triggerSettingsOpen} onClose={handleCloseTriggerSettings}>
            <TriggerSettingsDialog
              isOpen={triggerSettingsOpen}
              onClose={handleCloseTriggerSettings}
              mode={mode}
            />
          </AnchoredDialog>
        )}

        {}
        <AnchoredDialog isOpen={measurementsOpen} onClose={handleCloseMeasurements}>
          <MeasurementsDialog isOpen={measurementsOpen} onClose={handleCloseMeasurements} />
        </AnchoredDialog>

        {}
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

        {}
        {isPlayback && effectiveRecordingId && (
          <AnchoredDialog isOpen={recordingInfoOpen} onClose={handleCloseRecordingInfo}>
            <RecordingInfoDialog
              isOpen={recordingInfoOpen}
              onClose={handleCloseRecordingInfo}
              recordingId={effectiveRecordingId}
            />
          </AnchoredDialog>
        )}

        {}
        {renameDialogOpen && (
          <RenameDialog
            isOpen={renameDialogOpen}
            value={renameValue}
            onChange={setRenameValue}
            onConfirm={handleRenameConfirm}
            onCancel={handleCloseRename}
            isLoading={isRenaming}
          />
        )}

        {}
        {deleteDialogOpen && (
          <DeleteConfirmationDialog
            isOpen={deleteDialogOpen}
            recordingName={recording?.name}
            onConfirm={handleDeleteConfirm}
            onCancel={handleCloseDelete}
            isLoading={isDeleting}
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
      isRenaming,
      isDeleting,
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
