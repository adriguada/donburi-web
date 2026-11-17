# Donburi 🍜

Web del restaurante de ramen **Donburi Ramen Bar**: carta digital accesible mediante código QR y panel de administración para gestionar su contenido.

La especificación completa (requisitos funcionales y plan de pruebas) está en [requirements.md](requirements.md).

## Funcionalidades

### Carta pública (`/`)
- Accesible escaneando el código QR de las mesas.
- Diseño adaptado a móviles, tablets y PCs.
- Muestra el logo del restaurante.
- Fondo claro con patrón *seigaiha* y tipografía Shippori Mincho en tinta oscura.
- El logo cuelga de la parte superior dentro de un marco terracota; se desvanece hacia arriba al bajar por la carta y reaparece al subir.
- Los precios se separan del plato con una línea fina continua.
- Platos organizados por secciones (entrantes, salteados, ramen, postres, bebidas…) que el cliente puede plegar (icono «−») y desplegar (icono «+») desde la esquina superior izquierda de cada sección, con una transición suave.
- Cada plato muestra nombre, descripción y precio; los platos picantes muestran de una a tres guindillas según su nivel de picante.
- Las secciones vacías muestran el mensaje "Work In Progress..."; si la carta entera está vacía, el mensaje aparece en el centro de la pantalla.
- *(Pendiente)* Selector de idioma en la parte superior: español, inglés, alemán, francés y portugués.
- Al final de la carta, sobre una banda terracota con bandas decorativas: dirección, teléfono y los iconos de WhatsApp e Instagram enlazando a las cuentas del restaurante.

### Panel de administración (`/admin/`)
- Acceso protegido con [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/).
- Crear, renombrar y eliminar **secciones**.
  - El nombre de una sección no puede repetirse en la carta.
  - Eliminar una sección pide confirmación y elimina también todos sus platos.
- Ordenar las secciones de la carta arrastrándolas por su asa (también con teclado y en pantallas táctiles).
- Los botones de editar y eliminar son iconos de lápiz y papelera.
- Crear, editar y eliminar **platos** dentro de cada sección (nombre, descripción opcional, precio y nivel de picante de 0 a 3 guindillas).
  - El nombre de un plato no puede repetirse dentro de la misma sección; si se intenta, se muestra un error y la carta no cambia.

## Stack tecnológico

| Capa          | Tecnología                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------- |
| Frontend      | [React](https://react.dev/) + [Vite](https://vite.dev/)                                             |
| Hosting       | [Cloudflare Workers](https://developers.cloudflare.com/workers/) (static assets)                    |
| API / backend | [Cloudflare Workers](https://developers.cloudflare.com/workers/)                                    |
| Base de datos | [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite)                                     |
| Autenticación | [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)              |

## Arquitectura

```
┌──────────────┐      ┌──────────────────────────────┐      ┌──────────────┐
│   Cliente    │      │  Cloudflare Worker           │      │              │
│ (QR / Admin) │ ───▶ │  · static assets (React SPA) │      │ Cloudflare   │
│              │      │  · /api/* (API REST)         │ ───▶ │ D1           │
└──────────────┘      └──────────────────────────────┘      └──────────────┘
```

- Un único **Worker** sirve la aplicación React como static assets (carta pública y panel de admin) y expone la API REST en `/api/*`.
- **D1** almacena secciones y platos. Solo se guarda texto y números; no se almacenan imágenes.

### API

| Método   | Ruta               | Descripción                    |
| -------- | ------------------ | ------------------------------ |
| `GET`    | `/api/menu`        | Obtener la carta en JSON       |
| `POST`   | `/api/section`     | Añadir una sección             |
| `PUT`    | `/api/section/:id` | Modificar una sección          |
| `DELETE` | `/api/section/:id` | Eliminar una sección y sus platos |
| `PUT`    | `/api/section/order` | Ordenar las secciones (`{ "sectionIds": [3, 1, 2] }`, todas las secciones en el nuevo orden) |
| `POST`   | `/api/dish`        | Añadir un plato                |
| `PUT`    | `/api/dish/:id`    | Modificar un plato             |
| `DELETE` | `/api/dish/:id`    | Eliminar un plato              |

## Modelo de datos

**Section**: sección de la carta (Entrantes, Principal, Postres, Bebidas…)

| Campo | Descripción                          |
| ----- | ------------------------------------ |
| id    | Clave primaria                       |
| title | Nombre de la sección (único)         |

**Dish**: plato, bebida o postre (Tonkotsu Ramen, HighBall, Tiramisú…)

| Campo       | Descripción                                         |
| ----------- | --------------------------------------------------- |
| id          | Clave primaria                                      |
| section_id  | Referencia a `Section.id`                           |
| name        | Nombre del plato (único dentro de su sección)       |
| description | Descripción (opcional)                              |
| price       | Precio                                              |
| spiciness   | Nivel de picante: número de guindillas, de 0 a 3    |

## Desarrollo local

### Requisitos
- [Node.js](https://nodejs.org/) LTS
- Chromium/Chrome y chromedriver, solo para las pruebas de integración con Selenium

[Wrangler](https://developers.cloudflare.com/workers/wrangler/) se instala como dependencia del proyecto. No hace falta una cuenta de Cloudflare para desarrollar en local.

### Puesta en marcha

```bash
# Instalar dependencias
npm install

# Desactivar la autenticación en local (el panel de admin y la API de escritura
# requieren Cloudflare Access, que solo existe una vez desplegado)
cp .dev.vars.example .dev.vars

# Crear la base de datos D1 local y aplicar las migraciones
npm run db:migrate:local

# Arrancar el entorno de desarrollo (Vite + Worker con HMR)
npm run dev
```

La carta está en `http://localhost:5173/` y el panel de administración en `http://localhost:5173/admin/`.

Otros comandos:

```bash
npm run build        # Comprobación de tipos y build de producción
npm run lint         # Linter (oxlint)
npm run cf-typegen   # Regenerar tipos tras cambiar los bindings en wrangler.jsonc
```

### Datos del restaurante

La dirección, el teléfono (también usado para el enlace de WhatsApp) y la cuenta de Instagram están en [`src/config.ts`](src/config.ts). El logo es [`src/assets/donburi-logo.svg`](src/assets/donburi-logo.svg) (en la carta se usa `donburi-logo-light.svg`, con el kanji en el color claro, dentro del marco [`src/assets/logo-marco.svg`](src/assets/logo-marco.svg)), el fondo del pie de página [`src/assets/header-fondo.svg`](src/assets/header-fondo.svg) y el fondo de la página [`src/assets/seigaiha.svg`](src/assets/seigaiha.svg). La tipografía Shippori Mincho se sirve desde la propia web (paquete `@fontsource/shippori-mincho`, solo el subconjunto latino).

## Tests

```bash
npm test              # Tests del Worker + D1 y del cliente React
npm run test:worker   # Solo la API (se ejecuta en workerd con una D1 local)
npm run test:client   # Solo los componentes React (jsdom)
npm run test:e2e      # Pruebas de integración con Selenium (PIC1–PIC3, PIA1–PIA8)
npx vitest run test/worker/api.test.ts           # Un único fichero
npx vitest run --project worker -t "duplicate"   # Tests cuyo nombre coincide
```

Las pruebas de Selenium arrancan su propio servidor de desarrollo (puerto 5317) con una base de datos D1 local independiente (`.wrangler/e2e-state`) y Chromium en modo headless. Por defecto usan `/usr/bin/chromium` y `/usr/bin/chromedriver`; se pueden cambiar con las variables `CHROME_BIN` y `CHROMEDRIVER_PATH`.

## Despliegue

Todo (frontend y API) se despliega como un único Cloudflare Worker con Wrangler. Antes del primer despliegue:

1. Crear la base de datos con `npx wrangler d1 create donburi-db` y copiar su `database_id` en `wrangler.jsonc`.
2. Crear una aplicación de Cloudflare Access que proteja `/admin*`, `/api/section*` y `/api/dish*`, y rellenar `ACCESS_TEAM_DOMAIN` y `ACCESS_AUD` en `wrangler.jsonc`. El Worker verifica el token de Access en cada petición de administración y las rechaza si estas variables no están configuradas.

```bash
# Aplicar migraciones en producción
npx wrangler d1 migrations apply donburi-db --remote

# Desplegar
npm run deploy
```

## Roadmap

- [x] Estructura inicial del proyecto (React + Workers)
- [x] Esquema y migraciones de D1
- [x] API de lectura de la carta
- [x] Página pública de la carta
- [ ] Selector de idioma
- [x] Autenticación del panel de admin con Cloudflare Access (verificación del token en el Worker)
- [x] CRUD de secciones y platos
- [x] Tests (Worker, cliente React e integración con Selenium)
- [ ] Generación del código QR
- [ ] Despliegue en Cloudflare
