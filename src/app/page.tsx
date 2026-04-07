"use client";

import { ChangeEvent, DragEvent, useEffect, useState } from "react";
import styles from "./page.module.css";

type ConfigFormat = "clash" | "surge";

function detectSourceFormat(file: File, content: string): ConfigFormat | null {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".yaml") || lowerName.endsWith(".yml")) return "clash";
  if (lowerName.endsWith(".conf")) return "surge";

  const lower = content.toLowerCase();
  if (lower.includes("[proxy]") || lower.includes("[proxy group]") || lower.includes("[rule]")) return "surge";
  if (lower.includes("proxy-groups:") || lower.includes("proxies:") || lower.includes("rules:")) return "clash";
  return null;
}

function nextTargetFormat(source: ConfigFormat): ConfigFormat {
  return source === "clash" ? "surge" : "clash";
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [output, setOutput] = useState("");
  const [downloadName, setDownloadName] = useState("converted.conf");
  const [downloadMime, setDownloadMime] = useState("text/plain;charset=utf-8");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    if (!output) {
      setDownloadUrl("");
      return;
    }
    const url = URL.createObjectURL(new Blob([output], { type: downloadMime }));
    setDownloadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [output, downloadMime]);

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;
    await convertFile(nextFile);
  };

  const convertFile = async (nextFile: File) => {
    setFile(nextFile);
    setError("");
    setOutput("");
    setLoading(true);

    try {
      const content = await nextFile.text();
      const source = detectSourceFormat(nextFile, content);
      if (!source) {
        throw new Error("无法识别配置格式，只支持 Clash YAML 或 Surge INI。");
      }
      const target = nextTargetFormat(source);
      const formData = new FormData();
      formData.append("file", nextFile);
      formData.append("target", target);

      const response = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "转换失败");
      }

      setOutput(data.output || "");
      setDownloadName(data.filename || (target === "clash" ? "converted.yaml" : "converted.conf"));
      setDownloadMime(data.mimeType || (target === "clash" ? "application/x-yaml;charset=utf-8" : "text/plain;charset=utf-8"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "转换失败");
      setOutput("");
    } finally {
      setLoading(false);
    }
  };

  const onDrop = async (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const dropped = event.dataTransfer.files?.[0];
    if (!dropped) return;
    await convertFile(dropped);
  };

  const isAfterConvert = Boolean(output && downloadUrl);
  const hintText = loading ? "Converting..." : "Drop your Clash/Surge config file here.";

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.title}>SubConverter</h1>

        <section className={styles.card}>
          <label
            className={`${styles.dropFrame} ${isDragOver ? styles.dragOver : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={onDrop}
          >
            <input
              type="file"
              accept=".conf,.yaml,.yml,.txt,text/plain,application/x-yaml,text/yaml"
              onChange={onFileChange}
              disabled={loading}
            />
            {isAfterConvert ? (
              <>
                <div className={styles.fileStack}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.fileIcon}>
                    <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                  </svg>
                  <p className={styles.filename}>{file?.name || "filename.config"}</p>
                </div>
                <a
                  className={styles.downloadButton}
                  href={downloadUrl}
                  download={downloadName}
                  onClick={(event) => event.stopPropagation()}
                >
                  Download
                </a>
              </>
            ) : (
              <p className={styles.hint}>{hintText}</p>
            )}
          </label>
        </section>

        {error ? <p className={styles.error}>{error}</p> : null}
      </main>
    </div>
  );
}
