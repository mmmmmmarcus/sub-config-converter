import yaml from "js-yaml";

type ProxyLike = Record<string, unknown>;
type GroupLike = Record<string, unknown>;

type ClashConfig = {
  port?: number;
  socksPort?: number;
  redirPort?: number;
  mixedPort?: number;
  allowLan?: boolean;
  mode?: string;
  logLevel?: string;
  ipv6?: boolean;
  dns?: unknown;
  proxies?: ProxyLike[];
  "proxy-groups"?: GroupLike[];
  rules?: string[];
  [key: string]: unknown;
};

type RawSurgeGroup = {
  name: string;
  rawType: string;
  type: string;
  proxies: string[];
  options: Record<string, unknown>;
};

type SurgeConfig = {
  general: Record<string, string>;
  proxies: string[];
  groups: string[];
  rules: string[];
};

function splitCsvLike(input: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim()) result.push(current.trim());
  return result.filter(Boolean);
}

function coerceScalar(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed.replace(/^"|"$/g, "");
}

function normalizeVmessCipher(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "chacha20-ietf-poly1305") return "auto";
  return value;
}

function detectFormat(content: string): "clash" | "surge" {
  try {
    const parsed = yaml.load(content);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      if (
        Array.isArray(obj.proxies) ||
        Array.isArray(obj["proxy-groups"]) ||
        Array.isArray(obj.rules) ||
        obj["proxy-providers"] ||
        obj["rule-providers"]
      ) {
        return "clash";
      }
    }
  } catch {
    // noop
  }

  const lower = content.toLowerCase();
  if (lower.includes("[proxy]") || lower.includes("[proxy group]") || lower.includes("[rule]")) {
    return "surge";
  }

  throw new Error("无法识别配置格式，只支持 Clash YAML 或 Surge INI。\n");
}

function parseSurge(content: string): SurgeConfig {
  const sections = {
    general: [] as string[],
    proxy: [] as string[],
    proxyGroup: [] as string[],
    rule: [] as string[],
  };

  let current = "";
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    if (line.startsWith("//")) continue;

    const sectionMatch = line.match(/^\[(.+)]$/);
    if (sectionMatch) {
      current = sectionMatch[1].trim().toLowerCase();
      continue;
    }

    if (current === "general") sections.general.push(line);
    else if (current === "proxy") sections.proxy.push(line);
    else if (current === "proxy group") sections.proxyGroup.push(line);
    else if (current === "rule") sections.rule.push(line);
  }

  const generalMap: Record<string, string> = {};
  for (const item of sections.general) {
    const index = item.indexOf("=");
    if (index > -1) {
      const key = item.slice(0, index).trim();
      const value = item.slice(index + 1).trim();
      generalMap[key] = value;
    }
  }

  return {
    general: generalMap,
    proxies: sections.proxy,
    groups: sections.proxyGroup,
    rules: sections.rule,
  };
}

function parseSurgeGroup(line: string): RawSurgeGroup {
  const eqIndex = line.indexOf("=");
  if (eqIndex === -1) {
    return { name: line.trim(), rawType: "select", type: "select", proxies: [], options: {} };
  }

  const name = line.slice(0, eqIndex).trim();
  const parts = splitCsvLike(line.slice(eqIndex + 1));
  const rawType = String(parts.shift() || "select").toLowerCase();
  const type = rawType === "smart" ? "select" : rawType;
  const proxies: string[] = [];
  const options: Record<string, unknown> = {};

  for (const item of parts) {
    const idx = item.indexOf("=");
    if (idx > -1) {
      const key = item.slice(0, idx).trim();
      const value = item.slice(idx + 1).trim();
      options[key] = coerceScalar(value);
    } else {
      proxies.push(item);
    }
  }

  return { name, rawType, type, proxies, options };
}

function buildRegexFromPolicyFilter(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function surgeProxyLineToClash(line: string): ProxyLike {
  const eqIndex = line.indexOf("=");
  if (eqIndex === -1) return { name: line.trim(), type: "unknown", raw: line.trim() };

  const name = line.slice(0, eqIndex).trim();
  const parts = splitCsvLike(line.slice(eqIndex + 1));
  const type = String(parts.shift() || "unknown").toLowerCase();
  const server = parts.shift() || "";
  const port = Number(parts.shift() || 0);

  const proxy: ProxyLike = { name, type };
  if (server) proxy.server = server;
  if (port) proxy.port = port;

  for (const item of parts) {
    const idx = item.indexOf("=");
    if (idx === -1) continue;
    const key = item.slice(0, idx).trim();
    const value = item.slice(idx + 1).trim();

    if (type === "vmess") {
      if (key === "username") proxy.uuid = value;
      else if (key === "encrypt-method") proxy.cipher = normalizeVmessCipher(value);
      else if (key === "tls") proxy.tls = coerceScalar(value);
      else if (key === "sni") {
        proxy.servername = value;
        proxy.sni = value;
      } else if (key === "skip-cert-verify") proxy["skip-cert-verify"] = coerceScalar(value);
      else if (key === "ws" && value === "true") proxy.network = "ws";
      else if (key === "ws-path") {
        const wsOpts = (proxy["ws-opts"] as Record<string, unknown> | undefined) || {};
        wsOpts.path = value;
        proxy["ws-opts"] = wsOpts;
      } else if (key === "ws-headers") {
        const hostMatch = value.match(/Host:"?([^\"]+)"?/i);
        const wsOpts = (proxy["ws-opts"] as Record<string, unknown> | undefined) || {};
        const headers = (wsOpts.headers as Record<string, string> | undefined) || {};
        if (hostMatch?.[1]) headers.Host = hostMatch[1];
        wsOpts.headers = headers;
        proxy["ws-opts"] = wsOpts;
      } else if (key === "vmess-aead") {
        proxy.alterId = 0;
        proxy["vmess-aead"] = coerceScalar(value);
      } else {
        proxy[key] = coerceScalar(value);
      }
      continue;
    }

    if (type === "ss") {
      if (key === "encrypt-method") proxy.cipher = value;
      else proxy[key] = coerceScalar(value);
      continue;
    }

    proxy[key] = coerceScalar(value);
  }

  if (type === "vmess" && !proxy.cipher) {
    proxy.cipher = "auto";
  }

  return proxy;
}

function surgeGroupsToClash(lines: string[], proxyNames: string[]): GroupLike[] {
  const rawGroups = lines.map(parseSurgeGroup);
  const groupsByName = new Map(rawGroups.map((group) => [group.name, group]));
  const resolvedByName = new Map<string, string[]>();

  function resolveGroupMembers(groupName: string, stack = new Set<string>()): string[] {
    if (resolvedByName.has(groupName)) return resolvedByName.get(groupName) || [];
    if (stack.has(groupName)) return [];

    const group = groupsByName.get(groupName);
    if (!group) return [];

    stack.add(groupName);
    let members = [...group.proxies];

    const includeAll = Boolean(group.options["include-all-proxies"]);
    const includeOtherGroup = group.options["include-other-group"];
    const includeOtherGroups = typeof includeOtherGroup === "string" && includeOtherGroup.trim()
      ? includeOtherGroup.split(":").flatMap((item) => item.split(",")).map((v) => v.trim()).filter(Boolean)
      : [];

    if (includeAll) {
      members.push(...proxyNames);
    }

    for (const ref of includeOtherGroups) {
      members.push(ref);
    }

    const regexFilter = typeof group.options["policy-regex-filter"] === "string"
      ? buildRegexFromPolicyFilter(String(group.options["policy-regex-filter"]))
      : null;

    if (regexFilter) {
      const preserved = members.filter((item) => ["DIRECT", "REJECT"].includes(item) || groupsByName.has(item));
      const explicitNodes = members.filter((item) => proxyNames.includes(item));

      if (includeOtherGroups.length > 0) {
        members = [...preserved, ...explicitNodes];
      } else {
        const filteredNodes = unique(proxyNames).filter((name) => {
          if (!regexFilter.test(name)) return false;
          if (includeAll) return true;
          return !explicitNodes.includes(name);
        });
        members = [...preserved, ...explicitNodes, ...filteredNodes];
      }
    }

    members = unique(members);
    resolvedByName.set(groupName, members);
    return members;
  }

  return rawGroups.map((group) => {
    let proxies = resolveGroupMembers(group.name);

    if (proxies.length === 0 && typeof group.options["include-other-group"] === "string") {
      proxies = [String(group.options["include-other-group"])];
    }

    if (proxies.length === 0 && group.rawType === "smart") {
      proxies = ["DIRECT", ...proxyNames];
    }

    const clashGroup: GroupLike = {
      name: group.name,
      type: group.type,
      proxies,
    };

    if (group.rawType === "smart") clashGroup["x-surge-original-type"] = "smart";
    for (const [key, value] of Object.entries(group.options)) {
      clashGroup[key] = value;
    }
    return clashGroup;
  });
}

function clashProxyToSurgeLine(proxy: ProxyLike): string {
  const name = String(proxy.name || "Unnamed");
  const type = String(proxy.type || "unknown").toLowerCase();
  const server = String(proxy.server || "");
  const port = proxy.port ? String(proxy.port) : "";
  const extras: string[] = [];

  if (type === "vmess") {
    if (proxy.uuid) extras.push(`username=${String(proxy.uuid)}`);
    if (proxy.network === "ws") extras.push("ws=true");

    const wsOpts = (proxy["ws-opts"] as Record<string, unknown> | undefined) || {};
    if (wsOpts.path) extras.push(`ws-path=${String(wsOpts.path)}`);

    const headers = (wsOpts.headers as Record<string, unknown> | undefined) || {};
    if (headers.Host) extras.push(`ws-headers=Host:\"${String(headers.Host)}\"`);

    if (proxy.cipher) extras.push(`encrypt-method=${String(proxy.cipher)}`);
    if (proxy["vmess-aead"] !== undefined) extras.push(`vmess-aead=${String(proxy["vmess-aead"])}`);
    else extras.push("vmess-aead=true");
    if (proxy.tls !== undefined) extras.push(`tls=${String(proxy.tls)}`);
    if (proxy["skip-cert-verify"] !== undefined) extras.push(`skip-cert-verify=${String(proxy["skip-cert-verify"])}`);
    if (proxy.servername || proxy.sni) extras.push(`sni=${String(proxy.servername || proxy.sni)}`);
  } else if (type === "ss") {
    if (proxy.cipher) extras.push(`encrypt-method=${String(proxy.cipher)}`);
    if (proxy.password) extras.push(`password=${String(proxy.password)}`);
  } else if (type === "trojan") {
    if (proxy.password) extras.push(`password=${String(proxy.password)}`);
    if (proxy["skip-cert-verify"] !== undefined) extras.push(`skip-cert-verify=${String(proxy["skip-cert-verify"])}`);
    if (proxy.servername || proxy.sni) extras.push(`sni=${String(proxy.servername || proxy.sni)}`);
  }

  for (const [key, value] of Object.entries(proxy)) {
    if (
      [
        "name",
        "type",
        "server",
        "port",
        "uuid",
        "network",
        "ws-opts",
        "cipher",
        "vmess-aead",
        "tls",
        "skip-cert-verify",
        "servername",
        "sni",
        "password",
      ].includes(key)
    ) {
      continue;
    }
    if (value === undefined || value === null || value === "") continue;
    extras.push(`${key}=${String(value)}`);
  }

  return `${name} = ${[type, server, port, ...extras].filter(Boolean).join(", ")}`;
}

function clashGroupToSurgeLine(group: GroupLike): string {
  const name = String(group.name || "Group");
  const type = String(group["x-surge-original-type"] || group.type || "select");
  const proxies = Array.isArray(group.proxies) ? group.proxies.map((item) => String(item)) : [];
  const extras: string[] = [];

  for (const [key, value] of Object.entries(group)) {
    if (["name", "type", "proxies", "x-surge-original-type"].includes(key)) continue;
    if (value === undefined || value === null || value === "") continue;
    extras.push(`${key}=${String(value)}`);
  }

  return `${name} = ${[type, ...proxies, ...extras].join(", ")}`;
}

function clashRuleToSurgeLine(rule: unknown): string {
  const text = String(rule).trim();
  if (text.startsWith("MATCH,")) return text.replace(/^MATCH,/, "FINAL,");
  return text;
}

function surgeRuleToClashLine(rule: string): string {
  const cleaned = rule.split("//")[0].trim();
  if (!cleaned) return "";

  const ruleType = cleaned.split(",")[0].trim().toUpperCase();
  const unsupportedTypes = new Set([
    "USER-AGENT",
    "RULE-SET",
    "URL-REGEX",
    "DEVICE-NAME",
    "DEST-PORT",
    "IN-PORT",
    "PROTOCOL",
  ]);

  if (unsupportedTypes.has(ruleType)) return "";
  if (cleaned.startsWith("FINAL,")) return cleaned.replace(/^FINAL,/, "MATCH,");
  return cleaned;
}

export function convertConfig(content: string, target: "clash" | "surge"): string {
  const source = detectFormat(content);
  if (source === target) return content;

  if (source === "surge" && target === "clash") {
    const parsed = parseSurge(content);
    const clashProxies = parsed.proxies.map(surgeProxyLineToClash);
    const proxyNames = clashProxies.map((proxy) => String(proxy.name || "")).filter(Boolean);
    const clashGroups = surgeGroupsToClash(parsed.groups, proxyNames);

    const clash: ClashConfig = {
      port: parsed.general["port"] ? Number(parsed.general["port"]) : undefined,
      socksPort: parsed.general["socks-port"] ? Number(parsed.general["socks-port"]) : undefined,
      mixedPort: parsed.general["mixed-port"] ? Number(parsed.general["mixed-port"]) : undefined,
      allowLan: parsed.general["allow-wifi-access"] === "true",
      mode: parsed.general.mode || "rule",
      logLevel: parsed.general.loglevel || "info",
      ipv6: parsed.general.ipv6 === "true",
      proxies: clashProxies,
      "proxy-groups": clashGroups,
      rules: parsed.rules.map(surgeRuleToClashLine).filter(Boolean),
    };

    return yaml.dump(clash, {
      noRefs: true,
      lineWidth: -1,
      quotingType: '"',
    });
  }

  const parsed = yaml.load(content) as ClashConfig;
  if (!parsed || typeof parsed !== "object") throw new Error("Clash 配置解析失败。");

  const general: string[] = [];
  if (parsed.port) general.push(`port = ${parsed.port}`);
  if (parsed.socksPort) general.push(`socks-port = ${parsed.socksPort}`);
  if (parsed.redirPort) general.push(`redir-port = ${parsed.redirPort}`);
  if (parsed.mixedPort) general.push(`mixed-port = ${parsed.mixedPort}`);
  if (typeof parsed.allowLan === "boolean") general.push(`allow-wifi-access = ${parsed.allowLan}`);
  if (parsed.mode) general.push(`mode = ${String(parsed.mode).toLowerCase()}`);
  if (parsed.logLevel) general.push(`loglevel = ${parsed.logLevel}`);
  if (typeof parsed.ipv6 === "boolean") general.push(`ipv6 = ${parsed.ipv6}`);

  const proxies = Array.isArray(parsed.proxies) ? parsed.proxies.map(clashProxyToSurgeLine) : [];
  const groups = Array.isArray(parsed["proxy-groups"])
    ? (parsed["proxy-groups"] as GroupLike[]).map(clashGroupToSurgeLine)
    : [];
  const rules = Array.isArray(parsed.rules) ? parsed.rules.map(clashRuleToSurgeLine) : [];

  const sections: string[] = [];
  if (general.length) sections.push("[General]", ...general, "");
  if (proxies.length) sections.push("[Proxy]", ...proxies, "");
  if (groups.length) sections.push("[Proxy Group]", ...groups, "");
  if (rules.length) sections.push("[Rule]", ...rules, "");

  return sections.join("\n").trim() + "\n";
}
