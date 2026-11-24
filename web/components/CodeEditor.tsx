"use client";
import Editor, { loader } from "@monaco-editor/react";

// Load Monaco from our own server (copied into public/ on install) instead of a CDN.
// The URL must be absolute: Monaco's language workers can't resolve relative paths.
// (This module only ever loads in the browser; see the dynamic imports.)
loader.config({ paths: { vs: `${window.location.origin}/monaco/vs` } });

export default function CodeEditor({
  value, onChange, language, readOnly = false,
}: {
  value: string;
  onChange?: (v: string) => void;
  language: "javascript" | "python" | "html";
  readOnly?: boolean;
}) {
  return (
    <Editor
      value={value}
      language={language}
      onChange={(v) => onChange?.(v ?? "")}
      theme="vs-dark"
      loading={<div className="p-4 text-slate-400">Loading editor…</div>}
      options={{
        readOnly,
        fontSize: 16,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        tabSize: language === "python" ? 4 : 2,
        automaticLayout: true,
        wordWrap: "on",
      }}
    />
  );
}
