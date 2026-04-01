import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
];

for (const [inputFile, target, outputFile] of cases) {
  const input = fs.readFileSync(path.join(fixturesDir, inputFile), "utf8");
  const output = convertConfig(input, target);
  fs.writeFileSync(path.join(outDir, outputFile), output);
  console.log(`ok: ${inputFile} -> ${outputFile}`);
}
