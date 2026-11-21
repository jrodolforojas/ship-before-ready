import { COUNT_KEYS, GROUPS, THRESHOLD_KEYS } from './ladder.mjs'

const RATE_KEYS = ['cta_click_rate', 'signup_rate', 'answer_rate']
const SHORT_COMMIT = 7

export function fill(template, values) {
  return template.replace(/\{([a-z_]+)\}/g, (placeholder, key) => {
    if (!(key in values)) throw new Error(`Missing value for ${placeholder} in: ${template}`)
    return String(values[key])
  })
}

export function formatPercent(fraction, locale) {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(fraction * 100)
  return `${number}%`
}

export function formatRate({ count, of, rate }, phrases, locale) {
  if (rate === null) return fill(phrases.rates.no_base, { count, of })
  return fill(phrases.rates.format, { rate: formatPercent(rate, locale), count, of })
}

export function formatThreshold(key, value, locale) {
  if (key === 'signup_rate_pass' || key === 'signup_rate_gray_min') return formatPercent(value, locale)
  if (key === 'cold_sources') return value.join(', ')
  return String(value)
}

const table = (header, rows) => [`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`, ...rows.map((row) => `| ${row.join(' | ')} |`)]

const thresholdValues = (rules, locale) =>
  Object.fromEntries(THRESHOLD_KEYS.map((key) => [key, formatThreshold(key, rules[key], locale)]))

export function phraseValues(decision, phrases, locale) {
  const cold = decision.counts.cold
  return {
    ...thresholdValues(decision.rules, locale),
    ...cold,
    signup_rate: formatRate(decision.rates.signup_rate, phrases, locale),
    upper_bound: formatPercent(3 / decision.rules.no_evidence_visitors, locale),
  }
}

export function sourceLabel(source, phrases) {
  return phrases.sources[source] ?? source
}

export function rateLines(decision, phrases, locale) {
  return decision.by_source.flatMap((row) =>
    RATE_KEYS.map((key) => `${sourceLabel(row.source, phrases)} · ${phrases.rates[key]}: ${formatRate(row.rates[key], phrases, locale)}`),
  )
}

function rulesChangedSection(integrity, decision, phrases, locale) {
  const changed = integrity.rules_changed_after_seal || integrity.uncommitted_changes || integrity.changed_keys.length > 0
  if (!changed) return []
  const lines = [`## ${phrases.integrity.changed_title}`, '', fill(phrases.integrity.changed_intro, { date: integrity.sealed_at.slice(0, 10), commit: integrity.rules_commit.slice(0, SHORT_COMMIT) }), '']
  for (const change of integrity.changes) {
    lines.push(`- ${fill(phrases.integrity.commit_line, { date: change.date.slice(0, 10), commit: change.commit.slice(0, SHORT_COMMIT), reason: change.reason || phrases.integrity.no_reason })}`)
  }
  if (integrity.uncommitted_changes) lines.push(`- ${phrases.integrity.uncommitted}`)
  for (const change of integrity.changed_keys) {
    lines.push(`- ${fill(phrases.integrity.key_line, { label: phrases.thresholds[change.key] ?? change.key, sealed: formatThreshold(change.key, change.sealed, locale), now: formatThreshold(change.key, change.now, locale) })}`)
  }
  lines.push('', phrases.integrity.applied_sealed)
  if (decision.with_rules_now) lines.push(fill(phrases.integrity.result_with_rules_now, { result: phrases.results[decision.with_rules_now.result].title }))
  return [...lines, '']
}

function earlyReadingSection(decision, computedAt, phrases) {
  const verdictDate = decision.meta?.verdict_date
  if (!verdictDate || computedAt.slice(0, 10) >= verdictDate) return []
  return [fill(phrases.early_reading, { date: verdictDate }), '']
}

function answerSection(decision, phrases, locale) {
  const values = phraseValues(decision, phrases, locale)
  const result = phrases.results[decision.result]
  const reason = [fill(phrases.reasons[decision.reason], values), '']
  if (!decision.matched.includes(decision.result)) return [`## ${phrases.sections.answer}: ${result.title}`, '', ...reason]
  return [`## ${phrases.sections.answer}: ${result.title}`, '', fill(result.detail, values), '', ...reason]
}

function countsSection(decision, phrases) {
  const header = [phrases.table.source, phrases.table.group, ...COUNT_KEYS.map((key) => phrases.table[key])]
  const countsOf = (row) => COUNT_KEYS.map((key) => String(row[key]))
  const coldRows = decision.by_source.filter((row) => row.group === 'cold')
  const apartRows = decision.by_source.filter((row) => row.group !== 'cold')
  const rows = [
    ...coldRows.map((row) => [sourceLabel(row.source, phrases), phrases.groups.cold, ...countsOf(row)]),
    [`**${phrases.table.cold_total}**`, phrases.groups.cold, ...countsOf(decision.counts.cold).map((value) => `**${value}**`)],
    ...apartRows.map((row) => [sourceLabel(row.source, phrases), phrases.groups[row.group], ...countsOf(row)]),
  ]
  return [`## ${phrases.sections.numbers}`, '', phrases.sections.numbers_note, '', ...table(header, rows), '']
}

function ratesSection(decision, phrases, locale) {
  const header = [phrases.table.source, ...RATE_KEYS.map((key) => phrases.rates[key])]
  const ratesOf = (rates) => RATE_KEYS.map((key) => formatRate(rates[key], phrases, locale))
  const coldRows = decision.by_source.filter((row) => row.group === 'cold')
  const apartRows = decision.by_source.filter((row) => row.group !== 'cold')
  const rows = [
    ...coldRows.map((row) => [sourceLabel(row.source, phrases), ...ratesOf(row.rates)]),
    [`**${phrases.table.cold_total}**`, ...ratesOf(decision.rates)],
    ...apartRows.map((row) => [sourceLabel(row.source, phrases), ...ratesOf(row.rates)]),
  ]
  const lines = [`## ${phrases.sections.rates}`, '', ...table(header, rows), '']
  if (!decision.sample_reached) lines.push(fill(phrases.rates.not_judged, thresholdValues(decision.rules, locale)), '')
  return lines
}

function declaredSection(decision, phrases) {
  return [`## ${phrases.sections.declared}`, '', fill(phrases.declared.calls_held, { calls_held: decision.declared.calls_held }), '']
}

function rulesSection(decision, phrases, locale) {
  const rows = THRESHOLD_KEYS.map((key) => [phrases.thresholds[key], formatThreshold(key, decision.rules[key], locale)])
  return [`## ${phrases.sections.rules}`, '', ...table([phrases.table.threshold, phrases.table.value], rows), '']
}

function notMeasuredSection(phrases) {
  return [`## ${phrases.sections.not_measured}`, '', ...phrases.not_measured.map((line) => `- ${line}`), '']
}

function reviewSection(review, phrases) {
  if (review.status === 'approved') return [`## ${phrases.sections.review}`, '', phrases.review.approved, '']
  const findings = review.findings.map((finding) => `- ${fill(phrases.review.finding, finding)}`)
  return [`## ${phrases.sections.review}`, '', phrases.review.rejected, '', ...findings, '']
}

function header(decision, computedAt, review) {
  const lines = [
    '---',
    `result: ${decision.result}`,
    `computed_at: ${computedAt}`,
    `rules_commit: ${decision.integrity.rules_commit}`,
    `rules_changed_after_seal: ${decision.integrity.rules_changed_after_seal}`,
    `reviewer: ${review.status === 'approved' ? 'approved' : 'pending'}`,
    'counts:',
  ]
  for (const group of GROUPS) {
    lines.push(`  ${group}:`)
    for (const key of COUNT_KEYS) lines.push(`    ${key}: ${decision.counts[group][key]}`)
  }
  lines.push(`calls_held_declared: ${decision.declared.calls_held}`, '---', '')
  return lines
}

export function renderVerdict({ decision, review, computedAt, phrases, locale }) {
  return [
    ...header(decision, computedAt, review),
    `# ${phrases.sections.title}`,
    '',
    ...rulesChangedSection(decision.integrity, decision, phrases, locale),
    ...earlyReadingSection(decision, computedAt, phrases),
    ...answerSection(decision, phrases, locale),
    ...countsSection(decision, phrases),
    ...ratesSection(decision, phrases, locale),
    ...declaredSection(decision, phrases),
    ...rulesSection(decision, phrases, locale),
    ...notMeasuredSection(phrases),
    ...reviewSection(review, phrases),
    phrases.closing,
    '',
  ].join('\n')
}
