# Contrato de eventos (PostHog)

La landing emite estos eventos y `veredicto` los lee. Los nombres de eventos y propiedades no se cambian sin actualizar este contrato.

| Evento | Cuándo | Propiedades |
|---|---|---|
| `$pageview` | Carga de la página | `origen` |
| `sbr_clic_acceso` | Clic en el botón | `origen` |
| `sbr_registro` | Envía el correo | `origen`, `correo` |
| `sbr_respuestas` | Envía las tres preguntas | `origen`, `usa_hoy`, `ultima_vez`, `quiere_llamada`, `whatsapp`, `horario` |
| `sbr_fin` | Ve el aviso final | `origen` |

`origen` sale del parámetro `?o=` del link: `v1`, `v2`, `v3` (tráfico frío, uno por guion), `amigos`, o `sin_etiqueta` si falta.

Las visitas sin `?o=` se cuentan aparte como `sin_etiqueta`; no son tráfico frío.
