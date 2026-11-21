# Comparación de motores de detección

Fecha: 2026-11-21
Fuente de imágenes: fixtures (imágenes sintéticas)
Imágenes: 1

> Aviso: son imágenes sintéticas; los números no son representativos y no sirven para decidir el motor. Corré el script con fotos reales en `corpus/`.

Valor por defecto de `VITE_DETECTION_ENGINE`: `scanic`

Cada imagen se reduce como en el worker (lado mayor ≤ 1024 px, orientada por EXIF) y el cuadrilátero se reescala a px de la fuente antes de medir el error. El error es la media de la distancia entre esquinas contra `<nombre>.quad.json`; «—» significa sin dato.

## Resumen

| Motor | Detecciones | Errores de motor | Tiempo medio (ms) | Error medio (px) | Imágenes con verdad terreno |
| --- | --- | --- | --- | --- | --- |
| scanic | 1/1 | 0 | 14.1 | 1.7 | 1 |
| opencv | 1/1 | 0 | 6.2 | 0.9 | 1 |

## Detalle por imagen

| Imagen | scanic: detectó | scanic: ms | scanic: error (px) | opencv: detectó | opencv: ms | opencv: error (px) |
| --- | --- | --- | --- | --- | --- | --- |
| imagen 1 | sí | 14.1 | 1.7 | sí | 6.2 | 0.9 |

## Decisión

Motor elegido: _por completar_

Motivo: _por completar_
