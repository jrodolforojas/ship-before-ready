> Copy of the build plan. The source of truth is the plan session; this file is only updated on `main`. Relative links point to the original location and do not resolve here.

# Plan de construcción: Ship Before Ready

Actualizado el 2026-11-20
Estado: parte web aprobada y en ejecución; pasos 3, 5, 6, 7 y 8 pendientes de detalle
Fuente de verdad del alcance: [docs/designs/ship-before-ready.md](../designs/ship-before-ready.md)
Entrega: domingo 22 de noviembre de 2026, 23:59 (hora de Costa Rica)

## Decisiones del repo

- Repo en GitHub: `jrodolforojas/ship-before-ready`, público.
- Carpeta local: `~/Documents/code/ship-before-ready`.
- Plugin y marketplace: `ship-before-ready`. Autor: Rodolfo Rojas. Licencia: MIT.

## Cómo se ejecuta

- Cada paso corre en su propia subsesión iniciada desde la sesión del plan, y solo con luz verde del usuario.
- Los pasos 0 y 0b trabajan directo en `main`. Los demás corren cada uno en su propio git worktree y terminan en un PR hacia `main` con una prueba de 10 minutos.
- Un paso no arranca hasta que su dependencia esté en `main`.
- Aprobar un paso es también la luz verde para lanzarlo en cuanto sus dependencias estén listas (acordado el 2026-11-20).
- Los contratos solo se editan en `main`.

## Mapa de pasos

| Paso | Qué es | Estado |
|---|---|---|
| 0 | Repo y esqueleto del plugin | Hecho el 2026-11-20, `main` en `9e67083` |
| 0b | Contratos, convenciones y renombres a inglés | Hecho el 2026-11-20, `main` en `00c8e9c` |
| 0c | Composiciones bocetadas en Claude Design | En curso |
| 1 | Plantilla de la landing en Astro | En curso |
| 1b | Reglas del sistema de diseño y verificador | En curso |
| 1c | Las tres composiciones en código | Espera a 0c y 1 |
| 2 | Página propia en línea, versión 0 | Espera a 1 |
| 3 | Skills `connect`, `interview` y `rules` | Aprobado; espera a 0b |
| 4a | Skill `design` | Espera a 0c y 1b |
| 4b | Skill `landing` | Espera a 1, 1b, 1c y 2 |
| 4c | Página propia con el flujo completo | Espera a 4a y 4b |
| 5 | Skill `video-scripts` | Por detallar |
| 6 | Skill `verdict` | Por detallar |
| 7 | Gate | Por detallar |
| 8 | Empaque y entrega | Por detallar |

## Registro

- **Paso 0** (2026-11-20): <https://github.com/jrodolforojas/ship-before-ready>, público, `main` en `9e67083`. `claude plugin validate` pasa; `plugin.json` y `marketplace.json` conviven en la raíz con `"source": "./"`. Se creó con nombres en español (skills `conectar`, `interrogar`, `reglas`, `landing`, `guiones`, `veredicto`; `docs/contratos/`); el paso 0b los pasa a inglés.
- **Paso 0b** (2026-11-20): `main` en `00c8e9c`. Skills y contratos en inglés (`docs/contracts/`), `templates/contract.json`, diseño neutro, texto y brief de ejemplo, `locales/es.json` y copia del plan en `docs/plan.md`. Comprobado contra este plan: están los 29 tokens, los 38 ganchos, los eventos, las claves de estado y los seis scripts. La lista cerrada de `decor` quedó en `none`, `shapes` y `grid`. `claude plugin validate` pasa con dos advertencias (ícono ausente y `CLAUDE.md` en la raíz) que se resuelven en el paso 8.
- **Cuentas:** la cuenta activa de `gh` es `jrodolforojas`; la llave SSH de `github.com` autentica como `jrodolforojas`.
- **PostHog sin llaves** (decidido el 2026-11-20): el builder inicia sesión en PostHog desde Claude Code y no pega ninguna llave. `connect` y `verdict` leen por el servidor MCP de PostHog (`https://mcp.posthog.com/mcp`, con inicio de sesión en el navegador), que el plugin declara en su propio `.mcp.json`. Verificado en el plugin oficial de PostHog instalado en esta máquina: se autentica con `/mcp` y expone `execute-sql`.

## Pendiente de decidir

- Reglas y criterios del hackathon (requieren sesión en trydojo.io) y formato de Dojo Marketplace.
- Sesión de Vercel y proyecto de PostHog del autor.

---

## Parte web: diseño primero en Claude Design

### Contexto

El plan anterior resolvía la landing con una sola plantilla sobria y tres pasos resumidos (1, 2 y 4). Usted pidió más detalle y un cambio de fondo: el plugin tiene que **preguntar** por el diseño, **derivar un design system de la idea**, mostrar **tres bocetos** en Claude Design, dejar que el builder **elija e itere ahí**, y solo con el diseño final **programar** la landing, que debe cumplir requisitos de jerarquía y diseño verificables.

Este plan reemplaza los pasos 1, 2 y 4 de `docs/plans/ship-before-ready-plan.md` por nueve pasos: 0b, 0c, 1, 1b, 1c, 2, 4a, 4b y 4c. Los pasos 3, 5, 6, 7 y 8 se detallan después a este mismo nivel.

#### Tres principios

1. **Las decisiones se toman en el diseño.** Ahí se puede cambiar todo lo que haga falta, las veces que haga falta. La fase de landing no decide nada: programa lo aprobado.
2. **El código llega cuando el diseño es final.** Nada se instala ni se programa en el repo del builder antes de su aprobación.
3. **El código va en inglés; el texto, en archivos de idioma.** Cambiar una palabra o agregar un idioma no toca código.

#### Decisiones tomadas en esta sesión

| Tema | Decisión |
|---|---|
| Dónde se itera el diseño | Dentro de Claude Design, con artboards nativos y editables. Se programa al final. |
| En qué difieren los bocetos | Tres direcciones visuales: paleta, tipografía y composición propias. La elegida se convierte en el design system. |
| Sin Claude Design | Respaldo local sobre la página real. |
| Tecnología | Astro 7 con Tailwind 4. Sin React, sin Preact, sin librería de formularios. |
| Gestor de paquetes | Lo elige el builder entre bun, pnpm, npm y yarn; bun es el recomendado y el valor por defecto. |
| Tipografías | Catálogo de Google Fonts, servidas desde el dominio del builder. |
| Idioma del código | Todo identificador en inglés, incluidos los comandos de las skills. Lo que lee una persona queda en español, en archivos de idioma. |
| Skills de diseño externas | Se portan sus reglas con atribución. No se instalan ni son dependencia. |
| Mirada al mercado | Dentro de la skill de diseño, opcional, primera en recortarse. |
| Plantilla | Sus tres composiciones se bocetan en Claude Design para su visto bueno antes de programarlas. |
| Anatomía | Cuatro pantallas fijas con bloques obligatorios. |

Un agente independiente revisó la arquitectura; sus hallazgos están incorporados.

### Tecnología

| Pieza | Elección | Por qué |
|---|---|---|
| Generador | Astro 7, salida estática, sin adaptador | El texto queda en el HTML al compilar; Vercel lo detecta solo |
| Estilos | Tailwind 4 con la paleta y escalas por defecto apagadas | Solo existen las utilidades de nuestros tokens: un color fuera del sistema no compila |
| Interacción | Script propio en TypeScript con validación nativa del navegador | Cuatro pantallas y cinco campos no justifican una isla ni una librería |
| Texto | Un archivo por idioma, `src/i18n/es.json` | Ningún texto visible vive en el código |
| Fuentes | API de fuentes de Astro con proveedor Google | Se descargan al compilar: ninguna petición a Google |
| Eventos | `fetch` a la API de captura de PostHog por una ruta del propio dominio | Sin scripts de terceros; muestra error si la petición falla |
| Publicación | Vercel CLI con `--cwd landing` | Nunca desde la raíz: publicaría `.sbr/` |

Astro no genera conflicto con los eventos: son JavaScript del navegador, y PostHog tiene guía oficial para Astro. Si la API directa diera problemas en el paso 2, se cambia al fragmento oficial sin tocar el contrato de eventos.

**Formulario.** Astro lo pinta como HTML al compilar y lo maneja `flow.ts`: validación nativa (`required`, `type=email`, `checkValidity`), mensajes propios bajo el campo, `aria-invalid`, foco al primer error y estado de "enviando". El correo se envía al terminar la pantalla 2, así que queda guardado aunque el visitante abandone las preguntas. Si el formulario creciera, pasarlo a una isla queda contenido en un componente.

**Gestor de paquetes.** `connect` lo pregunta al inicio (bun recomendado, pnpm, npm o yarn), comprueba que esté instalado y lo guarda como `package_manager`. Los cuatro aceptan `<gestor> install` y `<gestor> run <script>`, así que las skills solo cambian el nombre. La plantilla fija versiones exactas y trae el archivo de bloqueo de bun; con otro gestor, el suyo se genera en la primera instalación. Bun instala y lanza los scripts, pero Astro corre sobre Node.

**Costos.** Cada landing instala dependencias, y Astro 7 exige Node 22.23.4 o superior. Su máquina tiene 22.23.1.

#### Idioma

| En inglés | En español, en archivos de idioma o documentos |
|---|---|
| Comandos de las skills, carpetas, archivos, scripts | Texto de la landing (`src/i18n/es.json`) |
| Tokens, ganchos, claves de JSON, eventos y sus propiedades | Lo que la skill le dice al builder |
| Instrucciones internas de las skills, contratos, `CLAUDE.md`, comentarios y commits | Documentos que lee el builder: README, brief, veredicto |

El idioma de cada proyecto es la clave `locale` del brief (`es` por defecto). Las frases fijas del plugin viven en `locales/es.json`.

### Cómo queda el flujo del builder

`connect` → `interview` → `rules` → **`design`** → **`landing`** → `video-scripts` → `verdict`

**`design`: del brief a un diseño final aprobado en Claude Design**
1. Comprueba que el brief esté aprobado por el revisor.
2. Hace cuatro preguntas de diseño en una sola pantalla; todas aceptan "decida usted".
3. Si el builder no trae paleta, mira el mercado: qué colores usa la competencia y cómo diferenciarse.
4. Escribe el texto de la página desde el brief y espera el visto bueno.
5. Propone tres direcciones en texto y espera el visto bueno.
6. Define cada dirección como un archivo de valores y lo pasa por el verificador. Una dirección que no cumple no se dibuja.
7. Arma en Claude Design un lienzo con las tres direcciones, lado a lado, como artboards editables.
8. El builder elige una.
9. La dirección elegida se dibuja completa, con las cuatro pantallas, y se itera sin límite de rondas: cada cambio ajusta valores o texto, se verifica y se repinta.
10. Con la aprobación final, guarda el design system en el repo del builder.

**`landing`: del diseño final a la página publicada**
1. Relee el lienzo; si fue editado después de la aprobación, se detiene y pregunta.
2. Instala la plantilla Astro y le aplica los valores y el texto aprobados.
3. Compila y corre el verificador sobre la página real. Si falla, no publica.
4. Muestra la página junto al lienzo y espera el visto bueno del builder.
5. Escribe la conexión a PostHog, publica en Vercel y comprueba que una visita de prueba registra los cinco eventos.

**Sin Claude Design:** la skill lo dice en una línea, instala la plantilla antes y muestra las tres direcciones una por una sobre la página real.

### Qué tiene siempre la landing

Cuatro pantallas fijas. El diseño cambia cómo se ven; nunca qué bloques hay ni en qué orden. Cada bloque es un componente de Astro.

| Pantalla | Bloque | Contiene | Obligatorio |
|---|---|---|---|
| 1 · Promesa | Marca | Nombre del producto. Sin menú | Sí |
| | Portada | Titular (la promesa), subtítulo (para quién y qué cambia) y botón de acceso anticipado. Cabe entera en la primera vista | Sí |
| | Figura | Motivo decorativo de la portada | Opcional |
| | Dolores | De una a tres situaciones que el usuario reconoce, sacadas del brief | Sí |
| | Cómo funciona | Tres pasos de lo que va a recibir | Sí |
| | Cierre | La promesa en una línea y el mismo botón | Sí |
| | Pie | Quién está detrás y la línea de privacidad | Sí |
| 2 · Correo | Progreso | Marca y "paso 1 de 2" | Sí |
| | Registro | Título, campo de correo con etiqueta, línea de privacidad, botón de enviar | Sí |
| | Error | Bajo el campo, solo si falla | Condicional |
| 3 · Preguntas | Progreso | Marca, "paso 2 de 2" y aviso de que el correo ya quedó guardado | Sí |
| | Dos preguntas | Qué usa hoy; cuándo fue la última vez y qué le costó | Sí |
| | Llamada | WhatsApp y horario | Opcional para el visitante |
| | Enviar | Botón | Sí |
| 4 · Final | Confirmación | Título | Sí |
| | Aviso | "Todavía no existe", a la vista | Sí |
| | Qué sigue | Una línea | Sí |

**Dónde va el registro de correo:** en su propia pantalla, después del botón. El clic se mide aparte en el veredicto, por eso son dos pasos.

**Nunca aparece, con ningún diseño:** menú de navegación, precios o planes, testimonios, logos de clientes o cifras inventadas, enlaces de salida o redes, ventanas emergentes, chat, carruseles, video de fondo.

### Decisiones de arquitectura

1. **Un archivo de valores, dos pintores.** Cada dirección es un `tokens.json`: colores, tipografía, espacios, forma, composición y decoración. Ese archivo alimenta los artboards del lienzo durante el diseño y la plantilla Astro al final. Por eso lo aprobado en Claude Design y lo publicado salen de los mismos valores.
2. **Las composiciones se aprueban una vez.** La portada tiene tres composiciones (`centered`, `split`, `editorial`). Usted las aprueba en Claude Design (paso 0c); de ahí salen las plantillas de artboard que usa la skill y la especificación que se programa en Astro (paso 1c).
3. **Artboards con huecos.** Las plantillas de artboard tienen un hueco por cada token y cada texto. Un script los llena, así el lienzo de cada builder se arma en segundos, sin redibujar, y sigue siendo nativo y editable.
4. **Qué se puede cambiar en el diseño.** Todo lo que cabe en los valores (colores, tipografías, tamaños, espacios, forma, composición, decoración) y todo el texto. La anatomía no cambia.
5. **Lo que se verifica antes y después.** Antes de dibujar, el verificador revisa valores y texto: contraste, escala, tamaños, largos. Lo que solo existe en la página real (desbordes, primera vista, contraste dibujado) se revisa después de programar. Para que eso casi nunca falle, el paso 1c prueba cada composición con el texto más largo y los valores más grandes permitidos.
6. **Si la página real falla un requisito**, la skill dice cuál y propone el cambio mínimo de valores. El cambio vuelve al lienzo para su aprobación. Es el costo de programar al final, y se aceptó.
7. **Esqueleto fijo.** Todo el proyecto Astro es igual para todos los builders, salvo `src/data/` y `src/i18n/`.
8. **Sin `config.json` no se envía nada.** Las vistas previas no ensucian el veredicto.
9. **Página propia como builder de mentira.** `site/` dentro del repo del plugin funciona como el repo de un builder.

### Contratos (los fija el paso 0b)

Sin estos nombres fijados, las sesiones en paralelo divergen. Solo se editan en `main`.

#### Nombres que cambian en el repo

| Antes | Ahora |
|---|---|
| Skills `conectar`, `interrogar`, `reglas`, `diseno`, `landing`, `guiones`, `veredicto` | `connect`, `interview`, `rules`, `design`, `landing`, `video-scripts`, `verdict` |
| `.sbr/conexiones.json`, `reglas.md`, `guiones.md`, `veredicto.md`, `saltos.log` | `.sbr/connections.json`, `rules.md`, `video-scripts.md`, `verdict.md`, `bypass.log` |
| Eventos `sbr_clic_acceso`, `sbr_registro`, `sbr_respuestas`, `sbr_fin` | `sbr_cta_click`, `sbr_signup`, `sbr_answers`, `sbr_done` |
| Propiedades `origen`, `correo`, `usa_hoy`, `ultima_vez`, `quiere_llamada`, `horario` | `source`, `email`, `current_solution`, `last_time`, `wants_call`, `time_slot` |
| Parámetros `?o=`, valores `amigos`, `sin_etiqueta` | `?src=`, valores `friends`, `untagged`, y el nuevo `test` |
| `docs/contratos/` | `docs/contracts/` |

#### Tokens

| Familia | Variables | Utilidades | Regla |
|---|---|---|---|
| Color | `--color-canvas`, `-surface`, `-ink`, `-ink-muted`, `-accent`, `-on-accent`, `-line`, `-focus`, `-danger` | `bg-canvas`, `text-ink`, `border-line` | `ink` e `ink-muted` solo sobre `canvas` o `surface`; `on-accent` solo sobre `accent`; el acento nunca es color de texto |
| Familias | `--font-display`, `--font-body` | `font-display`, `font-body` | Máximo dos |
| Texto | `--text-title`, `-heading`, `-lead`, `-body`, `-small`, `-button`, `-label`, cada uno con interlineado, peso y espaciado | `text-title`, etc. | Tamaño de teléfono por defecto y de escritorio desde 768 px |
| Espacio | `--spacing-section`, `-block`, `-group`, `-item` | `py-section`, `gap-group` | Múltiplos de 4 px y en ese orden de mayor a menor |
| Forma | `--radius-control`, `--radius-card`, `--shadow-card`, `--line-width` | `rounded-control`, etc. | |
| Medidas | `--container-prose`, `--container-page`, `--motion-duration` | `max-w-prose`, etc. | `prose` entre 45ch y 75ch |

`tokens.json` lleva además: `name`, `scheme` (`light` o `dark`), `composition` (`centered`, `split` o `editorial`), `decor` (lista cerrada, con `none`) y `fonts` (familia, pesos, respaldo).

#### Ganchos del HTML (`data-sbr`)

- Estructura: `page`, `brand`, `progress`, `figure`, `decor-1`, `decor-2`, `footer`, `debug-panel`.
- Pantalla 1: `screen-promise`, `title`, `subtitle`, `cta`, `pains`, `steps`, `closing`, `cta-closing`.
- Pantalla 2: `screen-email`, `email-title`, `email-form`, `email-field`, `privacy`, `email-submit`, `email-error`.
- Pantalla 3: `screen-questions`, `questions-title`, `questions-form`, `field-current-solution`, `field-last-time`, `field-wants-call`, `call-group`, `field-whatsapp`, `field-time-slot`, `questions-submit`, `questions-error`.
- Pantalla 4: `screen-done`, `done-title`, `notice`, `next-steps`.

#### Archivos de una landing

| Archivo | Cambia por builder | Quién lo escribe |
|---|---|---|
| Todo el proyecto Astro: `package.json`, `astro.config.mjs`, `src/layouts`, `src/components`, `src/scripts`, `src/styles`, `src/pages` | No | `scripts/copy-template.mjs` |
| `src/i18n/<locale>.json` | Sí | Skill `landing`, desde el texto aprobado |
| `src/data/tokens.json` | Sí | Skill `landing`, desde el diseño aprobado |
| `src/data/config.json` y `vercel.json` | Sí; no existen hasta publicar | `scripts/configure-landing.mjs` |

Claves del archivo de idioma: `lang`, `brand`, `hero{title, subtitle}`, `cta`, `pains[]`, `steps[]`, `closing`, `footer{author, privacy}`, `progress`, `status{sending}`, `email{title, label, placeholder, submit, privacy, error}`, `questions{title, saved, current_solution, last_time, wants_call, whatsapp, time_slot, submit, error}`, `done{title, notice, next}`, `meta{title, description}`.

Claves de `config.json`: `posthog_key`, `capture_path`.

#### Estado en el repo del builder

| Archivo | Lo escribe | Lo leen |
|---|---|---|
| `.sbr/connections.json`: `package_manager`, `posthog_region`, `posthog_public_key`, `posthog_project_id`, `vercel_project`, `vercel_team`, `verified_at` | `connect` | `design`, `landing`, `verdict` |
| `.sbr/brief.md`: cabecera con `reviewer`, `locale`, `persona`, `pain`, `current_solution`, `promise`, `questions`; el cuerpo en el idioma del builder | `interview` | `rules`, `design`, `video-scripts` |
| `.sbr/design/answers.md`, `market.md`, `concepts.md` | `design` | `design` |
| `.sbr/sketches/{a,b,c}/tokens.json` y `concept.md` | `design` | builder |
| `.sbr/design/tokens.json`, `copy.<locale>.json`, `system.md` | `design` | `landing` |
| `.sbr/design/choice.md`: `chosen`, `approved`, `canvas`, huella de lo aprobado, razón del builder | `design` | `landing` |
| `landing/` (proyecto Astro) y `.sbr/landing.json`: URL, fecha, huella del diseño, resultado del verificador | `landing` | `video-scripts`, `verdict` |

#### Parámetros de URL

- `src`: origen. `test` queda reservado para visitas de prueba y `verdict` lo excluye.
- `debug=1`: muestra el panel de eventos.
- `screen=1..4`: abre directo una pantalla. Solo funciona sin `config.json`.
- `sbr_cta_click` gana la propiedad `place` (`hero` o `closing`), porque el botón aparece dos veces.

#### Scripts del plugin

Todos son `.mjs` sin dependencias. Códigos de salida: 0 bien, 1 falla algún requisito, 2 uso o entorno incorrecto, 3 no hay Chrome.

| Script | Uso | Dueño |
|---|---|---|
| `fill-artboards.mjs <tokens.json> <copy.json> <salida>` | Llena las plantillas de artboard con valores y texto | 0c |
| `copy-template.mjs <destino> [--pm <gestor>] [--example]` | Copia el proyecto sin pisar `src/data/` ni `src/i18n/` | 1 |
| `verify-design.mjs <tokens.json> <copy.json>` | Requisitos de diseño sobre valores y texto | 1b |
| `verify-landing.mjs <carpeta>` | Puerta completa sobre el proyecto y su `dist/` | 1b |
| `capture.mjs <url> <salida> [--measure] [--gray]` | Capturas con Chrome y medidas sobre la página dibujada | 1b |
| `configure-landing.mjs <carpeta> --connections <json>` | Escribe `config.json` y `vercel.json` según la región | 2 |

### Las cuatro preguntas de diseño

Van en una sola llamada de preguntas con opciones. Todas admiten "decida usted"; la respuesta se deriva entonces del brief y se anota como derivada.

1. **Marca y referencias.** ¿Tiene marca (nombre, logo, colores, un design system de Claude Design) o un sitio cuyo aspecto le guste? Si trae colores propios, las tres direcciones los respetan y difieren en lo demás.
2. **Lo memorable.** ¿Qué es lo único que alguien debe recordar después de ver la página?
3. **Personalidad.** Hasta tres: serio y confiable, cercano y cálido, técnico y preciso, atrevido y enérgico, calmado y mínimo, artesanal y humano.
4. **Tono y prohibidos.** ¿Claro, oscuro o decide el plugin? ¿Algo a lo que no quiera parecerse?

### Mirada al mercado

Solo corre si el builder no trajo paleta. Es opcional y lo primero que se recorta.

- **De dónde salen los competidores:** del "arreglo actual" del brief. Máximo tres.
- **Qué mira:** color dominante, tono claro u oscuro y carácter tipográfico de cada uno. Con Chrome, sobre una captura de su página; sin Chrome, desde el conocimiento general del modelo, marcado como no verificado.
- **Qué produce:** `.sbr/design/market.md`, una nota de pocas líneas con el código de color de la categoría.
- **Cómo se usa:** una de las tres direcciones sigue ese código y otra se aparta a propósito. El builder elige informado; la skill no decide por él.

### Requisitos de la landing

**Cómo:** S script, C Chrome sobre la página dibujada (sin Chrome lo revisa el builder con una lista), R revisor sin contexto. **Cuándo:** *diseño* es antes de dibujar, sobre valores y texto; *página* es después de programar; *plantilla* es propiedad del esqueleto, probada en los pasos 1 y 1c y repetida al publicar. **Origen:** RU Refactoring UI, WG Web Design Guidelines, HIG la skill de Apple, TS Taste Skill, GS gstack.

| # | Requisito | Umbral | Cómo y cuándo | Origen |
|---|---|---|---|---|
| R1 | Una sola acción | Un `h1`; un único botón relleno por pantalla (en la 1 se repite el mismo al cierre); acciones secundarias solo texto; sin menú ni enlaces de salida | S · plantilla | GS, RU |
| R2 | Texto corto | Titular ≤ 70 caracteres; subtítulo ≤ 160; botón ≤ 24; de 1 a 3 dolores y 3 pasos de ≤ 90 | S · diseño | GS |
| R3 | Primera vista completa | A 375×667 y 1440×900 se ven titular, subtítulo y el botón entero | C · página | GS, HIG |
| R4 | Escala con razón | Tamaños en razón 1,25 o 1,333 (±4%); titular ≥ 2 veces el cuerpo en escritorio y ≥ 1,75 en teléfono | S · diseño | GS |
| R5 | Énfasis por tres vías | Solo el titular combina el mayor tamaño, el mayor peso y el color más fuerte; máximo tres niveles de texto por pantalla; las etiquetas son más pequeñas y suaves que lo que etiquetan | S · diseño | RU |
| R6 | Funciona en grises | La jerarquía se sostiene en una captura sin color | R · página | RU |
| R7 | Prueba de 5 segundos | Viendo solo la primera vista se dice para quién es y qué promete; el ojo va a titular, botón y subtítulo, en ese orden | R · página | GS |
| R8 | Tamaños legibles | Cuerpo ≥ 16 px; texto pequeño ≥ 14 px; texto de campos ≥ 16 px | S · diseño | GS, TS |
| R9 | Interlineado | 1,45 a 1,65 en cuerpo; 1,05 a 1,25 en titulares | S · diseño | GS |
| R10 | Lectura cómoda | `prose` entre 45ch y 75ch; párrafos a la izquierda, nunca justificados; titulares equilibrados | S · diseño y plantilla | GS, HIG, WG |
| R11 | Tipografía contenida | ≤ 2 familias y ≤ 4 pesos, servidas desde el propio dominio | S · diseño | GS |
| R12 | Contraste de valores | `ink` ≥ 7:1 sobre `canvas` y `surface`; ≥ 4,5:1 para `ink-muted`, `on-accent` sobre `accent` y `danger`; ≥ 3:1 para `line`, `focus` y `accent`; la tinta nunca es negro puro | S · diseño | TS, GS |
| R13 | Contraste real | Todo texto visible ≥ 4,5:1 sobre su fondo real; ≥ 3:1 desde 24 px | C · página | GS |
| R14 | Solo tokens | El proyecto no usa valores sueltos entre corchetes ni la paleta por defecto de Tailwind; no hay CSS escrito por builder | S · plantilla | GS |
| R15 | Sin clichés | Sin degradados en texto ni botón; sin brillos ni emojis; acento fuera del violeta salvo que el builder lo pida; sin frases de la lista prohibida | S · diseño | GS, TS |
| R16 | Nunca solo color | Errores y estados llevan texto además del color | S · plantilla | HIG |
| R17 | Espacio con jerarquía | Cuatro niveles, múltiplos de 4, y siempre más espacio entre grupos que dentro de ellos; sin bloqueo de zoom | S · diseño y plantilla | RU, GS |
| R18 | Tamaño táctil | Objetivos ≥ 44×44 px y separados ≥ 8 px | C · página | HIG, GS |
| R19 | Sin desbordes | Sin desplazamiento horizontal ni texto cortado a 375, 768, 1024 y 1440 px, en las cuatro pantallas | C · página | GS |
| R20 | Campos bien hechos | Etiqueta visible; `type`, `autocomplete` e `inputmode` correctos; sin corrector en el correo; formulario de 300 a 500 px de ancho; `lang` definido | S · plantilla | WG, RU |
| R21 | Errores útiles | Junto al campo, anunciados, y el foco va al primer error | S y C · plantilla | WG |
| R22 | Teclado y estados | Todo el recorrido con teclado; foco ≥ 2 px; al cambiar de pantalla el foco va al título; hover, activo y foco más notorios que el reposo | C · página | WG |
| R23 | Movimiento contenido | Regla de movimiento reducido; solo `opacity` y `transform`; ≤ 400 ms; nunca infinito | S · plantilla | GS, WG |
| R24 | Envío honesto | El botón sigue activo hasta que arranca el envío, muestra que está enviando, y si la petición falla hay error y no se avanza | S y C · plantilla | WG |
| R25 | Aviso visible | El aviso de "aún no existe" cabe en la primera vista de la pantalla final a 375×667, a tamaño de cuerpo y con 4,5:1 | S y C · página | Diseño |
| R26 | Privacidad | Línea de privacidad no vacía junto al correo, ≥ 14 px | S · diseño | Diseño |
| R27 | Sin precios ni inventos | Sin símbolos de moneda, montos ni palabras de precio; sin cifras ni testimonios inventados | S y R · diseño | Diseño |
| R28 | Esqueleto intacto | Todo el proyecto, salvo `src/data/`, `src/i18n/`, `vercel.json` y el archivo de bloqueo, es idéntico a la plantilla | S · página | |
| R29 | Sin terceros y liviana | La página compilada no pide nada a otros dominios; HTML, CSS y JavaScript propios ≤ 100 KB | S · página | |
| R30 | Cabecera completa | Título ≤ 60; descripción de 70 a 160; etiquetas `og:`; `theme-color` igual al fondo | S · diseño y página | WG |
| R31 | Hecha para esta idea | El titular no serviría para otro producto; cada decisión de `system.md` cita una línea del brief | R · diseño | GS |
| R32 | Texto fuera del código | Todo texto visible sale del archivo de idioma; ningún componente ni script lleva frases escritas | S · plantilla | |

### Criterios de aceptación de los bocetos

- **B1. Distintos.** Tres composiciones diferentes, ninguna pareja tipográfica repetida, y acentos separados al menos 40° de tono o con distinto `scheme`. Si el builder trajo colores de marca, la paleta queda exenta. Si hubo mirada al mercado, una dirección sigue el código de la categoría y otra se aparta.
- **B2. Cada uno cumple.** Pasa todos los requisitos de diseño antes de dibujarse.
- **B3. Comparables.** Mismo texto real en los tres; portada en teléfono y en escritorio, lado a lado; ninguno marcado como recomendado.
- **B4. Nativos.** Son artboards editables de Claude Design, no imágenes.
- **B5. Iterables.** Rondas sin límite sobre la dirección elegida; cada cambio pasa por el verificador y se repinta.
- **B6. Diseño final.** La dirección elegida se dibuja con las cuatro pantallas y el builder la aprueba por escrito. Sin esa aprobación `landing` no corre.
- **B7. Lo aprobado es lo que se programa.** `landing` relee el lienzo y se detiene si cambió después de la aprobación.

### Pasos de construcción

Reglas de todos los pasos:
- Cada uno corre en su propia subsesión y, salvo el 0b, en su propio worktree; termina en un PR.
- La descripción del PR trae los comandos exactos de una **prueba de 10 minutos** para usted.
- Para probar una skill antes de fusionar se abre Claude Code con `claude --plugin-dir <worktree>`.
- Si un contrato no alcanza, el paso se detiene y lo reporta. No lo cambia en su rama.

| Paso | Es dueño de |
|---|---|
| 0b (en `main`) | `docs/contracts/*`, `CLAUDE.md`, README, `templates/contract.json`, `templates/neutral-design/*`, `templates/example/*`, `locales/es.json`, renombre de las skills |
| 0c | `templates/canvas/*`, `scripts/fill-artboards.mjs`, `docs/design/compositions.md` |
| 1 | `templates/landing/**`, `scripts/copy-template.mjs` |
| 1b | `scripts/verify-design.mjs`, `verify-landing.mjs`, `capture.mjs`, `scripts/tests/*`, `guides/*`, `agents/design-reviewer.md`, `ATTRIBUTIONS.md` |
| 1c | Estilos y componentes de composición dentro de `templates/landing/`, `templates/landing-tests/*` |
| 2 | `site/**`, `scripts/configure-landing.mjs`; puede corregir `events.ts` |
| 4a | `skills/design/*` |
| 4b | `skills/landing/*` |
| 4c | `site/**`, y correcciones en cualquier carpeta por ser la única sesión de diseño abierta |

#### Paso 0b · Contratos, convenciones y renombres

**Objetivo:** dejar en `main` los nombres en inglés y todo lo que los pasos siguientes necesitan para trabajar en paralelo.

**Procedimiento**
1. Renombrar las carpetas de las skills y `docs/contratos/` según la tabla de nombres.
2. `CLAUDE.md`: la regla de idioma, la tecnología, la tabla de dueños y la regla de que los contratos solo se editan en `main`.
3. `docs/contracts/`: `landing.md` (anatomía, archivos, ganchos, claves de idioma y de configuración, parámetros, scripts), `tokens.md`, `state.md` y `events.md` con los nombres nuevos.
4. `templates/contract.json`: ganchos, claves y variables en un archivo que los scripts leen.
5. `templates/neutral-design/tokens.json`: una dirección neutra y en grises, escrita a mano. Es el diseño por defecto y el caso que el verificador debe aprobar.
6. `templates/example/`: `es.json` con el texto de la página propia y `brief.md` de Ship Before Ready, sacados del documento de diseño.
7. `locales/es.json` con las frases fijas del plugin que ya se conocen.
8. `claude plugin validate`, commit y push.

**Aceptación:** la validación pasa y aparecen siete skills con sus nombres en inglés. No requiere prueba suya: yo comparo los contratos contra este plan antes de lanzar lo demás.

**Dependencias:** ninguna. Subsesión nueva, directo en `main`. Cerca de una hora.

**Riesgo:** quedarse corto. Un nombre que falte se convierte en dos sesiones inventando nombres distintos.

#### Paso 0c · Composiciones bocetadas en Claude Design

**Objetivo:** decidir cómo se ve la plantilla donde cambiar es barato, y dejar las plantillas de artboard que usará la skill.

**Procedimiento**
1. Crear un lienzo en Claude Design con las tres composiciones en grises y con el texto de ejemplo: por cada una, la pantalla 1 en teléfono y en escritorio; más las pantallas de correo, preguntas y final en teléfono.
2. Usted revisa el lienzo y pide cambios en esa misma subsesión, las rondas que hagan falta.
3. Con su aprobación: guardar los artboards en el repo como plantillas con un hueco por cada token y cada texto, y escribir `fill-artboards.mjs`.
4. `docs/design/compositions.md`: el link del lienzo y lo aprobado por tamaño de pantalla. Es la especificación del paso 1c.
5. Prueba: llenar las plantillas con el diseño neutro y con un segundo juego de valores opuesto, y publicarlas en un lienzo de prueba.

**Aceptación (lo decide usted)**
1. Aprueba las tres composiciones en el lienzo.
2. El lienzo de prueba armado por el script se ve igual a lo que aprobó.
3. Con el juego de valores opuesto, los mismos artboards se ven como otro producto.

**Dependencias:** arranca en paralelo con 0b; su PR entra después. Bloquea a 1c y a 4a.

**Riesgos**
- El formato de los artboards se conoce al crear el lienzo y falla en silencio si se escribe mal.
- Si Claude Design cambia el formato, las plantillas hay que revisarlas. La skill conserva una salida: redibujar siguiendo las instrucciones del propio tipo.
- No usa su "JRG Design System": la plantilla es neutra a propósito.

#### Paso 1 · Plantilla de la landing en Astro

**Objetivo:** el proyecto Astro completo y funcional con las cuatro pantallas, el texto en archivo de idioma y una composición provisional. Las tres composiciones definitivas llegan en el paso 1c.

**Procedimiento**
1. Proyecto mínimo con versiones exactas y archivo de bloqueo de bun: `astro`, `tailwindcss` y su plugin de Vite.
2. `src/styles/global.css`: Tailwind con la paleta y escalas por defecto apagadas y los tokens del contrato con los valores neutros.
3. `src/layouts/Base.astro`: cabecera desde el archivo de idioma, fuentes con la API de Astro leídas de `tokens.json`, variables de los tokens en `:root`, atributos de composición y esquema.
4. Un componente por bloque de la anatomía, con sus ganchos: `Brand`, `Hero`, `Pains`, `Steps`, `Closing`, `Footer`, `EmailScreen`, `QuestionsScreen`, `DoneScreen`, `DebugPanel`. Ninguno lleva texto escrito.
5. `src/scripts/flow.ts`: avanza entre pantallas llevando el foco al título, valida, enfoca el primer error y respeta `?screen=` cuando no hay `config.json`.
6. `src/scripts/events.ts`: `source` desde `?src=`, los cinco eventos, panel con `?debug=1`. Sin `config.json` no envía nada. Con `config.json` envía por `fetch` y espera la respuesta.
7. Composición `centered` provisional, suficiente para probar el recorrido.
8. `scripts/copy-template.mjs`: copia el proyecto sin `node_modules` y nunca pisa `src/data/` ni `src/i18n/`. Con `--example` agrega el diseño neutro y el texto de ejemplo.

**Aceptación (prueba de 10 minutos)**
1. En una copia de ejemplo, `bun install` y `bun run dev`; con `?src=v1&debug=1`, al recorrer las cuatro pantallas el panel muestra los cinco eventos en orden, con `source: v1`.
2. La pestaña de red no muestra ninguna petición a otro dominio.
3. Un correo inválido no avanza, muestra el error bajo el campo y lo enfoca.
4. Recorre todo solo con teclado.
5. Cambia una frase en `es.json` y la página cambia sin tocar código.
6. `bun run build` termina bien y el titular está escrito en `dist/index.html`.
7. En otra copia, instalación y compilación funcionan con npm. El PR reporta el resultado con pnpm y yarn.

**Dependencias:** 0b. En paralelo con 0c, 1b, 3, 5 y 7. Bloquea a 1c, 2 y 4b.

**Qué necesito de usted:** actualizar Node antes de que arranque, porque Astro 7 no corre en 22.23.1. `fnm` ya ofrece la 22.23.5.

**Riesgos**
- Comprobar en la documentación antes de escribir: Tailwind 4 con Astro 7, cómo apagar el tema por defecto, la API de fuentes con familias leídas de un archivo, y el formato de la API de captura de PostHog.
- Sin verificar todavía: que Astro 7 se instale y compile igual con los cuatro gestores, y que Vercel detecte bun por su archivo de bloqueo. Si un gestor falla, se retira de las opciones y se dice.

#### Paso 1b · Reglas del sistema de diseño y verificador

**Objetivo:** convertir los requisitos de este plan en guías que las skills leen y en scripts que los hacen cumplir.

**Procedimiento**
1. `verify-design.mjs`: los requisitos marcados "S · diseño" sobre `tokens.json` y el archivo de texto.
2. `verify-landing.mjs`: lo anterior más los de plantilla y página, leyendo el proyecto y su `dist/`. Imprime una fila por requisito.
3. `capture.mjs`: maneja Chrome sin ventana contra una URL y saca capturas de las cuatro pantallas a 375×667 y 1440×900; `--gray` las saca sin color. Con `--measure` comprueba los requisitos C. **Tope de dos horas**; si no sale, quedan solo las capturas.
4. `guides/landing-requirements.md`: la tabla R1 a R32 con su origen.
5. `guides/design-system.md`: cómo derivar tres direcciones del brief y las respuestas. Incluye el mundo del tema, los ejes, diseñar primero en grises, cómo elegir pareja tipográfica, la escala y las listas de clichés y frases prohibidas.
6. `guides/market-look.md`: el procedimiento corto de la mirada al mercado.
7. `agents/design-reviewer.md`: agente del plugin sin contexto. En diseño recibe valores, texto y `system.md` (R27, R31); en página recibe capturas (R6, R7).
8. Pruebas con `node --test`: el diseño neutro pasa; cinco defectos sembrados dan cinco fallas con su número.
9. `ATTRIBUTIONS.md`.

**Aceptación (prueba de 10 minutos)**
1. `node --test scripts/tests/` pasa.
2. Baja el contraste de un token en una copia y el verificador falla nombrando R12.
3. Alarga el titular a 90 caracteres y falla nombrando R2.
4. `capture.mjs` deja ocho capturas de una página de ejemplo, o dice que no hay Chrome.

**Dependencias:** 0b. Se desarrolla en paralelo con 1 y se fusiona después, porque su prueba de integración usa la plantilla real. Bloquea a 4a y 4b.

**Riesgos**
- Que `capture.mjs` se coma el día. Por eso el tope.
- El verificador lee texto: cada regla debe ser simple y sin falsos positivos, o pasa al revisor.
- Si el diseño neutro no cumple un requisito, se corrige en `main`, no en esta rama.

#### Paso 1c · Las tres composiciones en código

**Objetivo:** programar en Astro las composiciones que usted aprobó en el lienzo, y probar que cualquier diseño válido cabe en ellas.

**Procedimiento**
1. Implementar `centered`, `split` y `editorial`, y las opciones de `decor`, siguiendo `docs/design/compositions.md` y el lienzo aprobado.
2. Probar cada una a 375, 768, 1024 y 1440 px.
3. **Prueba de límites:** con el texto más largo permitido y los valores más grandes permitidos, la primera vista sigue completa y nada se desborda a 375 px.
4. **Prueba de elasticidad:** tres juegos de valores opuestos se ven como tres productos distintos.
5. Capturas de la página junto a los artboards aprobados, en el PR.

**Aceptación (prueba de 10 minutos)**
1. Abre las tres páginas de ejemplo y cada una corresponde a su boceto aprobado.
2. El caso de límites no se desborda en teléfono.
3. Los tres juegos de valores opuestos no se confunden entre sí.

**Dependencias:** 0c aprobado y 1 fusionado. En paralelo con 2 y 4a. Bloquea a 4b.

**Riesgo:** que el lienzo y la página se separen en detalles de espacio. Las capturas lado a lado del punto 5 existen para verlo.

#### Paso 2 · Página propia en línea, versión 0

**Objetivo:** la URL pública recibiendo eventos reales con el diseño neutro. Prueba PostHog, el reenvío y Vercel antes de que exista el flujo de diseño.

**Procedimiento**
1. `scripts/configure-landing.mjs`: escribe `config.json` y un `vercel.json` con los reenvíos hacia el PostHog de la región del builder, según la documentación actual.
2. `site/.sbr/connections.json` con sus datos y `site/.sbr/brief.md` copiado del ejemplo.
3. `copy-template.mjs site/landing --pm bun --example`, instalación con bun, `configure-landing.mjs` y una compilación local.
4. Enlazar el proyecto de Vercel por nombre explícito y publicar con `--cwd site/landing`. Vercel compila en su nube.
5. Visita de prueba con `?src=test`, con y sin bloqueador.

**Aceptación (prueba de 10 minutos)**
1. La URL abre en su teléfono.
2. La visita con `?src=test` deja los cinco eventos en PostHog con sus propiedades.
3. Con uBlock o Brave activo también llegan.
4. `<URL>/.sbr/connections.json` no existe.

**Dependencias:** 1. En paralelo con 1c y 4a. Bloquea a 4b.

**Qué necesito de usted:** `vercel login`, y la llave pública (`phc_...`) y la región de su proyecto de PostHog.

**Riesgos:** nombre de la ruta de reenvío y orden de las reglas; opciones actuales de `vercel link` y `--cwd`; si la API directa falla, cambiar al fragmento oficial de PostHog para Astro.

#### Paso 4a · Skill `design`

**Objetivo:** de un brief aprobado a un diseño final aprobado por el builder en Claude Design, sin instalar ni programar nada.

**Procedimiento**
1. `SKILL.md` con las diez fases del flujo y un punto de espera en cada decisión del builder. Instrucciones en inglés; le habla al builder en el idioma del brief.
2. `questions.md`: las cuatro preguntas con sus opciones y la regla de "decida usted".
3. Mirada al mercado según `guides/market-look.md`, solo sin paleta, con salida en `market.md`.
4. Fase de texto: escribe `.sbr/design/copy.<locale>.json` desde el brief respetando R2 y R27, y lo muestra para aprobación.
5. Fase de conceptos: tres direcciones en texto. El hilo principal fija los ejes de cada una (composición, esquema, zona de tono, tipo de pareja, y si sigue o rompe el código de la categoría) para garantizar B1.
6. Fase de valores: un agente por dirección escribe su `tokens.json` en `.sbr/sketches/<letra>/`; `verify-design.mjs` se repite hasta que cada una pase.
7. Fase de lienzo: crea el lienzo de tipo Design, llena las plantillas con `fill-artboards.mjs` y publica seis artboards, portada en teléfono y en escritorio por dirección.
8. Fase de elección e iteración: dibuja la dirección elegida con las cuatro pantallas. Cada cambio pedido ajusta valores o texto, pasa por el verificador y se repinta. Sin límite de rondas. Lo que pida cambiar la anatomía se rechaza diciendo por qué.
9. Aprobación final: escribe `tokens.json`, `copy.<locale>.json`, `system.md` y `choice.md` con el link del lienzo y la huella de lo aprobado.
10. Respaldo sin Claude Design: lo dice en una línea, instala la plantilla y muestra las direcciones una por una sobre la página real.
11. Si se vuelve a correr con un diseño ya aprobado, pregunta si conserva o rehace.

**Aceptación (prueba de 10 minutos, en una carpeta con el brief de ejemplo)**
1. Hace las cuatro preguntas en una pantalla y acepta "decida usted".
2. Muestra el texto y luego tres conceptos con nombre, esperando su visto bueno en cada uno.
3. Entrega el link de un lienzo con seis artboards editables, claramente distintos.
4. Pide dos cambios seguidos sobre la dirección elegida y el lienzo se repinta cada vez.
5. Tras aprobar existen `tokens.json`, el archivo de texto, `system.md` y `choice.md`; la carpeta no tiene `landing/` ni `node_modules`.
6. Con un segundo brief sin relación, las seis direcciones resultantes no repiten paleta.

**Dependencias:** 0c y 1b. En paralelo con 1c, 2 y 4b.

**Riesgos**
- Parecido entre direcciones: por eso los ejes se fijan antes y cada dirección la escribe un agente aparte.
- No hay señal documentada de que Claude Design esté disponible: la skill lo deduce de si tiene la herramienta. Requiere plan de pago y sesión de claude.ai.
- Si el builder edita el lienzo a mano, esos cambios no vuelven solos a los valores. La skill lo detecta al releer y pregunta.

#### Paso 4b · Skill `landing`

**Objetivo:** del diseño final aprobado a una landing publicada que pasó la puerta.

**Procedimiento**
1. `SKILL.md`: precondiciones (`choice.md` con `approved`, `connections.json`); si falta algo, nombra la skill que lo produce.
2. Relee el lienzo y compara con la huella aprobada. Si cambió, se detiene y pregunta.
3. `copy-template.mjs landing --pm <gestor>`, instala, y copia `tokens.json` y el archivo de texto a su lugar.
4. Puerta: compila, corre `verify-landing.mjs` y, si hay Chrome, `capture.mjs --measure`. Luego el revisor sobre las capturas.
5. Si falla un requisito de página, dice cuál, propone el cambio mínimo de valores y lo manda de vuelta a `design`. Aquí no se cambia un diseño aprobado.
6. Vista previa local junto al lienzo y visto bueno del builder. Sin Chrome, le da la lista de lo que debe mirar a mano.
7. `configure-landing.mjs`, enlace del proyecto por nombre y publicación con `--cwd landing`.
8. Visita de prueba con `?src=test` y comprobación de los cinco eventos.
9. `.sbr/landing.json` con URL, fecha, huella del diseño y resultado.

**Aceptación (prueba de 10 minutos)**
1. Con el diseño neutro como diseño aprobado, una sola corrida llega a una URL pública.
2. La página publicada corresponde al lienzo y registra los cinco eventos.
3. Si rompe a propósito el contraste, la skill se niega a publicar, nombra R12 y lo manda a `design`.

**Dependencias:** 1, 1b, 1c y 2. No espera a 4a: se prueba con el diseño neutro.

**Riesgo:** cómo comprueba la skill los eventos depende de la decisión pendiente del paso 6 (llave personal o MCP de PostHog). Hasta entonces lo confirma el builder mirando PostHog.

#### Paso 4c · Página propia con el flujo completo

**Objetivo:** que Ship Before Ready use sus propias skills en `site/`, con usted como builder, y dejar la versión 1 en línea en la misma URL.

**Procedimiento**
1. Una sesión abierta dentro de `site/` con el plugin del repo.
2. Usted corre `design`: responde, aprueba el texto, ve las tres direcciones, elige e itera en Claude Design.
3. Usted corre `landing`: se publica sobre el mismo proyecto de Vercel.
4. Se graba la pantalla: es el material del video de demo.
5. Lo que tropiece se corrige en el mismo PR.

**Aceptación:** la URL pública corresponde al diseño que usted aprobó, pasan R1 a R32 y la visita de prueba registra los cinco eventos.

**Dependencias:** 4a y 4b. Es la prueba de extremo a extremo de toda la parte web.

### Orden, ruta crítica y calendario

`0b → (0c ∥ 1 ∥ 1b) → (1c ∥ 2 ∥ 4a) → 4b → 4c`

Hay dos rutas que no admiten atraso: `0b → 1 → 1c → 4b → 4c` y `0c → 4a → 4c`. La segunda depende de que usted apruebe las composiciones pronto. Con las otras skills son unos catorce PR para un solo revisor; por eso cada uno trae su prueba de 10 minutos.

| Cuándo | Qué corre | Qué hace usted |
|---|---|---|
| Viernes noche | 0b; luego 0c, 1 y 1b en paralelo | Aprueba este plan y actualiza Node; si puede, da la primera mirada al lienzo de composiciones |
| Sábado temprano | 1c, 2 y 4a | Aprueba las composiciones; prueba y fusiona 1 y 1b; `vercel login` y llave de PostHog |
| Sábado tarde | 4b | Prueba y fusiona 0c, 1c y 2 |
| Sábado noche | 4c | Prueba y fusiona 4a y 4b; diseña su propia página |
| Domingo | Veredicto con datos reales, empaque, video y entrega | |

**Aviso honesto:** con Claude Design nativo, idioma separado, mirada al mercado y los renombres, el alcance creció respecto de la versión anterior de este plan. Cabe en el fin de semana solo si las revisiones no se acumulan. La lista de recortes es la red.

### Qué se recorta primero

Si el sábado a las 18:00 vamos atrasados, en este orden:
1. Publicar el sistema elegido como "Design System" en Claude Design.
2. La mirada al mercado: primero baja a solo conocimiento general; luego sale.
3. El revisor sin contexto en `landing`.
4. Las medidas de `capture.mjs`. Los requisitos C pasan a una lista de cinco minutos que revisa el builder a 375 px.
5. Detectar ediciones a mano del lienzo.
6. Las opciones de `decor`: queda solo `none`.
7. Los artboards de escritorio de las tres direcciones: queda solo teléfono.
8. El paso 4c: se mantiene la versión 0 en línea y el rediseño se graba para la demo.

No se recorta: las preguntas de diseño, las tres direcciones con tres composiciones en Claude Design, la anatomía, la puerta de valores y contraste, programar solo con diseño final, el archivo de idioma y el código en inglés.

### Hechos verificados en documentación

- Astro 7 es la versión actual; exige Node 22.23.4 o superior. Un sitio estático se publica en Vercel sin configuración ni adaptador.
- Un `<script>` en un componente de Astro se empaqueta y admite TypeScript; es la forma documentada de añadir interacción sin un framework.
- La API de fuentes de Astro es estable desde la versión 6 y copia las fuentes a la salida del sitio.
- PostHog tiene guía oficial para Astro y documenta su API de captura (`POST /i/v0/e/` con `api_key`, `event` y `distinct_id`). Algunos eventos inválidos igual responden 200, así que esperar la respuesta detecta fallas de red, no confirma el guardado.
- El reenvío de PostHog en Vercel son tres reglas en orden, con host distinto para US y EU, y una ruta que no sea obvia.
- Claude Design desde Claude Code es la herramienta `Artifact` con el tipo Design: un lienzo con artboards lado a lado. Cada artboard admite huecos que se llenan con valores, e imágenes subidas. Elegir es conversacional. Requiere plan de pago y sesión de claude.ai; una organización o el usuario pueden apagarla.
- En el cuerpo de una skill de plugin se sustituye `${CLAUDE_PLUGIN_ROOT}`. Un plugin puede traer agentes en `agents/`, que arrancan sin contexto. Las preguntas con opciones solo funcionan en el hilo principal.
- Taste Skill registra un hook de sesión con su propio gate; las otras tres skills son solo texto de guía. Las cuatro son MIT.
- En esta máquina: Node 22.23.1, Chrome, y bun 1.3.14, pnpm 11.17.0, yarn 1.22.22 y npm 10.9.8. Vercel CLI sin sesión.

### Atribuciones

Las reglas se reescriben y se listan en `ATTRIBUTIONS.md` con su licencia: gstack (MIT, Garry Tan) y los proyectos que cita (Elaya, MIT; impeccable, Apache-2.0); las skills `refactoring-ui` e `ios-hig-design` de wondelai (MIT); Web Interface Guidelines de Vercel (MIT); Taste Skill (MIT). No se usa ninguna herramienta ni binario de esos proyectos.

### Verificación de extremo a extremo

1. `claude plugin validate` y `node --test scripts/tests/` pasan.
2. En una carpeta vacía con el brief de ejemplo: `design` produce tres direcciones distintas en un lienzo y un diseño final aprobado, sin instalar nada; `landing` programa, publica y registra los cinco eventos.
3. El paso 4c repite lo mismo con la página propia y deja la URL pública en su versión 1.

---

## Pasos fuera de la parte web

### Paso 3 · Skills `connect`, `interview` y `rules` (aprobado)

**Objetivo:** dejar al builder con sus cuentas verificadas, un brief aprobado por un revisor sin contexto y sus reglas selladas. Es lo que `design` necesita para arrancar.

**Archivos (dueño):** `skills/connect/*`, `skills/interview/*`, `skills/rules/*`, `agents/brief-reviewer.md`, `templates/probe/*`, `.mcp.json`.

**`connect`**
1. Pregunta el gestor de paquetes (bun recomendado, pnpm, npm, yarn), comprueba que esté instalado y que Node sea 22.23.4 o superior.
2. Vercel: si falta la CLI, ofrece instalarla con el gestor elegido; comprueba la sesión con `vercel whoami` y, si falta, dice el comando y espera. Propone el nombre del proyecto.
3. PostHog, sin llaves: comprueba si hay sesión; si no, le dice al builder cómo iniciarla (`/mcp`, elegir PostHog, seguir el navegador) y espera. Con la sesión lista, lista sus proyectos, él elige uno, y la skill lee de ahí la región y la llave pública.
4. Prueba: publica una página mínima y comprueba que responde; envía un evento de prueba y lo busca con una consulta por la misma sesión.
5. Escribe `.sbr/connections.json`, sin secretos.

El plugin declara el servidor de PostHog (`https://mcp.posthog.com/mcp`) en su propio `.mcp.json`, así el builder no necesita instalar el plugin de PostHog. Si ya lo tiene, se usa esa sesión.

**`interview`**
1. Tres preguntas, una a la vez: quién exactamente tiene el problema, con una persona o un caso real; qué hace hoy para resolverlo y qué le cuesta; qué cambia para esa persona, en una frase que ella repetiría.
2. Insiste una vez cuando la respuesta es vaga, como "usuarios" o "empresas".
3. Escribe `.sbr/brief.md`: cabecera con claves en inglés, cuerpo en el idioma del builder y las tres preguntas para el visitante.
4. `brief-reviewer`, un agente sin contexto, lee solo el brief y debe poder decir quién es el usuario, qué le duele y qué hace hoy. Si no puede, devuelve qué falta y la skill vuelve a preguntar. A la tercera ronda se detiene y muestra lo que falta.
5. Solo con esa aprobación queda `reviewer: approved`.

**`rules`**
1. Muestra las varas del documento de diseño con su fuente y deja ajustarlas antes de sellar.
2. Pregunta la fecha de veredicto.
3. Escribe `.sbr/rules.md` y lo sella con un commit; guarda fecha y commit.
4. Si se vuelve a correr después de sellar, no cambia nada en silencio: cualquier cambio es un commit nuevo que `verdict` va a mostrar.

**Aceptación (prueba de 10 minutos, en una carpeta vacía)**
1. `connect` pregunta el gestor con bun recomendado; sin sesión de Vercel o de PostHog dice exactamente qué hacer; con todo listo, la página de prueba responde, el evento aparece y `connections.json` no tiene secretos.
2. `interview` hace las tres preguntas, insiste ante una respuesta vaga, y el revisor rechaza un brief vago y aprueba uno concreto.
3. `rules` muestra las varas, pide la fecha, deja `rules.md` en un commit, y al repetirla no cambia nada sin avisar.

**Dependencias:** 0b. En paralelo con 0c, 1 y 1b. Las tres skills van en un solo paso y un solo PR.

**Qué necesita del usuario:** `vercel login` y una cuenta de PostHog con un proyecto, con la sesión iniciada en Claude Code.

**Riesgos y por verificar**
- Qué herramientas del servidor de PostHog listan proyectos y devuelven llave pública y región. Se comprueba primero, con la sesión iniciada.
- Que no haya choque si el builder tiene a la vez este servidor y el del plugin oficial de PostHog.
- El formato con que un plugin declara un servidor en `.mcp.json`.
- Las vistas previas de Vercel pueden pedir autenticación, así que la página de prueba se publica en producción con un "pronto".
- El texto de las preguntas se adapta de gstack (MIT) con atribución.
- Las consultas las hace el modelo con una herramienta, no un script: es un poco menos predecible, a cambio de cero secretos.

