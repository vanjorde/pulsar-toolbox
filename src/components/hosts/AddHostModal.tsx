"use client";
import { useState } from "react";
import type React from "react";
import type { Host } from "@/types/pulsar";
import { uid } from "@/lib/uid";

interface AddHostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (host: Host) => void;
}

export function AddHostModal({ isOpen, onClose, onAdd }: AddHostModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    adminBase: "http://localhost:8080",
    wsBase: "ws://localhost:8080",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !formData.name.trim() ||
      !formData.adminBase.trim() ||
      !formData.wsBase.trim()
    ) {
      return;
    }

    const host: Host = {
      id: uid("host"),
      name: formData.name.trim(),
      adminBase: formData.adminBase.trim(),
      wsBase: formData.wsBase.trim(),
    };

    onAdd(host);
    setFormData({
      name: "",
      adminBase: "http://localhost:8080",
      wsBase: "ws://localhost:8080",
    });
    onClose();
  };

  const handleClose = () => {
    setFormData({
      name: "",
      adminBase: "http://localhost:8080",
      wsBase: "ws://localhost:8080",
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between p-6 border-b border-border">
        <h2 className="text-xl font-semibold text-foreground">
          Add Pulsar Host
        </h2>
      </div>
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Host Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Local Pulsar"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Admin Base URL
            </label>
            <input
              type="url"
              value={formData.adminBase}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, adminBase: e.target.value }))
              }
              className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="http://localhost:8080"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              WebSocket Base URL
            </label>
            <input
              type="text"
              value={formData.wsBase}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, wsBase: e.target.value }))
              }
              className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="ws://localhost:8080"
              required
            />
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="cursor-pointer px-4 py-2 text-sm font-medium text-foreground/90 hover:text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cursor-pointer px-4 py-2 text-sm font-medium bg-primary/60 border border-primary hover:bg-primary/70 text-white rounded-lg transition-colors"
            >
              Add Host
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
