# Revisión UX/UI de Yomu Yomu y propuesta para YomuStory

Revisión del 18 de octubre de 2026. Referencia de YomuStory: commit `04209a0`.
Se navegó la app instalada en BlueStacks 5, en una ventana horizontal. Se
inspeccionaron catálogo, filtros, ficha de serie, lector, consulta de palabra,
traducción, opciones de lectura y entrada a Flashcards. Esto no constituye una
prueba en un teléfono físico ni una evaluación de todo su catálogo.

## Lo observado directamente

| Área | Yomu Yomu observado | YomuStory actual | Oportunidad |
| --- | --- | --- | --- |
| Entrada | Búsqueda por título, palabras clave y caracteres; accesos a Stories, Articles y Courses; recomendaciones y contenido gratuito | Biblioteca con 30 tarjetas, tema y estado por historia | Reducir el esfuerzo de elegir con búsqueda y una lectura para continuar |
| Catálogo | Portadas, etiquetas de nivel coloreadas, filtros multiselección y ocultar lo marcado como leído | Título japonés y traducido, nivel, duración, dificultad y filtro temático | Añadir filtros de estado y duración; conservar títulos y datos legibles |
| Colecciones | Serie con descripción, ocho capítulos y contador de capítulos leídos en la ficha revisada | Relatos independientes | Diseñar futuras series propias; no convertir artificialmente relatos inconexos en capítulos |
| Texto | Párrafos continuos con pocas acciones intercaladas; barra inferior con páginas y controles de audio | Traducción por frase, bloques separados y barra de navegación por frases | Ofrecer lectura más continua sin perder la selección precisa por frase |
| Consulta rápida | Al tocar una palabra aparece lectura, significado breve y etiqueta JLPT en una franja superior, conservando el texto visible | Diálogo modal con sentidos, lecturas, estado y atribución | Separar consulta breve de detalles completos |
| Traducción | Un toque en la franja de ayuda mostró la traducción de la frase activa y resaltó esa frase | La traducción se despliega debajo de cada frase | Evaluar una zona estable para la frase activa, evitando saltos de composición |
| Ajustes | Opciones de apariencia, tamaño, familia de fuente, traducciones, subrayado JLPT y resaltado gramatical | Furigana adaptativa y dos tamaños de letra | Un panel claro de lectura con tamaño, interlineado y apariencia |
| Repaso | Sección Flashcards con explicación de cómo guardar palabras mediante pulsación prolongada | Vocabulario con estados y backups, sin sesión de tarjetas | Crear un recorrido visible de guardar → revisar; mantener botones explícitos |

Se comprobó la consulta de una palabra y de una partícula, y el cambio entre
definición y traducción de frase. El menú Info identificó el capítulo abierto
como Chapter 7; no se asume que fuera el primero. La ficha de esa serie indicaba
cero de ocho capítulos leídos; no se marcaron capítulos como completados.

Se vieron reproductor, velocidad, audiolibro, bookmark y descarga, esta última con
indicador premium. No se probó la calidad del audio, sincronización, funcionamiento
sin conexión, suscripción ni sesión de repetición espaciada. La pantalla de
Flashcards mostraba instrucciones de incorporación; no se guardaron palabras para
simular un repaso. Se consultaron ajustes sin cambiar sus interruptores.

Los anuncios laterales y la barra del emulador pertenecen a BlueStacks. No se
atribuyen a Yomu Yomu. La portada de la serie ocupaba mucho alto en esta ventana;
no se extrapola esa proporción a un teléfono. En algunas transiciones hubo que
esperar a que terminara la animación antes de elegir el siguiente control.

## Qué mantendría de nuestro lector

La identidad visual cálida y verde, español e inglés, furigana adaptativa, lectura
en hiragana, distinción entre objetivos y estado de aprendizaje, backups y
contexto exportable. El diccionario completo y sus restricciones de lectura
seguirían disponibles. No sustituiría esos datos por una definición editorial
sin procedencia ni por un nivel JLPT inferido.

No trasladaría a nuestra app gestos ocultos como única forma de guardar, romaji
por defecto para este nivel ni controles de audio antes de disponer de audio
usable. El color siempre debe acompañarse de texto. Con los treinta relatos
actuales en la misma banda N4–N3, un filtro de nivel aporta menos que búsqueda,
duración y estado; ganará utilidad cuando haya varias bandas.

## Propuesta concreta, por orden

1. **Biblioteca orientada a la siguiente lectura.** Una tarjeta «Continuar» para
   la lectura incompleta más reciente; buscador japonés/español/inglés; filtros
   por tema, estado y duración; orden por incorporación y acceso al lote largo.
   Las tarjetas normales conservarán títulos, nivel y minutos. Portadas propias
   pueden añadirse después con proporciones contenidas y recursos originales.
2. **Consulta rápida dentro del lector.** Un toque muestra lectura contextual,
   un significado breve y acciones de estado, junto a «Ver todos los sentidos».
   En escritorio, panel lateral; en móvil, franja inferior que deje visible la
   frase. La consulta breve y el diálogo completo compartirán el servicio JMdict,
   identidad de entrada y estados existentes. La franja debe cargar de forma
   asíncrona sin desplazar el texto y tratar explícitamente la ambigüedad.
3. **Menos interrupciones visuales.** Opción de párrafos continuos y ayuda para
   la frase activa. Mantener la traducción por frase como alternativa, navegación
   con teclado y selección sobre espacio vacío. Agrupar opciones en «Lectura» y
   conservar la posición al abrir/cerrar ayudas. Ampliar tamaño e interlineado
   requiere migración compatible de preferencias y backups.
4. **Comprensión y continuidad.** Mostrar las preguntas ya incluidas en los
   relatos al terminar, con respuestas y explicación. Más adelante, series
   originales con capítulos y progreso agregado, sin cambiar IDs publicados.
5. **Audio y repaso.** Evaluar voces japonesas con muestras reales y distinguir
   síntesis de narración grabada. Añadir reproducción por frase solo con una
   fuente adecuada. Para repaso, priorizar exportación Anki con contexto antes
   de construir otro motor SRS completo.

Primera entrega recomendada: puntos 1 y 2. Son una propuesta para la siguiente
iteración; esta revisión no cambia la interfaz pública ni agrega funcionalidades.

### Criterios de aceptación de esa primera entrega

- «Continuar» lleva a la última frase guardada; no cambia Known/Learning ni
  marca como completada una historia al consultarla.
- Búsqueda y filtros se combinan, muestran resultados vacíos comprensibles y
  funcionan en ambos idiomas sin traducir títulos japoneses ni cambiar sus IDs.
- La consulta breve usa la misma entrada compatible que los detalles completos;
  conserva las alternativas cuando no hay una sola interpretación segura.
- Consultar varias palabras no exige cerrar un modal entre cada una. Escape,
  foco de teclado y «Cerrar» siguen siendo utilizables.
- La frase activa permanece visible y el progreso no se reinicia al cambiar
  idioma, filtros o presentación. Verificar escritorio y ancho móvil real.
- No introducir una migración de los datos del alumno para un mero filtro de
  biblioteca. Nuevas preferencias de lectura sí deben versionarse y migrarse.

## Textos y niveles: resultado de la comprobación

No se importaron textos, traducciones, audio, portadas ni datos privados de la
app. Sus [condiciones enlazadas desde la web oficial](https://www.iubenda.com/terms-and-conditions/46090470),
en las secciones sobre contenido y sus derechos, reservan los derechos del
editor/licenciantes y restringen copiar, transformar, traducir y publicar ese
contenido. Las excepciones de descarga/compartición que describen requieren
indicación expresa y se limitan al uso personal no comercial. No se encontró
una autorización para redistribuir su biblioteca en nuestro GitHub Pages.

Acceso gratuito o una suscripción permiten leer dentro del servicio; no son la
licencia que necesita nuestra colección pública. Tampoco se presume que una
adaptación graduada, traducción, imagen o narración sea reutilizable porque la
obra en que se inspira tenga otra situación de derechos.

Referencias públicas útiles, sin reproducir sus relatos:

| Referencia | Nivel que publica la fuente | Tratamiento en YomuStory |
| --- | --- | --- |
| The Human Chair | Elementary; la ficha y la web dicen adaptación JLPT N4 | Referencia externa; no importada |
| The Diary of a Cat 1: What is Home? | Beginner I en la web; no equivalencia JLPT verificada aquí | Referencia externa; no inventar N5/N4 |

Ambas fichas aparecen en la [página oficial](https://yomuyomu.app/).
Para una futura incorporación se necesita permiso o licencia verificable para
ese texto y su redistribución concreta. Se guardarían procedencia, autor,
licencia, URL, fecha consultada y nivel atribuido por la fuente, separado de
nuestra estimación. Los niveles de sus versiones no se trasladan a adaptaciones
originales nuestras. Alternativas viables: enlaces de referencia, permiso del
editor, o textos propios/expresamente reutilizables con revisión de nivel propia.
No se contactó a terceros ni se extrajo el almacenamiento de BlueStacks.

## Recurso técnico que merece una prueba separada

Yomu Yomu declara usar JMdict para definiciones y JmdictFurigana para posicionar
furigana en su [página de fuentes](https://yomuyomu.app/data_sources).
[JmdictFurigana](https://github.com/Doublevil/JmdictFurigana) proporciona segmentos
de lectura por palabra. El README distingue su función de la de un analizador
morfológico y declara los datos bajo la licencia de JMdict, CC BY-SA; la licencia
del código del repositorio no debe confundirse con la de los datos.

Nuestro `JapaneseText.tsx` ya admite `furigana_segments`, aunque cae en ruby para
la palabra entera cuando no los hay. Una prueba futura podría enriquecer palabras
compatibles y reducir ruby sobre kana. Debe respetar la lectura contextual de las
formas flexionadas, conservar expresiones indivisibles, fijar versión/checksum,
incluir atribución y mantener fallback. No cambiaría automáticamente los relatos
publicados ni asumiría que el recurso determina lecturas por contexto.

## Validación de esta revisión

Inspección directa de las pantallas indicadas, contraste con las fuentes oficiales
y lectura de `StoryLibrary.tsx`, `ReaderPage.tsx`, `StorySentence.tsx`,
`VocabularySheet.tsx`, `JapaneseText.tsx`, preferencias y tipos del repositorio.
No hubo cambios de código, corpus ni estado del alumno, por lo que no se repitió
la suite para este documento. La auditoría distingue lo observado, lo anunciado
por la fuente y lo propuesto; las mejoras quedan pendientes de implementación.
