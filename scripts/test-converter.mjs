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

  console.log(`ok: ${inputFile} -> ${outputFile}`);
}
