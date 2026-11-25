"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "@/components/Markdown";
import TopBar from "@/components/TopBar";
import { api, homeFor, type Lesson } from "@/lib/api";
import { missingSelectors, runCode, warmUp, type OutputLine } from "@/lib/runners";
import { useMe } from "@/lib/useMe";

// Editors touch the DOM, so they only load in the browser.
const CodeEditor = dynamic(() => import("@/components/CodeEditor"), { ssr: false });
const BlocklyEditor = dynamic(() => import("@/components/BlocklyEditor"), { ssr: false });

type Result = { passed: boolean; message: string } | null;

export default function LessonPage() {
  const { slug } = useParams<{ slug: string }>();
  const me = useMe();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [blocksJs, setBlocksJs] = useState("");
  const [lines, setLines] = useState<OutputLine[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [hintsShown, setHintsShown] = useState(0);
  const [editorKey, setEditorKey] = useState(0); // bump to reset Blockly

  useEffect(() => {
    api<Lesson>(`/lessons/${slug}`)
      .then((l) => {
        setLesson(l);
        setCode(l.progress?.code || l.starterCode);
        if (l.language === "python") warmUp("python");
        if (l.progress?.status === "completed") setResult({ passed: true, message: "You've already completed this lesson. Practise as much as you like!" });
        if (l.progress?.status === "submitted") setResult({ passed: true, message: "Submitted. Waiting for your teacher to review it." });
      })
      .catch((e) => setError(e.message));
  }, [slug]);

  // Autosave a moment after the student stops typing.
  const lastSaved = useRef<string | null>(null);
  useEffect(() => {
    if (!lesson || lesson.kind === "quiz") return;
    if (lastSaved.current === null) {
      lastSaved.current = code;
      return;
    }
    if (code === lastSaved.current) return;
    const t = setTimeout(() => {
      lastSaved.current = code;
      api(`/lessons/${slug}/code`, { method: "PUT", body: { code } }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [code, lesson, slug]);

  const onBlocksChange = useCallback((state: string, js: string) => {
    setCode(state);
    setBlocksJs(js);
  }, []);

  const run = async () => {
    if (!lesson) return;
    setRunning(true);
    setLines([]);
    setResult(null);
    try {
      if (lesson.language === "html") {
        const missing = missingSelectors(code, lesson.expectedOutput ?? "");
        if (lesson.kind === "code") {
          const { passed } = await api<{ passed: boolean }>(`/lessons/${slug}/attempt`, { body: { code, passed: missing.length === 0 } });
          setResult(passed
            ? { passed: true, message: "Your page has everything it needs!" }
            : { passed: false, message: `Your page is still missing: ${missing.map((m) => `\`${m}\``).join(", ")}` });
        }
        return;
      }
      const lang = lesson.language === "python" ? "python" : "javascript";
      const source = lesson.language === "blocks" ? blocksJs : code;
      const out = await runCode(lang, source, { onLine: (l) => setLines((prev) => [...prev, l]) });
      if (lesson.kind === "code") {
        const { passed } = await api<{ passed: boolean }>(`/lessons/${slug}/attempt`, { body: { code, output: out.output } });
        setResult(passed
          ? { passed: true, message: `Correct! +${lesson.xp} XP` }
          : { passed: false, message: out.ok ? "Not quite. Compare your output with the goal." : "Your program hit an error. Read the red message." });
      }
    } catch (e) {
      setResult({ passed: false, message: (e as Error).message });
    } finally {
      setRunning(false);
    }
  };

  const submitCapstone = async () => {
    await api(`/lessons/${slug}/submit`, { body: { code } });
    setResult({ passed: true, message: "Submitted! Your teacher will review it." });
  };

  const reset = () => {
    if (!lesson || !confirm("Start this lesson over? Your current code will be replaced.")) return;
    setCode(lesson.starterCode);
    setEditorKey((k) => k + 1);
    setLines([]);
    setResult(null);
  };

  if (error) return (
    <><TopBar me={me} />
      <div className="p-8"><p className="mb-4 text-red-700">{error}</p><Link className="text-indigo-600 underline" href="/dashboard">Back to my belts</Link></div>
    </>
  );
  if (!lesson) return <><TopBar me={me} /><p className="p-8 text-slate-500">Loading…</p></>;

  const back = me ? homeFor(me.role) : "/dashboard";

  return (
    <div className="flex h-full flex-col">
      <TopBar me={me}>
        <Link href={back} className="text-sm text-slate-500 hover:underline">← Back</Link>
        <span className="text-sm text-slate-400">/</span>
        <span className="text-sm text-slate-600">{lesson.belt?.name ?? lesson.track.name}</span>
      </TopBar>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Instructions */}
        <aside className="w-full space-y-4 overflow-y-auto border-r border-slate-200 bg-white p-5 lg:w-[380px] lg:shrink-0">
          <h1 className="text-2xl font-bold">{lesson.title}</h1>
          <Markdown text={lesson.instructions} />

          {lesson.expectedOutput && lesson.language !== "html" && (
            <div>
              <p className="mb-1 text-sm font-semibold text-slate-600">🎯 Goal output</p>
              <pre className="rounded-lg bg-slate-900 p-3 font-mono text-sm text-green-300">{lesson.expectedOutput}</pre>
            </div>
          )}

          {lesson.progress?.feedback && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
              <p className="font-semibold">💬 Teacher feedback</p>
              <p className="whitespace-pre-wrap">{lesson.progress.feedback}</p>
            </div>
          )}

          {lesson.hints.length > 0 && (
            <div className="space-y-2">
              {lesson.hints.slice(0, hintsShown).map((h, i) => (
                <div key={i} className="rounded-lg bg-sky-50 p-3 text-sm"><Markdown text={`💡 ${h}`} /></div>
              ))}
              {hintsShown < lesson.hints.length && (
                <button onClick={() => setHintsShown((n) => n + 1)} className="text-sm font-medium text-sky-700 hover:underline">
                  Show a hint ({lesson.hints.length - hintsShown} left)
                </button>
              )}
            </div>
          )}

          {result && (
            <div className={`rounded-xl p-4 ${result.passed ? "bg-green-100 text-green-900" : "bg-red-50 text-red-900"}`}>
              <Markdown text={result.message} />
              {result.passed && lesson.nextSlug && (
                <Link href={`/lesson/${lesson.nextSlug}`} className="mt-3 inline-block rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700">
                  Next lesson →
                </Link>
              )}
              {result.passed && !lesson.nextSlug && (
                <Link href={back} className="mt-3 inline-block rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700">
                  Back to my belts →
                </Link>
              )}
            </div>
          )}
        </aside>

        {/* Workspace */}
        <section className="flex min-h-[500px] min-w-0 flex-1 flex-col">
          {lesson.kind === "quiz" ? (
            <Quiz lesson={lesson} onDone={setResult} />
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
                <button onClick={run} disabled={running}
                  className="rounded-lg bg-green-600 px-5 py-2 font-semibold text-white shadow hover:bg-green-700 disabled:opacity-50">
                  {running ? "Running…" : lesson.language === "html" ? "✔ Check" : "▶ Run"}
                </button>
                {lesson.kind === "capstone" && lesson.progress?.status !== "completed" && (
                  <button onClick={submitCapstone} className="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-white hover:bg-amber-600">
                    Submit for review
                  </button>
                )}
                <div className="flex-1" />
                <button onClick={reset} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-200">↺ Start over</button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
                <div className="min-h-[320px] flex-1">
                  {lesson.language === "blocks" ? (
                    <BlocklyEditor key={editorKey} initialState={code} onChange={onBlocksChange} />
                  ) : (
                    <CodeEditor value={code} onChange={setCode} language={lesson.language} />
                  )}
                </div>
                <div className="flex min-h-[200px] flex-col border-t border-slate-200 xl:w-[38%] xl:border-l xl:border-t-0">
                  {lesson.language === "blocks" && (
                    <div className="border-b border-slate-200">
                      <p className="bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-500">Your blocks as JavaScript</p>
                      <pre className="max-h-48 overflow-auto bg-slate-800 p-3 font-mono text-xs text-sky-200">{blocksJs || "// add some blocks"}</pre>
                    </div>
                  )}
                  {lesson.language === "html" ? (
                    <>
                      <p className="bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-500">Preview</p>
                      {/* Opaque-origin sandbox: the page can run scripts but can't touch Code Lab. */}
                      <iframe title="preview" sandbox="allow-scripts" srcDoc={code} className="w-full flex-1 bg-white" />
                    </>
                  ) : (
                    <>
                      <p className="bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-500">Output</p>
                      <pre className="flex-1 overflow-auto bg-slate-950 p-3 font-mono text-sm">
                        {lines.length === 0 && <span className="text-slate-500">{running ? "Running…" : "Press Run to see what your program prints."}</span>}
                        {lines.map((l, i) => (
                          <div key={i} className={l.kind === "err" ? "text-red-400" : "text-slate-100"}>{l.text}</div>
                        ))}
                      </pre>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Quiz({ lesson, onDone }: { lesson: Lesson; onDone: (r: Result) => void }) {
  const questions = lesson.quiz ?? [];
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [correct, setCorrect] = useState<boolean[] | null>(null);

  const submit = async () => {
    const r = await api<{ passed: boolean; correct: boolean[] }>(`/lessons/${lesson.slug}/quiz`, { body: { answers } });
    setCorrect(r.correct);
    onDone(r.passed
      ? { passed: true, message: `All correct! +${lesson.xp} XP` }
      : { passed: false, message: `${r.correct.filter(Boolean).length} of ${questions.length} right. Fix the ones marked ✗ and try again.` });
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 overflow-y-auto p-6">
      {questions.map((q, i) => (
        <fieldset key={i} className="rounded-xl bg-white p-4 shadow-sm">
          <legend className="mb-2 font-semibold">
            {correct && (correct[i] ? "✓ " : "✗ ")}{i + 1}. {q.question}
          </legend>
          <div className="space-y-2">
            {q.options.map((opt, j) => (
              <label key={j} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-slate-50 ${answers[i] === j ? "border-indigo-500 bg-indigo-50" : "border-slate-200"}`}>
                <input type="radio" name={`q${i}`} checked={answers[i] === j}
                  onChange={() => { setAnswers((a) => a.map((x, k) => (k === i ? j : x))); setCorrect(null); }} />
                {opt}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <button onClick={submit} disabled={answers.some((a) => a === null)}
        className="rounded-lg bg-indigo-600 px-6 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
        Check answers
      </button>
    </div>
  );
}
