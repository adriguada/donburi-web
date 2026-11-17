import { useEffect, useId, useRef } from "react";

interface Props {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ message, confirmLabel, onConfirm, onCancel }: Props) {
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="alertdialog" aria-modal="true" aria-describedby={messageId} data-testid="confirm-dialog">
        <p id={messageId}>{message}</p>
        <div className="actions">
          <button type="button" ref={cancelRef} onClick={onCancel} data-testid="confirm-cancel">
            Cancelar
          </button>
          <button type="button" className="danger" onClick={onConfirm} data-testid="confirm-accept">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
