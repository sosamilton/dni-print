# DNI Print

[![CI](https://github.com/sosamilton/dni-print/actions/workflows/deploy.yml/badge.svg)](https://github.com/sosamilton/dni-print/actions/workflows/deploy.yml)
[![Licencia: AGPL v3](https://img.shields.io/badge/licencia-AGPL--3.0-blue.svg)](LICENSE)

Aplicación web para imprimir un DNI o una licencia de conducir argentinos **a tamaño real** en una hoja A4, a partir de fotos tomadas con el celular o la webcam. Funciona completamente en el navegador: no hay servidor, no hay cuentas y las fotos nunca salen del dispositivo.

**[Abrir la aplicación](https://sosamilton.github.io/dni-print/)**

## El problema

Fotocopiar un documento es incómodo, y imprimir una foto casual sale torcida, con fondo, en proporciones erróneas y a un tamaño que no es el del plástico. Muchos trámites piden una copia legible y del tamaño real, con frente y dorso en la misma hoja.

DNI Print resuelve ese flujo: carga las dos caras, las recorta y endereza, y arma un PDF A4 donde cada cara mide exactamente **85,6 × 54 mm** (formato ID-1, el de las tarjetas plásticas).

## Cómo funciona

Un asistente de tres pasos:

1. **Cargar.** Se elige el documento y se carga el frente y el dorso desde la galería, la cámara del teléfono o la webcam.
2. **Revisar el recorte.** Se detectan automáticamente las cuatro esquinas del documento. Si el recorte no es correcto, se arrastran las esquinas con una lupa de precisión.
3. **Imprimir.** Se elige 1 o 2 copias (frente y dorso por copia), color, blanco y negro o ahorro de tinta, una marca de agua opcional y los márgenes. El resultado es un PDF de una hoja A4.

Detrás de cada paso hay un pipeline de procesamiento:

```text
foto → detección de esquinas → rectificación (homografía) → escala física → filtros → PDF A4
```

- La **rectificación** corrige la perspectiva con una homografía propia, y renderiza la cara a 300 DPI en milímetros reales.
- El **PDF** se genera con `jsPDF` y pide imprimir sin escalado. Incluye una **regla de 100 mm** de calibración para comprobar en papel que la escala es exacta.
- La detección de esquinas usa `cardfit` por defecto (rectas de borde más la forma de la tarjeta, código propio y sin dependencias), con [`scanic`](https://github.com/marquaye/scanic) y [OpenCV.js](https://github.com/TechStark/opencv-js) como motores alternativos en tiempo de compilación.

## Principios

- **Privacidad por diseño y verificable.** Todo se procesa en el dispositivo y la sesión es efímera (nada se guarda). La promesa no se declara: se comprueba con una política CSP estricta, una guardia de red en los tests e2e que falla ante cualquier request a otro origen, y un análisis del build que rechaza URLs no permitidas.
- **Escala exacta.** El tamaño físico es un invariante del núcleo, no un detalle de la interfaz: el diseño de la hoja es una función pura en milímetros, con tests propios.
- **Sin backend.** Es un sitio estático. Funciona sin conexión una vez instalado como PWA, y avisa cuando hay una versión nueva sin interrumpir.
- **Pensada para cualquiera.** Interfaz en español rioplatense, accesible y usable desde el celular o desde pantallas anchas.
- **Software libre.** Licencia AGPL-3.0; la app ofrece un enlace al código fuente exacto de la versión que se sirve. Las dependencias se verifican contra una lista de licencias permitidas.

## Arquitectura

Pipes and filters, con un núcleo puro y capas que se verifican con un test:

```text
src/
  core/      geometría, perfiles de documento, layout y PDF (sin React, DOM ni estado global)
  engines/   puerto DetectionEngine y adaptadores (cardfit, scanic, opencv)
  worker/    worker de procesamiento (Comlink): ingesta, detección, render y PDF
  ui/        componentes React, estado de sesión (zustand) y textos
```

Las fotos de alta resolución viven solo en el worker; la interfaz recibe miniaturas y resultados. Los perfiles de documento son datos (hoy DNI y licencia, ambos ID-1), de modo que agregar otro formato no requiere tocar el pipeline.

**Stack:** React, TypeScript, Vite (con `vite-plugin-pwa`), jsPDF, zustand, Comlink; pruebas con Vitest y Playwright (Chromium, Firefox y WebKit).

## Desarrollo

Requiere Node.js 24 y npm.

```bash
npm ci
npm run dev      # servidor de desarrollo
npm test         # tests unitarios y de arquitectura
npm run lint
npm run test:e2e # build + guardia de red y flujos completos (Playwright)
```

Más detalle (comandos, verificaciones de privacidad, licencias, comparación de motores) en la [guía de desarrollo](docs/DEVELOPMENT.md).

## Licencia

[GNU AGPL v3](LICENSE) (`AGPL-3.0-only`).
