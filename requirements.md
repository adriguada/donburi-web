# Donburi Web App

Este proyecto es una aplicación web para un restuarante de ramen: Donburi Ramen Bar.
A continuación se describe la arquitectura y análisis de requisitos y alcance del proyecto.

## Arquitectura
### Aplicación Web (React.js)
La aplicación web será un proyecto React.js, que servirá una aplicación adapatada para dispositivos móviles, tablets y PCs normales. Estará servida con Cloudflare Workers (static assets)
Existirán dos páginas principales en esta web: 
- https://<dominio-cloudflare>: la página principal en la que se mostrará la carta
- https://<dominio-cloudflare>/admin/: la página del administrador para editar la web

### API
El backend que consumirá el cliente web será un sencillo CRUD de datos en Cloudflare, utilizando Cloudflare Workers.
Estos serán los endpoints principales para este proyecto:
- GET       https://<dominio-cloudflare>/api/menu          -> obtener la carta en formato JSON
- POST      https://<dominio-cloudflare>/api/dish          -> añadir un nuevo plato al menú
- PUT       https://<dominio-cloudflare>/api/dish/:id      -> modificar un plato del menú
- DELETE    https://<dominio-cloudflare>/api/dish/:id      -> eliminar un plato del menú
- POST      https://<dominio-cloudflare>/api/section       -> añadir una sección al menú
- PUT       https://<dominio-cloudflare>/api/section/:id   -> modificar una sección del menú
- DELETE    https://<dominio-cloudflare>/api/section       -> eliminar una sección del menú

### Almacenamiento
El backend de almacenamiento será el servicio Cloudflare D1. No se guardarán imágenes de platos ni de ningún otro tipo, todo el almacenamiento persistido será texto o númerico.

### Tests
El proyecto contará con una batería de tests local para probar los Workers y el almacenamiento en local, así como el cliente React.

### Modelo de datos
Se describen las entidades del dominio de la aplicación:

| Entidad | Descripción | Campos |
| Section | Sección de la carta/menú (Entrantes, Principal, Postres, Bebidas, etc) | id, title |
| Dish | Plato/Bebida/Postre del menú (Tonkotsu Ramen, HighBall, Tiramisú, etc) | id, section_id, name, description (optional), price, isSpicy (boolean) |

## Análisis de requisitos funcionales
CL1. El sistema mostrará la carta/menú del restaurante
    CL1.1. El sistema mostrará el logo del restaurante
    CL1.2. El sistema mostrará las secciones de la carta (entrantes, salteados, ramen, postres, bebidas, etc)
        CL1.2.1. El sistema mostrará los platos o items de su sección (Ramen de cerdo, salteado yakisoba, Brownie, etc)
        CL1.2.2. El sistema marcará con un icono aquellos platos que sean picantes
        CL1.2.3. El sistema mostrará nombre, descripción y precio para todos los items de la sección
        CL1.2.4. El sistema permitirá al cliente minimizar o ampliar una sección de la carta
        CL1.2.5. El sistema mostrará el mensaje "Work In Progress.." en una sección vacía
    CL1.3. El sistema mostrará información de contacto y dirección al final de la carta
        CL1.3.1. El sistema mostrará la dirección del restaurante
        CL1.3.2. El sistema mostrará el enlace a la cuenta de Instagram del restaurante
        CL1.3.3. El sistema mostrará el número de teléfono del restaurante
        CL1.3.4. El sistema mostrará un enlace al WhatsApp del teléfono del restaurante
    CL1.4. El sistema permitirá al cliente cambiar el idioma de la carta
        CL1.4.1. El cliente podrá cambiar el idioma a Español, Inglés, Alemán, Francés y Portugués
        CL1.4.2. El botón para cambiar el idioma será visible en la parte superior de la web
    CL1.5. El sistema mostrará una carta vacía con el mensaje en el centro de la pantalla "Work In Progress..."
AD1. El sistema permitirá al administrador modificar la web de la carta
    AD1.1. El sistema permitirá al administrador gestionar las secciones de la carta
        AD1.1.1. El sistema permitirá al administrador añadir una nueva sección
            AD1.1.1.1. El sistema requerirá al administrador un nombre para crear la nueva sección
            AD1.1.1.1.1. El nombre de la sección no debe existir todavía en la carta
        AD1.1.2. El sistema permitirá al administrador editar una sección
            AD1.1.2.1. El administrador podrá editar el nombre de la sección
            AD1.1.2.2. El administrador podrá gestionar los platos/items de la sección
                AD1.1.2.2.1. El administrador podrá añadir un nuevo plato/item a la sección
                    AD1.1.2.2.2.1.1. El plato/item no debe tener el mismo "title" que otro de la misma sección
                    AD1.1.2.2.2.1.2. El sistema le requerirá al administrador los siguientes campos para añadir el plato/item
                        AD1.1.2.2.2.1.2.1. Title
                        AD1.1.2.2.2.1.2.2. Description (optional)
                        AD1.1.2.2.2.1.2.3. Price
                        AD1.1.2.2.2.1.2.4. isSpicy (checkbox) 
                AD1.1.2.2.2. El administrador podrá modificar un plato/item de la sección   
                    AD1.1.2.2.2.1. El sistema permitirá modificar los siguientes campos de un plato/item
                        AD1.1.2.2.2.1.1. Name
                        AD1.1.2.2.2.1.2. Description (optional)
                        AD1.1.2.2.2.1.3. Price
                        AD1.1.2.2.2.1.4. isSpicy (checkbox) 
                AD1.1.2.2.3. El administrador podrá eliminar un plato/item de la sección   
        AD1.1.3. El sistema permitirá al administrador eliminar una sección
            AD1.1.3.1. El sistema requerirá confirmación al administrador para eliminar la sección
            AD1.1.3.2. El sistema eliminará todos los platos asociados a la sección
    AD1.2. El sistema requerirá al administrador autenticarse con Cloudflare Access

## Plan de pruebas
### Pruebas de integración con Selenium
| ID   | Descripción | Resultado esperado |
| PIC1 | El cliente accede a la página principal y visualiza una carta vacía | Se muestra el mensaje de carta vacía |
| PIC2 | El cliente accede a la página principal y visualiza una carta con dos secciones: una con tres platos y otra vacía | Se muestra la sección con tres platos y la sección vacía con el mensaje de sección vacía |
| PIC3 | El cliente accede a la página principal y accede al enlace de Instagram | La página redirige al perfil de Instagram del restaruante |
| PIA1 | El administrador añade una sección nueva a la carta | La sección se añade correctamente y se visualiza con el mensaje de sección vacía |
| PIA2 | El administrador intenta añadir una sección con nombre existente | Se muestra un mensaje de error que explica que la sección ya existe |
| PIA3 | El administrador elimina una sección existente con platos | La sección se borra y todos los platos que contenía también. Ya no se visualizan en la carta ni la sección ni los platos |
| PIA4 | El administrador modifica una sección existente con platos para editar el título | La sección se visualiza en la carta con el nuevo título y conserva los platos que tenía |
| PIA5 | El administrador elimina un plato existente de una sección, añade uno nuevo y edita el nombre de otro | La sección se visualiza en la carta con todos los cambios |
| PIA6 | El administrador intenta editar el nombre de un plato y pone un nombre que ya existe | La aplicación informa con un error y el mensaje que dice que el plato/item ya existe y la carta no recibe ninguna actualización |
| PIA7 | El administrador intenta añadir un plato con un nombre que ya existe | La aplicación informa con un error y el mensaje que dice que el plato/item ya existe y la carta no recibe ninguna actualización |
| PIA8 | El administrador edita un plato de una sección y lo marca como spicy | El plato en la carta se visualiza con un icono de una guindilla picante al lado |
