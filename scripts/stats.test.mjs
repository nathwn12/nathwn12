import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { levelFor, recentDays, renderCard } from './stats.mjs'

const daysEndingAt = (last, counts = {}) =>
  Array.from({ length: 40 }, (_, index) => {
    const date = new Date(Date.parse(`${last}T00:00:00Z`) - (39 - index) * 86400000)
      .toISOString()
      .slice(0, 10)
    return { date, contributionCount: counts[date] ?? 0 }
  })

const card = (activity, overrides = {}) =>
  renderCard({
    npmMonth: 10,
    npmAllTime: 20,
    through: '2026-10-30',
    contributions: 30,
    commits: 12,
    activity,
    generated: new Date('2026-11-01T00:00:00Z'),
    ...overrides
  })

test('recentDays keeps the last 30 dates in order with their real counts', () => {
  const days = daysEndingAt('2026-11-16', { '2026-11-15': 5, '2026-10-20': 3 })
  const result = recentDays(days)
  assert.equal(result.length, 30)
  assert.equal(result[0].date, '2026-10-18')
  assert.equal(result.at(-1).date, '2026-11-16')
  assert.deepEqual(result.filter(({ value }) => value > 0), [
    { date: '2026-10-20', value: 3 },
    { date: '2026-11-15', value: 5 }
  ])
})

test('recentDays refuses a window the calendar does not fully cover', () => {
  const gap = daysEndingAt('2026-11-16').filter((day) => day.date !== '2026-11-01')
  assert.throws(() => recentDays(gap), /missing 2026-11-01/)
})

test('recentDays refuses an empty calendar', () => {
  assert.throws(() => recentDays([]), /contribution calendar is empty/)
  assert.throws(() => recentDays(undefined), /contribution calendar is empty/)
})

test('renderCard draws 30 cells in two rows of 15 without dropping counts', () => {
  const days = daysEndingAt('2026-11-16', { '2026-11-16': 359, '2026-10-18': 92 })
  const activity = recentDays(days)
  const svg = card(activity)

  const cells = [...svg.matchAll(/<rect x="([\d.]+)" y="(\d+)" width="15" height="15" fill="([^"]+)">/g)]
  assert.equal(cells.length, 30)
  assert.equal(cells[0][1], '32')
  assert.equal(cells[0][2], '120')
  assert.equal(cells[14][1], '330.2')
  assert.equal(cells[14][2], '120')
  assert.equal(cells[15][1], '32')
  assert.equal(cells[15][2], '144')

  assert.match(svg, /<title>2026-11-16: 359 contributions<\/title>/)
  assert.match(svg, /<title>2026-10-18: 92 contributions<\/title>/)
  assert.match(svg, />2 active days<\/text>/)
  assert.match(svg, /2 active days from 2026-10-18 through 2026-11-16/)
})

test('levelFor spreads active days across the full four-tone ramp', () => {
  const activity = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((value, index) => ({
    date: `2026-11-${String(index + 1).padStart(2, '0')}`,
    value
  }))
  const level = levelFor(activity)
  assert.equal(level(0), 0)
  const tones = new Set(activity.filter(({ value }) => value > 0).map(({ value }) => level(value)))
  assert.deepEqual([...tones].sort(), [1, 2, 3])
  assert.equal(levelFor([{ date: '2026-11-01', value: 0 }])(0), 0)
})

test('renderCard keeps the four headline numbers and the npm date', () => {
  const svg = card(recentDays(daysEndingAt('2026-11-16')))
  assert.match(svg, />10<\/text>/)
  assert.match(svg, />20<\/text>/)
  assert.match(svg, />30<\/text>/)
  assert.match(svg, />12<\/text>/)
  assert.match(svg, /through 2026-10-30/)
})

test('renderCard rejects an activity list that is not 30 days', () => {
  assert.throws(() => card([{ date: '2026-11-16', value: 1 }]), /expected 30 activity days/)
})

const readme = () => readFile(new URL('../README.md', import.meta.url), 'utf8')

test('README counts the ten published npm packages including hand-mcp', async () => {
  const text = await readme()
  assert.match(text, /ten packages I maintain/)
  const links = [...text.matchAll(/npmjs\.com\/package\/([^)]+)/g)].map((match) => match[1])
  assert.equal(links.length, 10, 'the README must list all ten published packages')
  assert.ok(links.includes('hand-mcp'), 'hand-mcp must appear in the package list')
})

test('README leads the project list with the shipped hand MCP server', async () => {
  const text = await readme()
  const section = text.slice(text.indexOf('## Selected projects'), text.indexOf('## Open source'))
  const first = section.split('\n').find((line) => line.startsWith('- '))
  assert.match(first, /\[Hand\]\(https:\/\/github\.com\/nathwn12\/hand\)/)
  assert.match(first, /npm-published/)
  assert.match(first, /released this week/)
})
