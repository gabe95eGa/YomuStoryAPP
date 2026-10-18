# Reader UX V1

Entrega del 18 de octubre de 2026, a partir de la revisión de Yomu Yomu.
La implementación utiliza componentes, textos e identidad visual de YomuStory.
No se extrajo ni añadió contenido de Yomu Yomu.

## Biblioteca

- Tarjeta para retomar la lectura incompleta abierta más recientemente.
- Búsqueda de títulos japoneses, españoles e ingleses y temas, incluidos alias
  españoles. Normaliza ancho, mayúsculas y tildes latinas.
- Filtros combinables de tema, estado y duración; accesos a hasta cinco minutos
  y a más de diez. Orden del catálogo, brevedad y título.
- Conteo de resultados, estado vacío recuperable y limpieza de filtros.
- Filtros conservados al regresar de una historia, en sessionStorage separado
  del progreso. Si ese almacenamiento falla, siguen funcionando en la vista.
- Cabeceras gráficas propias en CSS por categoría, sin imágenes de terceros.

La tarjeta Continuar respeta la última frase existente. Filtrar, buscar y ordenar
no reescriben el historial ni clasifican vocabulario. La biblioteca sigue usando
los 30 relatos del manifest y sus niveles aproximados originales.

## Consulta de palabras

Un toque abre un panel no modal. En escritorio ocupa una columna lateral; en
ancho móvil aparece encima de la navegación. Se puede tocar la siguiente palabra
sin cerrarlo. Muestra la forma seleccionada, lectura en hiragana, primer sentido
compatible en el idioma preferido, fallback explícito y estados de vocabulario.
Si hay otros sentidos o entradas, lo indica: la definición breve no es una
desambiguación automática del significado contextual.

«Ver todos los detalles» abre el diálogo completo con las mismas entradas ya
resueltas, sin otra consulta. Mantiene sentidos, lecturas, restricciones e identidad
JMdict. El enlace de atribución también está disponible en la consulta breve.
Los cambios de estado siguen actualizando todas las coincidencias identificadas.
Escape, cierre y retorno desde detalles restauran el foco adecuado. Las consultas
anteriores se cancelan y sus resultados tardíos se ignoran.

Al cambiar explícitamente de frase se cierra la consulta anterior. La frase activa
se recoloca cuando hace falta, al abrir el panel, cambiar su altura o redimensionar
la ventana. Esto evita centrarla detrás de la franja móvil. Las frases demasiado
altas se alinean con el comienzo de la zona disponible.

## Lectura y comprensión

«Lectura» permite párrafos continuos, espaciado amplio/compacto y papel claro,
sepia o nocturno. Furigana y tamaño grande siguen accesibles directamente. La
ayuda extensa queda en una sección desplegable. El modo continuo conserva las
frases y sus acciones, mostrando las herramientas en la frase activa o con foco.

Las preferencias visuales nuevas usan `yomustory.reader.appearance.v1`. Se validan
al recuperar y vuelven a valores seguros si están corruptas. No cambian el esquema
existente de backups, preferencias de furigana/tamaño o contexto del alumno; este
nuevo aspecto, como el idioma de interfaz, queda fuera de esos backups actuales.
Si no se puede guardar, el ajuste sigue activo en la sesión y se avisa.

Al final aparece un repaso desplegable de las preguntas que ya contienen los
relatos. Las preguntas de elección y verdadero/falso muestran corrección y
explicación. Las abiertas ofrecen respuesta modelo y explicación para comparar;
no se rechazan variantes por una comparación literal. Las respuestas son locales
a la lectura abierta, no se puntúan ni modifican Known/Learning, nivel o progreso.
Completar la lectura sigue siendo una acción explícita separada.

Toda la interfaz nueva y las preguntas utilizan el selector español/inglés.
El japonés, corpus, tokens, manifest y traducciones editoriales permanecen intactos.

## Verificaciones

Pruebas de búsqueda multilingüe y filtros combinados, recuperación de vista,
selección de la lectura incompleta reciente, invariancia del progreso, carrera
de consultas, reapertura de detalles sin repetir lookup, Escape/foco, fallback
de idioma, ambigüedad, preferencias y los tres tipos de preguntas. Se mantuvieron
las pruebas de estados de vocabulario, furigana, backups y recuperación de errores.

QA con build de producción en un origen local de prueba separado del navegador
habitual del alumno. Comprobaciones a 320 y 390 píxeles y en escritorio: sin
desbordamiento horizontal, panel lateral, consulta móvil, frase visible, controles,
contraste nocturno y corrección de una pregunta. Son pruebas de viewport, no una
prueba en teléfono físico. Se verificó el acceso al JMdict completo instalado.

El build avisa de un bundle principal de aproximadamente 602 kB (187 kB gzip).
La advertencia de tamaño es una mejora pendiente de carga por módulos; no impide
la compilación. Esta entrega no añade audio, otro SRS, sincronización entre
dispositivos ni cambia la distribución del diccionario.

Resultado local: 114 pruebas frontend, 81 backend, 30/30 relatos válidos,
manifest verificado, typecheck y build correctos. El diff confirma que los
relatos, manifest y catálogo de traducciones editoriales no cambiaron. Se excluyen
exports privados, capturas locales de QA y el archivo ajeno `desktop.ini`.

La CI y GitHub Pages se comprueban tras enviar el commit. El resultado concreto
se comunica al entregar esta iteración.
