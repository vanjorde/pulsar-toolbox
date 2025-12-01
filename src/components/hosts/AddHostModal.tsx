"use client";
import { useEffect, useState } from "react";
import type React from "react";
import type { Host } from "@/types/pulsar";
import { uid } from "@/lib/uid";

interface AddHostModalProps {
  isOpen: boolean;
  host?: Host;
  onClose: () => void;
  onAdd: (host: Host) => void;
  onUpdate?: (host: Host) => void;
  onDelete?: (hostId: string) => void;
}

type HostFormState = {
  name: string;
  adminBase: string;
  serviceUrl: string;
  adminCaPem: string;
  token: string;
  adminToken: string;
  tokenMode: "shared" | "split";
  isAdmin: boolean;
  allowedTopics: string[];
};

function getInitialFormState(host?: Host): HostFormState {
  if (!host) {
    return {
      name: "",
      adminBase: "http://localhost:8080",
      serviceUrl: "pulsar://localhost:6650",
      adminCaPem: "",
      token: "",
      adminToken: "",
      tokenMode: "shared",
      isAdmin: true,
      allowedTopics: [],
    };
  }

  const useSeparateAdminToken = Boolean(
    host.isAdmin && host.useSeparateAdminToken
  );
  return {
    name: host.name,
    adminBase: host.adminBase,
    serviceUrl: host.serviceUrl,
    adminCaPem: host.adminCaPem ?? "",
    token: host.token ?? "",
    adminToken: host.adminToken ?? "",
    tokenMode: useSeparateAdminToken ? "split" : "shared",
    isAdmin: host.isAdmin,
    allowedTopics: [...host.allowedTopics],
  };
}

export function AddHostModal({
  isOpen,
  host,
  onClose,
  onAdd,
  onUpdate,
  onDelete,
}: AddHostModalProps) {
  const [formData, setFormData] = useState<HostFormState>(() =>
    getInitialFormState(host)
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isServiceTokenVisible, setServiceTokenVisible] = useState(false);
  const [isAdminTokenVisible, setAdminTokenVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isEditMode = Boolean(host && onUpdate);

  useEffect(() => {
    if (isOpen) {
      setFormData(getInitialFormState(host));
      setShowDeleteConfirm(false);
      setShowAdvanced(false);
      setServiceTokenVisible(false);
      setAdminTokenVisible(false);
      setFormError(null);
    }
  }, [host, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim() || !formData.serviceUrl.trim()) {
      setFormError("Provide a host name and service URL.");
      return;
    }

    if (formData.isAdmin && !formData.adminBase.trim()) {
      setFormError("Admin hosts require an admin base URL.");
      return;
    }

    const sanitizedTopics = formData.allowedTopics
      .map((topic) => topic.trim())
      .filter((topic) => topic.length > 0);

    const trimmedToken = formData.token.trim();
    const trimmedAdminToken = formData.adminToken.trim();
    const useSeparateAdminToken =
      formData.isAdmin && formData.tokenMode === "split";

    if (useSeparateAdminToken && trimmedAdminToken.length === 0) {
      setFormError("Provide an admin token or switch back to a shared token.");
      return;
    }

    const payload = {
      name: formData.name.trim(),
      adminBase: formData.adminBase.trim(),
      serviceUrl: formData.serviceUrl.trim(),
      adminCaPem:
        formData.adminCaPem.trim().length > 0
          ? formData.adminCaPem.trim()
          : undefined,
      token: trimmedToken.length > 0 ? trimmedToken : null,
      adminToken: formData.isAdmin
        ? useSeparateAdminToken
          ? trimmedAdminToken.length > 0
            ? trimmedAdminToken
            : null
          : trimmedToken.length > 0
          ? trimmedToken
          : null
        : null,
      useSeparateAdminToken,
      isAdmin: formData.isAdmin,
      allowedTopics: sanitizedTopics,
    };

    if (isEditMode && host && onUpdate) {
      onUpdate({ ...host, ...payload });
    } else {
      const newHost: Host = {
        id: uid("host"),
        ...payload,
      };
      onAdd(newHost);
    }

    setFormData(getInitialFormState());
    setShowDeleteConfirm(false);
    setShowAdvanced(false);
    setServiceTokenVisible(false);
    setAdminTokenVisible(false);
    setFormError(null);
    onClose();
  };

  const handleClose = () => {
    setFormData(getInitialFormState(host));
    setShowDeleteConfirm(false);
    setShowAdvanced(false);
    setServiceTokenVisible(false);
    setAdminTokenVisible(false);
    setFormError(null);
    onClose();
  };

  const handleDelete = () => {
    if (!host || !onDelete) {
      setShowDeleteConfirm(false);
      return;
    }
    onDelete(host.id);
    setFormData(getInitialFormState());
    setShowDeleteConfirm(false);
    setShowAdvanced(false);
    setServiceTokenVisible(false);
    setAdminTokenVisible(false);
    setFormError(null);
    onClose();
  };

  const toggleAdminMode = (isAdmin: boolean) => {
    setFormData((prev) => ({
      ...prev,
      isAdmin,
      tokenMode: isAdmin ? prev.tokenMode : "shared",
      adminToken: isAdmin ? prev.adminToken : "",
    }));
    if (!isAdmin) {
      setAdminTokenVisible(false);
    }
    setFormError(null);
  };

  const toggleSeparateTokens = () => {
    setFormData((prev) => {
      const newMode = prev.tokenMode === "shared" ? "split" : "shared";
      if (newMode === "split" && prev.adminToken.trim().length === 0) {
        return {
          ...prev,
          tokenMode: newMode,
          adminToken: prev.token,
        };
      }
      if (newMode === "shared") {
        setAdminTokenVisible(false);
      }
      return {
        ...prev,
        tokenMode: newMode,
      };
    });
    setFormError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full h-[46rem] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/60 bg-gradient-to-b from-muted/30 to-transparent">
          <div>
            <h2 className="text-xl font-semibold text-foreground tracking-tight">
              {isEditMode ? "Edit Pulsar Host" : "Add Pulsar Host"}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isEditMode
                ? "Update your host configuration"
                : "Configure a new Pulsar connection"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Host Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground ring-primary transition-all"
                placeholder="Local Pulsar"
                required
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="block text-sm font-medium text-foreground">
                    Host Admin permissions
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.isAdmin
                      ? "Full admin access with tenant and topic discovery"
                      : "Limited to manually specified topics only (no auto discovery)"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleAdminMode(!formData.isAdmin)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ring-primary focus:ring-offset-2 cursor-pointer ${
                    formData.isAdmin ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                  role="switch"
                  aria-checked={formData.isAdmin}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      formData.isAdmin ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                formData.isAdmin
                  ? "max-h-[200px] opacity-100"
                  : "max-h-0 opacity-0"
              }`}
            >
              <div className="space-y-2 px-0.5">
                <label className="block text-sm font-medium text-foreground">
                  Admin Base URL
                </label>
                <input
                  type="url"
                  value={formData.adminBase}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      adminBase: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground ring-primary transition-all"
                  placeholder="http://localhost:8080"
                  required={formData.isAdmin}
                />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Use your Pulsar admin endpoint. SSL URLs such as{" "}
                  <code className="px-1.5 py-0.5 bg-muted rounded text-foreground">
                    pulsar+ssl://
                  </code>{" "}
                  or{" "}
                  <code className="px-1.5 py-0.5 bg-muted rounded text-foreground">
                    https://
                  </code>{" "}
                  are supported.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Pulsar service URL
              </label>
              <input
                type="text"
                value={formData.serviceUrl}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    serviceUrl: e.target.value,
                  }))
                }
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground ring-primary transition-all"
                placeholder="pulsar://localhost:6650"
                required
              />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Paste the broker service endpoint used by the native Pulsar
                client. SSL endpoints such as{" "}
                <code className="px-1.5 py-0.5 bg-muted rounded text-foreground">
                  pulsar+ssl://cluster.example.com:6651
                </code>{" "}
                are supported.
              </p>
            </div>

            <div className="border border-border rounded-xl overflow-hidden bg-muted/20">
              <button
                type="button"
                onClick={() => setShowAdvanced((prev) => !prev)}
                className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors group cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${
                      showAdvanced ? "rotate-90" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  Advanced options
                </span>
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  showAdvanced
                    ? "max-h-[2000px] opacity-100"
                    : "max-h-0 opacity-0"
                }`}
              >
                <div className="px-5 pb-5 pt-2 space-y-5 border-t border-border/60 bg-background/50">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-foreground mb-1">
                          Authentication Token
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {formData.isAdmin
                            ? formData.tokenMode === "shared"
                              ? "This token will be used for both Pulsar service and admin API requests"
                              : "Using separate tokens for service and admin endpoints"
                            : "Token for authenticating with the Pulsar service"}
                        </p>
                      </div>
                      <div
                        className={`transition-all duration-300 ease-in-out ${
                          formData.isAdmin
                            ? "opacity-100 translate-x-0"
                            : "opacity-0 translate-x-4 pointer-events-none"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={toggleSeparateTokens}
                          disabled={!formData.isAdmin}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ring-primary focus:ring-offset-2 cursor-pointer flex-shrink-0 ${
                            formData.tokenMode === "split"
                              ? "bg-primary"
                              : "bg-muted-foreground/30"
                          }`}
                          role="switch"
                          aria-checked={formData.tokenMode === "split"}
                          title="Use separate tokens for admin and service"
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                              formData.tokenMode === "split"
                                ? "translate-x-6"
                                : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div
                        className={`overflow-hidden transition-all duration-300 ease-in-out ${
                          formData.isAdmin && formData.tokenMode === "split"
                            ? "max-h-[200px] opacity-100"
                            : "max-h-0 opacity-0"
                        }`}
                      >
                        <div className="space-y-2 px-0.5 pb-0.5">
                          <label className="block text-xs font-medium text-muted-foreground">
                            Admin API Token
                          </label>
                          <div className="relative">
                            <input
                              type={isAdminTokenVisible ? "text" : "password"}
                              value={formData.adminToken}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  adminToken: e.target.value,
                                }))
                              }
                              className="w-full no-native-eye px-4 py-2.5 pr-12 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground ring-primary transition-all"
                              placeholder="Paste admin token"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setAdminTokenVisible((prev) => !prev)
                              }
                              className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              title={
                                isAdminTokenVisible
                                  ? "Hide token"
                                  : "Show token"
                              }
                            >
                              {isAdminTokenVisible ? (
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M9.88 9.88a3 3 0 104.24 4.24M12 7.5c1.7 0 3.264.75 4.318 1.956m2.064 2.324A10.45 10.45 0 0022.066 12C20.774 7.662 16.756 4.5 12 4.5S3 16.5 1.5 12z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M3 3l18 18"
                                  />
                                </svg>
                              ) : (
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M1.5 12c1.5-4.5 5.5-7.5 10.5-7.5s9 3 10.5 7.5c-1.5 4.5-5.5 7.5-10.5 7.5S3 16.5 1.5 12z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                  />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-muted-foreground">
                          {formData.isAdmin && formData.tokenMode === "split"
                            ? "Pulsar Service Token"
                            : formData.isAdmin
                            ? "Combined Token (Service + Admin)"
                            : "Service Token"}
                        </label>
                        <div className="relative">
                          <input
                            type={isServiceTokenVisible ? "text" : "password"}
                            value={formData.token}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                token: e.target.value,
                              }))
                            }
                            className="w-full no-native-eye px-4 py-2.5 pr-12 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground ring-primary transition-all"
                            placeholder="Paste authentication token"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setServiceTokenVisible((prev) => !prev)
                            }
                            className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            title={
                              isServiceTokenVisible
                                ? "Hide token"
                                : "Show token"
                            }
                          >
                            {isServiceTokenVisible ? (
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M9.88 9.88a3 3 0 104.24 4.24M12 7.5c1.7 0 3.264.75 4.318 1.956m2.064 2.324A10.45 10.45 0 0022.066 12C20.774 7.662 16.756 4.5 12 4.5S3 16.5 1.5 12z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 3l18 18"
                                />
                              </svg>
                            ) : (
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M1.5 12c1.5-4.5 5.5-7.5 10.5-7.5s9 3 10.5 7.5c-1.5 4.5-5.5 7.5-10.5 7.5S3 16.5 1.5 12z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Tokens are stored encrypted in the os keyring
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">
                      Custom CA certificate (optional)
                    </label>
                    <textarea
                      value={formData.adminCaPem}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          adminCaPem: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 bg-background border border-border rounded-lg text-xs font-mono text-foreground placeholder-muted-foreground ring-primary transition-all resize-none h-32"
                      placeholder={`Paste the PEM contents that sign ${formData.adminBase}`}
                    />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Provide the PEM for the certificate authority that signs
                      your admin endpoint if it is self-signed. When set, the CA
                      is bundled with requests instead of relying on the system
                      trust store. The same bundle is reused by the native
                      Pulsar client.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {formError && (
              <div className="flex items-start gap-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 px-4 py-3 rounded-lg animate-in slide-in-from-top-2 duration-200">
                <svg
                  className="w-5 h-5 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{formError}</span>
              </div>
            )}
          </form>
        </div>

        <div className="border-t border-border/60 px-6 py-4 bg-gradient-to-t from-muted/30 to-transparent">
          {isEditMode ? (
            <div className="flex flex-col gap-4">
              {onDelete && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {!showDeleteConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="cursor-pointer px-4 py-2 text-sm bg-destructive text-white hover:bg-destructive/90 rounded-lg transition-colors"
                    >
                      Delete Host
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3 text-sm animate-in slide-in-from-left-2 duration-200">
                      <span className="text-muted-foreground font-medium">
                        Delete this host?
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-4 py-2 text-sm font-medium bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="px-4 py-2 text-sm font-medium bg-destructive text-white hover:bg-destructive/90 rounded-lg transition-all shadow-sm cursor-pointer"
                      >
                        Confirm Delete
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-5 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      onClick={handleSubmit}
                      className="px-5 py-2 text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-all shadow-sm cursor-pointer"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              )}

              {!onDelete && (
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-5 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    onClick={handleSubmit}
                    className="px-5 py-2 text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-all shadow-sm cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                className="px-5 py-2 text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-all shadow-sm cursor-pointer"
              >
                Add Host
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
