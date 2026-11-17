import { useId, useState, type FormEvent } from "react";
import { MAX_SPICINESS, type Dish, type DishInput } from "../../../shared/types";
import { errorMessage } from "../../api";
import { spicinessLabel } from "../../format";

const SPICINESS_LEVELS = Array.from({ length: MAX_SPICINESS + 1 }, (_, level) => level);

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
  const [spiciness, setSpiciness] = useState(dish?.spiciness ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();

  function reset() {
    setName("");
    setDescription("");
    setPrice("");
    setSpiciness(0);
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
        spiciness,
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
        <fieldset className="spiciness-field">
          <legend>Picante</legend>
          <div className="spiciness-options">
            {SPICINESS_LEVELS.map((level) => (
              <label key={level} className="spiciness-option" data-testid={`spiciness-option-${level}`}>
                <input
                  type="radio"
                  name={`${id}-spiciness`}
                  value={level}
                  checked={spiciness === level}
                  onChange={() => setSpiciness(level)}
                />
                {level === 0 ? (
                  <span>No</span>
                ) : (
                  <>
                    <span aria-hidden="true">{"🌶️".repeat(level)}</span>
                    <span className="visually-hidden">{spicinessLabel(level)}</span>
                  </>
                )}
              </label>
            ))}
          </div>
        </fieldset>
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
