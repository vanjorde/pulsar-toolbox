"use client";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const getVariantStyles = () => {
    switch (variant) {
      case "danger":
        return "bg-destructive hover:bg-destructive/90 text-white";
      case "warning":
        return "bg-yellow-600 hover:bg-yellow-700 text-white";
      case "info":
        return "bg-primary hover:bg-primary/90 text-primary-foreground";
      default:
        return "bg-destructive hover:bg-destructive/90 text-white";
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-muted-foreground">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="cursor-pointer px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`cursor-pointer px-4 py-2 text-sm font-medium rounded-lg transition-colors ${getVariantStyles()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
