# Próxima tarea: biblioteca mejorada y consulta rápida

Estado: pendiente. Registrada el 18 de octubre de 2026.
No iniciar automáticamente, programar recordatorios ni ejecutar en segundo plano.
Retomar cuando el usuario lo pida para evitar solapar el uso de tokens.

Implementar la primera fase del análisis de Yomu Yomu descrito en
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
o permiso verificable de redistribución. JmdictFurigana, audio, series y repaso
quedan para fases posteriores; no ampliar esta primera entrega automáticamente.
