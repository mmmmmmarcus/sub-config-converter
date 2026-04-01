# Sub Config Converter

一个极简的 Surge / Clash 配置互转工具，适合直接部署到 Vercel。

## 功能

- 上传本地配置文件
- 自动识别 Surge / Clash
- 输出为另一种格式
- 支持直接下载结果文件

## 技术栈

- Next.js App Router
- TypeScript
- js-yaml
- ini

## 本地运行

```bash
npm install
npm run dev
```

## 部署到 Vercel

```bash
vercel
```

## 说明

这是一个“纯转换”版本：

- 不抓订阅链接
- 不做规则增强
- 不做远程拉取
- 只处理上传的 Surge / Clash 配置文本

当前实现以常见配置段为主：

- Clash: `proxies` / `proxy-groups` / `rules`
- Surge: `[Proxy]` / `[Proxy Group]` / `[Rule]` / `[General]`

如果输入里有非常平台特定、很复杂的高级字段，结果会尽量保留，但不保证 100% 语义完全等价。
