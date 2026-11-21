import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { InvalidInput, decide } from '../scripts/ladder.mjs'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')
const fixture = (name) => JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), 'utf8'))

const RULES = {
  min_cold_visitors: 200,
  signup_rate_pass: 0.05,
  signup_rate_gray_min: 0.038,
  no_evidence_visitors: 300,
  calls_scheduled_pass: 3,
  cold_sources: ['v1', 'v2', 'v3', 'bio'],
}

const row = (visitors, signups = 0, answers = 0, qualifiedLeads = 0, callsScheduled = 0) => ({
  visitors,
  cta_clicks: signups,
  signups,
  answers,
  qualified_leads: qualifiedLeads,
  calls_scheduled: callsScheduled,
})

const inputWith = (counts, overrides = {}) => ({ rules: RULES, counts, declared: { calls_held: 0 }, ...overrides })

for (const result of ['insufficient_sample', 'iterate_promise', 'no_evidence', 'evidence_to_continue']) {
  test(`the ${result} fixture gives ${result}`, () => {
    assert.equal(decide(fixture(result)).result, result)
  })
}

test('friends and untagged never decide, however many calls they bring', () => {
  const decision = decide(fixture('insufficient_sample'))
  assert.equal(decision.result, 'insufficient_sample')
  assert.equal(decision.counts.friends.calls_scheduled, 6)
  assert.equal(decision.counts.cold.calls_scheduled, 0)
  assert.equal(decision.counts.cold.visitors, 120)
})

test('test visits are refused as input', () => {
  assert.throws(() => decide(inputWith({ v1: row(10), test: row(5) })), InvalidInput)
})

test('a signup rate inside the gray zone still means iterate the promise, marked gray', () => {
  const decision = decide(inputWith({ v1: row(200, 9) }))
  assert.equal(decision.result, 'iterate_promise')
  assert.equal(decision.reason, 'signup_rate_in_gray_zone')
  assert.equal(decision.signup_filter, 'gray')
})

test('a signup rate exactly at the threshold passes the filter but is not enough alone', () => {
  const decision = decide(inputWith({ v1: row(200, 10) }))
  assert.equal(decision.signup_filter, 'pass')
  assert.equal(decision.result, 'insufficient_sample')
  assert.equal(decision.reason, 'filter_passed_calls_pending')
})

test('below the minimum sample with a qualified lead the sample is still insufficient', () => {
  const decision = decide(inputWith({ v1: row(50, 5, 3, 1, 1) }))
  assert.equal(decision.result, 'insufficient_sample')
  assert.equal(decision.reason, 'sample_below_minimum_with_leads')
  assert.deepEqual(decision.matched, [])
})

test('rates are not judged below the minimum sample', () => {
  const decision = decide(inputWith({ v1: row(150, 1) }))
  assert.equal(decision.signup_filter, 'not_judged')
  assert.equal(decision.result, 'insufficient_sample')
})

test('no evidence wins over iterate the promise when both hold, and both are listed', () => {
  const decision = decide(inputWith({ v1: row(300, 3, 2, 0, 0) }))
  assert.equal(decision.result, 'no_evidence')
  assert.deepEqual(decision.matched, ['no_evidence', 'iterate_promise'])
})

test('three scheduled calls win over a low signup rate', () => {
  const decision = decide(inputWith({ v1: row(400, 6, 5, 3, 3) }))
  assert.equal(decision.result, 'evidence_to_continue')
  assert.deepEqual(decision.matched, ['evidence_to_continue', 'iterate_promise'])
})

test('calls held are declared data and never change the result', () => {
  const decision = decide(inputWith({ v1: row(100, 5, 4, 2, 2) }, { declared: { calls_held: 2 } }))
  assert.equal(decision.result, 'insufficient_sample')
  assert.equal(decision.declared.calls_held, 2)
})

test('every rate travels with its raw count', () => {
  const decision = decide(fixture('iterate_promise'))
  assert.deepEqual(decision.rates.signup_rate, { count: 8, of: 230, rate: 8 / 230 })
  for (const sourceRow of decision.by_source) {
    for (const rateValue of Object.values(sourceRow.rates)) {
      assert.ok(Number.isInteger(rateValue.count) && Number.isInteger(rateValue.of))
    }
  }
})

test('a rate with no base is null, not zero', () => {
  const decision = decide(inputWith({ v1: row(0) }))
  assert.deepEqual(decision.rates.signup_rate, { count: 0, of: 0, rate: null })
})

test('cold sources come from the sealed rules', () => {
  const rules = { ...RULES, cold_sources: ['v1', 'v2', 'v3'] }
  const decision = decide(inputWith({ v1: row(100), bio: row(150) }, { rules }))
  assert.equal(decision.counts.cold.visitors, 100)
  assert.equal(decision.by_source.find((sourceRow) => sourceRow.source === 'bio').group, 'outside_rules')
})

test('every cold source, friends and untagged appear even with no visits', () => {
  const decision = decide(inputWith({}))
  assert.deepEqual(
    decision.by_source.map((sourceRow) => sourceRow.source),
    ['v1', 'v2', 'v3', 'bio', 'friends', 'untagged'],
  )
})

test('changed rules give a second reading next to the sealed one', () => {
  const decision = decide(inputWith({ v1: row(150, 3) }, { rules_now: { ...RULES, min_cold_visitors: 100 } }))
  assert.equal(decision.result, 'insufficient_sample')
  assert.equal(decision.with_rules_now.result, 'iterate_promise')
})

test('counts that contradict each other are refused', () => {
  assert.throws(() => decide(inputWith({ v1: row(10, 20) })), /signups \(20\) cannot exceed visitors/)
  assert.throws(() => decide(inputWith({ v1: row(10, 5, 2, 3) })), /qualified_leads \(3\) cannot exceed answers/)
})

test('invalid thresholds are refused', () => {
  assert.throws(() => decide(inputWith({}, { rules: { ...RULES, signup_rate_gray_min: 0.06 } })), InvalidInput)
  assert.throws(() => decide(inputWith({}, { rules: { ...RULES, cold_sources: ['v1', 'friends'] } })), InvalidInput)
})

test('a missing declaration is refused', () => {
  assert.throws(() => decide(inputWith({}, { declared: {} })), /declared.calls_held/)
})
