-- Nivel de picante de un plato: número de guindillas, de 0 (no picante) a 3.
-- Sustituye al antiguo campo booleano is_spicy.
ALTER TABLE dishes ADD COLUMN spiciness INTEGER NOT NULL DEFAULT 0 CHECK (spiciness BETWEEN 0 AND 3);

-- Los platos que eran picantes pasan a tener una guindilla.
UPDATE dishes SET spiciness = is_spicy;

ALTER TABLE dishes DROP COLUMN is_spicy;
