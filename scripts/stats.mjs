#!/usr/bin/env node
// Regenerates assets/stats.svg: npm downloads and GitHub activity.
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
const NPM_RANGES = { week: 'last-week', month: 'last-month' }
const DAY_MS = 86400000
const isoDate = (date) => date.toISOString().slice(0, 10)
const addDays = (date, days) => isoDate(new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS))
const ACTIVITY_DAYS = 30

const GROUND = '#0B0F14'
const BONE = '#E8EDF2'
const ACCENT = '#4DD4E8'
const ACTIVITY_LEVELS = ['#1c3039', '#23606b', '#3293a2', ACCENT]
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

// Geometry, one grid for the whole card.
const W = 1030
const H = 240
const PAD = 32
const RULE_Y = 62
const CHART_X = PAD
const CHART_W = 320
const ACTIVITY_COLUMNS = 15
const CELL = 15
const CELL_STEP_X = 21.3
const CELL_STEP_Y = 24
const GRID_Y = 120
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

export async function allTimeDownloads(pkg, through, getJson = npmFetch) {
  const id = encodeURIComponent(pkg)
  const metadata = await getJson(`https://registry.npmjs.org/${id}`)
  if (metadata.name !== pkg || !metadata.time?.created || !metadata.maintainers?.some((m) => m.name === USER)) {
    throw new Error(`npm registry metadata is incomplete for ${pkg}`)
  }
  let start = metadata.time.created.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || Number.isNaN(Date.parse(`${start}T00:00:00Z`)) || start > through) {
    throw new Error(`invalid registration date for ${pkg}`)
  }
  let total = 0
  while (start <= through) {
    const limit = addDays(start, 364)
    const end = limit < through ? limit : through
    const body = await getJson(`https://api.npmjs.org/downloads/point/${start}:${end}/${id}`)
    if (body.package !== pkg || body.start !== start || body.end !== end ||
        !Number.isSafeInteger(body.downloads) || body.downloads < 0) {
      throw new Error(`npm returned an incomplete download range for ${pkg}: ${start}:${end}`)
    }
    total += body.downloads
    if (!Number.isSafeInteger(total)) throw new Error(`npm total exceeds safe integer range for ${pkg}`)
    start = addDays(end, 1)
  }
  return total
}

async function npmDownloads(pkg, through) {
  const id = encodeURIComponent(pkg) // scoped names keep their "/" escaped
  const counts = {}
  for (const [label, range] of Object.entries(NPM_RANGES)) {
    const body = await npmFetch(`https://api.npmjs.org/downloads/point/${range}/${id}`)
    if (typeof body.downloads !== 'number' || Number.isNaN(body.downloads)) {
      throw new Error(`npm returned no download count for ${pkg} (${label}): ${JSON.stringify(body)}`)
    }
    counts[label] = body.downloads
  }
  return { package: pkg, week: counts.week, month: counts.month, allTime: await allTimeDownloads(pkg, through) }
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

const round = (value) => Number(value.toFixed(2))
const esc = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// The newest days in the calendar, oldest first. A date inside the window that the
// calendar does not carry is a failure, never a zero: a missing day is missing data.
export function recentDays(days, count = ACTIVITY_DAYS) {
  if (!Array.isArray(days) || days.length === 0) throw new Error('the contribution calendar is empty')
  const byDate = new Map(days.map((day) => [day.date, day.contributionCount]))
  const last = days.at(-1).date
  if (!/^\d{4}-\d{2}-\d{2}$/.test(last)) throw new Error(`invalid contribution date: ${last}`)
  return Array.from({ length: count }, (_, index) => {
    const date = addDays(last, index - count + 1)
    if (!byDate.has(date)) throw new Error(`the contribution calendar is missing ${date}`)
    const value = byDate.get(date)
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`invalid contribution count for ${date}`)
    return { date, value }
  })
}

// Thirds of the active days, so a busy month still shows contrast instead of
// saturating every cell. Zero stays the empty tone.
export function levelFor(days) {
  const active = days.map((day) => day.value).filter((value) => value > 0).sort((a, b) => a - b)
  if (active.length === 0) return () => 0
  const at = (fraction) => active[Math.min(active.length - 1, Math.floor(fraction * active.length))]
  const cuts = [at(1 / 3), at(2 / 3)]
  return (value) => {
    if (value <= 0) return 0
    if (value <= cuts[0]) return 1
    if (value <= cuts[1]) return 2
    return 3
  }
}

function text(x, y, size, content, options = {}) {
  const anchor = options.anchor ? ` text-anchor="${options.anchor}"` : ''
  const weight = options.weight ? ` font-weight="${options.weight}"` : ''
  return (
    `  <text x="${x}" y="${y}"${anchor}${weight} font-family="${FONT}" ` +
    `font-size="${size}" fill="${BONE}">${esc(content)}</text>`
  )
}

export function renderCard({ npmMonth, npmAllTime, through, contributions, commits, activity, generated }) {
  if (!Array.isArray(activity) || activity.length !== ACTIVITY_DAYS) {
    throw new Error(`expected ${ACTIVITY_DAYS} activity days, got ${Array.isArray(activity) ? activity.length : 'none'}`)
  }
  const level = levelFor(activity)
  const activeDays = activity.filter((day) => day.value > 0).length
  const cells = activity
    .map((day, index) => {
      const x = round(CHART_X + (index % ACTIVITY_COLUMNS) * CELL_STEP_X)
      const y = GRID_Y + Math.floor(index / ACTIVITY_COLUMNS) * CELL_STEP_Y
      return (
        `    <rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${ACTIVITY_LEVELS[level(day.value)]}">` +
        `<title>${esc(day.date)}: ${formatNumber(day.value)} contributions</title></rect>`
      )
    })
    .join('\n')

  const numbers = [
    { top: 'npm downloads', bottom: '30 days · 9 packages', value: formatNumber(npmMonth) },
    { top: 'npm downloads', bottom: 'all-time · 9 packages', value: formatNumber(npmAllTime) },
    { top: 'GitHub contributions', bottom: 'last 12 months', value: formatNumber(contributions) },
    { top: 'GitHub commits', bottom: 'last 12 months', value: formatNumber(commits) }
  ]
  // One size for all four so their baselines stay level; shrink only if a number
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
    `${USER}: ${formatNumber(npmMonth)} npm package downloads in the last 30 days, ` +
    `${formatNumber(npmAllTime)} all-time npm downloads across 9 packages through ${through}, ` +
    `${formatNumber(contributions)} GitHub contributions and ${formatNumber(commits)} commits in the last 12 months; ` +
    `${activeDays} active days from ${activity[0].date} through ${activity.at(-1).date}`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(summary)}">
  <title>${esc(summary)}</title>
  <rect width="${W}" height="${H}" fill="${GROUND}"/>
  <rect x="${PAD}" y="${RULE_Y}" width="${W - PAD * 2}" height="1" fill="${BONE}"/>
${text(PAD, 44, 16, USER, { weight: 600 })}
${text(W - PAD, 44, 12, stamp, { anchor: 'end' })}
  <g aria-label="Daily GitHub contributions for the last 30 days">
${cells}
  </g>
${text(CHART_X, 105, 12, 'recent activity · last 30 days')}
${text(CHART_X, 190, 12, `${activeDays} active days`)}
${text(CHART_X, 212, 10, 'earlier')}
${text(CHART_X + CHART_W, 212, 10, 'recent', { anchor: 'end' })}
${text(RIGHT_X + COLUMN_W, 196, 10, `through ${through}`)}
${stats}
</svg>
`
}

// ---------------------------------------------------------------------- main

async function collect() {
  const through = addDays(isoDate(new Date()), -3)
  const npm = []
  for (const pkg of PACKAGES) npm.push(await npmDownloads(pkg, through))
  const activity = await githubActivity()
  const days = activity.contributionCalendar.weeks.flatMap((week) => week.contributionDays)
  return {
    generated: new Date(),
    report: {
      generatedAt: new Date().toISOString(),
      npm,
      npmDownloadsThisMonth: npm.reduce((sum, p) => sum + p.month, 0),
      npmDownloadsAllTime: npm.reduce((sum, p) => sum + p.allTime, 0),
      npmDownloadsThrough: through,
      github: {
        contributions: activity.contributionCalendar.totalContributions,
        commits: activity.totalCommitContributions,
        pullRequests: activity.totalPullRequestContributions,
        calendarDays: days.length,
        calendarRange: [days[0].date, days[days.length - 1].date]
      },
      activity: recentDays(days)
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
    npmAllTime: report.npmDownloadsAllTime,
    through: report.npmDownloadsThrough,
    contributions: report.github.contributions,
    commits: report.github.commits,
    activity: report.activity,
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
