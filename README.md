### Nathaniel Nikolai Ladero

Backend developer. Fintech APIs on AWS, shipped March 2023 to May 2026.

[Portfolio](https://nathwn12.github.io/) · [Resume](https://nathwn12.github.io/Nathaniel-Nikolai-Ladero-Resume.pdf) · [CV](https://nathwn12.github.io/Nathaniel-Nikolai-Ladero-CV.pdf) · [LinkedIn](https://www.linkedin.com/in/nathaniel-nikolai-l-184181261/) · [Email](mailto:nathanielnikolai.ladero@gmail.com)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github-readme-stats.vercel.app/api?username=nathwn12&hide_title=true&hide_rank=true&show_icons=false&include_all_commits=true&theme=github_dark&hide_border=true&bg_color=00000000&line_height=22">
  <img alt="GitHub statistics: commits, pull requests, issues, contributions" src="https://github-readme-stats.vercel.app/api?username=nathwn12&hide_title=true&hide_rank=true&show_icons=false&include_all_commits=true&theme=default&hide_border=true&bg_color=00000000&line_height=22">
</picture>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github-readme-activity-graph.vercel.app/graph?username=nathwn12&bg_color=00000000&color=c9d1d9&line=58a6ff&point=58a6ff&area=true&hide_border=true&days=30">
  <img alt="Contribution activity over the last 30 days" src="https://github-readme-activity-graph.vercel.app/graph?username=nathwn12&bg_color=00000000&color=24292f&line=0969da&point=0969da&area=true&hide_border=true&days=30">
</picture>

## Experience

Backend Developer, Xentra Infotech Solutions Inc. — Remote — March 2023 to May 2026 (three years, two months). The company closed in May 2026.

- Payments API: worst-case query latency fell from about 60 seconds to under one second, a 98% cut, by migrating payment services from MySql.Data to MySqlConnector on AWS.
- Data access: read latency cut by over 40% with EF Core and Dapper, plus Redis caching and index tuning against real query plans.
- Auth: JWT, OAuth 2.0, OpenID Connect, RBAC and ABAC. Zero high/critical Snyk findings on production deployments.
- Delivery ledger: 1,182 commits across 17 repositories, 2023-2026, recovered from 21 scanned internal repositories after the company closed.

The fintech systems are closed source. Everything below is public.

## Open source

The oc-* plugins and both MCP launchers live in [oc-collections](https://github.com/nathwn12/oc-collections) as the single source. Each still installs on its own, and the install lines are unchanged.

### [puppet](https://github.com/nathwn12/puppet)

MCP server for the Windows desktop: screenshots, window control, and input from any MCP client.

```powershell
npx -y puppet-mcp@latest --doctor
```

Rust. [Repo](https://github.com/nathwn12/oc-collections/tree/main/packages/puppet-mcp) · [Docs](https://github.com/nathwn12/puppet#readme)

### [gladius](https://github.com/nathwn12/gladius)

MCP server that drives a browser, so pages can be walked without doing it by hand.

```powershell
npx -y gladius-mcp@latest --doctor
```

Rust. [Repo](https://github.com/nathwn12/oc-collections/tree/main/packages/gladius-mcp) · [Docs](https://github.com/nathwn12/gladius#readme)

### [oc-harness-setup](https://github.com/nathwn12/oc-harness-setup)

Installs the OpenCode harness — agents, commands, and skills — in one explicit, reversible step.

```bash
npx --yes oc-harness-setup setup
```

Node.js, PowerShell. [Repo](https://github.com/nathwn12/oc-collections/tree/main/packages/oc-harness-setup) · [Docs](https://github.com/nathwn12/oc-harness-setup#readme)

### [oc-bifrost](https://github.com/nathwn12/oc-bifrost)

Keeps V1-era OpenCode plugins running on V2.

```jsonc
{ "plugins": [{ "package": "@nathwn12/oc-bifrost@latest" }] }
```

JavaScript. [Repo](https://github.com/nathwn12/oc-collections/tree/main/packages/oc-bifrost) · [Docs](https://github.com/nathwn12/oc-bifrost#readme)

### [oc-flight-deck](https://github.com/nathwn12/oc-flight-deck)

Live cost, tokens, and context in the OpenCode sidebar.

```json
{ "plugins": ["oc-flight-deck@latest"] }
```

TypeScript. [Repo](https://github.com/nathwn12/oc-collections/tree/main/packages/oc-flight-deck) · [Docs](https://github.com/nathwn12/oc-flight-deck#readme)

### [slowburn](https://github.com/nathwn12/slowburn)

Windows player for slowed and reverb audio: slow or speed any track, add reverb, A-B loop a passage, offline.

Source only, no release yet. Clone and run with Tauri; releases coming.

TypeScript, Tauri. [Repo](https://github.com/nathwn12/slowburn) · [Docs](https://github.com/nathwn12/slowburn#readme)

### [Potflix](https://github.com/nathwn12/Potflix)

Shows what plays in PotPlayer on your Discord card.

Tagged release, no binaries yet. Build from source; see the repo README.

Rust. [Repo](https://github.com/nathwn12/Potflix) · [Docs](https://github.com/nathwn12/Potflix#readme)

### Other repositories

- [tab-audio-normalizer](https://github.com/nathwn12/tab-audio-normalizer) — keeps loud tabs at an even level, per site.
- [ArcInstaller](https://github.com/nathwn12/ArcInstaller) — installs, repairs, and reverts the ARC icon theme.
- [slowed-reverb-audio](https://github.com/nathwn12/slowed-reverb-audio) — YouTube speed control plus plate reverb.
- [oc-collections](https://github.com/nathwn12/oc-collections) — the single source monorepo for all of the oc-* plugins and both MCP launchers above, not just an index; each still installs on its own.
- [rea-shim](https://github.com/nathwn12/oc-collections/tree/main/packages/rea-shim) — compatibility wrapper that lets existing REA scripts keep running unmodified.
- [aimp-discord-presence-art](https://github.com/nathwn12/aimp-discord-presence-art) — cover art for the AIMP Discord Rich Presence; art only, no code.

Each tool above carries its own install line. Check a published version with `npm view <package> version`. MCP servers prove themselves with `--doctor`; OpenCode plugins need a restart before they load.

## Elsewhere

Archived and forks.

- [oc-todo](https://github.com/nathwn12/oc-todo) — retired, not deleted. The repository description states it is deprecated 2026-10-21 because OpenCode 2.1 restored the built-in `todowrite`, and points to `EOL.md`.
- [aimp-discord-presence2](https://github.com/nathwn12/aimp-discord-presence2) ([upstream](https://github.com/Exle/aimp-discord-presence)) — maintained fork of the AIMP→Discord presence plugin, with fixes noted in the repo.
- [Installer2](https://github.com/nathwn12/Installer2) ([upstream](https://github.com/Vencord/Installer)) — fork kept for reference; use upstream unless the repo notes otherwise.
- [pear-desktop](https://github.com/nathwn12/pear-desktop) ([upstream](https://github.com/pear-devs/pear-desktop)) — fork of the upstream Pear desktop client, kept for study; all credit to upstream.

Local open-weight work runs on LM Studio, OpenCode, and Codex, including DeepSeek V4 Flash, Gemma 4, and Qwen 3.8.

[Portfolio](https://nathwn12.github.io/) · [GitHub](https://github.com/nathwn12) · [All projects](https://github.com/nathwn12?tab=repositories) · [LinkedIn](https://www.linkedin.com/in/nathaniel-nikolai-l-184181261/) · [Email](mailto:nathanielnikolai.ladero@gmail.com)
