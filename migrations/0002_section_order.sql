-- Orden de las secciones en la carta (AD1.2: el administrador las ordena arrastrándolas).
-- "order" es palabra reservada en SQL: hay que escribirla siempre entre comillas dobles.
ALTER TABLE sections ADD COLUMN "order" INT NOT NULL DEFAULT 0;

-- Las secciones existentes conservan su orden actual (orden de creación).
UPDATE sections SET "order" = id;
