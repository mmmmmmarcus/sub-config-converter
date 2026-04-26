# Mapping Plan

> Goal: make this project a **core Surge / Clash config converter**, not a full-fidelity ecosystem cloner.

## Supported conversion scope

### Fully supported (target behavior)
- Proxies
  - `ss`
  - `trojan`
  - `vmess`
- Groups
  - `select`
  - `url-test`
- Rules
  - `DOMAIN`
  - `DOMAIN-SUFFIX`
  - `PROCESS-NAME`
  - `IP-CIDR`
  - `GEOIP`
  - `MATCH` / `FINAL`
- Basic global fields
  - ports
  - `mode`
  - `log-level` / `loglevel`
  - `ipv6`

### Supported with downgrade / partial preservation
- Surge groups
  - `smart` -> downgrade to `select` or `url-test`
  - `include-all-proxies`
  - `include-other-group`
  - `policy-regex-filter`
  - `hidden`
  - `no-alert`
- Clash providers
  - `proxy-providers`
  - `rule-providers`

### Out of scope for semantic conversion
These should be preserved as comments / metadata when possible, but not treated as equivalent config:

- Surge-only complex sections
  - `[Ponte]`
  - `[Host]`
  - `[URL Rewrite]`
  - `[MITM]`
- Clash-only complex sections
  - `dns`
  - `script`
  - `clash-for-android`

## Proxy field mapping

### Surge -> Clash

#### SS
- `encrypt-method` -> `cipher`
- `password` -> `password`
- `server` / `port` -> same names

#### Trojan
- `password` -> `password`
- `sni` -> `sni`
- `skip-cert-verify` -> `skip-cert-verify`
- default `udp: true` for broader Clash/Mihomo import compatibility
- `server` / `port` -> same names

#### VMess
- `username` -> `uuid`
- `encrypt-method` -> `cipher`
- missing / unsupported vmess cipher -> normalize to `cipher: auto`
- `ws=true` -> `network: ws`
- `ws-path` -> `ws-opts.path`
- `ws-headers=Host:"x"` -> `ws-opts.headers.Host: x`
- `tls=true` -> `tls: true`
- `sni` -> emit both `sni` and `servername` when useful for compatibility
- `skip-cert-verify` -> `skip-cert-verify`
- default `alterId: 0`
- default `udp: true` for broader Clash/Mihomo import compatibility
- `vmess-aead=true` -> preserve flag and ensure `alterId: 0`

### Clash -> Surge

#### SS
- `cipher` -> `encrypt-method`
- `password` -> `password`

#### Trojan
- `password` -> `password`
- `sni` / `servername` -> `sni`
- `skip-cert-verify` -> `skip-cert-verify`

#### VMess
- `uuid` -> `username`
- `cipher` -> `encrypt-method`
- `network: ws` -> `ws=true`
- `ws-opts.path` -> `ws-path`
- `ws-opts.headers.Host` -> `ws-headers=Host:"..."`
- `tls: true` -> `tls=true`
- `servername` / `sni` -> `sni=...`
- `skip-cert-verify` -> `skip-cert-verify`

## Group mapping

### Direct mapping
- Clash `select` <-> Surge `select`
- Clash `url-test` <-> Surge `url-test`

### Downgrade rules
- Surge `smart` -> Clash `select` (default) unless a better explicit strategy is later implemented
- Surge regex/group inclusion options should be preserved as metadata comments when direct Clash representation is impossible
- Clash `use:` provider references should remain provider-oriented where possible; when converting to Surge, downgrade to explicit `policy-path` style is **out of scope** for now

## Rule mapping

### Direct mapping
- `DOMAIN`
- `DOMAIN-SUFFIX`
- `PROCESS-NAME`
- `IP-CIDR`
- `GEOIP`

### Final fallback
- Surge `FINAL,Policy,...` -> Clash `MATCH,Policy`
- Ignore extra Surge tail flags after `FINAL` (example: `dns-failed`) because they can break Clash import
- Clash `MATCH,Policy` -> Surge `FINAL,Policy`

## Real-sample notes

Based on the provided real files:
- The Surge file contains sensitive node credentials and certificate material; do not commit it.
- The Clash file contains remote provider URLs; do not commit it.
- Tests should use sanitized fixtures only.
- Real-world Clash compatibility needs are stricter than field-name parity; prefer importable output over preserving every Surge nuance.

## Immediate implementation plan
1. Upgrade parser to understand `name = type, host, port, key=value...`
2. Add vmess websocket/tls field mapping
3. Add safer group parsing for `select` / `url-test` / `smart`
4. Normalize `FINAL` <-> `MATCH`
5. Keep unsupported sections as ignored blocks for now
