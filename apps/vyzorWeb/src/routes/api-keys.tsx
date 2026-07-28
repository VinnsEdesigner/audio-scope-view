import { useState } from "react";
import { useApiKeys, useDeleteApiKey, useCreateApiKey } from "@/hooks/use-api-keys";
import {
  Plus,
  Copy,
  Pencil,
  Trash2,
  Key,
  AlertCircle,
  RefreshCw,
  Check,
  AlertTriangle,
} from "lucide-react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type { ApiKey, CreateApiKeyInput } from "@audio-scope-view/api-client/domain/api-key";

function MiniBlocksSpinner({ size = 16 }: { size?: number }) {
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <style>{`
 @keyframes mini-blocks-spin {
 0% { transform: rotate(0deg); }
 100% { transform: rotate(360deg); }
 }
 .mini-blocks-spin {
 animation: mini-blocks-spin 2s linear infinite;
 }
 `}</style>
      <div
        className="mini-blocks-spin absolute inset-0 rounded-full border-2 border-current"
        style={{ borderColor: "white" }}
      />
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

function formatDate(timestamp: number | null): string {
  if (!timestamp) return "Never";
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isExpired(expiresAt: number | null): boolean {
  if (!expiresAt) return false;
  return expiresAt * 1000 < Date.now();
}

function Button({
  className = "",
  variant = "default",
  size = "default",
  loading = false,
  disabled = false,
  children,
  ...properties
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "icon" | "sm";
  loading?: boolean;
}) {
  const baseStyles =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer";

  const variants = {
    default: "bg-bg-secondary text-foreground border border-border shadow-sm hover:bg-bg-hover",
    outline:
      "border border-border bg-transparent shadow-sm hover:bg-bg-hover hover:text-foreground",
    ghost: "hover:bg-bg-hover hover:text-foreground",
    destructive:
      "bg-transparent text-text-secondary border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive",
  };

  const sizes = {
    default: "h-9 px-4 py-2",
    icon: "h-9 w-9",
    sm: "h-8 rounded-md px-3 text-xs",
  };

  return (
    <button
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        loading && "bg-accent-hover",
        className,
      )}
      disabled={disabled || loading}
      {...properties}
    >
      {loading && <MiniBlocksSpinner size={16} />}
      {loading ? "Loading..." : children}
    </button>
  );
}

function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={`bg-bg-secondary border border-border-subtle rounded-lg overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-3 p-3 rounded-md cursor-pointer transition-all",
        checked
          ? "bg-destructive/10 border border-destructive/40"
          : "bg-destructive/5 border border-destructive/20 hover:bg-destructive/8",
      )}
    >
      <div
        className={cn(
          "w-[18px] h-[18px] border rounded flex items-center justify-center transition-all",
          checked ? "bg-destructive border-destructive" : "border border-border-default",
        )}
        onClick={(_evt) => {
          e.preventDefault();
          onChange(!checked);
        }}
      >
        {checked && <Check size={12} className="text-white" />}
      </div>
      <span className="text-sm text-foreground" onClick={() => onChange(!checked)}>
        {label}
      </span>
    </label>
  );
}

export function ApiKeys() {
  const { data: apiKeys, isLoading, error, refetch } = useApiKeys();
  const deleteApiKey = useDeleteApiKey();
  const createApiKey = useCreateApiKey();
  const { addToast } = useToast();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [showKeyDialogOpen, setShowKeyDialogOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<ApiKey | null>(null);
  const [, setKeyToEdit] = useState<ApiKey | null>(null);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [createdKey, setCreatedKey] = useState<{ id: string; key: string; name: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  const [editName, setEditName] = useState("");
  const [createName, setCreateName] = useState("");
  const [createRateLimit, setCreateRateLimit] = useState(60);
  const [createExpiry, setCreateExpiry] = useState<number | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    addToast("success", "API key ID copied to clipboard");
  };

  const handleDeleteClick = (apiKey: ApiKey) => {
    setKeyToDelete(apiKey);
    setDeleteConfirmed(false);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!keyToDelete) return;
    setDeletingId(keyToDelete.id);
    try {
      await deleteApiKey.mutateAsync(keyToDelete.id);
      setDeleteDialogOpen(false);
      setKeyToDelete(null);
      addToast("success", `API key "${keyToDelete.name}" deleted successfully`);
    } catch (error_) {
      addToast(
        "error",
        `Failed to delete API key: ${error_ instanceof Error ? error_.message : "Unknown error"}`,
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditClick = (apiKey: ApiKey) => {
    setKeyToEdit(apiKey);
    setEditName(apiKey.name);
    setEditDialogOpen(true);
  };

  const handleCreateClick = () => {
    setCreateName("");
    setCreateRateLimit(60);
    setCreateExpiry(null);
    setCreateError(null);
    setCreateDialogOpen(true);
  };

  const handleCreate = async () => {
    setCreateError(null);
    try {
      const input: CreateApiKeyInput = {
        name: createName,
        rateLimitPerMinute: createRateLimit,
        expiresInHours: createExpiry || undefined,
      };
      const result = await createApiKey.mutateAsync(input);
      setCreatedKey(result);
      setCreateDialogOpen(false);
      setShowKeyDialogOpen(true);
      addToast("success", `API key "${result.name}" created successfully`);
    } catch (error_) {
      const message = error_ instanceof Error ? error_.message : "Failed to create API key";
      setCreateError(message);
      addToast("error", message);
      console.error("Failed to create API key:", error_);
    }
  };

  const handleCopyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
      addToast("success", "API key copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="w-full min-h-screen">
      {}
      <div className="w-full px-4 py-6 sm:px-6 md:px-8 lg:px-12 xl:px-16">
        {}
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              API Keys
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Manage your API keys for external access to audio scopes
            </p>
          </div>
          <Button
            className="bg-accent hover:bg-accent-hover text-white gap-2"
            onClick={handleCreateClick}
          >
            <Plus size={16} />
            Create API Key
          </Button>
        </header>

        {}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-text-tertiary animate-spin" />
          </div>
        ) : error ? (
          <Card className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Failed to load API keys</h3>
            <p className="text-sm text-text-secondary mb-4">{error.message}</p>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Try again
            </Button>
          </Card>
        ) : !apiKeys || apiKeys.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="w-20 h-20 bg-bg-elevated border border-border-subtle rounded-lg flex items-center justify-center mx-auto mb-6">
              <Key className="w-10 h-10 text-text-tertiary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No API keys yet</h3>
            <p className="text-sm text-text-tertiary mb-6 max-w-sm mx-auto">
              Create your first API key to start integrating with external applications
            </p>
            <Button
              className="bg-accent hover:bg-accent-hover text-white gap-2"
              onClick={handleCreateClick}
            >
              <Plus size={16} />
              Create API Key
            </Button>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            {}
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

            {}
            <div className="divide-y divide-border-subtle">
              {apiKeys.map((apiKey) => {
                const expired = isExpired(apiKey.expiresAt);
                const status = apiKey.isValid ? (expired ? "expired" : "active") : "revoked";

                return (
                  <div
                    key={apiKey.id}
                    className="grid grid-cols-1 md:grid-cols-[1fr_140px_120px_100px_80px_100px] gap-4 px-6 py-5 hover:bg-bg-hover transition-colors"
                  >
                    {}
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-sm font-medium text-foreground truncate">
                        {apiKey.name}
                      </span>
                      <span className="text-xs font-mono text-text-tertiary">
                        #{apiKey.id.slice(0, 8)}
                      </span>
                    </div>

                    {}
                    <div className="hidden md:flex items-center text-sm text-text-secondary">
                      {formatDate(apiKey.createdAt)}
                    </div>

                    {}
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

                    {}
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

                    {}
                    <div className="hidden md:flex items-center">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium",
                          status === "active"
                            ? "bg-bg-primary text-rose-400"
                            : "bg-bg-primary text-text-tertiary",
                        )}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {status === "active"
                          ? "Active"
                          : status === "expired"
                            ? "Expired"
                            : "Revoked"}
                      </span>
                    </div>

                    {}
                    <div className="hidden md:flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleCopy(apiKey.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-sm border border-transparent hover:bg-bg-elevated hover:border-border text-text-tertiary hover:text-text-secondary transition-all"
                        title="Copy key"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditClick(apiKey)}
                        className="w-8 h-8 flex items-center justify-center rounded-sm border border-transparent hover:bg-bg-elevated hover:border-border text-text-tertiary hover:text-text-secondary transition-all"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(apiKey)}
                        disabled={deletingId === apiKey.id}
                        className="w-8 h-8 flex items-center justify-center rounded-sm border border-transparent hover:bg-destructive/10 text-text-tertiary hover:text-destructive transition-all disabled:opacity-50"
                        title="Delete"
                      >
                        {deletingId === apiKey.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {}
        {apiKeys && apiKeys.length > 0 && (
          <div className="mt-4 space-y-3 md:hidden">
            {apiKeys.map((apiKey) => (
              <Card key={apiKey.id} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-foreground">{apiKey.name}</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs",
                      apiKey.isValid
                        ? "bg-rose-400/10 text-rose-400"
                        : "bg-bg-hover text-text-tertiary",
                    )}
                  >
                    <span className="w-1 h-1 rounded-full bg-current" />
                    {apiKey.isValid ? "Active" : "Revoked"}
                  </span>
                </div>
                <div className="text-xs text-text-secondary mb-3 space-y-1">
                  <p>Created: {formatDate(apiKey.createdAt)}</p>
                  <p>Rate: {apiKey.rateLimitPerMinute}/min</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(apiKey.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-sm border border-border hover:bg-bg-hover text-text-tertiary transition-all"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEditClick(apiKey)}
                    className="w-8 h-8 flex items-center justify-center rounded-sm border border-border hover:bg-bg-hover text-text-tertiary transition-all"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(apiKey)}
                    disabled={deletingId === apiKey.id}
                    className="w-8 h-8 flex items-center justify-center rounded-sm border border-border hover:bg-destructive/10 text-text-tertiary hover:text-destructive transition-all disabled:opacity-50"
                  >
                    {deletingId === apiKey.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {}
      <Dialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title="Delete API Key"
        maxWidth="max-w-sm"
      >
        {}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-destructive/15 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <div className="text-center">
            <h3 className="text-[15px] font-semibold text-foreground mb-2">
              Are you sure you want to delete this API key?
            </h3>
            <p className="text-[13px] text-text-secondary leading-relaxed">
              This action cannot be undone. Any applications using this key will immediately lose
              access.
            </p>
          </div>
        </div>

        {}
        {keyToDelete && (
          <div className="bg-bg-primary border border-border-subtle rounded-md p-3.5 mb-5">
            <div className="text-sm font-medium text-foreground mb-1">{keyToDelete.name}</div>
            <div className="text-xs font-mono text-text-tertiary">
              vyz_live_••••••••••••{keyToDelete.id.slice(-4)}
            </div>
          </div>
        )}

        {}
        <Checkbox
          checked={deleteConfirmed}
          onChange={setDeleteConfirmed}
          label="Yes, delete this API key permanently"
        />

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!deleteConfirmed || deletingId === keyToDelete?.id}
            loading={deletingId === keyToDelete?.id}
          >
            Delete API Key
          </Button>
        </DialogFooter>
      </Dialog>

      {}
      <Dialog
        isOpen={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        title="Edit API Key"
        maxWidth="max-w-md"
      >
        {}
        <div className="mb-5">
          <label className="block text-[13px] font-medium text-foreground mb-2">
            Name <span className="text-text-tertiary font-normal">(required)</span>
          </label>
          <input
            type="text"
            value={editName}
            onChange={(_evt) => setEditName(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-bg-primary border border-border-default rounded-md text-sm text-foreground placeholder:text-text-tertiary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            placeholder="e.g., Production API Key"
          />
        </div>

        {}
        <div className="mb-5">
          <label className="block text-[13px] font-medium text-foreground mb-2">
            Description <span className="text-text-tertiary font-normal">(optional)</span>
          </label>
          <textarea
            className="w-full px-3.5 py-2.5 bg-bg-primary border border-border-default rounded-md text-sm text-foreground placeholder:text-text-tertiary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all min-h-[80px] resize-y"
            placeholder="Add a description..."
          />
        </div>

        {}
        <div className="mb-5">
          <label className="block text-[13px] font-medium text-foreground mb-2">
            Rate Limit (requests/minute)
          </label>
          <select
            value={createRateLimit}
            onChange={(_evt) => setCreateRateLimit(Number(e.target.value))}
            className="w-full px-3.5 py-2.5 bg-bg-primary border border-border-default rounded-md text-sm text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
          >
            {[30, 60, 100, 120, 200, 500, 1000].map((limit) => (
              <option key={limit} value={limit}>
                {limit} req/min
              </option>
            ))}
          </select>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => setEditDialogOpen(false)}>Save Changes</Button>
        </DialogFooter>
      </Dialog>

      {}
      <Dialog
        isOpen={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        title="Create API Key"
        maxWidth="max-w-md"
      >
        {}
        <div className="mb-5">
          <label className="block text-[13px] font-medium text-foreground mb-2">
            Name <span className="text-text-tertiary font-normal">(required)</span>
          </label>
          <input
            type="text"
            value={createName}
            onChange={(_evt) => setCreateName(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-bg-primary border border-border-default rounded-md text-sm text-foreground placeholder:text-text-tertiary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            placeholder="e.g., Production API Key"
          />
        </div>

        {}
        <div className="mb-5">
          <label className="block text-[13px] font-medium text-foreground mb-2">
            Rate Limit (requests/minute)
          </label>
          <select
            value={createRateLimit}
            onChange={(_evt) => setCreateRateLimit(Number(e.target.value))}
            className="w-full px-3.5 py-2.5 bg-bg-primary border border-border-default rounded-md text-sm text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
          >
            {[30, 60, 100, 120, 200, 500, 1000].map((limit) => (
              <option key={limit} value={limit}>
                {limit} req/min
              </option>
            ))}
          </select>
        </div>

        {}
        <div className="mb-5">
          <label className="block text-[13px] font-medium text-foreground mb-2">Expires</label>
          <select
            value={createExpiry ?? ""}
            onChange={(_evt) =>
              setCreateExpiry(e.target.value ? Number(e.target.value) : undefined)
            }
            className="w-full px-3.5 py-2.5 bg-bg-primary border border-border-default rounded-md text-sm text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
          >
            <option value="">Never</option>
            <option value="24">24 hours</option>
            <option value="168">7 days</option>
            <option value="720">30 days</option>
            <option value="2160">90 days</option>
            <option value="8760">1 year</option>
          </select>
        </div>

        {}
        {createError && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{createError}</span>
            </div>
          </div>
        )}

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!createName.trim()}
            loading={createApiKey.isPending}
          >
            Create API Key
          </Button>
        </DialogFooter>
      </Dialog>

      {}
      <Dialog
        isOpen={showKeyDialogOpen}
        onClose={() => {
          setShowKeyDialogOpen(false);
          setCreatedKey(null);
        }}
        title="API Key Created"
        maxWidth="max-w-md"
      >
        {}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-bg-elevated rounded-full flex items-center justify-center mb-4">
            <Check className="w-6 h-6 text-text-secondary" />
          </div>
          <div className="text-center">
            <h3 className="text-[15px] font-semibold text-foreground mb-2">
              {createdKey?.name} has been created
            </h3>
            <p className="text-[13px] text-text-secondary leading-relaxed">
              Copy your API key now. You won't be able to see it again.
            </p>
          </div>
        </div>

        {/* Key display */}
        <div className="mb-5">
          <label className="block text-[12px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">
            Your API Key
          </label>
          <div className="flex items-center gap-3 bg-bg-primary border border-border-subtle rounded-md p-3.5">
            <code className="flex-1 text-sm font-mono text-foreground break-all">
              {createdKey?.key}
            </code>
            <button
              onClick={handleCopyKey}
              className={cn(
                "flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-md border transition-all",
                copied
                  ? "bg-success/15 border-success text-success"
                  : "bg-bg-elevated border-border-default text-text-secondary hover:border-accent hover:text-accent",
              )}
              title="Copy to clipboard"
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>
        </div>

        {/* Warning box */}
        <div className="flex gap-3 bg-bg-elevated border border-border-default rounded-md p-3.5 mb-5">
          <AlertTriangle className="w-5 h-5 text-text-tertiary flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-[13px] font-semibold text-foreground mb-1">
              Save your API key securely
            </div>
            <div className="text-[12px] text-text-secondary leading-relaxed">
              This is the only time you'll see this key. Copy it now and store it securely.
            </div>
          </div>
        </div>

        {}
        <div className="flex gap-3 mb-5">
          <div className="flex-1 bg-bg-primary border border-border-subtle rounded-md p-3 text-center">
            <div className="text-sm font-medium text-foreground mb-0.5">Read</div>
            <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
              Permissions
            </div>
          </div>
          <div className="flex-1 bg-bg-primary border border-border-subtle rounded-md p-3 text-center">
            <div className="text-sm font-medium text-foreground mb-0.5">0</div>
            <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Last used</div>
          </div>
          <div className="flex-1 bg-bg-primary border border-border-subtle rounded-md p-3 text-center">
            <div className="text-sm font-medium text-foreground mb-0.5">Today</div>
            <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Created</div>
          </div>
        </div>

        <DialogFooter className="mt-6 justify-center">
          <Button
            onClick={() => {
              setShowKeyDialogOpen(false);
              setCreatedKey(null);
            }}
          >
            Done
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
