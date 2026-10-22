"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRef } from "react";
import { X } from "lucide-react";
export const Dialog = DialogPrimitive.Root;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
export function DialogContent({
  children,
  className = "",
  onCloseAutoFocus,
}: {
  children: React.ReactNode;
  className?: string;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dialog-overlay" />
      <DialogPrimitive.Content
        ref={contentRef}
        className={`dialog-content ${className}`}
        onCloseAutoFocus={onCloseAutoFocus}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          const content = contentRef.current;
          const title = content?.querySelector<HTMLElement>("h2");
          if (title) title.tabIndex = -1;
          (title || content)?.focus({ preventScroll: true });
          content?.scrollTo({ top: 0, behavior: "instant" });
        }}
      >
        {children}
        <DialogPrimitive.Close
          className="dialog-close"
          aria-label="Fechar detalhes"
        >
          <X size={20} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
