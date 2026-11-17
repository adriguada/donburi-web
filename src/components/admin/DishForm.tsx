import { useId, useState, type FormEvent } from "react";
import type { Dish, DishInput } from "../../../shared/types";
import { errorMessage } from "../../api";

interface Props {
  dish?: Dish;
  submitLabel: string;
  /** Persists the dish. Throwing shows the error message and keeps the form open. */
  onSubmit: (input: DishInput) => Promise<void>;
  onCancel?: () => void;
  testId: string;
}

export function DishForm({ dish, submitLabel, onSubmit, onCancel, testId }: Props) {
  const [name, setName] = useState(dish?.name ?? "");
  const [description, setDescription] = useState(dish?.description ?? "");
  const [price, setPrice] = useState(dish ? String(dish.price) : "");
  const [isSpicy, setIsSpicy] = useState(dish?.isSpicy ?? false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();

  function reset() {
    setName("");
    setDescription("");
    setPrice("");
    setIsSpicy(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsedPrice = Number(price.replace(",", "."));
    if (name.trim() === "") return setError("El nombre del plato es obligatorio.");
    if (price.trim() === "" || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return setError("Introduce un precio válido.");
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || null,
        price: parsedPrice,
        isSpicy,
      });
      if (!dish) reset();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="dish-form" onSubmit={handleSubmit} data-testid={testId} noValidate>
      <div className="field">
        <label htmlFor={`${id}-name`}>Nombre</label>
        <input
          id={`${id}-name`}
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={100}
          autoComplete="off"
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-description`}>Descripción (opcional)</label>
        <textarea
          id={`${id}-description`}
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={500}
          rows={2}
        />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`${id}-price`}>Precio (€)</label>
          <input
            id={`${id}-price`}
            name="price"
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            required
          />
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            name="isSpicy"
            checked={isSpicy}
            onChange={(event) => setIsSpicy(event.target.checked)}
          />
          Picante
        </label>
      </div>
      {error && (
        <p className="form-error" role="alert" data-testid="form-error">
          {error}
        </p>
      )}
      <div className="actions">
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button type="submit" className="primary" disabled={busy}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
