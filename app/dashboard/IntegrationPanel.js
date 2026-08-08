"use client";

function ScanProgress({ scanJob }) {
  const foundText = (scanJob.integrations || [])
    .map((i) => `found ${i.vendor} in ${i.callSiteCount} place${i.callSiteCount === 1 ? "" : "s"}`)
    .join(" · ");

  return (
    <div className="px-4 py-4">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-signal transition-all duration-300"
          style={{ width: `${scanJob.progress ?? 0}%` }}
        />
      </div>
      <p className="mt-2 font-mono text-xs text-ink/60">
        scanning {scanJob.filesScanned ?? 0} / {scanJob.total ?? 0}
        {foundText ? ` · ${foundText}` : ""}
      </p>
    </div>
  );
}

export default function IntegrationPanel({ repo, integrations, scanJob }) {
  const isScanningThisRepo = scanJob && scanJob.repoId === repo?.id && scanJob.status !== "done";

  return (
    <aside className="border-t border-line lg:border-t-0 lg:border-l">
      <div className="px-4 py-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-ink/50">API usage index</h2>
      </div>

      {!repo ? (
        <p className="px-4 py-3 text-sm leading-relaxed text-ink/60">
          Select or connect a repo to see the vendor APIs it calls, with the exact file and line of every call
          site.
        </p>
      ) : isScanningThisRepo ? (
        <ScanProgress scanJob={scanJob} />
      ) : integrations.length === 0 ? (
        <p className="px-4 py-3 text-sm leading-relaxed text-ink/60">
          No vendor API usage found in {repo.fullName}.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-line px-4">
          {integrations.map((integration) => (
            <div key={integration.vendor} className="py-4 first:pt-2">
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-base font-semibold text-ink">{integration.vendor}</h3>
                <span className="font-mono text-xs text-ink/50">
                  {integration.callSiteCount} call site{integration.callSiteCount === 1 ? "" : "s"}
                  {integration.sdkVersionGuess ? ` · v${integration.sdkVersionGuess}` : ""}
                </span>
              </div>
              <ul className="mt-2 flex flex-col gap-0.5">
                {integration.callSites.map((site, i) => (
                  <li
                    key={`${site.file}:${site.line}:${i}`}
                    className="rounded px-1.5 py-1 -mx-1.5 font-mono text-xs leading-relaxed transition-colors hover:bg-paper"
                  >
                    <span className="text-ink">{site.file}</span>
                    <span className="text-ink/50">:{site.line}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
