import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Reusable confirm dialog with a focus trap (extracted from CvEditor's regenerate guard).
 *
 * Modal, destructive-action styling on the confirm button. Restores focus to the
 * previously-focused element on close, traps Tab within the dialog, and cancels on
 * Escape or backdrop click. The regenerate guard, the saved-CV delete, and the
 * account-deletion gate all use it.
 *
 * S-08 widened `body` from `string` to `ReactNode` so a dialog can carry interactive content —
 * the account-deletion gate renders its type-your-email field there. The wrapper is a `<div>`
 * rather than a `<p>` for the same reason: a paragraph may not contain flow content, and a
 * string body renders identically either way.
 */

const focusableSelector =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector));
}

export default function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    // Capture the trigger BEFORE moving focus into the dialog. This effect is the only thing
    // that focuses anything here: an `autoFocus` on a button below would be applied by React
    // during commit — i.e. before this effect runs — so the "previously focused element" read
    // here would be that button, and closing the dialog would restore focus to a node that is
    // about to be detached. Focus would land on <body> and keyboard users would lose their
    // place. Covered by e2e/account-deletion.spec.ts.
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const firstFocusable = dialogRef.current ? getFocusableElements(dialogRef.current)[0] : null;
    firstFocusable?.focus();

    return () => {
      restoreFocusRef.current?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onCancel();
          return;
        }

        if (event.key !== "Tab" || !dialogRef.current) return;

        const focusable = getFocusableElements(dialogRef.current);
        if (focusable.length === 0) {
          event.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      role="presentation"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-lg"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <h2 id={titleId} className="text-lg font-semibold text-slate-950">
          {title}
        </h2>
        <div id={bodyId} className="mt-2 text-sm leading-6 text-slate-600">
          {body}
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition-colors hover:border-slate-400 hover:bg-slate-100 focus-visible:ring-3 focus-visible:ring-slate-500/20 focus-visible:outline-none"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={confirmDisabled}
            onClick={onConfirm}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-red-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-800 focus-visible:ring-3 focus-visible:ring-red-700/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
