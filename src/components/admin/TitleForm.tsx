import { useId, useState, type FormEvent } from "react";
import { errorMessage } from "../../api";

interface Props {
  label: string;
  submitLabel: string;
  initialTitle?: string;
  /** Persists the title. Throwing shows the error message and keeps the form open. */
  onSubmit: (title: string) => Promise<void>;
  onCancel?: () => void;
  testId: string;
}

/** Single-field form used to create or rename a section. */
export function TitleForm({ label, submitLabel, initialTitle = "", onSubmit, onCancel, testId }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputId = useId();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (title.trim() === "") {
      setError("El nombre de la sección es obligatorio.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(title.trim());
      if (!onCancel) setTitle("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit} data-testid={testId} noValidate>
      <label htmlFor={inputId}>{label}</label>
      <div className="inline-form-row">
        <input
          id={inputId}
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={100}
          autoComplete="off"
        />
        <button type="submit" className="primary" disabled={busy}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
      {error && (
        <p className="form-error" role="alert" data-testid="form-error">
          {error}
        </p>
      )}
    </form>
  );
}
