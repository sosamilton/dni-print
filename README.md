# DNI Print

Aplicación web para imprimir tu DNI a tamaño real desde el navegador. Todo se procesa en tu dispositivo: no hay servidor, no hay cuentas y no se envía ningún dato.

## Requisitos

- Node.js 24 (LTS) y npm.

## Instalación

```bash
npm ci
```

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Levanta el servidor de desarrollo de Vite. |
| `npm run lint` | Corre oxlint sobre el proyecto. |
| `npm run test` | Corre los tests unitarios y de arquitectura con Vitest. |
| `npm run build` | Chequea tipos (`tsc -b`) y genera el build de producción en `dist/`. |
| `npm run preview` | Sirve localmente el build de `dist/`. |
| `npm run test:e2e` | Hace el build y corre la guardia de red de Playwright (ver "Privacidad verificable"). |
| `npm run check:dist` | Revisa que `dist/` no tenga URLs fuera de la allowlist. |
| `npm run check:licenses` | Revisa las licencias de las dependencias de producción. |

## Estructura

```text
src/
  core/      núcleo puro: geometría, perfiles, layout, PDF (sin React, DOM ni estado global)
  engines/   puerto DetectionEngine y sus adaptadores
  worker/    contrato del worker (api.ts) y worker de procesamiento
  ui/        componentes, estado y textos (strings.es.ts)
tests/
  architecture/  test que hace cumplir la regla de capas
  e2e/           guardia de red con Playwright
  scripts/       tests de los checks de scripts/
  fixtures/      imágenes sintéticas para tests
```

### Regla de dependencias entre capas

- `core` no importa de `ui` ni de `engines`.
- `ui` no importa de `engines`.
- Permitido: `ui → core, worker/api`; `worker → core, engines`; `engines → core`.

La regla se verifica con `tests/architecture/layer-rules.test.ts`: si un import la rompe, `npm run test` falla.

Todos los textos visibles están en `src/ui/strings.es.ts`, en español rioplatense.

## Diseño y fuentes

- Los tokens de diseño (colores, tipografía, radios, espaciados y medidas de componentes) salen de `DESIGN.md` y viven como variables CSS en `src/ui/styles/tokens.css`, con los colores de modo oscuro bajo `prefers-color-scheme: dark`. En el resto del CSS, colores, fuentes, tamaños de letra, radios y longitudes salen solo de `var(--…)`; `tests/ui/design-tokens.test.ts` lo verifica.
- Las fuentes (Familjen Grotesk, Atkinson Hyperlegible y JetBrains Mono) se sirven como `woff2` desde el propio sitio, en `public/fonts/`, bajo la licencia SIL Open Font License 1.1 (un `OFL-*.txt` por familia). No se carga nada desde CDNs ni Google Fonts.

## Código fuente

La licencia AGPL-3.0 pide ofrecer el código fuente de la versión que se sirve. Por eso el menú ⋮ de la app tiene un enlace "Código fuente" que apunta a `<URL del repo>/tree/<SHA del commit>`. El build calcula los dos valores (`scripts/build-info.ts`) y los inyecta en el JS:

| Valor | Precedencia (gana el primero que exista y sea válido) |
| --- | --- |
| SHA del commit | `VITE_COMMIT_SHA` → `GITHUB_SHA` → `git rev-parse HEAD` → sin SHA |
| URL del repo | `VITE_REPO_URL` → `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}` → remoto `origin` de git → sin URL |

- El enlace usa el formato `/tree/<SHA>` de GitHub; en otros hosts puede no funcionar.
- La URL se normaliza a `https://host/dueño/repo` (sin `.git` ni barra final; un remoto SSH `git@host:dueño/repo.git` se convierte a `https://`). Cualquier URL que no sea `https://` se descarta.
- Sin SHA, el enlace apunta a la raíz del repo. Sin URL, el item "Código fuente" se muestra deshabilitado con "No disponible en esta versión"; el build no falla.
- En GitHub Actions no hace falta configurar nada: las variables `GITHUB_*` ya están definidas. Para forzar valores en un build local:

```bash
VITE_REPO_URL=https://github.com/dueño/repo VITE_COMMIT_SHA=$(git rev-parse HEAD) npm run build
```

## Privacidad verificable

La promesa "nada sale de tu dispositivo" se verifica con una política de seguridad y tres checks automáticos. Los tres terminan con código distinto de 0 si encuentran un problema.

### Content-Security-Policy

`index.html` declara la CSP de AD-7 en un `<meta http-equiv="Content-Security-Policy">`, justo después de `<meta charset>`:

```text
default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; img-src 'self' blob: data:; worker-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'
```

El build y `npm run preview` la sirven intacta. Solo `npm run dev` la quita (plugin `strip-csp-in-dev` en `vite.config.ts`), porque el preámbulo inline de React Refresh la viola. `tests/ui/csp.test.ts` verifica que la política sea exactamente esa. No se cambia la CSP para que la app pase: se arregla la app.

### Guardia de red (`npm run test:e2e`)

Hace el build de producción, lo sirve con `vite preview` en `http://localhost:4173` y, en Chromium, Firefox y WebKit, recorre los cuatro pasos, "Atrás", el menú ⋮ y el diálogo de privacidad (`tests/e2e/network-guard.spec.ts`):

- La guardia (`tests/e2e/network-guard.ts`) registra todo request de la página y los workers (y de los service workers solo en Chromium, porque Playwright no reporta su tráfico en Firefox ni WebKit; hoy la app no tiene service worker), y aborta los que van a otro origen (también websockets): nunca salen. Corre con la CSP desactivada para ver lo que la app *intenta*, aunque la CSP lo bloquearía.
- Un segundo recorrido con la CSP activa falla ante cualquier `securitypolicyviolation`.
- Tests de cordura inyectan un `fetch` externo (desde la página y desde un worker) y comprueban que la guardia lo detecta.

Para instalar los navegadores de Playwright y sus dependencias del sistema (una vez por máquina):

```bash
npx playwright install --with-deps
```

Para correr un solo navegador (con el build ya hecho): `npx playwright test --project=chromium`.

### URLs en el build (`npm run check:dist`)

Busca toda URL `http(s)://` en los archivos de `dist/` (o del directorio de `DIST_DIR`) y falla con el archivo y la URL si no está permitida. Corré `npm run build` antes.

- La URL del repositorio que usa "Código fuente" se permite sola: el check la calcula con `scripts/build-info.ts` y las mismas variables de entorno que el build. Por eso hay que correrlo con el mismo entorno que `npm run build`.
- El resto vive en `scripts/dist-url-allowlist.json`. Solo se agregan URLs que no generan requests (namespaces XML, textos de error o de licencia). Cada entrada es `{ "url", "match", "reason" }`, con `match` en `"exact"` (la URL tal cual) o `"prefix"` (toda URL que empiece así) y el motivo en `reason`.

### Licencias (`npm run check:licenses`)

Lee las dependencias de producción de `package-lock.json` (las que no son `dev`) y la licencia del `package.json` instalado de cada una. Las que no están instaladas en esta plataforma (opcionales) se saltean.

- Allowlist (AD-13): MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, AGPL-3.0 y GPL-3.0 (con sus variantes `-only`, `-or-later` y `+`).
- Expresiones SPDX: `OR` pasa si alguna opción pasa; `AND`, solo si pasan todas. `WITH`, `SEE LICENSE IN`, licencias desconocidas o ausentes no pasan.
- Excepciones revisadas en `scripts/license-exceptions.json`: `{ "package", "version", "license", "reason" }`. Aplican solo si coinciden el nombre, la versión y la licencia exactos, así que cualquier actualización vuelve a pedir revisión. Hoy hay una: `pako@2.2.0` con `(MIT AND Zlib)`, que jsPDF necesita; Zlib es permisiva y compatible con AGPL-3.0. Antes de agregar otra, confirmá que la licencia sea compatible con AGPL-3.0 y explicá por qué en `reason`.

## Fotos reales

La carpeta `corpus/` es para fotos reales de documentos y está en `.gitignore`: **nunca se commitea**, porque el repositorio es público. Los tests usan solo imágenes sintéticas de `tests/fixtures/`.

## Licencia

[GNU AGPL v3](LICENSE) (`AGPL-3.0-only`).
