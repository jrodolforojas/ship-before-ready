SELECT
  people.source AS source,
  people.has_email AS has_email,
  answers.current_solution AS current_solution,
  answers.last_time AS last_time,
  answers.wants_call AS wants_call,
  answers.has_whatsapp AS has_whatsapp,
  answers.has_time_slot AS has_time_slot
FROM (
  SELECT
    distinct_id,
    argMin(coalesce(toString(properties.source), ''), timestamp) AS source,
    min(timestamp) AS first_seen,
    countIf(event = 'sbr_signup' AND coalesce(toString(properties.email), '') != '') > 0 AS has_email,
    countIf(toString(properties.source) = 'test') AS test_events
  FROM events
  WHERE event IN ('$pageview', 'sbr_cta_click', 'sbr_signup', 'sbr_answers', 'sbr_done')
    AND toString(properties.source) IN ('v1', 'v2', 'v3', 'bio', 'friends', 'untagged', 'test')
  GROUP BY distinct_id
) AS people
INNER JOIN (
  SELECT
    distinct_id,
    argMax(coalesce(toString(properties.current_solution), ''), timestamp) AS current_solution,
    argMax(coalesce(toString(properties.last_time), ''), timestamp) AS last_time,
    argMax(coalesce(toString(properties.wants_call), '') IN ('true', '1'), timestamp) AS wants_call,
    argMax(coalesce(toString(properties.whatsapp), '') != '', timestamp) AS has_whatsapp,
    argMax(coalesce(toString(properties.time_slot), '') != '', timestamp) AS has_time_slot
  FROM events
  WHERE event = 'sbr_answers'
    AND toString(properties.source) IN ('v1', 'v2', 'v3', 'bio', 'friends', 'untagged')
  GROUP BY distinct_id
) AS answers ON answers.distinct_id = people.distinct_id
WHERE people.test_events = 0
  AND people.first_seen >= toDateTime('{since}', 'UTC')
ORDER BY source
LIMIT 1000
