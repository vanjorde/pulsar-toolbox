"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { DEFAULT_TEMPLATES } from "@/lib/defaults";
import type { Template } from "@/types/pulsar";

export function useTemplateManager() {
  const [templates, setTemplates] = useLocalStorage<Template[]>(
    "pulsar.templates",
    DEFAULT_TEMPLATES
  );

  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  useEffect(() => {
    if (editingTemplate) {
      const updated = templates.find((tpl) => tpl.id === editingTemplate.id);
      if (updated) setEditingTemplate(updated);
    }
  }, [templates, editingTemplate?.id]);

  const handleEditTemplate = useCallback((template: Template) => {
    setEditingTemplate(template);
  }, []);

  const handleUpdateTemplate = useCallback(
    (updated: Template) => {
      setTemplates((prev) =>
        prev.map((tpl) => (tpl.id === updated.id ? updated : tpl))
      );
      setEditingTemplate(null);
      toast.success("Template updated successfully");
    },
    [setTemplates]
  );

  const handleDeleteTemplate = useCallback(
    (templateId: string) => {
      setTemplates((prev) => prev.filter((tpl) => tpl.id !== templateId));
      setEditingTemplate((current) =>
        current && current.id === templateId ? null : current
      );
      toast.success("Template deleted successfully");
    },
    [setTemplates]
  );

  const closeTemplateEditor = useCallback(() => setEditingTemplate(null), []);

  return {
    templates,
    setTemplates,
    editingTemplate,
    setEditingTemplate,
    handleEditTemplate,
    handleUpdateTemplate,
    handleDeleteTemplate,
    closeTemplateEditor,
  } as const;
}
