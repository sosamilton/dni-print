# Comparación de motores de detección

Fecha: 2026-11-21
Fuente de imágenes: corpus (fotos reales, no incluidas en el repo)
Imágenes: 24
Valor por defecto de `VITE_DETECTION_ENGINE`: `cardfit`

Cada imagen se reduce como en el worker (lado mayor ≤ 1024 px, orientada por EXIF) y el cuadrilátero se reescala a px de la fuente antes de medir el error. El «error refinado» se mide después de ajustar las esquinas sobre la imagen a resolución completa (`refineQuad`), como hace el worker; si el refinado no es confiable, conserva el cuadrilátero sin refinar. El error es la media de la distancia entre esquinas contra `<nombre>.quad.json`; «—» significa sin dato.

## Resumen

Pipeline de producción = detección + refinado a resolución completa. Un «acierto» es una detección con error refinado menor a 100 px; una detección con 100 px o más es un error grosero y cuenta como fallo, igual que no detectar.

| Motor | Aciertos | Errores groseros | Mediana del error refinado (px) | Detecciones | Errores de motor | Tiempo medio (ms) | Error medio (px) | Error refinado medio (px) | Imágenes con verdad terreno |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cardfit | 24/24 | 0 | 19.7 | 24/24 | 0 | 214.2 | 22.9 | 22.2 | 24 |
| scanic | 9/24 | 12 | 129.6 | 21/24 | 0 | 73.9 | 435.9 | 435.5 | 21 |
| opencv | 13/24 | 1 | 20.2 | 14/24 | 0 | 10.9 | 118.8 | 114.5 | 14 |

## Detalle por imagen

| Imagen | cardfit: detectó | cardfit: ms | cardfit: error (px) | cardfit: error refinado (px) | scanic: detectó | scanic: ms | scanic: error (px) | scanic: error refinado (px) | opencv: detectó | opencv: ms | opencv: error (px) | opencv: error refinado (px) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| imagen 1 | sí | 196.7 | 9.1 | 9.3 | sí | 74.0 | 16.3 | 8.8 | sí | 10.6 | 29.8 | 9.4 |
| imagen 2 | sí | 253.2 | 42.1 | 42.1 | sí | 43.4 | 25.7 | 25.7 | sí | 10.1 | 28.0 | 13.5 |
| imagen 3 | sí | 203.1 | 19.0 | 17.9 | sí | 50.4 | 37.6 | 37.6 | sí | 10.0 | 28.8 | 18.0 |
| imagen 4 | sí | 229.3 | 11.4 | 4.9 | sí | 96.9 | 1170.1 | 1170.1 | sí | 13.4 | 1305.0 | 1305.0 |
| imagen 5 | sí | 233.2 | 16.0 | 17.2 | sí | 89.7 | 129.6 | 129.6 | no | 15.8 | — | — |
| imagen 6 | sí | 154.6 | 43.5 | 43.5 | sí | 27.6 | 42.3 | 42.3 | no | 11.5 | — | — |
| imagen 7 | sí | 176.4 | 49.7 | 49.7 | sí | 78.7 | 92.2 | 92.2 | no | 11.6 | — | — |
| imagen 8 | sí | 217.1 | 15.2 | 15.2 | sí | 50.6 | 89.6 | 89.6 | sí | 9.7 | 47.2 | 47.2 |
| imagen 9 | sí | 292.8 | 30.2 | 30.2 | sí | 30.6 | 85.8 | 85.8 | sí | 9.7 | 36.5 | 36.5 |
| imagen 10 | sí | 341.2 | 15.0 | 10.4 | sí | 77.2 | 101.7 | 101.7 | sí | 10.9 | 17.0 | 10.5 |
| imagen 11 | sí | 199.5 | 19.7 | 19.7 | sí | 89.9 | 765.1 | 765.1 | no | 12.0 | — | — |
| imagen 12 | sí | 152.6 | 16.0 | 16.0 | sí | 88.4 | 644.0 | 644.0 | no | 11.2 | — | — |
| imagen 13 | sí | 566.3 | 23.3 | 23.3 | sí | 77.0 | 1625.0 | 1625.0 | no | 9.1 | — | — |
| imagen 14 | sí | 175.9 | 22.2 | 22.2 | sí | 105.1 | 688.1 | 688.1 | sí | 10.7 | 37.1 | 37.1 |
| imagen 15 | sí | 159.3 | 21.6 | 21.6 | sí | 55.9 | 29.0 | 29.0 | sí | 10.7 | 23.9 | 23.9 |
| imagen 16 | sí | 192.4 | 33.4 | 33.4 | no | 83.5 | — | — | sí | 10.9 | 20.9 | 20.9 |
| imagen 17 | sí | 199.5 | 20.5 | 8.4 | sí | 82.5 | 878.4 | 878.4 | no | 12.0 | — | — |
| imagen 18 | sí | 198.7 | 19.3 | 18.5 | no | 78.7 | — | — | sí | 11.7 | 22.9 | 18.6 |
| imagen 19 | sí | 160.4 | 23.6 | 19.5 | sí | 85.0 | 152.4 | 152.4 | sí | 10.6 | 17.6 | 19.4 |
| imagen 20 | sí | 148.6 | 14.5 | 16.3 | sí | 95.5 | 754.5 | 754.5 | sí | 10.6 | 18.4 | 16.2 |
| imagen 21 | sí | 149.9 | 12.6 | 20.1 | sí | 86.2 | 1522.4 | 1522.4 | no | 10.4 | — | — |
| imagen 22 | sí | 163.1 | 14.5 | 19.8 | no | 85.8 | — | — | no | 10.8 | — | — |
| imagen 23 | sí | 197.7 | 32.9 | 27.5 | sí | 89.3 | 254.5 | 254.5 | sí | 8.9 | 30.2 | 26.8 |
| imagen 24 | sí | 180.3 | 23.2 | 25.5 | sí | 51.0 | 49.3 | 49.3 | no | 9.8 | — | — |

## Decisión

Motor elegido: **cardfit** (nuevo, valor por defecto; reemplaza a scanic como predeterminado).

Motivo: con las 24 fotos reales anotadas, el pipeline de producción (detección + refinado de 6.3) con cardfit da 24/24 aciertos, 0 errores groseros y mediana de error de ~20 px (fotos de ~4000 px). La línea de base con scanic era 9/24 aciertos, 12 groseros y mediana de ~130 px; opencv da 13/24 con 1 grosero y no detecta 10 de 24.

Cómo funciona: calcula el gradiente por canal (un borde de color cuenta igual que uno de brillo), extrae rectas con una transformada de Hough sobre las normales firmadas, arma cuadriláteros con cuatro rectas cuyas normales giran ~90° y puntúa cada uno por el soporte de borde a lo largo de sus cuatro lados más la forma contra el perfil (relación ~1,586, lados opuestos parejos). Si ninguno es convincente devuelve `null` y la app abre el editor manual. No usa red ni dependencias nuevas.

Costo medido: tiempo medio ~210 ms por foto en el worker contra ~73 ms de scanic (no bloquea la interfaz). El precache baja de 1241,7 KiB a 1160,8 KiB y el bundle del worker de 518 kB a 436 kB, porque el build por defecto ya no lleva scanic. scanic y opencv siguen disponibles como builds alternativos (`VITE_DETECTION_ENGINE`).

Límites: los umbrales (votos mínimos de recta, puntaje mínimo 0,3, soporte mínimo por lado 0,6, ancho de la forma 0,14) se ajustaron con estas mismas 24 fotos de un solo documento, así que 24/24 es un resultado sobre el conjunto de ajuste, no una promesa de acierto general. Se comprobó que da lo mismo con dos reducciones distintas de las fotos (Chromium y Lanczos), pero hace falta ampliar el corpus (otros documentos, fondos y luces) antes de confiar en el número. La regresión sobre el corpus no corre en CI porque `corpus/` no está en el repo.
