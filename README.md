<h1 align="center">PDF Reader</h1>

<p align="center">
  Lector de PDF local que resalta texto y guarda las anotaciones dentro del mismo archivo.
</p>

<!-- BADGES -->
<p align="center">
    <a title="Deploy to GitHub Pages" href="https://github.com/Mane087/pdf-reader/actions/workflows/deploy-gh-pages.yml">
       <img src="https://github.com/Mane087/pdf-reader/actions/workflows/deploy-gh-pages.yml/badge.svg" alt="Deploy to GitHub Pages" />
    </a>
    <a title="Apache-2.0" href="LICENSE.md">
       <img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="Apache-2.0" />
    </a>
    <a title="Angular" href="https://angular.dev">
       <img src="https://img.shields.io/badge/Angular-22-DD0031?logo=angular&logoColor=white" alt="Angular 22" />
    </a>
    <a title="TypeScript" href="https://www.typescriptlang.org">
       <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white" alt="TypeScript 6.0" />
    </a>
    <a title="Tailwind CSS" href="https://tailwindcss.com">
       <img src="https://img.shields.io/badge/Tailwind%20CSS-4.3-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4.3" />
    </a>
    <a title="node.js" href="https://nodejs.org">
       <img src="https://img.shields.io/badge/Node.js-%3E%3D20.19.0-339933?logo=node.js&logoColor=white" alt="node.js" />
    </a>
</p>

## Descripción

PDF Reader es una aplicación web en Angular 22 (zoneless, signals) que abre archivos
PDF locales, permite resaltar texto con cuatro colores y guarda los resaltados como
anotaciones `Highlight` estándar dentro del mismo archivo. Todo el procesamiento
ocurre en el navegador: no hay backend y ningún archivo sale del equipo.

## ¿Qué problema resuelve?

Permite subrayar documentos PDF y conservar las marcas en el propio archivo, sin
subirlo a un servicio en línea ni instalar un lector de escritorio. Como las
anotaciones se escriben en el formato estándar del PDF, cualquier otro lector las
muestra igual.

## Features

- Biblioteca local en IndexedDB: en Chromium guarda el `FileSystemFileHandle` (sin
  copiar el archivo); en Firefox y Safari guarda una copia (`Blob`).
- Dos formas de ver la biblioteca: lista y vista previa con la primera página de cada
  documento. La miniatura se genera al agregar el archivo y se guarda con el registro.
- Resaltados con el editor de PDF.js: crear desde la selección, cambiar de color y
  eliminar, incluidos los que ya venían en el archivo (doble clic para seleccionarlos).
- Cuatro colores con alias configurable: Amarillo, Verde, Azul y Rojo, con los valores
  iniciales "Tema importante", "Definición", "Ejemplo" y "Repasar tema".
- Visor basado en `PDFViewer` de `pdfjs-dist`, con modo de una o dos páginas y zoom.
- Modo claro y modo oscuro, y modo de pantalla completa desde la barra del lector.
- Validación antes de agregar a la biblioteca: extensión, cabecera `%PDF-`, límite de
  50 MB y apertura previa con PDF.js.
- Guardado sobre el mismo archivo con la File System Access API, o actualización de la
  copia local más descarga donde esa API no existe. "Guardar como copia" nunca modifica
  el original.
- Preferencias conservadas entre sesiones en `localStorage`: tema, vista de la
  biblioteca, zoom, modo de páginas y alias de colores. Los alias se sincronizan entre
  pestañas.
- Cada documento recuerda la última página leída (`lastPage` en su registro de
  IndexedDB) y se reabre ahí.

## Cómo usar

Agrega un PDF con el botón "Agregar PDF" o arrastrándolo
a la zona de la biblioteca, ábrelo, selecciona texto y elige un color en la barra
flotante. "Guardar" escribe las anotaciones en el archivo.

### Atajos de teclado

| Tecla            | Efecto                      |
| ---------------- | --------------------------- |
| `←` / `→`        | Página anterior / siguiente |
| `Inicio` / `Fin` | Primera / última página     |

Los atajos se ignoran mientras escribes en un campo de texto, mientras el panel de alias
está abierto, cuando hay un resaltado seleccionado (PDF.js lo mueve con las flechas) y
cuando la tecla lleva `Ctrl`, `Cmd` o `Alt`, para no pisar los atajos del navegador ni
los del sistema.

## Estructura

```text
src/app/
├── core/
│   ├── browser-events/   eventos del DOM como signals (toSignal + fromEvent)
│   ├── files/            validación de PDF, nombre de copia, formato de tamaño y fecha
│   ├── file-system/      DocumentSource: FileHandleSource (Chromium) y StoredBlobSource
│   ├── models/           colores, documentos guardados, estado del visor
│   ├── pdfjs/            worker, recursos y carga de documentos de PDF.js
│   └── storage/          IndexedDB (idb) y localStorage
└── features/
    ├── library/          pantalla inicial: lista, agregar (selector / drag & drop), eliminar
    └── reader/           visor, adaptadores de PDF.js, toolbar de colores, alias, guardado
```

Solo `core/pdfjs`, `PdfViewerHostComponent`, `PdfViewerAdapter` y `HighlightAdapter`
importan símbolos de `pdfjs-dist`.

Los recursos de PDF.js (`pdf.worker.min.mjs`, `cmaps`, `standard_fonts`, `wasm`, `iccs`)
se copian a `pdfjs/` desde `angular.json`, y `pdf_viewer.css` se carga antes de
`src/styles.css`.

El tema oscuro se activa con la clase `dark` en `<html>`, ligada al variant `dark:` de
Tailwind mediante `@custom-variant` en `src/styles.css`.

## Herramientas

| Herramienta                                           | Versión         |
| ----------------------------------------------------- | --------------- |
| TypeScript (requerido por `@angular/compiler-cli` 22) | 6.0.3           |
| Tailwind CSS                                          | 4.3.3           |
| PostCSS                                               | 8.5.26          |
| ESLint + angular-eslint                               | 10.9.0 / 22.2.0 |
| Prettier                                              | 3.9.6           |
| Jest + `jest-preset-angular` (entorno zoneless)       | 30.5.1 / 17     |
| Playwright                                            | 1.63.0          |
| Husky + lint-staged                                   | 9.1.7 / 17.4.1  |
| Commitlint                                            | 21.2.2          |

## Desarrollo

Servidor local con recarga automática al modificar los archivos fuente:

```bash
pnpm exec ng serve
```

Compilación; los artefactos quedan en `dist/`:

```bash
pnpm run build
```

Scaffolding de Angular CLI:

```bash
pnpm exec ng generate component component-name
pnpm exec ng generate --help
```

Análisis estático:

```bash
pnpm run lint
```

## Pruebas

### Unitarias

```bash
pnpm test
pnpm run test:watch
pnpm run test:ci
```

La configuración de Angular CLI conserva además un target `ng test` basado en
[Karma](https://karma-runner.github.io); ambas configuraciones coexisten.

### End to end

```bash
pnpm exec playwright install firefox   # una sola vez
pnpm run e2e:fixtures                  # genera los PDF de prueba (no se versionan)
pnpm run test:e2e
```

`playwright.config.ts` levanta el servidor de desarrollo en el puerto 4300 y define dos
proyectos. Los archivos `*.e2e.spec.ts` están excluidos de Jest.

| Proyecto   | Archivos                 | Qué cubre                                                                                                                                                           |
| ---------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `firefox`  | `*.e2e.spec.ts`          | Biblioteca, navegación, resaltados, alias, tema, rendimiento y verificación en lectores externos. Sin File System Access: copia en IndexedDB y descarga al guardar. |
| `chromium` | `*.chromium.e2e.spec.ts` | File System Access: handle real, permisos y escritura sobre el mismo archivo con `createWritable`. Requiere `pnpm exec playwright install chromium`.                |

La prueba de lectores externos comprueba el PDF guardado con motores ajenos a PDF.js:
`pdf-lib` lee la anotación, y Ghostscript y Poppler renderizan la página para confirmar
que el resaltado se ve. Ambos deben estar instalados en el sistema (`gs` y `pdftoppm`).
