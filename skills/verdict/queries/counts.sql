SELECT
  source,
  count() AS visitors,
  countIf(clicked) AS cta_clicks,
  countIf(signed_up) AS signups,
  countIf(answered) AS answers
FROM (
  SELECT
    distinct_id,
    argMin(coalesce(toString(properties.source), ''), timestamp) AS source,
    min(timestamp) AS first_seen,
    countIf(event = 'sbr_cta_click') > 0 AS clicked,
    countIf(event = 'sbr_signup') > 0 AS signed_up,
    countIf(event = 'sbr_answers') > 0 AS answered,
    countIf(toString(properties.source) = 'test') AS test_events
  FROM events
  WHERE event IN ('$pageview', 'sbr_cta_click', 'sbr_signup', 'sbr_answers', 'sbr_done')
    AND toString(properties.source) IN ('v1', 'v2', 'v3', 'bio', 'friends', 'untagged', 'test')
  GROUP BY distinct_id
)
WHERE test_events = 0
  AND first_seen >= toDateTime('{since}', 'UTC')
GROUP BY source
ORDER BY source
LIMIT 100
