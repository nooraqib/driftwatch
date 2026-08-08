"use client";

function statusDot(status) {
  if (status === "scanning") return "bg-warn";
  if (status === "done") return "bg-add";
  return "bg-ink/20";
}

export default function RepoRail({ repos, integrationsByRepo, selectedRepoId, onSelect, onConnectClick, onDisconnect }) {
  const connected = repos.filter((r) => r.connected);

  return (
    <aside className="h-full">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-ink/50">Repos</h2>
        {connected.length ? <span className="font-mono text-xs text-ink/40">{connected.length}</span> : null}
      </div>

      <nav className="px-2">
        {connected.length === 0 ? (
          <p className="px-2 py-3 text-sm leading-relaxed text-ink/60">
            No repos connected yet. Connect one to build its API usage index.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {connected.map((repo) => {
              const count = (integrationsByRepo?.[repo.id] || []).reduce((n, i) => n + i.callSiteCount, 0);
              const isSelected = repo.id === selectedRepoId;
              return (
                <li key={repo.id}>
                  <div
                    className={`flex items-center gap-2 rounded-md border-l-2 py-2 pl-3 pr-2 transition-colors ${
                      isSelected ? "border-signal bg-paper" : "border-transparent hover:bg-paper/70"
                    }`}
                  >
                    <button onClick={() => onSelect(repo.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot(repo.scanStatus)}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-sm text-ink">{repo.fullName}</span>
                        <span className="block text-xs text-ink/50">
                          {repo.scanStatus === "scanning" ? "scanning..." : `${count} call site${count === 1 ? "" : "s"}`}
                        </span>
                      </span>
                    </button>
                    <button
                      onClick={() => onDisconnect(repo.fullName)}
                      className="shrink-0 rounded border border-line px-2 py-1 font-mono text-[11px] text-ink/50 transition-colors hover:border-ink/30 hover:bg-surface hover:text-ink/80"
                    >
                      Disconnect
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <div className="px-2 py-3">
        <button
          onClick={onConnectClick}
          className="w-full rounded-md border border-line px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-ink/30 hover:bg-paper"
        >
          Connect a repo
        </button>
      </div>
    </aside>
  );
}
