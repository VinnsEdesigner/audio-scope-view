import { useState, useEffect } from "react";
import { Plus, Copy, Pencil, Trash2, Key, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks";
import { useApiKeys, type ApiKey } from "@/hooks/use-api-keys";
import {
  DeleteApiKeyDialog,
  CreateApiKeyDialog,
  ShowApiKeyDialog,
  EditApiKeyDialog,
} from "@/components/dialogs";
import { cn } from "@/lib/utilities";

function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp) return "Never";
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
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-text-tertiary animate-spin" />
          </div>
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
          <ApiKeysCard className="overflow-hidden">
            <div className="hidden md:grid grid-cols-[1fr_140px_120px_100px_80px_100px] gap-4 px-6 py-3 bg-bg-elevated border-b border-border-subtle">
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
                Rate Limit
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Status
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary text-right">
                Actions
              </span>
            </div>

            <div className="divide-y divide-border-subtle">
              {apiKeys.map((apiKey) => {
                const expired = isExpired(apiKey.expiresAt);
                const status = apiKey.isValid ? (expired ? "expired" : "active") : "revoked";

                return (
                  <div
                    key={apiKey.id}
                    className="grid grid-cols-1 md:grid-cols-[1fr_140px_120px_100px_80px_100px] gap-4 px-6 py-5 hover:bg-bg-hover transition-colors"
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-sm font-medium text-foreground truncate">
                        {apiKey.name}
                      </span>
                      <span className="text-xs font-mono text-text-tertiary">
                        #{apiKey.id.slice(0, 8)}
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

                    <div className="hidden md:flex items-center gap-1.5 text-sm font-mono text-text-secondary">
                      <span className="w-3.5 h-3.5">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="w-full h-full"
                        >
                          <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
                        </svg>
                      </span>
                      {apiKey.rateLimitPerMinute}/min
                    </div>

                    <div className="hidden md:flex items-center">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                          status === "active" && "bg-success/10 text-success",
                          status === "expired" && "bg-destructive/10 text-destructive",
                          status === "revoked" && "bg-text-tertiary/10 text-text-tertiary",
                        )}
                      >
                        {status}
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleCopy(apiKey.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:text-foreground hover:bg-bg-elevated transition-all"
                        title="Copy ID"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditClick(apiKey)}
                        className="w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:text-foreground hover:bg-bg-elevated transition-all"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(apiKey)}
                        className="w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:text-destructive hover:bg-destructive/10 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
