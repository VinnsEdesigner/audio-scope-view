import { useState, useEffect } from "react";
import { Plus, Copy, Pencil, Trash2, Key, MoreVertical, Gauge } from "lucide-react";
import { useToast } from "@/hooks";
import { useApiKeys, type ApiKey } from "@/hooks/use-api-keys";
import {
  DeleteApiKeyDialog,
  CreateApiKeyDialog,
  ShowApiKeyDialog,
  EditApiKeyDialog,
} from "@/components/dialogs";
import { cn } from "@/lib/utilities";
import { Skeleton } from "@/components/ui/skeleton";

function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp || !Number.isFinite(timestamp)) return "Never";
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isExpired(expiresAt: number | null | undefined): boolean {
  if (!expiresAt) return false;
  return expiresAt * 1000 < Date.now();
}

function ApiKeysCard({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border border-border-subtle bg-bg-secondary overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

export function ApiKeys() {
  const { data: apiKeys, isLoading, error } = useApiKeys();
  const { showToast } = useToast();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [showKeyDialogOpen, setShowKeyDialogOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<ApiKey | undefined>();
  const [keyToEdit, setKeyToEdit] = useState<ApiKey | undefined>();
  const [createdKey, setCreatedKey] = useState<
    { id: string; key: string; name: string } | undefined
  >();
  const [openMenuId, setOpenMenuId] = useState<string | undefined>();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClick = () => setOpenMenuId(undefined);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Handle errors with toast notifications
  useEffect(() => {
    if (error) {
      const errorMessage = error.message || "";

      // Check if it's a network error (can't reach server)
      if (
        errorMessage.includes("fetch") ||
        errorMessage.includes("network") ||
        errorMessage.includes("NetworkError") ||
        errorMessage.includes("Failed to fetch") ||
        errorMessage.includes("net::ERR")
      ) {
        showToast({
          message: "Unable to reach server. Please check your connection.",
          type: "error",
        });
      } else {
        // Extract status code if present
        const statusMatch = errorMessage.match(/status.*?(\d+)/i) || errorMessage.match(/(\d{3})/);
        if (statusMatch) {
          showToast({
            message: `Response not successful, received status code ${statusMatch[1]}`,
            type: "error",
          });
        } else {
          showToast({
            message: `Request failed: ${errorMessage}`,
            type: "error",
          });
        }
      }
    }
  }, [error, showToast]);

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    showToast({
      message: "API key ID copied to clipboard",
      type: "success",
    });
  };

  const handleDeleteClick = (apiKey: ApiKey) => {
    setKeyToDelete(apiKey);
    setDeleteDialogOpen(true);
  };

  const handleEditClick = (apiKey: ApiKey) => {
    setKeyToEdit(apiKey);
    setEditDialogOpen(true);
  };

  const handleCreateClick = () => {
    setCreateDialogOpen(true);
  };

  const handleCreated = (result: { id: string; key: string; name: string }) => {
    setCreateDialogOpen(false);
    setCreatedKey(result);
    setShowKeyDialogOpen(true);
  };

  const handleCreateDialogClose = () => {
    setCreateDialogOpen(false);
  };

  const handleShowKeyDialogClose = () => {
    setShowKeyDialogOpen(false);
    setCreatedKey(undefined);
  };

  return (
    <div className="w-full min-h-screen">
      <div className="w-full px-4 py-6 sm:px-6 md:px-8 lg:px-12 xl:px-16">
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              API Keys
            </h1>
            <p className="mt-1 text-sm text-text-tertiary">
              Manage your API keys for external access to audio scopes
            </p>
          </div>
          <button
            onClick={handleCreateClick}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer bg-bg-elevated border border-border-subtle hover:bg-bg-hover text-foreground h-9 px-4 py-2"
          >
            <Plus size={16} />
            Create API Key
          </button>
        </header>

        {isLoading ? (
          <ApiKeysCard className="overflow-visible">
            <div className="hidden md:grid grid-cols-[1fr_140px_120px_80px_40px] gap-4 px-6 py-3 bg-bg-elevated border-b border-border-subtle overflow-visible">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Name
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Created
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Expires
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Status
              </span>
              <span className="sr-only">Actions</span>
            </div>
            <div className="divide-y divide-border-subtle">
              {[1, 2, 3, 4].map((index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_140px_120px_80px_40px] gap-4 px-6 py-5"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <div className="hidden md:flex items-center">
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <div className="hidden md:flex items-center">
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <div className="hidden md:flex items-center justify-end">
                    <Skeleton className="h-5 w-14 rounded" />
                  </div>
                  <div className="flex items-center justify-end">
                    <Skeleton className="w-8 h-8 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </ApiKeysCard>
        ) : !apiKeys || apiKeys.length === 0 ? (
          <ApiKeysCard className="p-12 text-center">
            <div className="w-20 h-20 bg-bg-elevated border border-border-subtle rounded-lg flex items-center justify-center mx-auto mb-6">
              <Key className="w-10 h-10 text-text-tertiary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No API keys yet</h3>
            <p className="text-sm text-text-tertiary mb-6 max-w-sm mx-auto">
              Create your first API key to start integrating with external applications
            </p>
            <button
              onClick={handleCreateClick}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer bg-bg-elevated border border-border-subtle hover:bg-bg-hover text-foreground h-9 px-4 py-2"
            >
              <Plus size={16} />
              Create API Key
            </button>
          </ApiKeysCard>
        ) : (
          <ApiKeysCard className="overflow-visible">
            <div className="hidden md:grid grid-cols-[1fr_140px_120px_80px_40px] gap-4 px-6 py-3 bg-bg-elevated border-b border-border-subtle overflow-visible">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Name
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Created
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Expires
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Status
              </span>
              <span className="sr-only">Actions</span>
            </div>

            <div className="divide-y divide-border-subtle">
              {apiKeys.map((apiKey) => {
                const expired = isExpired(apiKey.expiresAt);
                const status = apiKey.isValid ? (expired ? "expired" : "active") : "revoked";

                return (
                  <div
                    key={apiKey.id}
                    className="grid grid-cols-[1fr_140px_120px_80px_40px] gap-4 px-6 py-5 hover:bg-bg-hover transition-colors overflow-visible"
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-sm font-medium text-foreground truncate">
                        {apiKey.name}
                      </span>
                    </div>

                    <div className="hidden md:flex items-center text-sm text-text-secondary">
                      {formatDate(apiKey.createdAt)}
                    </div>

                    <div className="hidden md:flex items-center">
                      <span
                        className={cn(
                          "text-sm",
                          expired
                            ? "text-destructive"
                            : apiKey.expiresAt
                              ? "text-text-secondary"
                              : "text-text-tertiary",
                        )}
                      >
                        {apiKey.expiresAt ? formatDate(apiKey.expiresAt) : "Never"}
                      </span>
                    </div>

                    <div className="hidden md:flex items-center justify-end">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                          status === "active" && "bg-text-tertiary/10 text-text-tertiary",
                          status === "expired" && "bg-destructive/10 text-destructive",
                          status === "revoked" && "bg-text-tertiary/10 text-text-tertiary",
                        )}
                      >
                        {status}
                      </span>
                    </div>

                    <div className="flex items-center justify-end overflow-visible">
                      <div className="relative">
                        <button
                          onClick={(event_) => {
                            event_.stopPropagation();
                            setOpenMenuId(openMenuId === apiKey.id ? undefined : apiKey.id);
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-bg-elevated transition-all"
                          title="More options"
                        >
                          <MoreVertical size={16} className="text-text-secondary" />
                        </button>
                        {openMenuId === apiKey.id && (
                          <div className="absolute right-0 top-full mt-1 w-56 py-1 bg-bg-elevated border border-border-subtle rounded-lg shadow-lg z-50 overflow-visible">
                            <button
                              onClick={(event_) => {
                                event_.stopPropagation();
                                handleCopy(apiKey.id);
                                setOpenMenuId(undefined);
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-bg-hover transition-colors"
                            >
                              <Copy size={14} />
                              Copy ID
                            </button>
                            <button
                              onClick={(event_) => {
                                event_.stopPropagation();
                                handleEditClick(apiKey);
                                setOpenMenuId(undefined);
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-bg-hover transition-colors"
                            >
                              <Pencil size={14} />
                              Edit
                            </button>
                            <button
                              onClick={(event_) => {
                                event_.stopPropagation();
                                handleDeleteClick(apiKey);
                                setOpenMenuId(undefined);
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-bg-hover transition-colors"
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                            <div className="border-t border-border-subtle my-1" />
                            <div className="px-3 py-2">
                              <div className="flex items-center gap-2 text-sm text-text-secondary">
                                <Gauge size={14} className="text-text-tertiary" />
                                <span className="font-mono">{apiKey.rateLimitPerMinute}/min</span>
                              </div>
                              <p className="text-xs text-text-tertiary mt-1">
                                Rate limit per minute
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ApiKeysCard>
        )}
      </div>

      <DeleteApiKeyDialog
        isOpen={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setKeyToDelete(undefined);
        }}
        apiKey={keyToDelete}
      />

      <EditApiKeyDialog
        isOpen={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setKeyToEdit(undefined);
        }}
        apiKey={keyToEdit}
      />

      <CreateApiKeyDialog
        isOpen={createDialogOpen}
        onClose={handleCreateDialogClose}
        onCreated={handleCreated}
      />

      <ShowApiKeyDialog
        isOpen={showKeyDialogOpen}
        onClose={handleShowKeyDialogClose}
        createdKey={createdKey}
      />
    </div>
  );
}
