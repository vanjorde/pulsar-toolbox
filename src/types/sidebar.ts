import { ReactNode } from "react";

export type SidebarSectionProps = {
  title: string;
  storageKey: string;
  defaultHeight?: number;
  minHeight?: number;
  actions?: ReactNode;
  children: ReactNode;
  borderTop?: boolean;
  className?: string;
  contentClassName?: string;
};
