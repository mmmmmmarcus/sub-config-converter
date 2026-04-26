# TODO

## Phase 1 - Core correctness
- [x] Parse Surge proxy lines with `=` correctly
- [x] Parse Surge vmess `username` -> Clash `uuid`
- [x] Parse Surge ws fields into Clash `network` + `ws-opts`
- [x] Parse Surge trojan tls/sni/skip-cert-verify
- [x] Convert Clash vmess back to Surge vmess fields
- [x] Convert Clash ss cipher -> Surge encrypt-method
- [x] Convert Clash groups `select` / `url-test`
- [x] Convert Surge `smart` as downgraded Clash `select`
- [x] Convert Surge `FINAL` <-> Clash `MATCH`
- [x] Default Clash vmess `alterId: 0` / `cipher: auto` / `udp: true` when needed for importability
- [x] Default Clash trojan `udp: true`
- [x] Filter unsupported Surge `USER-AGENT` rules from Clash output
- [x] Drop unsupported `FINAL` tail flags like `dns-failed` in Clash output

## Phase 2 - Safer degradation
- [ ] Preserve unsupported sections as comment blocks in output metadata header
- [ ] Preserve unconvertible group options as comments
- [ ] Add warnings list in API response

## Phase 3 - Regression safety
- [ ] Add sanitized real-world fixtures
- [ ] Add round-trip test script
- [ ] Add sample-based expectations for core nodes / groups / rules
