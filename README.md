# Visualizador de unidades IMSS-BIENESTAR

Mapa web público y estático. No necesita servidor ni base de datos: el navegador carga el directorio JSON incluido en `data/unidades.json`.

## Publicar gratis con GitHub Pages

1. Cree un repositorio público nuevo en GitHub.
2. Cargue **el contenido de esta carpeta** en la raíz del repositorio (`index.html`, `app.js`, `styles.css` y `data/`).
3. En el repositorio, abra **Settings → Pages**.
4. En **Build and deployment**, seleccione **Deploy from a branch**, la rama `main` y la carpeta `/(root)`; guarde.
5. Espere a que termine la publicación. GitHub mostrará el enlace público en esa misma pantalla.

Para actualizar la información, reemplace `data/unidades.json` por la nueva versión y vuelva a subir el archivo. La aplicación espera las mismas claves JSON que aparecen en los datos actuales.

## Contenido

- Mapa Leaflet con agrupación visual de marcadores.
- Filtros por entidad, nivel y estatus; búsqueda por CLUES, unidad o municipio.
- Ventana con los datos básicos al seleccionar un establecimiento.
- Búsqueda por radio y listado ordenado por distancia en línea recta.
- Geolocalización y cálculos en el navegador; no se envían búsquedas a un servidor.

## Dependencias y atribución

Leaflet y Leaflet.markercluster se cargan desde un CDN. El fondo usa los mosaicos de OpenStreetMap y conserva su atribución visible. El mapa necesita conexión a internet para cargar esas librerías y los mosaicos.

La publicación será pública: los datos JSON pueden descargarse por cualquiera que conozca la dirección del sitio. La fuente de datos es el archivo de directorio recibido, con corte agosto de 2026.
