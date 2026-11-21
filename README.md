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

## Estructura

```text
src/
  core/      núcleo puro: geometría, perfiles, layout, PDF (sin React, DOM ni estado global)
  engines/   puerto DetectionEngine y sus adaptadores
  worker/    contrato del worker (api.ts) y worker de procesamiento
  ui/        componentes, estado y textos (strings.es.ts)
tests/
  architecture/  test que hace cumplir la regla de capas
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

## Fotos reales

La carpeta `corpus/` es para fotos reales de documentos y está en `.gitignore`: **nunca se commitea**, porque el repositorio es público. Los tests usan solo imágenes sintéticas de `tests/fixtures/`.

## Licencia

[GNU AGPL v3](LICENSE) (`AGPL-3.0-only`).
