# Donburi 🍚

Web del restaurante **Donburi**: carta digital accesible mediante código QR y panel de administración para gestionar su contenido.

## Funcionalidades

### Carta pública
- Accesible escaneando el código QR de las mesas.
- Diseño *mobile-first*, ligero y rápido de cargar.
- Platos organizados por secciones (entrantes, donburis, postres, bebidas…).
- Cada plato muestra nombre, descripción, precio y, opcionalmente, alérgenos e imagen.

### Panel de administración
- Acceso protegido mediante autenticación.
- Crear, editar, reordenar y eliminar **secciones** de la carta.
- Crear, editar, reordenar y eliminar **platos** dentro de cada sección.
- Marcar platos como no disponibles sin eliminarlos.
- Los cambios se reflejan en la carta pública al instante.

## Stack tecnológico

| Capa          | Tecnología                                                             |
| ------------- | ---------------------------------------------------------------------- |
| Frontend      | [React](https://react.dev/)                                            |
| Hosting       | [Cloudflare Pages](https://developers.cloudflare.com/pages/)           |
| API / backend | [Cloudflare Workers](https://developers.cloudflare.com/workers/)       |
| Base de datos | [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite)        |

## Arquitectura

```
┌──────────────┐      ┌─────────────────────┐      ┌──────────────┐
│   Cliente    │ ───▶ │  Cloudflare Pages   │      │              │
│ (QR / Admin) │      │  (React SPA)        │      │ Cloudflare   │
│              │ ───▶ │  Cloudflare Workers │ ───▶ │ D1           │
└──────────────┘      │  (API REST)         │      │              │
                      └─────────────────────┘      └──────────────┘
```

- **Pages** sirve la aplicación React (carta pública y panel de admin).
- **Workers** expone la API REST: lectura pública de la carta y endpoints protegidos de administración.
- **D1** almacena secciones y platos.

## Modelo de datos (inicial)

**sections**
| Campo      | Tipo    | Descripción                  |
| ---------- | ------- | ---------------------------- |
| id         | INTEGER | Clave primaria               |
| name       | TEXT    | Nombre de la sección         |
| position   | INTEGER | Orden de aparición en carta  |

**dishes**
| Campo       | Tipo    | Descripción                       |
| ----------- | ------- | --------------------------------- |
| id          | INTEGER | Clave primaria                    |
| section_id  | INTEGER | Referencia a `sections.id`        |
| name        | TEXT    | Nombre del plato                  |
| description | TEXT    | Descripción                       |
| price       | INTEGER | Precio en céntimos                |
| allergens   | TEXT    | Lista de alérgenos (opcional)     |
| image_url   | TEXT    | URL de la imagen (opcional)       |
| available   | INTEGER | 1 = disponible, 0 = no disponible |
| position    | INTEGER | Orden dentro de la sección        |

## Desarrollo local

### Requisitos
- [Node.js](https://nodejs.org/) LTS
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (CLI de Cloudflare)
- Una cuenta de Cloudflare

### Puesta en marcha

> 🚧 Pendiente de definir una vez creado el proyecto.

```bash
# Instalar dependencias
npm install

# Crear la base de datos D1 y aplicar migraciones en local
npx wrangler d1 migrations apply donburi-db --local

# Arrancar el entorno de desarrollo
npm run dev
```

## Despliegue

El frontend se despliega en Cloudflare Pages y la API en Cloudflare Workers, ambos usando Wrangler.

```bash
# Aplicar migraciones en producción
npx wrangler d1 migrations apply donburi-db --remote

# Desplegar
npm run deploy
```

## Roadmap

- [ ] Estructura inicial del proyecto (React + Workers)
- [ ] Esquema y migraciones de D1
- [ ] API de lectura de la carta
- [ ] Página pública de la carta
- [ ] Autenticación del panel de admin
- [ ] CRUD de secciones y platos
- [ ] Generación del código QR
- [ ] Despliegue en Cloudflare
