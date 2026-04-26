import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { convertConfig } from "../src/lib/converter.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, "../fixtures");
const outDir = path.resolve(__dirname, "../tmp-test-output");
fs.mkdirSync(outDir, { recursive: true });

const cases = [
  ["surge-minimal.conf", "clash", "surge-minimal.to-clash.yaml"],
  ["clash-minimal.yaml", "surge", "clash-minimal.to-surge.conf"],
  ["surge-realistic.sanitized.conf", "clash", "surge-realistic.to-clash.yaml"],
  ["clash-realistic.sanitized.yaml", "surge", "clash-realistic.to-surge.conf"],
  ["surge-vmess-without-cipher.conf", "clash", "surge-vmess-without-cipher.to-clash.yaml"],
];

for (const [inputFile, target, outputFile] of cases) {
  const input = fs.readFileSync(path.join(fixturesDir, inputFile), "utf8");
  const output = convertConfig(input, target);
  const outputPath = path.join(outDir, outputFile);
  const expectedPath = path.join(fixturesDir, outputFile);

  fs.writeFileSync(outputPath, output);

  if (fs.existsSync(expectedPath)) {
    const expected = fs.readFileSync(expectedPath, "utf8");
    if (output !== expected) {
      throw new Error(`fixture mismatch: ${inputFile} -> ${outputFile}`);
    }
  }

  if (inputFile === "surge-realistic.sanitized.conf" && target === "clash") {
    const parsed = yaml.load(output);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("realistic surge fixture did not produce valid clash yaml");
    }

    const config = parsed;
    const proxies = Array.isArray(config.proxies) ? config.proxies : [];
    const rules = Array.isArray(config.rules) ? config.rules : [];
    const vmess = proxies.find((proxy) => proxy && proxy.type === "vmess");
    const trojan = proxies.find((proxy) => proxy && proxy.type === "trojan");

    if (!vmess) throw new Error("expected at least one vmess proxy in realistic clash output");
    if (vmess.alterId !== 0) throw new Error("expected vmess alterId to default to 0");
    if (vmess.cipher !== "auto") throw new Error("expected vmess cipher to normalize to auto");
    if (vmess.udp !== true) throw new Error("expected vmess udp=true for clash compatibility");
    if (!vmess["ws-opts"]?.path) throw new Error("expected vmess ws-opts.path in clash output");

    if (!trojan) throw new Error("expected at least one trojan proxy in realistic clash output");
    if (trojan.udp !== true) throw new Error("expected trojan udp=true in clash output");
    if (!trojan.sni) throw new Error("expected trojan sni in clash output");

    if (rules.some((rule) => String(rule).startsWith("USER-AGENT,"))) {
      throw new Error("expected USER-AGENT rules to be filtered from clash output");
    }
    if (rules.some((rule) => String(rule).includes("dns-failed"))) {
      throw new Error("expected FINAL extras like dns-failed to be dropped in clash MATCH rule");
    }
  }

  console.log(`ok: ${inputFile} -> ${outputFile}`);
}
