# Comparación de motores de detección

Fecha: 2026-11-21
Fuente de imágenes: corpus (fotos reales, no incluidas en el repo)
Imágenes: 13
Valor por defecto de `VITE_DETECTION_ENGINE`: `scanic`

Cada imagen se reduce como en el worker (lado mayor ≤ 1024 px, orientada por EXIF) y el cuadrilátero se reescala a px de la fuente antes de medir el error. El error es la media de la distancia entre esquinas contra `<nombre>.quad.json`; «—» significa sin dato.

## Resumen

| Motor | Detecciones | Errores de motor | Tiempo medio (ms) | Error medio (px) | Imágenes con verdad terreno |
| --- | --- | --- | --- | --- | --- |
| scanic | 13/13 | 0 | 73.3 | — | 0 |
| opencv | 7/13 | 0 | 11.9 | — | 0 |

## Detalle por imagen

| Imagen | scanic: detectó | scanic: ms | scanic: error (px) | opencv: detectó | opencv: ms | opencv: error (px) |
| --- | --- | --- | --- | --- | --- | --- |
| imagen 1 | sí | 78.3 | — | sí | 12.1 | — |
| imagen 2 | sí | 45.6 | — | sí | 10.3 | — |
| imagen 3 | sí | 48.7 | — | sí | 9.7 | — |
| imagen 4 | sí | 110.5 | — | sí | 16.2 | — |
| imagen 5 | sí | 93.2 | — | no | 16.9 | — |
| imagen 6 | sí | 28.8 | — | no | 11.6 | — |
| imagen 7 | sí | 81.5 | — | no | 12.1 | — |
| imagen 8 | sí | 47.7 | — | sí | 10.3 | — |
| imagen 9 | sí | 31.5 | — | sí | 9.7 | — |
| imagen 10 | sí | 82.1 | — | sí | 10.5 | — |
| imagen 11 | sí | 112.2 | — | no | 13.4 | — |
| imagen 12 | sí | 99.2 | — | no | 11.1 | — |
| imagen 13 | sí | 93.7 | — | no | 10.7 | — |

## Decisión

Motor elegido: scanic (valor por defecto, sin cambios)

Motivo: con 13 fotos reales detectó 13/13 contra 7/13 de opencv; es más lento (73 ms contra 12 ms) pero imperceptible para el usuario. Detectar no es acertar: no hay verdad terreno (`.quad.json`), así que la calidad del recorte se confirma a ojo en el paso 2.
