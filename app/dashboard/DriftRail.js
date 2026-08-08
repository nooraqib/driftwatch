"use client";

import { useEffect, useRef, useState } from "react";

function severityStyle(severity) {
  if (severity === "high") return "text-del border-del/40 bg-del/5";
  if (severity === "medium") return "text-warn border-warn/40 bg-warn/5";
  return "text-ink/60 border-line bg-paper";
}

function outcomeLine(result) {
  switch (result.outcome) {
    case "unchanged":
      return { text: `${result.vendor}: no changes since last check.`, tone: "text-ink/60" };
    case "non-breaking":
      return { text: `${result.vendor}: detected a non-breaking change. No action needed.`, tone: "text-ink/60" };
    case "not-applicable":
      return { text: `${result.vendor}: detected, not applicable to your code.`, tone: "text-ink/60" };
    case "pr-opened":
      return { text: `${result.vendor}: opened a draft pull request.`, tone: "text-add" };
    case "error":
      return { text: `${result.vendor}: ${result.error}`, tone: "text-del" };
    default:
      return { text: `${result.vendor}: ${result.outcome}`, tone: "text-ink/60" };
  }
}

function ChangeNode({ change, prs, isNew }) {
  const [expanded, setExpanded] = useState(false);
  const relatedPrs = prs.filter((pr) => pr.changeId === change.id);

  return (
    <li className={`relative pl-8 ${isNew ? "rail-node-enter" : ""}`}>
      <span className="absolute left-[9px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-ink bg-paper" />
      <button onClick={() => setExpanded((v) => !v)} className="w-full text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-sm font-semibold text-ink">{change.vendor}</span>
          <span className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${severityStyle(change.severity)}`}>
            {change.severity}
          </span>
          {change.deadline ? (
            <span className="font-mono text-[11px] text-warn">deadline {change.deadline}</span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-ink/80">{change.summary}</p>
        <p className="mt-1 font-mono text-xs text-ink/40">{new Date(change.detectedAt).toLocaleString()}</p>
      </button>

      {expanded ? (
        <div className="mt-3 border-l border-line pl-4">
          <p className="text-xs leading-relaxed text-ink/60">{change.migration}</p>

          {relatedPrs.length === 0 ? (
            <p className="mt-2 font-mono text-xs text-ink/50">No pull requests opened for this change yet.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              {relatedPrs.map((pr) => (
                <div key={pr.id}>
                  <p className="font-mono text-xs text-ink/70">{pr.repoId}</p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {(pr.callSites || []).map((site, i) => (
                      <li key={i} className="font-mono text-xs text-ink/50">
                        {site.file}:{site.line}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={pr.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs font-medium text-signal hover:underline"
                  >
                    View pull request →
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}

export default function DriftRail({ changes, prs, selectedRepo, onRunCheck, checking, checkResults, scanJob }) {
  const prevTopId = useRef(null);
  const [newestId, setNewestId] = useState(null);

  useEffect(() => {
    const topId = changes[0]?.id || null;
    if (topId && prevTopId.current && topId !== prevTopId.current) {
      setNewestId(topId);
    }
    prevTopId.current = topId;
  }, [changes]);

  const repoIsScanning = scanJob && scanJob.repoId === selectedRepo?.id && scanJob.status !== "done";
  const canRunCheck = Boolean(selectedRepo) && !checking && !repoIsScanning;

  return (
    <main className="flex flex-col">
      <div className="flex flex-col gap-3 border-b border-line px-6 py-5">
        <button
          onClick={onRunCheck}
          disabled={!canRunCheck}
          className="inline-flex w-fit items-center justify-center gap-2 rounded-md bg-signal px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-signal/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {checking ? "Running check..." : "Run check now"}
        </button>
        {!selectedRepo ? (
          <p className="text-xs text-ink/50">Connect and select a repo before running a check.</p>
        ) : repoIsScanning ? (
          <p className="text-xs text-ink/50">Wait for the scan to finish before checking {selectedRepo.fullName}.</p>
        ) : (
          <p className="font-mono text-xs text-ink/50">checking {selectedRepo.fullName}</p>
        )}

        {checkResults ? (
          <div className="flex flex-col gap-1">
            {checkResults.map((result, i) => {
              const line = outcomeLine(result);
              return (
                <p key={i} className={`text-xs ${line.tone}`}>
                  {line.text}
                  {result.outcome === "pr-opened" ? (
                    <>
                      {" "}
                      <a href={result.pr.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                        View pull request →
                      </a>
                    </>
                  ) : null}
                </p>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {changes.length === 0 ? (
          <p className="text-sm leading-relaxed text-ink/60">
            No vendor changes detected yet. Run a check to watch {"{Stripe}"} for breaking changes.
          </p>
        ) : (
          <ul className="relative flex flex-col gap-6 border-l-2 border-ink/80 pl-0">
            {changes.map((change) => (
              <ChangeNode key={change.id} change={change} prs={prs} isNew={change.id === newestId} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
