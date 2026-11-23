# Ship Before Ready

Plugin de Claude Code que valida una idea con una landing real y números reales antes de construir el producto. Lleva al builder del problema a un brief con fuentes, de ahí a un diseño aprobado, a una landing publicada que mide cada paso del visitante, a tres guiones de video para traer tráfico frío y, al final, a un veredicto calculado con varas que se sellaron antes de lanzar.

Todo corre en las cuentas del builder: su repo, su Claude, su Vercel y su PostHog. El plugin no pide ni guarda llaves.

## Instalar desde cero

Dentro de Claude Code:

```
/plugin marketplace add jrodolforojas/ship-before-ready
/plugin install ship-before-ready@ship-before-ready
```

Reinicie Claude Code y corra:

```
/ship-before-ready:start
```

`start` mira en qué fase va la idea y corre la que sigue, una a la vez. Lo que el plugin le dice al builder va en español (`es` por defecto).

### Requisitos

- **Node 22.23.4 o más nuevo**: lo pide Astro 7.
- **Un repo de git**: las reglas del veredicto se sellan con un commit.
- **Vercel CLI con sesión**: `vercel login`.
- **Una cuenta de PostHog** con sesión en el servidor MCP `posthog` que trae el plugin: `/mcp` en la terminal, o `claude mcp login <servidor>` en una terminal si usa la app de escritorio.
- **Una sesión de claude.ai** para el lienzo de Claude Design. Sin ella, `design` sigue con una vista local.
- **Chrome** para las capturas que revisan el crítico de diseño y la puerta de requisitos.

El gestor de paquetes lo elige el builder entre bun, pnpm, npm y yarn; bun es el recomendado.

## Qué va a encontrar

Siete fases, en este orden. Cada una escribe su resultado en `.sbr/` dentro del repo del builder.

| # | Comando | Qué produce |
|---|---|---|
| 1 | `/ship-before-ready:interview` | `problem.md`, `lean-canvas.md` y `brief.md`: el problema con fuentes citadas, el Lean Canvas y el brief que leen las demás fases. Una pregunta a la vez. |
| 2 | `/ship-before-ready:rules` | `rules.md` y `seal.json`: las varas del veredicto y su fecha, selladas con un commit antes de lanzar. |
| 3 | `/ship-before-ready:design` | `design/`: tres direcciones de la primera pantalla en un lienzo de Claude Design; el builder elige una y la itera hasta aprobarla. No instala nada. |
| 4 | `/ship-before-ready:connect` | `connections.json`: Node, Vercel y PostHog probados con una página y un evento de prueba reales. |
| 5 | `/ship-before-ready:landing` | `landing/` y `landing.json`: la landing en Astro, pasada por la puerta de requisitos, publicada en Vercel y con sus cinco eventos confirmados en PostHog. |
| 6 | `/ship-before-ready:video-scripts` | `video-scripts.md`: tres guiones, cada uno con una sola idea y su link rastreado. El builder los graba y publica. |
| 7 | `/ship-before-ready:verdict` | `verdict.md`: una de cuatro respuestas con cada tasa junto a su conteo. Informa; la decisión es del builder. |

Las cuentas llegan tarde a propósito: Vercel y PostHog se conectan solo cuando ya hay un diseño aprobado que publicar.

Un hook bloquea las ediciones de código de producto fuera de `.sbr/` y `landing/` hasta que el veredicto sea «Evidencia para seguir». Si el builder quiere escribir código antes, da su razón y queda registrada en `.sbr/bypass.log`.

## En qué se fundamenta

**El problema y la declaración del problema.** La entrevista empieza por el problema sin hablar de la solución: diez preguntas en cuatro componentes (disparador, frecuencia, relevancia y viabilidad). Cada afirmación se revisa contra una página abierta en esa corrida, con la frase exacta copiada. La declaración del problema solo se escribe si hay al menos una afirmación respaldada por una fuente de terceros, y nunca nombra la solución. El método es del autor del plugin: [skills/interview/SKILL.md](skills/interview/SKILL.md) y [skills/interview/sources.md](skills/interview/sources.md).

**Lean Canvas.** El segundo paso es el [Lean Canvas](https://leanstack.com/lean-canvas) de Ash Maurya, una adaptación del Business Model Canvas. Cada dolor del builder se revisa contra fuentes; un dolor sin fuente no entra al brief. Las preguntas de seguimiento del canvas y el método del asesor están adaptados de la skill `/office-hours` de [gstack](https://github.com/garrytan/gstack) (MIT, Garry Tan).

**Claude Design.** Se usa en la fase de diseño: las tres direcciones se dibujan en un lienzo de Claude Design y el builder itera ahí sin límite de rondas. Si no hay Claude Design (sin plan de pago o sin sesión de claude.ai), `design` sigue con una vista local.

**Las varas del veredicto.** Valores por defecto de `rules`; el builder puede ajustarlos antes de sellar.

| Vara | Por defecto | Fuente |
|---|---|---|
| Muestra mínima | 200 visitantes fríos | Kromatic; cálculo propio |
| Filtro de registro | 5% | Kromatic; Unbounce |
| Inicio de la zona gris | 3,8% | Unbounce, reporte 2024: mediana de SaaS de 3,8% |
| Sin evidencia | 300 visitantes fríos sin un lead calificado | Cálculo propio: con 300 visitantes y cero leads hay 95% de confianza de que menos del 1% se convertiría |
| Evidencia para seguir | 3 llamadas agendadas con desconocidos | The Mom Test, vía reseñas; el número es una propuesta |
| Tráfico frío | `v1`, `v2`, `v3` | Solo el tráfico frío decide; amigos y comunidad se cuentan aparte |

Las cuatro respuestas posibles son «Muestra insuficiente», «Iterar la promesa», «Sin evidencia en este ángulo» y «Evidencia para seguir». Si las varas cambiaron después del sello, el veredicto lo avisa primero.

## Reglas contra el AI slop

- **La puerta de requisitos.** 32 reglas, de R1 a R32, en [guides/landing-requirements.md](guides/landing-requirements.md). Las revisan tres scripts (`verify-design.mjs`, `verify-landing.mjs`, `capture.mjs`) y un revisor sin contexto. Nada se dibuja, se muestra ni se publica con un `fail`. Las que más pesan contra el slop:
  - R1: una sola acción por página.
  - R2: texto corto, con límite por clave.
  - R7: un desconocido dice en cinco segundos para quién es y qué promete.
  - R15: sin clichés: nada de violeta por defecto, glow, gradientes, emoji, frases de la lista prohibida ni botones genéricos.
  - R27: sin precios y sin cifras, testimonios o garantías que el brief no dé.
  - R29: sin terceros y a lo sumo 100 KB propios.
  - R31: el titular no le serviría a otro producto.
- **La tipografía se reparte, no se elige.** Cada dirección recibe su sistema tipográfico de una biblioteca derivada de la de [Taste Skill](https://github.com/Leonxlnx/taste-skill) (MIT, Leonxlnx). Nunca de memoria.
- **Un crítico sin contexto antes de mostrar.** `design-critic` mira solo las capturas de cada dirección en teléfono y escritorio, con su estructura, y la juzga como un diseñador de interfaces con experiencia. Una dirección rechazada vuelve a dibujarse, hasta dos rondas.
- **Nada de texto genérico.** El texto sale solo del brief y de las palabras del builder: sin ejemplos de ideas, sin respuestas sugeridas, sin cifras inventadas. Cada dirección responde a lo que dijo el builder, no a una imagen literal del tema, y ninguna se presenta como la recomendada.

Las fuentes de cada regla están en [ATTRIBUTIONS.md](ATTRIBUTIONS.md).

## Revisores y asesores

Cada fase que produce algo pasa por un revisor sin contexto: un agente que solo ve el archivo, no la conversación. Lo que aprueba lo escribe un script, nunca la skill.

| Agente | Fase | Qué revisa |
|---|---|---|
| Asesor de la entrevista | `interview` | Cuando el builder dice «no sé», propone opciones con su fuente, marcadas como del asesor. El builder elige. Nunca propone segmento, costos ni ingresos. ([advisor.md](skills/interview/advisor.md)) |
| [`brief-reviewer`](agents/brief-reviewer.md) | `interview` | Que un desconocido entienda quién es el usuario, qué le duele, qué hace hoy y qué se le promete, y que todo tenga fuente. |
| [`design-critic`](agents/design-critic.md) | `design` | Cada dirección, desde sus capturas, antes de que el builder la vea. |
| [`design-reviewer`](agents/design-reviewer.md) | `design` y `landing` | R27 y R31 sobre el texto y los valores; R6 y R7 sobre las capturas de la página. |
| [`script-reviewer`](agents/script-reviewer.md) | `video-scripts` | Una sola idea por guion, el orden de las partes y que el producto no aparezca antes del cierre. |
| [`verdict-reviewer`](agents/verdict-reviewer.md) | `verdict` | Solo los números y las varas: si sostienen la respuesta dada. |

`rules` y `connect` no tienen agente: las varas quedan selladas en un commit, y las conexiones se prueban con una publicación y un evento reales.

## Landing y analíticas

- **Astro 7, estático**, con Tailwind limitado a los tokens del diseño: un color fuera del sistema no compila. Sin React ni librerías de formularios.
- **Liviana y sin terceros.** Las fuentes se descargan al construir, los eventos van a PostHog por una ruta del propio dominio de la landing y la página pesa a lo sumo 100 KB propios.
- **Publicada en Vercel** con `--cwd landing`, nunca desde la raíz, para no publicar `.sbr/`.
- **Cinco eventos de PostHog** que muestran en qué paso se cae el visitante:

  | Evento | Cuándo |
  |---|---|
  | `$pageview` | Carga la página |
  | `sbr_cta_click` | Clic en el botón principal |
  | `sbr_signup` | Deja su correo |
  | `sbr_answers` | Responde las preguntas |
  | `sbr_done` | Ve la pantalla final |

- **Cada visita lleva su origen** con `?src=`: `v1`, `v2`, `v3` y `bio` son tráfico frío; `friends` se cuenta aparte; las visitas con `?src=test` nunca cuentan para el veredicto.

El contrato completo está en [docs/contracts/events.md](docs/contracts/events.md).

## Guiones de video

La estructura de los guiones viene de la metodología que el autor aprendió personalmente de [Guillermo «Guille» Collado](https://www.instagram.com/guille.colladomk/), que trabaja en TikTok. Es una enseñanza directa, no una fuente pública.

- **Una idea por video.** Cada guion tiene una frase que dice de qué trata y una lista corta de lo único que dirá. Si la idea necesita dos frases, son dos videos.
- **Cuatro partes, en orden:** reveal, build up, value y call to action.
- **Tres videos:** el dolor, tres errores comunes y el builder contando por qué le importa.
- **El producto se nombra solo en el cierre**, y como acceso anticipado a algo que todavía no existe.

Cada guion lleva su link rastreado (`?src=v1`, `v2`, `v3`) para que el veredicto sepa qué video trajo a quién.

## Licencia y créditos

[MIT](LICENSE). Las reglas de diseño, la biblioteca tipográfica y el método del asesor se apoyan en trabajo de otras personas publicado con licencias abiertas; [ATTRIBUTIONS.md](ATTRIBUTIONS.md) dice de quién es cada cosa.
