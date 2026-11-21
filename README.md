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

## Fotos reales

La carpeta `corpus/` es para fotos reales de documentos y está en `.gitignore`: **nunca se commitea**, porque el repositorio es público. Los tests usan solo imágenes sintéticas de `tests/fixtures/`.

## Licencia

[GNU AGPL v3](LICENSE) (`AGPL-3.0-only`).
