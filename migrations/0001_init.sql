-- Secciones de la carta (Entrantes, Ramen, Postres, Bebidas...)
CREATE TABLE sections (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL UNIQUE COLLATE NOCASE
);

-- Platos / bebidas / postres de cada sección
CREATE TABLE dishes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id  INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL COLLATE NOCASE,
  description TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  is_spicy    INTEGER NOT NULL DEFAULT 0 CHECK (is_spicy IN (0, 1)),
  UNIQUE (section_id, name)
);

CREATE INDEX idx_dishes_section_id ON dishes(section_id);
