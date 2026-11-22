# Ship Before Ready

Plugin de Claude Code que lleva a un builder de su idea a sus primeros leads antes de escribir código: tres preguntas, un diseño aprobado, una landing publicada, tres guiones de video, lectura de números y un veredicto.

Todo corre en las cuentas del builder: su repo, su Claude, su Vercel y su PostHog.

## Instalación

```
/plugin marketplace add jrodolforojas/ship-before-ready
/plugin install ship-before-ready@ship-before-ready
```

## Skills

Los comandos van en inglés; lo que el plugin le dice al builder va en español. Se corren en este orden, o se deja que `/ship-before-ready:start` los vaya corriendo uno por uno.

| Comando | Qué hace |
|---|---|
| `/ship-before-ready:start` | Punto de entrada: mira en qué fase va la idea y corre la que sigue, una a la vez. |
| `/ship-before-ready:connect` | Verifica las cuentas del builder, pregunta el gestor de paquetes y guarda las conexiones. |
| `/ship-before-ready:interview` | Hace las preguntas y produce el brief. |
| `/ship-before-ready:rules` | Sella las varas y la fecha de veredicto. |
| `/ship-before-ready:design` | Lleva el brief a un diseño final aprobado en Claude Design, elegido entre tres direcciones. |
| `/ship-before-ready:landing` | Programa y publica la landing a partir del diseño aprobado. |
| `/ship-before-ready:video-scripts` | Escribe tres guiones de video con link rastreado. |
| `/ship-before-ready:verdict` | Lee los números y da el veredicto. |

Estado: en construcción. Las skills son marcadores por ahora.

## Licencia

[MIT](LICENSE)
