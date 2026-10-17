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
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dialog-overlay" />
      <DialogPrimitive.Content
        ref={contentRef}
        className={`dialog-content ${className}`}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.focus({ preventScroll: true });
          contentRef.current?.scrollTo({ top: 0 });
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
