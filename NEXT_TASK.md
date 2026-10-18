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

## Próxima fase propuesta — pulir la experiencia

Actualizado el 18 de octubre de 2026: el usuario ha descartado el piloto Azure
tras comprobar que la voz del navegador funciona bien en su móvil. Se retiran
el reproductor de MP3, los cuatro audios y la herramienta Azure; se conserva
la narración local y los textos de ayuda simplificados en español e inglés.
No añadir audio externo a las historias nuevas. No modificar el estado del
alumno ni sus backups al realizar esta retirada. Los commits anteriores
conservan el piloto por si se quisiera recuperar en el futuro.

Orden propuesto, pendiente de que el usuario elija la siguiente fase:

1. Entrada para amigos nuevos: elegir el idioma del navegador en la primera
   visita, respetar siempre la elección guardada y añadir una bienvenida breve
   que explique leer, tocar palabras y escuchar. El comportamiento actual usa
   español cuando no existe preferencia guardada.
2. Escucha cómoda: recordar voz y velocidad por dispositivo, conservar una voz
   disponible al cambiar de historia y revisar pausa/reanudación al cambiar de
   app o bloquear la pantalla. Actualmente voz y velocidad se reinician al
   montar el narrador; no prometer segundo plano sin probar móviles reales.
3. Repaso ligero: una sesión de 5–10 palabras Learning con lectura, significado
   y una frase de contexto. Mantener Known/Learning bajo control del usuario;
   no inferir dominio a partir de un clic ni añadir SRS completo de golpe.
4. Prueba con amigos: Safari/iPhone y Chrome/Android, recorrido biblioteca →
   lectura → consulta → escucha → backup/Anki. Anotar bloqueos reales, tiempo
   hasta empezar a leer y puntos de confusión; priorizarlos antes de más
   historias o cambios de estilo amplios.

El recurso remoto yomustory-speech-pilot F0 se ha retirado mediante borrado
recuperable; se ha verificado que el grupo del piloto queda vacío y que el
recurso figura en la lista de eliminados. Azure permite recuperarlo durante
48 horas. No se ha purgado ni se ha modificado la cuenta o la suscripción.
Referencia: https://learn.microsoft.com/en-us/azure/ai-services/recover-purge-resources

Referencias para la fase propuesta:
- https://developer.mozilla.org/en-US/docs/Web/API/Navigator/languages
- https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices
