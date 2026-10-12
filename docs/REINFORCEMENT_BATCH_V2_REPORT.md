# Reinforcement Batch V2 — personalización real

Se seleccionó el contexto válido más reciente del repositorio por `generated_at`,
validado contra `schema/yomustory-learner-context-v1.schema.json`: contexto real
del 12 de octubre de 2026, con 4 palabras Known y 5 Learning. No se utilizó el
perfil de ejemplo. El export permanece ignorado y sin cambios (SHA-256 comprobado).
No se modificaron el estado del alumno, los backups ni los diez relatos publicados.

| Relato | Caracteres japoneses del cuerpo | Objetivos (3 apariciones cada uno) | Introducciones propuestas | Lemas no listados, incluido el título |
| --- | ---: | --- | ---: | ---: |
| daily_003 | 616 | 近所・散歩・約束 | 8 | 87 |
| cooking_003 | 611 | 包丁・相手・約束 | 8 | 83 |
| travel_003 | 605 | 近所・散歩・約束 | 5 | 92 |
| work_003 | 601 | 包丁・相手・約束 | 8 | 88 |
| japan_003 | 661 | 近所・相手・散歩 | 5 | 97 |

Las cinco palabras Learning aparecen en varios relatos. Las cuatro Known aparecen
en cada relato. Se verificaron las cinco entradas objetivo, sus escrituras y
lecturas con el JMdict completo instalado. Cada relato refuerza `〜ておく` dos
veces y `〜ようになる` una vez: 10 y 5 anotaciones respectivamente. Se respetan
dificultad 2, N4→N3, dos objetivos gramaticales y un máximo de ocho introducciones
propuestas; cocina, moto, vida japonesa, trabajo, viajes y vida cotidiana guían
las situaciones. Cada relato tiene traducciones españolas y tres preguntas
revisadas con respuestas y explicaciones específicas.

La lista confirmada no es un inventario exhaustivo. Hay 275 lemas no listados
distintos en el lote; **no equivalen a 275 palabras desconocidas**. La revisión
editorial pública está en `REINFORCEMENT_BATCH_V2_LEXICAL_REVIEW.json`: particiona
los lemas no listados de cada relato entre base familiar supuesta, introducciones
propuestas e incertidumbre. La base usa supuestos de lectura graduada N4→N3,
incluidos vocabulario cotidiano, flexiones y contexto. No cambia ninguna palabra
a Known. Las introducciones propuestas se presupuestan junto con cualquier
incertidumbre. No es posible medir cuántas son genuinamente nuevas para el alumno
sin su confirmación, ni afirmar que se ha medido una cobertura familiar del 85 %.

En V1 no había contexto real: se usaron 2 Known y 3 Learning de ejemplo, relatos
de 257–295 caracteres y un presupuesto estricto que trataba cada lema no listado
como nuevo. V2 ofrece relatos de longitud normal y reutilización de las cinco
palabras reales. La comparación de «novedades» no es directamente equivalente:
el nuevo método distingue evidencia confirmada de supuestos editoriales. Las
tramas varían, aunque la exigencia de reutilización conserva cierta repetición
de rutinas y encuentros. La calidad personal requiere ahora lectura y feedback
del alumno, no solamente validación estructural.

Flujo: borradores separados → SudachiPy 0.6.11 / core 20260723, modo C → revisión
de traducciones, contexto, lecturas, objetivos, gramática y preguntas → revisión
léxica → validación → publicación. Los borradores y métricas privadas permanecen
fuera de Git. `generation.validated` solo se activó después de revisar y validar.
El manifest se regeneró determinísticamente con 15 relatos y se comprobó.

Validación local final: 81 pruebas backend; 101 pruebas frontend; typecheck y
build de producción correctos; todos los relatos y el perfil de ejemplo válidos.
Los tests de CI usan contenido público y fixtures, nunca el export privado.
Antes del commit se revisó el diff, la identidad de los diez relatos anteriores
y la exclusión de los archivos privados del staging.

CI y publicación: consultar las ejecuciones asociadas al commit de este lote en
[GitHub Actions](https://github.com/gabe95eGa/YomuStoryAPP/actions).
El resultado remoto se comunica después del push; este informe no lo presume.

También se aclara el lector: fondo suave para objetivos del relato; puntos para
Learning; línea continua para Known, propagados a las coincidencias identificadas.
El espacio libre de una frase y Enter/Espacio permiten seleccionarla; hover solo
orienta. El diccionario muestra otras lecturas compatibles de la misma escritura
cuando JMdict las proporciona, manteniendo los sentidos y la identidad seleccionados.
