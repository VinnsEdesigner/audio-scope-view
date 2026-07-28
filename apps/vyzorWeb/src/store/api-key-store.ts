

import { create } from "zustand";
import type { CreatedApiKey } from "@audio-scope-view/api-client/domain/api-key";

export interface ApiKeyState {
 
 isCreateModalOpen: boolean;
 isEditModalOpen: boolean;
 isDeleteConfirmOpen: boolean;

 
 selectedKeyId: string | undefined;

 
 newlyCreatedKey: CreatedApiKey | undefined;

 
 isCreating: boolean;
 isUpdating: boolean;
 isDeleting: boolean;
}

export interface ApiKeyActions {
 
 openCreateModal: () => void;
 closeCreateModal: () => void;
 openEditModal: (keyId: string) => void;
 closeEditModal: () => void;
 openDeleteConfirm: (keyId: string) => void;
 closeDeleteConfirm: () => void;

 
 setNewlyCreatedKey: (key: CreatedApiKey | undefined) => void;
 clearNewlyCreatedKey: () => void;

 
 setIsCreating: (isCreating: boolean) => void;
 setIsUpdating: (isUpdating: boolean) => void;
 setIsDeleting: (isDeleting: boolean) => void;

 
 reset: () => void;
}

export type ApiKeyStore = ApiKeyState & ApiKeyActions;

const initialState: ApiKeyState = {
 isCreateModalOpen: false,
 isEditModalOpen: false,
 isDeleteConfirmOpen: false,
 selectedKeyId: undefined,
 newlyCreatedKey: undefined,
 isCreating: false,
 isUpdating: false,
 isDeleting: false,
};

export const useApiKeyStore = create<ApiKeyStore>()((set) => ({
 ...initialState,

 
 openCreateModal: () => set({ isCreateModalOpen: true }),
 closeCreateModal: () => set({ isCreateModalOpen: false }),
 openEditModal: (keyId) => set({ isEditModalOpen: true, selectedKeyId: keyId }),
 closeEditModal: () => set({ isEditModalOpen: false, selectedKeyId: undefined }),
 openDeleteConfirm: (keyId) => set({ isDeleteConfirmOpen: true, selectedKeyId: keyId }),
 closeDeleteConfirm: () => set({ isDeleteConfirmOpen: false, selectedKeyId: undefined }),

 
 setNewlyCreatedKey: (key) => set({ newlyCreatedKey: key }),
 clearNewlyCreatedKey: () => set({ newlyCreatedKey: undefined }),

 
 setIsCreating: (isCreating) => set({ isCreating }),
 setIsUpdating: (isUpdating) => set({ isUpdating }),
 setIsDeleting: (isDeleting) => set({ isDeleting }),

 
 reset: () => set(initialState),
}));
