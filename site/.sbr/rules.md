---
min_cold_visitors: 200
signup_rate_pass: 0.05
signup_rate_gray_min: 0.038
no_evidence_visitors: 300
calls_scheduled_pass: 3
cold_sources: [v1, v2, v3]
verdict_date: 2026-11-23
sealed: 2026-11-22
---

# Reglas del veredicto

## Varas

| Vara | Valor | Qué mide | Fuente |
|---|---|---|---|
| Muestra mínima | 200 | Visitantes únicos de tráfico frío que hacen falta para opinar sobre tasas. | Kromatic; cálculo propio |
| Filtro de registro | 5% | Registros sobre visitantes fríos a partir de los cuales el filtro pasa. Es un filtro: nunca basta por sí solo. | Kromatic; Unbounce |
| Inicio de la zona gris | 3,8% | Desde este valor hasta el filtro, el resultado es gris. | Unbounce, reporte 2024: mediana de SaaS de 3,8% |
| Sin evidencia | 300 | Visitantes fríos sin un solo lead calificado que significan que este ángulo no dio evidencia. | Cálculo propio: con 300 visitantes y cero leads hay 95% de confianza de que menos del 1% se convertiría |
| Evidencia para seguir | 3 | Llamadas agendadas con desconocidos. | The Mom Test, vía reseñas; el número es una propuesta |
| Tráfico frío | v1, v2, v3 | Links que cuentan como tráfico frío, uno por guion de video. Amigos y comunidad se cuentan aparte. | Regla de credibilidad: solo el tráfico frío decide |

## Fecha de veredicto

El veredicto se lee el 2026-11-23.

## Reglas de credibilidad

1. Las varas se fijan y se sellan antes de lanzar.
2. Amigos y comunidad se cuentan aparte; solo el tráfico frío decide.
3. El revisor sin contexto audita que los números sostengan el veredicto.
4. Las tasas se muestran siempre con su conteo crudo.

## Lo que el veredicto no mide

Disposición a pagar. Aquí no se prueban precios: la evidencia más fuerte que se obtiene es de tiempo (una llamada), no de dinero.

## Sello

Estas reglas se sellaron con un commit, registrado en .sbr/seal.json. Cualquier cambio posterior es un commit nuevo y el veredicto lo muestra.
