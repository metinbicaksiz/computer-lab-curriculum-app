// Runs student code safely:
//  - In a Web Worker, so an infinite loop can't freeze the page. Each run has a
//    time limit; on timeout the worker is killed and replaced.
//  - Inside a hidden <iframe sandbox="allow-scripts">, which gives the code an
//    opaque origin. Without it, code could call /api/* with the logged-in
//    user's cookie, so a teacher running a student's capstone could have their
//    account used against them. In the sandbox the code can't use anyone's login.

export type OutputLine = { kind: "out" | "err"; text: string };
export type RunResult = { lines: OutputLine[]; output: string; ok: boolean; timedOut: boolean };

const JS_WORKER = `
const fmt = (v) => {
  if (typeof v === "string") return v;
  if (v === undefined) return "undefined";
  if (typeof v === "function") return v.toString();
  try { return JSON.stringify(v); } catch { return String(v); }
};
const send = (kind) => (...args) => postMessage({ type: "line", kind, text: args.map(fmt).join(" ") });
self.console = { log: send("out"), info: send("out"), warn: send("err"), error: send("err") };
self.alert = send("out");
onmessage = (e) => {
  try {
    new Function(e.data.code)();
    postMessage({ type: "done", ok: true });
  } catch (err) {
    postMessage({ type: "line", kind: "err", text: (err && err.name ? err.name + ": " : "") + (err && err.message ? err.message : String(err)) });
    postMessage({ type: "done", ok: false });
  }
};
`;

// Workers created from a Blob have no base URL, so Pyodide's location must be absolute.
const pyWorker = (origin: string) => `
const ready = import("${origin}/pyodide/pyodide.mjs")
  .then(({ loadPyodide }) => loadPyodide({ indexURL: "${origin}/pyodide/" }))
  .then((py) => {
  py.setStdout({ batched: (text) => postMessage({ type: "line", kind: "out", text }) });
  py.setStderr({ batched: (text) => postMessage({ type: "line", kind: "err", text }) });
  py.setStdin({ stdin: () => { throw new Error("input() isn't available here yet. Put the value in a variable instead."); } });
  return py;
});
onmessage = async (e) => {
  let py;
  try {
    py = await ready;
  } catch (err) {
    postMessage({ type: "line", kind: "err", text: "Python failed to load: " + (err && err.message ? err.message : err) });
    postMessage({ type: "done", ok: false });
    return;
  }
  postMessage({ type: "ready" });
  const scope = py.globals.get("dict")();
  try {
    await py.runPythonAsync(e.data.code, { globals: scope });
    postMessage({ type: "done", ok: true });
  } catch (err) {
    // Keep just the useful end of the traceback, without Pyodide's internal frames.
    const msg = String(err && err.message ? err.message : err);
    const lines = msg.split("\\n");
    const start = lines.findIndex((l) => l.includes('File "<exec>"'));
    postMessage({ type: "line", kind: "err", text: (start >= 0 ? lines.slice(start) : lines.slice(-3)).join("\\n").trim() });
    postMessage({ type: "done", ok: false });
  } finally {
    scope.destroy();
  }
};
`;

type Lang = "javascript" | "python";

// The page inside the sandbox iframe: it starts the worker and relays messages
// between it and us. Worker source is JSON-encoded, with "<" escaped so nothing
// in it can close the <script> tag.
// In an opaque-origin sandbox, Chromium/Edge refuse module workers made from
// blob: URLs, but allow them from data: URLs (Pyodide needs a module worker).
function sandboxPage(workerSrc: string, type: WorkerType) {
  const src = JSON.stringify(workerSrc).replace(/</g, "\\u003c");
  const url = type === "module"
    ? `"data:text/javascript," + encodeURIComponent(${src})`
    : `URL.createObjectURL(new Blob([${src}], { type: "text/javascript" }))`;
  return `<!doctype html><script>
const w = new Worker(${url}, { type: "${type}" });
w.onmessage = (e) => parent.postMessage(e.data, "*");
w.onerror = (e) => {
  parent.postMessage({ type: "line", kind: "err", text: "The code runner failed to start: " + (e.message || "unknown error") }, "*");
  parent.postMessage({ type: "done", ok: false }, "*");
};
onmessage = (e) => { if (e.source === parent) w.postMessage(e.data); };
parent.postMessage({ type: "sandbox-ready" }, "*");
</script>`;
}

type Sandbox = {
  frame: HTMLIFrameElement;
  ready: Promise<void>;
  markReady: () => void;
  onmessage: ((m: any) => void) | null;
};
const sandboxes: Partial<Record<Lang, Sandbox>> = {};
let listening = false;

function getSandbox(lang: Lang): Sandbox {
  const existing = sandboxes[lang];
  if (existing) return existing;
  if (!listening) {
    listening = true;
    // Only accept messages from our own sandbox frames.
    window.addEventListener("message", (e) => {
      for (const sb of Object.values(sandboxes)) {
        if (!sb || e.source !== sb.frame.contentWindow) continue;
        if (e.data?.type === "sandbox-ready") sb.markReady();
        else sb.onmessage?.(e.data);
      }
    });
  }
  const frame = document.createElement("iframe");
  frame.title = `${lang} code runner`;
  // allow-scripts WITHOUT allow-same-origin = opaque origin: no cookies, no access to our API.
  frame.setAttribute("sandbox", "allow-scripts");
  frame.style.display = "none";
  // Pyodide only supports module workers. Its files are fetched cross-origin
  // from the sandbox, so /pyodide/* is served with CORS (see next.config.ts).
  frame.srcdoc = lang === "javascript"
    ? sandboxPage(JS_WORKER, "classic")
    : sandboxPage(pyWorker(location.origin), "module");
  let markReady = () => {};
  const ready = new Promise<void>((r) => (markReady = r));
  const sb: Sandbox = { frame, ready, markReady, onmessage: null };
  sandboxes[lang] = sb;
  document.body.appendChild(frame);
  return sb;
}

/** Removing the iframe also kills its worker. */
function killSandbox(lang: Lang) {
  sandboxes[lang]?.frame.remove();
  delete sandboxes[lang];
}

/** Start loading Python early, since Pyodide takes a few seconds the first time. */
export function warmUp(lang: Lang) {
  getSandbox(lang);
}

export async function runCode(
  lang: Lang,
  code: string,
  { timeoutMs = 5000, onLine }: { timeoutMs?: number; onLine?: (l: OutputLine) => void } = {},
): Promise<RunResult> {
  const sb = getSandbox(lang);
  const started = await Promise.race([
    sb.ready.then(() => true),
    new Promise<boolean>((r) => setTimeout(() => r(false), 10_000)),
  ]);
  if (!started) {
    killSandbox(lang);
    const l: OutputLine = { kind: "err", text: "The code runner didn't start. Reload the page and try again." };
    onLine?.(l);
    return { lines: [l], output: "", ok: false, timedOut: false };
  }
  const lines: OutputLine[] = [];
  return new Promise((resolve) => {
    const finish = (ok: boolean, timedOut = false) => {
      clearTimeout(timer);
      sb.onmessage = null;
      if (timedOut) killSandbox(lang);
      const output = lines.filter((l) => l.kind === "out").map((l) => l.text).join("\n");
      resolve({ lines, output, ok, timedOut });
    };
    // Python: the clock starts once Pyodide has loaded, not while it downloads.
    let timer = lang === "javascript" ? setTimeout(() => timeout(), timeoutMs) : setTimeout(() => timeout(), 60000);
    const timeout = () => {
      const l: OutputLine = { kind: "err", text: `Stopped: your program ran longer than ${timeoutMs / 1000}s. Is there a loop that never ends?` };
      lines.push(l);
      onLine?.(l);
      finish(false, true);
    };
    sb.onmessage = (m) => {
      if (m.type === "ready") {
        clearTimeout(timer);
        timer = setTimeout(timeout, timeoutMs);
      } else if (m.type === "line") {
        // batched stdout may contain several lines at once
        for (const text of String(m.text).split("\n")) {
          const l: OutputLine = { kind: m.kind, text };
          lines.push(l);
          onLine?.(l);
        }
      } else if (m.type === "done") {
        finish(m.ok);
      }
    };
    // The sandbox has an opaque origin, so "*" is the only target that reaches it.
    // Only the student's code is sent, nothing private.
    sb.frame.contentWindow?.postMessage({ code }, "*");
  });
}

/** For HTML lessons: which required CSS selectors are missing from the page? */
export function missingSelectors(html: string, required: string): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return required.split("\n").map((s) => s.trim()).filter(Boolean).filter((sel) => {
    try {
      return !doc.querySelector(sel);
    } catch {
      return true;
    }
  });
}

/** Same rule as the server: ignore trailing spaces and trailing blank lines. */
export function outputMatches(actual: string, expected: string) {
  const norm = (s: string) => s.replace(/\r\n/g, "\n").split("\n").map((l) => l.trimEnd()).join("\n").trim();
  return norm(actual) === norm(expected);
}
