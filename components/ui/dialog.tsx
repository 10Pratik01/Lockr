"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Close } from "./icons";

/** Native <dialog> -- gives focus trapping, Esc-to-close and a11y for free. */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={title}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-zinc-200 bg-l-card p-0 text-l-fg shadow-[0_30px_70px_-30px_rgba(22,25,31,0.55)] backdrop:bg-[#12151a]/55 backdrop:backdrop-blur-[3px] dark:border-zinc-800"
    >
      {open && (
        <div className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-xl font-medium">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <Close />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
