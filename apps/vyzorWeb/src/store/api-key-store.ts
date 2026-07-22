/**
 * API Key Store - UI state for API key management
 * Note: Actual API key data is fetched via React Query hooks (useApiKeys, etc.)
 * This store manages UI state like modals, selected keys, and create key result
 */

import { create } from "zustand";
import type { CreatedApiKey } from "@audio-scope-view/api-client/domain/api-key";

export interface ApiKeyState {
  // Modal states
  isCreateModalOpen: boolean;
  isEditModalOpen: boolean;
  isDeleteConfirmOpen: boolean;

  // Selected key for editing/deletion
  selectedKeyId: string | null;

  // Create key result (the full key is only shown once at creation)
  newlyCreatedKey: CreatedApiKey | null;

  // Loading/error states for UI feedback
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
}

export interface ApiKeyActions {
  // Modal actions
  openCreateModal: () => void;
  closeCreateModal: () => void;
  openEditModal: (keyId: string) => void;
  closeEditModal: () => void;
  openDeleteConfirm: (keyId: string) => void;
  closeDeleteConfirm: () => void;

  // Created key management
  setNewlyCreatedKey: (key: CreatedApiKey | null) => void;
  clearNewlyCreatedKey: () => void;

  // Loading state actions
  setIsCreating: (isCreating: boolean) => void;
  setIsUpdating: (isUpdating: boolean) => void;
  setIsDeleting: (isDeleting: boolean) => void;

  // Reset
  reset: () => void;
}

export type ApiKeyStore = ApiKeyState & ApiKeyActions;

const initialState: ApiKeyState = {
  isCreateModalOpen: false,
  isEditModalOpen: false,
  isDeleteConfirmOpen: false,
  selectedKeyId: null,
  newlyCreatedKey: null,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
};

export const useApiKeyStore = create<ApiKeyStore>()((set) => ({
  ...initialState,

  // Modal actions
  openCreateModal: () => set({ isCreateModalOpen: true }),
  closeCreateModal: () => set({ isCreateModalOpen: false }),
  openEditModal: (keyId) => set({ isEditModalOpen: true, selectedKeyId: keyId }),
  closeEditModal: () => set({ isEditModalOpen: false, selectedKeyId: null }),
  openDeleteConfirm: (keyId) => set({ isDeleteConfirmOpen: true, selectedKeyId: keyId }),
  closeDeleteConfirm: () => set({ isDeleteConfirmOpen: false, selectedKeyId: null }),

  // Created key management
  setNewlyCreatedKey: (key) => set({ newlyCreatedKey: key }),
  clearNewlyCreatedKey: () => set({ newlyCreatedKey: null }),

  // Loading state actions
  setIsCreating: (isCreating) => set({ isCreating }),
  setIsUpdating: (isUpdating) => set({ isUpdating }),
  setIsDeleting: (isDeleting) => set({ isDeleting }),

  // Reset
  reset: () => set(initialState),
}));
