import { useId, useState, type FormEvent } from "react";
import type { SectionInput } from "../../../shared/types";
import { errorMessage } from "../../api";

interface Props {
  /** Label of the main (Spanish) title field. */
  label: string;
  submitLabel: string;
  initial?: SectionInput;
  /** Persists the section. Throwing shows the error message and keeps the form open. */
  onSubmit: (input: SectionInput) => Promise<void>;
  onCancel?: () => void;
  testId: string;
}

/** Form used to create or rename a section: title plus optional Japanese title. */
export function SectionForm({ label, submitLabel, initial, onSubmit, onCancel, testId }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [titleJa, setTitleJa] = useState(initial?.titleJa ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (title.trim() === "") {
      setError("El nombre de la sección es obligatorio.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ title: title.trim(), titleJa: titleJa.trim() || null });
      if (!onCancel) {
        setTitle("");
        setTitleJa("");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit} data-testid={testId} noValidate>
      <label htmlFor={`${id}-title`}>{label}</label>
      <input
        id={`${id}-title`}
        name="title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        required
        maxLength={100}
        autoComplete="off"
      />
      <label htmlFor={`${id}-title-ja`}>Nombre en japonés (opcional)</label>
      <input
        id={`${id}-title-ja`}
        name="titleJa"
        lang="ja"
        value={titleJa}
        onChange={(event) => setTitleJa(event.target.value)}
        maxLength={100}
        autoComplete="off"
        placeholder="ラーメン"
      />
      {error && (
        <p className="form-error" role="alert" data-testid="form-error">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="primary" disabled={busy}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
