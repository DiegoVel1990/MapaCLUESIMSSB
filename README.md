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

- Mapa Leaflet con símbolos circulares diferenciados por nivel de atención.
- Filtros por entidad, nivel y estatus; búsqueda por CLUES, unidad o municipio.
- Autocompletado en la búsqueda general y filtro independiente por CLUES.
- Ventana con los datos básicos al seleccionar un establecimiento.
- Búsqueda cercana por CLUES de referencia con distancia euclidiana local y radio máximo de 25 km.
- Descarga CSV de los resultados cercanos, ordenados de menor a mayor distancia.
- Los cálculos se realizan en el navegador; no se envían búsquedas a un servidor.

## Dependencias y atribución

Leaflet se carga desde un CDN. El fondo utiliza las capas World Light Gray Base y World Light Gray Reference de Esri y aplica escala de grises, con atribución a Esri, sus proveedores y OpenStreetMap. El mapa necesita conexión a internet para cargar la librería y los mosaicos.

Esri anunció el retiro de estas capas raster para diciembre de 2029. Las capas vectoriales que las reemplazan requieren cuenta y clave de ArcGIS; para una publicación de largo plazo habrá que migrar a ellas o a otro proveedor de mosaicos.

La publicación será pública: los datos JSON pueden descargarse por cualquiera que conozca la dirección del sitio. La fuente de datos es el archivo de directorio recibido, con corte agosto de 2026.
