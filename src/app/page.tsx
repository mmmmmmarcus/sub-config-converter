"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import styles from "./page.module.css";

type TargetFormat = "clash" | "surge";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState<TargetFormat>("surge");
  const [output, setOutput] = useState("");
  const [downloadName, setDownloadName] = useState("converted.conf");
  const [downloadMime, setDownloadMime] = useState("text/plain;charset=utf-8");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const downloadUrl = useMemo(() => {
    if (!output) return "";
    return URL.createObjectURL(new Blob([output], { type: downloadMime }));
  }, [output, downloadMime]);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] || null;
    setFile(nextFile);
    setError("");
    setOutput("");
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError("先选一个 Surge 或 Clash 配置文件。");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("target", target);

      const response = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "转换失败");
      }

      setOutput(data.output);
      setDownloadName(data.filename || (target === "clash" ? "converted.yaml" : "converted.conf"));
      setDownloadMime(data.mimeType || (target === "clash" ? "application/x-yaml;charset=utf-8" : "text/plain;charset=utf-8"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "转换失败");
      setOutput("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1>订阅配置互转</h1>
          <p>上传一个 Surge 或 Clash 配置文件，网页负责在两者之间做最小转换。</p>
        </section>

        <form className={styles.card} onSubmit={onSubmit}>
          <label className={styles.uploadBox}>
            <span>选择配置文件</span>
            <input type="file" accept=".conf,.yaml,.yml,.txt,text/plain,application/x-yaml,text/yaml" onChange={onFileChange} />
            <strong>{file ? file.name : "点击选择文件"}</strong>
          </label>

          <div className={styles.controls}>
            <label>
              输出格式
              <select value={target} onChange={(e) => setTarget(e.target.value as TargetFormat)}>
                <option value="surge">Surge</option>
                <option value="clash">Clash</option>
              </select>
            </label>

            <button className={styles.primary} type="submit" disabled={loading}>
              {loading ? "转换中..." : "开始转换"}
            </button>
          </div>
        </form>

        {error ? <p className={styles.error}>{error}</p> : null}

        {output ? (
          <section className={styles.result}>
            <div className={styles.resultHeader}>
              <h2>转换结果</h2>
              <a className={styles.secondary} href={downloadUrl} download={downloadName}>
                下载文件
              </a>
            </div>
            <pre>{output}</pre>
          </section>
        ) : null}
      </main>
    </div>
  );
}
