# Próxima tarea: biblioteca mejorada y consulta rápida

Estado: implementada el 18 de octubre de 2026 por petición expresa del usuario.
Se añadieron biblioteca mejorada, consulta rápida, presentación y comprensión.
Detalles y verificaciones: [entrega UX V1](docs/READER_UX_V1.md).

Actualizaciones posteriores autorizadas por el usuario: exportación para Anki
y mejoras de carga en [UX V2](docs/READER_POLISH_V2.md); retirada de las fotos
de la biblioteca beta y narración japonesa local en
[diseño neutro y narración V1](docs/NEUTRAL_LIBRARY_AND_LOCAL_NARRATION_V1.md).

Alcance de la primera fase del análisis de Yomu Yomu descrito en
[la revisión de UX](docs/YOMUYOMU_UX_REVIEW.md).

1. Biblioteca: tarjeta «Continuar» para la lectura incompleta más reciente,
   búsqueda en japonés/español/inglés y filtros combinables por tema, estado y
   duración. Conservar títulos, nivel y minutos visibles.
2. Lector: consulta breve de palabras sin bloquear el texto, con lectura
   contextual, significado, estados de vocabulario y acceso a todos los sentidos.
   Compartir el servicio JMdict y las identidades con el diálogo actual.
3. Mantener español/inglés, progreso, backups, furigana adaptativa y accesibilidad.
   Verificar foco, Escape, frase visible y diseño de escritorio/móvil.
4. Ejecutar las verificaciones apropiadas, revisar el diff, excluir los exports
   privados, hacer commit y push, y comprobar CI y publicación.

No importar relatos, traducciones, portadas ni audio de Yomu Yomu sin una licencia
o permiso verificable de redistribución. JmdictFurigana, series y repaso dentro
de la app quedan para fases posteriores; no ampliarlos automáticamente.

Piloto de audio Azure autorizado: reproductor por párrafos y herramienta de
generación implementados, F0 y límite de gasto verificados, y cuatro secciones
publicadas para cooking_001. Falta que el usuario valore la pronunciación antes
de ampliar el audio al resto de historias nuevas.
Ver [piloto de narración Azure](docs/AZURE_NARRATION_PILOT_V1.md).
