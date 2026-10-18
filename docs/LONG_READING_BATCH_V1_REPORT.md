# Lote largo V1 — 15 relatos N4–N3

Publicación del 18 de octubre de 2026. Se interpreta «M4» como N4 y se conserva
la banda aproximada `N4-N3`, con dificultad 2. No se afirma una clasificación
oficial del JLPT para cada palabra. La petición de textos más largos sustituye
la longitud estándar del contexto: 965–1.037 caracteres japoneses por relato,
media 999,6, frente a los 601–661 del lote personalizado anterior.

Se utilizó el export real válido más reciente encontrado en el workspace, del
12 de octubre de 2026, validado mediante el selector existente y el esquema
`schema/yomustory-learner-context-v1.schema.json`: 4 palabras Known y 5 Learning.
Es una instantánea de esa fecha, no una lectura del estado actual del navegador.
No se usó vocabulario del perfil de ejemplo. El archivo privado sigue ignorado
y su SHA-256 no cambió. No se alteraron estado, backups ni relatos anteriores.

| ID | Título español | Caracteres | Frases | Objetivos Learning | Introducciones propuestas |
| --- | --- | ---: | ---: | --- | ---: |
| cooking_004 | El papel de la nevera | 1014 | 26 | 包丁 ×3・相手 ×3・約束 ×3 | 5 |
| cooking_005 | La misma sopa, otra vez | 980 | 26 | 包丁 ×2・相手 ×2 | 5 |
| cooking_006 | La comida que llevamos al parque | 1012 | 26 | 約束 ×3・包丁 ×2・相手 ×3 | 5 |
| daily_004 | La estantería en un día de lluvia | 989 | 25 | 近所 ×3・約束 ×3・相手 ×3 | 4 |
| daily_005 | Cómo repartir diez minutos por la mañana | 980 | 25 | 散歩 ×3・約束 ×3・近所 ×2 | 5 |
| daily_006 | La caja que no llegaba | 965 | 25 | 近所 ×2・相手 ×2・約束 ×2 | 6 |
| japan_004 | Leer el mapa del tablón | 1037 | 25 | 近所 ×3・相手 ×2・約束 ×2 | 7 |
| japan_005 | Hasta que termine la colada | 1023 | 25 | 近所 ×4・散歩 ×2・相手 ×2 | 7 |
| japan_006 | Dónde aparcamos las bicicletas | 1017 | 25 | 約束 ×2・相手 ×2・近所 ×3 | 5 |
| travel_004 | Un mapa sin viaje al mar | 976 | 25 | 約束 ×3・散歩 ×2・相手 ×2 | 5 |
| travel_005 | Bajarse una estación después | 989 | 25 | 相手 ×3・散歩 ×2・約束 ×3 | 6 |
| travel_006 | La cuesta sin fotografías | 982 | 25 | 散歩 ×2・相手 ×2・約束 ×2 | 3 |
| work_004 | Cinco minutos antes del almuerzo | 1011 | 25 | 相手 ×3・包丁 ×3・約束 ×2 | 6 |
| work_005 | Un pedido que necesitaba respuesta | 1029 | 25 | 相手 ×4・約束 ×2・近所 ×2 | 7 |
| work_006 | El ruido que encontramos al cerrar | 990 | 25 | 相手 ×1・約束 ×2・包丁 ×2 | 5 |

Los cinco temas se reparten por igual: cocina, vida cotidiana, trabajo, viajes
y vida en Japón. Cada lectura tiene 25–26 frases, cinco párrafos, tres preguntas
de respuesta corta con modelo japonés y explicación bilingüe, y una estimación
orientativa de 11–12 minutos. Los tiempos no son mediciones del alumno.

Las cinco palabras Learning se reutilizan en varios relatos. Cada relato usa
entre dos y cuatro de las palabras Known, además de la base cotidiana supuesta.
Cada texto anota un uso preparatorio de `〜ておく` y un cambio o hábito con
`〜ようになる`: 15 anotaciones de cada estructura. También aparece lenguaje
cotidiano ya trabajado, como deseos con `〜たい`. La mayor extensión desarrolla
las causas y las consecuencias de las decisiones, manteniendo el nivel previsto.

La revisión léxica adjunta particiona los lemas no listados entre base familiar
supuesta, introducciones propuestas e incertidumbre. Se proponen 3–7 introducciones
por relato, dentro del máximo de 8. Son decisiones editoriales, no palabras
confirmadas como desconocidas. Los 759 lemas no listados distintos del lote
incluyen numerales, formas potenciales, segmentaciones y vocabulario cotidiano:
no equivalen a 759 palabras nuevas. No se puede medir la novedad real ni una
cobertura familiar del 85 % sin más evidencia del alumno. La revisión no cambia
ninguna palabra a Known y el rango N4–N3 sigue siendo aproximado.

Flujo: borradores en `.tmp/` → SudachiPy 0.6.11/core 20260723, modo C → revisión
del japonés, referencias, traducciones ES/EN, lemas, lecturas, contadores, spans
gramaticales y respuestas → validación → publicación con IDs nuevos. Se revisaron
las lecturas ambiguas de 私, 箱, 鉢, 種, 空, 店, 開く, los minutos y los contadores
de objetos. Las cinco escrituras/lecturas objetivo se contrastaron con el JMdict
completo instalado, sin copiar definiciones ni inventar IDs de diccionario.

Se añaden 378 traducciones de frases y el resto de campos editoriales al catálogo
inglés: 487 claves nuevas, 877 en total. Los valores ingleses anteriores y los
15 JSON ya publicados se conservaron sin cambios. El manifest se reconstruyó
y comprobó con 30 relatos. Las preguntas quedan disponibles en los datos; este
lote no añade una interfaz de cuestionarios.

Validación local: 30/30 relatos válidos, manifest correcto, 81 pruebas backend,
107 pruebas frontend, typecheck y compilación de producción correctos. La suite
frontend comprueba todos los campos editoriales españoles de los 30 relatos
contra el catálogo inglés. Se revisó el diff y la exclusión del export privado
antes del commit. Los estados de CI y despliegue se comprueban tras el push y se
comunican al entregar el lote.
