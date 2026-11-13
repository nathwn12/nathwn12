#!/usr/bin/env node
// Regenerates assets/stats.svg: npm downloads this month plus GitHub activity.
// Standard library and fetch only — no dependencies, no build step.
//
//   node scripts/stats.mjs            write assets/stats.svg
//   node scripts/stats.mjs --dry-run  print every fetched number as JSON, write nothing

import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const USER = 'nathwn12'
const PACKAGES = [
  'gladius-mcp',
  'puppet-mcp',
  '@nathwn12/janua',
  '@nathwn12/oc-bifrost',
  'oc-flight-deck',
  'oc-harness-setup',
  'oc-plugin-view',
  'oc-talk',
  'rea-shim'
]
const NPM_RANGES = { week: 'last-week', month: 'last-month', allTime: '2015-01-01:2030-01-01' }
const MONTHS = 12

const GROUND = '#0B0F14'
const BONE = '#E8EDF2'
const ACCENT = '#4DD4E8'
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

// Geometry, one grid for the whole card.
const W = 880
const H = 240
const PAD = 32
const RULE_Y = 62
const CHART_X = PAD
const CHART_W = 320
const CHART_TOP = 96
const BASELINE_Y = 196
const RIGHT_X = 396
const COLUMN_W = 150
const COLUMN_GAP = 12
const LABEL_Y = 128
const NUMBER_Y = 172
const NUMBER_SIZE = 44

const ACTIVITY_QUERY = `query {
  user(login: "${USER}") {
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      contributionCalendar {
        totalContributions
        weeks { contributionDays { contributionCount date } }
      }
    }
  }
}`

// ---------------------------------------------------------------- fetch layer

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchJson(url, init) {
  const delays = [2000, 5000, 10000, 20000, 30000]
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, init)
    if (response.ok) return response.json()
    const body = (await response.text()).slice(0, 300)
    const retryable = response.status === 429 || response.status >= 500
    if (!retryable || attempt === delays.length) {
      throw new Error(`HTTP ${response.status} ${response.statusText} for ${url} — ${body}`)
    }
    // The npm point API rate-limits bursts; back off, then still fail loudly.
    const header = Number(response.headers.get('retry-after'))
    const wait = Number.isFinite(header) && header > 0 && header <= 60 ? header * 1000 : delays[attempt]
    await sleep(wait)
  }
}

// One npm request in flight at a time, spaced out: the point API 429s on bursts.
let npmQueue = Promise.resolve()
function npmFetch(url) {
  const request = npmQueue.then(async () => {
    const json = await fetchJson(url)
    await sleep(150)
    return json
  })
  npmQueue = request.catch(() => {})
  return request
}

async function npmDownloads(pkg) {
  const id = encodeURIComponent(pkg) // scoped names keep their "/" escaped
  const counts = {}
  for (const [label, range] of Object.entries(NPM_RANGES)) {
    const body = await npmFetch(`https://api.npmjs.org/downloads/point/${range}/${id}`)
    if (typeof body.downloads !== 'number' || Number.isNaN(body.downloads)) {
      throw new Error(`npm returned no download count for ${pkg} (${label}): ${JSON.stringify(body)}`)
    }
    counts[label] = body.downloads
  }
  return { package: pkg, week: counts.week, month: counts.month, allTime: counts.allTime }
}

function ghGraphQL() {
  return new Promise((resolve, reject) => {
    execFile('gh', ['api', 'graphql', '-f', `query=${ACTIVITY_QUERY}`], { maxBuffer: 64 * 1024 * 1024 }, (error, stdout) => {
      if (error) reject(error)
      else resolve(stdout)
    })
  })
}

function apiGraphQL() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (!token) throw new Error('gh is not on PATH and neither GITHUB_TOKEN nor GH_TOKEN is set')
  return fetchJson('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': `${USER}-profile-stats`
    },
    body: JSON.stringify({ query: ACTIVITY_QUERY })
  })
}

function unwrapActivity(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('GitHub returned no payload')
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    throw new Error(`GitHub GraphQL error: ${payload.errors.map((e) => e.message).join('; ')}`)
  }
  const user = payload.data?.user
  if (!user) throw new Error('GitHub GraphQL returned no user')
  const collection = user.contributionsCollection
  const calendar = collection?.contributionCalendar
  if (!calendar || !Array.isArray(calendar.weeks)) {
    throw new Error('GitHub GraphQL returned no contribution calendar')
  }
  return collection
}

async function githubActivity() {
  let raw
  try {
    raw = await ghGraphQL()
  } catch (error) {
    if (error.code !== 'ENOENT') throw error // gh exists but failed: say so, do not paper over it
    return unwrapActivity(await apiGraphQL())
  }
  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    throw new Error(`gh api graphql returned unparseable output: ${String(raw).slice(0, 300)}`)
  }
  return unwrapActivity(payload)
}

// -------------------------------------------------------------- pure helpers

export function formatNumber(value) {
  const integer = Math.trunc(value)
  const sign = integer < 0 ? '-' : ''
  return sign + String(Math.abs(integer)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const monthKeyOf = (date) => date.slice(0, 7)

function monthLabel(key) {
  const [year, month] = key.split('-').map(Number)
  const name = new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', {
    month: 'short',
    timeZone: 'UTC'
  })
  return name
}

function monthKeysEndingAt(key, count) {
  const [year, month] = key.split('-').map(Number)
  const keys = []
  for (let back = count - 1; back >= 0; back--) {
    const date = new Date(Date.UTC(year, month - 1 - back, 1))
    const y = date.getUTCFullYear()
    const m = String(date.getUTCMonth() + 1).padStart(2, '0')
    keys.push(`${y}-${m}`)
  }
  return keys
}

// Buckets the calendar's days into `count` calendar months ending with the newest one,
// so the newest partial month stays honest instead of being merged into a neighbour.
export function bucketMonths(days, count = MONTHS) {
  if (!Array.isArray(days) || days.length === 0) throw new Error('the contribution calendar is empty')
  const totals = new Map()
  for (const day of days) {
    const key = monthKeyOf(day.date)
    totals.set(key, (totals.get(key) ?? 0) + day.contributionCount)
  }
  const keys = [...totals.keys()].sort()
  return monthKeysEndingAt(keys[keys.length - 1], count).map((key) => ({
    month: key,
    label: monthLabel(key),
    value: totals.get(key) ?? 0
  }))
}

const round = (value) => Number(value.toFixed(2))
const esc = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function text(x, y, size, content, options = {}) {
  const anchor = options.anchor ? ` text-anchor="${options.anchor}"` : ''
  const weight = options.weight ? ` font-weight="${options.weight}"` : ''
  return (
    `  <text x="${x}" y="${y}"${anchor}${weight} font-family="${FONT}" ` +
    `font-size="${size}" fill="${BONE}">${esc(content)}</text>`
  )
}

export function renderCard({ npmMonth, contributions, commits, months, generated }) {
  const n = months.length
  const slot = CHART_W / n
  const barWidth = 20
  const max = Math.max(1, ...months.map((m) => m.value))
  const chartHeight = BASELINE_Y - CHART_TOP

  const bars = months
    .map((month, index) => {
      const height = month.value === 0 ? 0 : Math.max(1.5, (month.value / max) * chartHeight)
      const x = round(CHART_X + index * slot + (slot - barWidth) / 2)
      const y = round(BASELINE_Y - height)
      return (
        `    <rect class="bar" x="${x}" y="${y}" width="${barWidth}" height="${round(height)}" ` +
        `fill="${ACCENT}" rx="1.5"><title>${esc(month.label)} ${month.month.slice(0, 4)}: ` +
        `${formatNumber(month.value)}</title></rect>`
      )
    })
    .join('\n')

  const numbers = [
    { top: 'npm downloads', bottom: '30 days · 9 packages', value: formatNumber(npmMonth) },
    { top: 'GitHub contributions', bottom: 'last 12 months', value: formatNumber(contributions) },
    { top: 'GitHub commits', bottom: 'last 12 months', value: formatNumber(commits) }
  ]
  // One size for all three so their baselines stay level; shrink only if a number
  // would run into the next column. Advances at this weight: 0.52em a digit, 0.28em a comma.
  const room = COLUMN_W - COLUMN_GAP
  const widest = numbers.map(({ value }) => value).reduce((a, b) => (b.length > a.length ? b : a))
  const digits = (widest.match(/\d/g) ?? []).length
  const commas = widest.length - digits
  const estimated = NUMBER_SIZE * (0.52 * digits + 0.28 * commas)
  const numberSize =
    estimated <= room ? NUMBER_SIZE : Math.max(24, Math.floor((NUMBER_SIZE * room) / estimated))
  const stats = numbers
    .map(({ top, bottom, value }, index) =>
      [
        text(RIGHT_X + index * COLUMN_W, NUMBER_Y - 60, 12, top, { weight: 400 }),
        text(RIGHT_X + index * COLUMN_W, NUMBER_Y - 44, 12, bottom, { weight: 400 }),
        text(RIGHT_X + index * COLUMN_W, NUMBER_Y, numberSize, value, { weight: 600 })
      ].join('\n')
    )
    .join('\n')

  const stamp = generated.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const summary =
    `${USER}: ${formatNumber(npmMonth)} npm package downloads in the last 30 days across 9 packages, ` +
    `${formatNumber(contributions)} GitHub contributions and ${formatNumber(commits)} commits in the last 12 months`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(summary)}">
  <title>${esc(summary)}</title>
  <rect width="${W}" height="${H}" fill="${GROUND}"/>
  <rect x="${PAD}" y="${RULE_Y}" width="${W - PAD * 2}" height="1" fill="${BONE}"/>
${text(PAD, 44, 16, USER, { weight: 600 })}
${text(W - PAD, 44, 12, stamp, { anchor: 'end' })}
  <g>
${bars}
  </g>
  <rect x="${CHART_X}" y="${BASELINE_Y}" width="${CHART_W}" height="1" fill="${BONE}"/>
${text(CHART_X, 212, 12, 'contributions by month, last 12 months')}
${stats}
</svg>
`
}

// ---------------------------------------------------------------------- main

async function collect() {
  const npm = []
  for (const pkg of PACKAGES) npm.push(await npmDownloads(pkg))
  const activity = await githubActivity()
  const days = activity.contributionCalendar.weeks.flatMap((week) => week.contributionDays)
  const months = bucketMonths(days, MONTHS)
  return {
    generated: new Date(),
    report: {
      generatedAt: new Date().toISOString(),
      npm,
      npmDownloadsThisMonth: npm.reduce((sum, p) => sum + p.month, 0),
      github: {
        contributions: activity.contributionCalendar.totalContributions,
        commits: activity.totalCommitContributions,
        pullRequests: activity.totalPullRequestContributions,
        calendarDays: days.length,
        calendarRange: [days[0].date, days[days.length - 1].date]
      },
      months
    }
  }
}

async function main() {
  const args = new Set(process.argv.slice(2))
  for (const arg of args) {
    if (arg !== '--dry-run') throw new Error(`unknown argument: ${arg}\nusage: node scripts/stats.mjs [--dry-run]`)
  }

  const { generated, report } = await collect()
  const svg = renderCard({
    npmMonth: report.npmDownloadsThisMonth,
    contributions: report.github.contributions,
    commits: report.github.commits,
    months: report.months,
    generated
  })

  if (args.has('--dry-run')) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const target = join(root, 'assets', 'stats.svg')
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, svg, 'utf8')
  console.log(`wrote ${target} (${Buffer.byteLength(svg)} bytes)`)
}

const invokedDirectly =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url

if (invokedDirectly) {
  main().catch((error) => {
    console.error(`stats: ${error.message}`)
    process.exitCode = 1
  })
}
