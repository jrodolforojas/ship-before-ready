# Contrato de estado (repo del builder)

Las skills y el gate se comunican solo por estos archivos, que viven en el repo del builder. Los nombres de archivo y sus claves no se cambian sin actualizar este contrato.

| Archivo | Lo escribe | Lo leen | Contenido |
|---|---|---|---|
| `.sbr/conexiones.json` | `conectar` | `landing`, `veredicto` | Host, id de proyecto y llave pública de PostHog; proyecto de Vercel. Sin secretos. |
| `.sbr/brief.md` | `interrogar` | `reglas`, `landing`, `guiones` | Persona, dolor, arreglo actual, promesa, tres preguntas; `revisor: aprobado`. |
| `.sbr/reglas.md` | `reglas` | `veredicto`, gate | Varas, fecha de veredicto y `sellado: <fecha>`; el sello es un commit. |
| `landing/` y `.sbr/landing.json` | `landing` | `guiones`, `veredicto` | La página y su URL publicada. |
| `.sbr/guiones.md` | `guiones` | `veredicto` | Tres guiones con su link. |
| `.sbr/veredicto.md` | `veredicto` | gate | `resultado: <respuesta>` y los números con conteo crudo. |
| `.sbr/saltos.log` | gate | `veredicto` | Fecha, archivo y razón de cada salto. |

El gate nunca frena ediciones dentro de `.sbr/` ni `landing/`.

El estado no se guarda en `CLAUDE_PLUGIN_ROOT`: esa ruta cambia en cada actualización del plugin.
