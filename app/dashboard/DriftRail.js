"use client";

import { useEffect, useRef, useState } from "react";
import { VENDORS } from "@/lib/vendors";

const WATCHED_VENDORS = VENDORS.map((v) => v.name).join(", ");

function severityStyle(severity) {
  if (severity === "high") return "text-mkt-del border-mkt-del/40 bg-mkt-del/5";
  if (severity === "medium") return "text-mkt-warn border-mkt-warn/40 bg-mkt-warn/5";
  return "text-mkt-muted border-mkt-line bg-mkt-bg";
}

function outcomeLine(result) {
  switch (result.outcome) {
    case "unchanged":
      return { text: `${result.vendor}: no changes since last check.`, tone: "text-mkt-muted" };
    case "non-breaking":
      return { text: `${result.vendor}: detected a non-breaking change. No action needed.`, tone: "text-mkt-muted" };
    case "not-applicable":
      return { text: `${result.vendor}: detected, not applicable to your code.`, tone: "text-mkt-muted" };
    case "already-shipped":
      return { text: `${result.vendor}: already opened a pull request for this change.`, tone: "text-mkt-muted" };
    case "pr-opened":
      return { text: `${result.vendor}: opened a draft pull request.`, tone: "text-mkt-add" };
    case "error":
      return { text: `${result.vendor}: ${result.error}`, tone: "text-mkt-del" };
    default:
      return { text: `${result.vendor}: ${result.outcome}`, tone: "text-mkt-muted" };
  }
}

function ChangeNode({ change, prs, isNew }) {
  const [expanded, setExpanded] = useState(false);
  const relatedPrs = prs.filter((pr) => pr.changeId === change.id);

  return (
    <li className={`relative pl-8 ${isNew ? "rail-node-enter" : ""}`}>
      <span className="absolute left-[9px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-mkt-text bg-mkt-bg" />
      <button
        onClick={() => setExpanded((v) => !v)}
        className="-mx-2 w-[calc(100%+1rem)] rounded-md px-2 py-1 text-left transition-colors hover:bg-mkt-bg"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-sm font-semibold text-mkt-text">{change.vendor}</span>
          <span className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${severityStyle(change.severity)}`}>
            {change.severity}
          </span>
          {change.deadline ? (
            <span className="font-mono text-[11px] text-mkt-warn">deadline {change.deadline}</span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-mkt-text/80">{change.summary}</p>
        <p className="mt-1 font-mono text-xs text-mkt-muted">{new Date(change.detectedAt).toLocaleString()}</p>
      </button>

      {expanded ? (
        <div className="mt-3 border-l border-mkt-line pl-4">
          <p className="text-xs leading-relaxed text-mkt-muted">{change.migration}</p>

          {relatedPrs.length === 0 ? (
            <p className="mt-2 font-mono text-xs text-mkt-muted">No pull requests opened for this change yet.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              {relatedPrs.map((pr) => (
                <div key={pr.id}>
                  <p className="font-mono text-xs text-mkt-muted">{pr.repoId}</p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {(pr.callSites || []).map((site, i) => (
                      <li key={i} className="font-mono text-xs text-mkt-muted">
                        {site.file}:{site.line}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={pr.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs font-medium text-mkt-signal hover:underline"
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

export default function DriftRail({
  changes,
  prs,
  selectedRepo,
  selectedIntegrations,
  onRunCheck,
  onForceCheck,
  checking,
  checkResults,
  scanJob,
}) {
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

  // Vendor changes are global (one changelog, fanned out to every repo that
  // uses it), but a pull request only belongs to one repo — only show PRs
  // for the repo currently selected, so switching repos doesn't surface
  // another repo's pull request under the same change.
  const scopedPrs = selectedRepo ? prs.filter((pr) => pr.repoId === selectedRepo.id) : [];

  // A vendor change is only worth showing for repos that actually depend on
  // that vendor — otherwise every connected repo would show the exact same
  // global list, including vendors it has zero call sites for.
  const usedVendors = new Set((selectedIntegrations || []).map((i) => i.vendor));
  const relevantChanges = selectedRepo ? changes.filter((change) => usedVendors.has(change.vendor)) : changes;

  return (
    <main className="flex flex-col">
      <div className="flex flex-col gap-3 border-b border-mkt-line px-6 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onRunCheck}
            disabled={!canRunCheck}
            className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-[10px] bg-mkt-signal px-4 text-sm font-medium text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
          >
            {checking ? "Running check..." : "Run check now"}
          </button>
          {/* Secondary on purpose: re-classifies the whole changelog instead
              of only what moved since the last check, so a vendor that has
              already been checked can be checked again. */}
          <button
            onClick={onForceCheck}
            disabled={!canRunCheck}
            title="Ignore the stored changelog snapshot and re-classify the whole changelog"
            className="inline-flex h-10 w-fit items-center justify-center rounded-[10px] border border-mkt-line px-3.5 font-mono text-xs text-mkt-muted transition-colors hover:border-mkt-muted/40 hover:bg-mkt-bg hover:text-mkt-text active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
          >
            Force re-check
          </button>
        </div>
        {!selectedRepo ? (
          <p className="text-xs text-mkt-muted">Connect and select a repo before running a check.</p>
        ) : repoIsScanning ? (
          <p className="text-xs text-mkt-muted">Wait for the scan to finish before checking {selectedRepo.fullName}.</p>
        ) : (
          <p className="font-mono text-xs text-mkt-muted">checking {selectedRepo.fullName}</p>
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
          <p className="text-sm leading-relaxed text-mkt-muted">
            No vendor changes detected yet. Run a check to watch {WATCHED_VENDORS} for breaking changes.
          </p>
        ) : relevantChanges.length === 0 ? (
          <p className="text-sm leading-relaxed text-mkt-muted">
            {selectedRepo?.fullName} doesn&apos;t use any of the vendors that have detected changes yet.
          </p>
        ) : (
          <ul className="relative flex flex-col gap-6 border-l-2 border-mkt-text/80 pl-0">
            {relevantChanges.map((change) => (
              <ChangeNode key={change.id} change={change} prs={scopedPrs} isNew={change.id === newestId} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
