import yaml from "js-yaml";

type ProxyLike = Record<string, unknown>;

type ClashConfig = {
  mixedPort?: number;
  socksPort?: number;
  allowLan?: boolean;
  mode?: string;
  logLevel?: string;
  dns?: unknown;
  proxies?: ProxyLike[];
  [key: string]: unknown;
};

type SurgeConfig = {
  general: Record<string, string>;
  proxies: string[];
  groups: string[];
  rules: string[];
};

function splitList(input: string): string[] {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function detectFormat(content: string): "clash" | "surge" {
  try {
    const parsed = yaml.load(content);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.proxies) || Array.isArray(obj["proxy-groups"]) || Array.isArray(obj.rules)) {
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
    if (!line || line.startsWith("#") || line.startsWith(";")) {
      continue;
    }

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

function surgeProxyLineToClash(line: string): ProxyLike {
  const eqIndex = line.indexOf("=");
  if (eqIndex === -1) {
    return { name: line.trim(), type: "unknown", raw: line.trim() };
  }

  const name = line.slice(0, eqIndex).trim();
  const rest = splitList(line.slice(eqIndex + 1));
  const type = (rest.shift() || "unknown").toLowerCase();

  const proxy: ProxyLike = { name, type };

  if (type === "ss" || type === "trojan" || type === "http" || type === "socks5") {
    proxy.server = rest.shift() || "";
    const port = Number(rest.shift() || 0);
    if (port) proxy.port = port;
  } else if (type === "vmess") {
    proxy.server = rest.shift() || "";
    const port = Number(rest.shift() || 0);
    if (port) proxy.port = port;
    const username = rest.shift();
    if (username) proxy.uuid = username;
  }

  for (const item of rest) {
    const eqIndex = item.indexOf("=");
    if (eqIndex > -1) {
      const key = item.slice(0, eqIndex).trim();
      const value = item.slice(eqIndex + 1).trim();
      proxy[key] = /^\d+$/.test(value) ? Number(value) : value;
    }
  }

  return proxy;
}

function surgeGroupLineToClash(line: string): Record<string, unknown> {
  const firstComma = line.indexOf("=");
  if (firstComma === -1) {
    return { name: line.trim(), type: "select", proxies: [] };
  }

  const name = line.slice(0, firstComma).trim();
  const rest = splitList(line.slice(firstComma + 1));
  const rawType = (rest.shift() || "select").toLowerCase();
  const typeMap: Record<string, string> = {
    select: "select",
    "url-test": "url-test",
    fallback: "fallback",
    "load-balance": "load-balance",
  };

  const group: Record<string, unknown> = {
    name,
    type: typeMap[rawType] || "select",
    proxies: [] as string[],
  };

  const proxies: string[] = [];

  for (const item of rest) {
    if (item.includes("=")) {
      const [key, ...valueParts] = item.split("=");
      const value = valueParts.join("=").trim();
      group[key.trim()] = /^\d+$/.test(value) ? Number(value) : value;
    } else {
      proxies.push(item);
    }
  }

  group.proxies = proxies;
  return group;
}

function clashProxyToSurgeLine(proxy: ProxyLike): string {
  const name = String(proxy.name || "Unnamed");
  const type = String(proxy.type || "unknown").toLowerCase();
  const server = String(proxy.server || "");
  const port = proxy.port ? String(proxy.port) : "";
  const extras: string[] = [];

  for (const [key, value] of Object.entries(proxy)) {
    if (["name", "type", "server", "port"].includes(key)) continue;
    if (value === undefined || value === null || value === "") continue;
    extras.push(`${key}=${String(value)}`);
  }

  const base = [name, type, server, port].filter(Boolean);
  return [...base, ...extras].join(", ");
}

function clashGroupToSurgeLine(group: Record<string, unknown>): string {
  const name = String(group.name || "Group");
  const type = String(group.type || "select");
  const proxies = Array.isArray(group.proxies)
    ? group.proxies.map((item) => String(item))
    : [];

  const extras: string[] = [];
  for (const [key, value] of Object.entries(group)) {
    if (["name", "type", "proxies"].includes(key)) continue;
    if (value === undefined || value === null || value === "") continue;
    extras.push(`${key}=${String(value)}`);
  }

  return `${name} = ${[type, ...proxies, ...extras].join(", ")}`;
}

function clashRuleToSurgeLine(rule: unknown): string {
  return String(rule);
}

function surgeRuleToClashLine(rule: string): string {
  return rule;
}

export function convertConfig(content: string, target: "clash" | "surge"): string {
  const source = detectFormat(content);

  if (source === target) {
    return content;
  }

  if (source === "surge" && target === "clash") {
    const parsed = parseSurge(content);
    const clash: ClashConfig = {
      mixedPort: parsed.general["mixed-port"] ? Number(parsed.general["mixed-port"]) : undefined,
      socksPort: parsed.general["socks-port"] ? Number(parsed.general["socks-port"]) : undefined,
      allowLan: parsed.general["allow-wifi-access"] === "true",
      mode: parsed.general.mode || "rule",
      logLevel: parsed.general["loglevel"] || "info",
      proxies: parsed.proxies.map(surgeProxyLineToClash),
      "proxy-groups": parsed.groups.map(surgeGroupLineToClash),
      rules: parsed.rules.map(surgeRuleToClashLine),
    };

    return yaml.dump(clash, {
      noRefs: true,
      lineWidth: -1,
      quotingType: '"',
    });
  }

  const parsed = yaml.load(content) as ClashConfig;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Clash 配置解析失败。");
  }

  const general: string[] = [];
  if (parsed.mixedPort) general.push(`mixed-port = ${parsed.mixedPort}`);
  if (parsed.socksPort) general.push(`socks-port = ${parsed.socksPort}`);
  if (typeof parsed.allowLan === "boolean") general.push(`allow-wifi-access = ${parsed.allowLan}`);
  if (parsed.mode) general.push(`mode = ${parsed.mode}`);
  if (parsed.logLevel) general.push(`loglevel = ${parsed.logLevel}`);

  const proxies = Array.isArray(parsed.proxies) ? parsed.proxies.map(clashProxyToSurgeLine) : [];
  const groups = Array.isArray(parsed["proxy-groups"])
    ? (parsed["proxy-groups"] as Record<string, unknown>[]).map(clashGroupToSurgeLine)
    : [];
  const rules = Array.isArray(parsed.rules) ? parsed.rules.map(clashRuleToSurgeLine) : [];

  const sections: string[] = [];
  if (general.length) sections.push("[General]", ...general, "");
  if (proxies.length) sections.push("[Proxy]", ...proxies, "");
  if (groups.length) sections.push("[Proxy Group]", ...groups, "");
  if (rules.length) sections.push("[Rule]", ...rules, "");

  return sections.join("\n").trim() + "\n";
}
