# Ship Before Ready

Plugin de Claude Code. El plugin vive en la raíz del repo: `.claude-plugin/`, `skills/<nombre>/SKILL.md`, `hooks/`.

## Estilo de código

- Sin comentarios, salvo código realmente complejo. Si hace falta uno, explica el porqué (una restricción, un rodeo), no el qué.
- Sin ramas `else`. Cláusulas de guarda (`if (cond) return ...`) y anidación plana.
- Nombres autodescriptivos.

## Contratos

- [docs/contratos/estado.md](docs/contratos/estado.md): archivos de estado en el repo del builder.
- [docs/contratos/eventos.md](docs/contratos/eventos.md): eventos y propiedades de PostHog.

No cambie nombres de archivos, eventos ni propiedades sin actualizar el contrato.

## Propiedad de archivos

Cada paso del plan es dueño de una carpeta: `templates/`, `site/`, `skills/<nombre>/`, `hooks/`. Solo los pasos 0 y 8 tocan `.claude-plugin/` y el README.
