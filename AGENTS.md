<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md

## Project mission

This repo is a **minimal Surge / Clash core config converter**.

It is **not** a full-fidelity subscription ecosystem migrator.
The goal is to make real-world configs usable after conversion, with special focus on:

- proxy nodes
- proxy groups
- rules
- a small subset of basic global fields

Priority order:
1. produce importable output
2. preserve practical usability
3. preserve as much structure as possible
4. avoid pretending unsupported sections are fully converted

## Product boundary

### In scope
- Surge -> Clash
- Clash -> Surge
- Core node types:
  - `ss`
  - `trojan`
  - `vmess`
- Core group types:
  - `select`
  - `url-test`
  - downgraded `smart`
- Core rules:
  - `DOMAIN`
  - `DOMAIN-SUFFIX`
  - `PROCESS-NAME`
  - `IP-CIDR`
  - `GEOIP`
  - `MATCH` / `FINAL`
- Basic globals:
  - ports
  - `mode`
  - `log-level` / `loglevel`
  - `ipv6`

### Out of scope for semantic parity
Do **not** claim 1:1 conversion for these unless explicit support is added:

- Surge-specific sections:
  - `[Ponte]`
  - `[Host]`
  - `[URL Rewrite]`
  - `[MITM]`
- Clash-specific sections:
  - `dns`
  - `script`
  - `clash-for-android`
  - full provider semantics

These may be ignored, downgraded, or later surfaced as warnings/comments.

## Source of truth

Before changing conversion behavior, check:

1. `docs/mapping.md` — intended mapping rules and scope
2. `docs/todo.md` — open work
3. `fixtures/` — sanitized regression inputs
4. `scripts/test-converter.mjs` — fixture-driven regression run

If code behavior and mapping doc disagree, fix one of them immediately.

## Sensitive data policy

Real user config files may contain:
- node hostnames
- passwords
- UUIDs
- provider subscription URLs
- certificate blobs
- API endpoints

Rules:
- **Never commit raw user config files**
- Only commit sanitized fixtures
- If adding a new fixture, scrub:
  - passwords
  - UUIDs
  - provider URLs
  - certificate material
  - controller credentials

## Implementation principles

### 1. Importability beats theoretical purity
If a target platform rejects a field, prefer a safe compatible downgrade.
Example:
- vmess `chacha20-ietf-poly1305` in Surge should become Clash-compatible `cipher: auto`

### 2. No empty proxy groups
Every generated Clash proxy group must have usable `proxies` or `use`.
If a Surge group would otherwise collapse, expand members conservatively.

### 3. Expand groups when practical
For Surge -> Clash, these options are important and should be used when possible:
- `include-all-proxies`
- `include-other-group`
- `policy-regex-filter`

The target outcome is that imported Clash groups remain manually selectable and useful.

### 4. Unsupported rules should not break import
If Surge rules are unsupported by Clash, prefer filtering them out over emitting invalid output.
Examples currently treated as unsupported in Clash conversion:
- `USER-AGENT`
- `RULE-SET`
- `URL-REGEX`
- other platform-specific rule kinds not accepted by Clash/Mihomo

### 5. Do not silently widen scope
When adding support for advanced sections, update:
- `docs/mapping.md`
- regression fixtures/tests
- UI/API warnings if needed

## Local workflow

When modifying conversion logic:

```bash
npm run test:converter
npm run lint
npm run build
```

Do not consider a conversion change done unless all three pass.

## Fixtures and testing

Use fixture-driven development.

Current fixture types:
- `fixtures/surge-minimal.conf`
- `fixtures/clash-minimal.yaml`
- `fixtures/surge-realistic.sanitized.conf`
- `fixtures/clash-realistic.sanitized.yaml`

When fixing a real bug reported by the user:
1. reproduce it with a sanitized fixture if possible
2. update converter logic
3. rerun `npm run test:converter`
4. only then regenerate manual output files

## UI/API expectations

This app should stay simple.
Avoid feature creep.

Desired UI shape:
- upload file
- choose target format
- convert
- download result

Avoid adding:
- subscription fetching
- remote URL pulling
- rule marketplace logic
- large preset systems
unless explicitly requested.

## Commit guidance

Prefer small, explicit commits such as:
- `fix: normalize vmess cipher for clash`
- `fix: expand surge smart groups into clash proxies`
- `docs: clarify unsupported config sections`

## If you are unsure

Do not guess about platform-specific semantics.
Prefer one of these actions:
- inspect a real sample
- add a downgrade rule
- surface a warning
- document the limitation in `docs/mapping.md`
