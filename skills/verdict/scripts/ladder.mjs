export const RESULTS = ['evidence_to_continue', 'no_evidence', 'iterate_promise', 'insufficient_sample']
export const COUNT_KEYS = ['visitors', 'cta_clicks', 'signups', 'answers', 'qualified_leads', 'calls_scheduled']
export const GROUPS = ['cold', 'friends', 'untagged']
export const FRIENDS_SOURCE = 'friends'
export const UNTAGGED_SOURCE = 'untagged'
export const TEST_SOURCE = 'test'
export const THRESHOLD_KEYS = [
  'min_cold_visitors',
  'signup_rate_pass',
  'signup_rate_gray_min',
  'no_evidence_visitors',
  'calls_scheduled_pass',
  'cold_sources',
]

const WHOLE_THRESHOLD_KEYS = ['min_cold_visitors', 'no_evidence_visitors', 'calls_scheduled_pass']
const RATE_THRESHOLD_KEYS = ['signup_rate_pass', 'signup_rate_gray_min']
const CONTAINED_IN_VISITORS = ['cta_clicks', 'signups', 'answers']
const CONTAINED_IN_ANSWERS = ['qualified_leads', 'calls_scheduled']

export class InvalidInput extends Error {
  constructor(problems) {
    super(problems.join('\n'))
    this.problems = problems
  }
}

const isWholeCount = (value) => Number.isInteger(value) && value >= 0

export function thresholdProblems(rules) {
  if (!rules || typeof rules !== 'object') return ['rules is missing']
  const problems = []
  for (const key of WHOLE_THRESHOLD_KEYS) {
    if (!Number.isInteger(rules[key]) || rules[key] <= 0) problems.push(`rules.${key} must be a whole number above zero`)
  }
  for (const key of RATE_THRESHOLD_KEYS) {
    if (typeof rules[key] !== 'number' || rules[key] <= 0 || rules[key] >= 1) problems.push(`rules.${key} must be a fraction between 0 and 1`)
  }
  if (rules.signup_rate_gray_min >= rules.signup_rate_pass) problems.push('rules.signup_rate_gray_min must be below rules.signup_rate_pass')
  if (rules.no_evidence_visitors < rules.min_cold_visitors) problems.push('rules.no_evidence_visitors cannot be below rules.min_cold_visitors')
  const coldSources = rules.cold_sources
  if (!Array.isArray(coldSources) || coldSources.length === 0) problems.push('rules.cold_sources must be a non-empty list')
  if (Array.isArray(coldSources) && coldSources.some((source) => [FRIENDS_SOURCE, UNTAGGED_SOURCE, TEST_SOURCE].includes(source))) {
    problems.push('rules.cold_sources cannot hold friends, untagged or test')
  }
  return problems
}

function rowProblems(source, row) {
  if (!row || typeof row !== 'object') return [`counts.${source} must be an object`]
  const problems = COUNT_KEYS.filter((key) => !isWholeCount(row[key])).map((key) => `counts.${source}.${key} must be a whole number, zero or more`)
  if (problems.length > 0) return problems
  for (const key of CONTAINED_IN_VISITORS) {
    if (row[key] > row.visitors) problems.push(`counts.${source}.${key} (${row[key]}) cannot exceed visitors (${row.visitors})`)
  }
  for (const key of CONTAINED_IN_ANSWERS) {
    if (row[key] > row.answers) problems.push(`counts.${source}.${key} (${row[key]}) cannot exceed answers (${row.answers})`)
  }
  return problems
}

export function inputProblems(input) {
  if (!input || typeof input !== 'object') return ['input must be a JSON object']
  const problems = thresholdProblems(input.rules)
  if (input.rules_now !== undefined) problems.push(...thresholdProblems(input.rules_now).map((problem) => problem.replace(/^rules/, 'rules_now')))
  if (!input.counts || typeof input.counts !== 'object' || Array.isArray(input.counts)) return [...problems, 'counts must be an object keyed by source']
  for (const [source, row] of Object.entries(input.counts)) {
    if (source === TEST_SOURCE) problems.push('counts.test is not allowed: test visits are never counted')
    problems.push(...rowProblems(source, row))
  }
  const callsHeld = input.declared?.calls_held
  if (!isWholeCount(callsHeld)) problems.push('declared.calls_held must be a whole number, zero or more')
  return problems
}

export const rate = (count, of) => ({ count, of, rate: of === 0 ? null : count / of })

const zeroRow = () => Object.fromEntries(COUNT_KEYS.map((key) => [key, 0]))

function sumRows(rows) {
  const total = zeroRow()
  for (const row of rows) {
    for (const key of COUNT_KEYS) total[key] += row[key]
  }
  return total
}

export function groupOf(source, rules) {
  if (rules.cold_sources.includes(source)) return 'cold'
  if (source === FRIENDS_SOURCE) return 'friends'
  if (source === UNTAGGED_SOURCE) return 'untagged'
  return 'outside_rules'
}

function orderedSources(counts, rules) {
  const fixed = [...rules.cold_sources, FRIENDS_SOURCE, UNTAGGED_SOURCE]
  const others = Object.keys(counts).filter((source) => !fixed.includes(source)).sort()
  return [...fixed, ...others]
}

export function ratesOf(row) {
  return {
    cta_click_rate: rate(row.cta_clicks, row.visitors),
    signup_rate: rate(row.signups, row.visitors),
    answer_rate: rate(row.answers, row.signups),
  }
}

function signupFilterOf(cold, rules) {
  if (cold.visitors < rules.min_cold_visitors) return 'not_judged'
  const signupRate = cold.signups / cold.visitors
  if (signupRate >= rules.signup_rate_pass) return 'pass'
  if (signupRate >= rules.signup_rate_gray_min) return 'gray'
  return 'fail'
}

function matchedResults(cold, rules, signupFilter) {
  const conditions = {
    evidence_to_continue: cold.calls_scheduled >= rules.calls_scheduled_pass,
    no_evidence: cold.visitors >= rules.no_evidence_visitors && cold.qualified_leads === 0,
    iterate_promise: signupFilter === 'gray' || signupFilter === 'fail',
    insufficient_sample: cold.visitors < rules.min_cold_visitors && cold.qualified_leads === 0,
  }
  return RESULTS.filter((result) => conditions[result])
}

function reasonFor(result, cold, rules, signupFilter) {
  if (result === 'evidence_to_continue') return 'calls_scheduled_reached'
  if (result === 'no_evidence') return 'no_qualified_leads'
  if (result === 'iterate_promise') return signupFilter === 'gray' ? 'signup_rate_in_gray_zone' : 'signup_rate_below_gray_zone'
  if (cold.visitors >= rules.min_cold_visitors) return 'filter_passed_calls_pending'
  if (cold.qualified_leads > 0) return 'sample_below_minimum_with_leads'
  return 'sample_below_minimum'
}

function climb(counts, rules) {
  const bySource = orderedSources(counts, rules).map((source) => {
    const row = { ...zeroRow(), ...counts[source] }
    return { source, group: groupOf(source, rules), ...Object.fromEntries(COUNT_KEYS.map((key) => [key, row[key]])) }
  })
  const groups = Object.fromEntries(GROUPS.map((group) => [group, sumRows(bySource.filter((row) => row.group === group))]))
  const cold = groups.cold
  const signupFilter = signupFilterOf(cold, rules)
  const matched = matchedResults(cold, rules, signupFilter)
  const result = matched[0] ?? 'insufficient_sample'
  return {
    result,
    reason: reasonFor(result, cold, rules, signupFilter),
    matched,
    sample_reached: cold.visitors >= rules.min_cold_visitors,
    signup_filter: signupFilter,
    counts: groups,
    rates: ratesOf(cold),
    by_source: bySource.map((row) => ({ ...row, rates: ratesOf(row) })),
  }
}

export function decide(input) {
  const problems = inputProblems(input)
  if (problems.length > 0) throw new InvalidInput(problems)
  const rules = Object.fromEntries(THRESHOLD_KEYS.map((key) => [key, input.rules[key]]))
  const decision = { ...climb(input.counts, rules), rules, declared: { calls_held: input.declared.calls_held } }
  if (input.integrity !== undefined) decision.integrity = input.integrity
  if (input.meta !== undefined) decision.meta = input.meta
  if (input.rules_now === undefined) return decision
  const rulesNow = Object.fromEntries(THRESHOLD_KEYS.map((key) => [key, input.rules_now[key]]))
  const withRulesNow = climb(input.counts, rulesNow)
  return { ...decision, with_rules_now: { result: withRulesNow.result, reason: withRulesNow.reason, rules: rulesNow } }
}
