# TODO

## Phase 1 - Core correctness
- [ ] Parse Surge proxy lines with `=` correctly
- [ ] Parse Surge vmess `username` -> Clash `uuid`
- [ ] Parse Surge ws fields into Clash `network` + `ws-opts`
- [ ] Parse Surge trojan tls/sni/skip-cert-verify
- [ ] Convert Clash vmess back to Surge vmess fields
- [ ] Convert Clash ss cipher -> Surge encrypt-method
- [ ] Convert Clash groups `select` / `url-test`
- [ ] Convert Surge `smart` as downgraded Clash `select`
- [ ] Convert Surge `FINAL` <-> Clash `MATCH`

## Phase 2 - Safer degradation
- [ ] Preserve unsupported sections as comment blocks in output metadata header
- [ ] Preserve unconvertible group options as comments
- [ ] Add warnings list in API response

## Phase 3 - Regression safety
- [ ] Add sanitized real-world fixtures
- [ ] Add round-trip test script
- [ ] Add sample-based expectations for core nodes / groups / rules
