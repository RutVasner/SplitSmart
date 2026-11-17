import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useDialogAccessibility(onDismiss: () => void) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const activeDialog: HTMLElement = dialog;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusableElements = () =>
      Array.from(activeDialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    const initialFocus = activeDialog.querySelector<HTMLElement>('[autofocus]')
      ?? focusableElements()[0]
      ?? activeDialog;

    if (initialFocus === activeDialog) activeDialog.tabIndex = -1;
    initialFocus.focus();

    function trapFocus(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDismissRef.current();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = focusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        activeDialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !activeDialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !activeDialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }

    activeDialog.addEventListener('keydown', trapFocus);
    return () => {
      activeDialog.removeEventListener('keydown', trapFocus);
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      } else {
        document.querySelector<HTMLElement>('.app-shell')?.focus();
      }
    };
  }, []);

  return dialogRef;
}
