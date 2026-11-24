"use client";
import dynamic from "next/dynamic";

// Client-only Monaco, for pages that don't otherwise need dynamic imports.
const CodeEditorLazy = dynamic(() => import("./CodeEditor"), { ssr: false });
export default CodeEditorLazy;
