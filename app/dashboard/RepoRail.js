"use client";

function statusDot(status) {
  if (status === "scanning") return "bg-mkt-warn";
  if (status === "done") return "bg-mkt-add";
  return "bg-mkt-muted/30";
}

export default function RepoRail({ repos, integrationsByRepo, selectedRepoId, onSelect, onConnectClick, onDisconnect, onRescan }) {
  const connected = repos.filter((r) => r.connected);

  return (
    <aside className="h-full">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-mkt-muted">Repos</h2>
        {connected.length ? <span className="font-mono text-xs text-mkt-muted">{connected.length}</span> : null}
      </div>

      <nav className="px-2">
        {connected.length === 0 ? (
          <p className="px-2 py-3 text-sm leading-relaxed text-mkt-muted">
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
                    className={`flex items-center gap-2 rounded-[10px] border-l-2 py-2 pl-3 pr-2 transition-colors ${
                      isSelected ? "border-mkt-signal bg-mkt-bg" : "border-transparent hover:bg-mkt-bg/70"
                    }`}
                  >
                    <button onClick={() => onSelect(repo.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot(repo.scanStatus)}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-sm text-mkt-text">{repo.fullName}</span>
                        <span className="block text-xs text-mkt-muted">
                          {repo.scanStatus === "scanning" ? "scanning..." : `${count} call site${count === 1 ? "" : "s"}`}
                        </span>
                      </span>
                    </button>
                    <button
                      onClick={() => onRescan(repo.fullName)}
                      disabled={repo.scanStatus === "scanning"}
                      title="Re-scan this repo's source to pick up files changed since it was last connected"
                      className="shrink-0 rounded-md border border-mkt-line px-2 py-1 font-mono text-[11px] text-mkt-muted transition-colors hover:border-mkt-muted/40 hover:bg-mkt-surface hover:text-mkt-text active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Rescan
                    </button>
                    <button
                      onClick={() => onDisconnect(repo.fullName)}
                      className="shrink-0 rounded-md border border-mkt-line px-2 py-1 font-mono text-[11px] text-mkt-muted transition-colors hover:border-mkt-muted/40 hover:bg-mkt-surface hover:text-mkt-text active:scale-[0.98]"
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
          className="w-full rounded-[10px] border border-mkt-line px-3 py-2 text-sm font-medium text-mkt-text transition-colors hover:border-mkt-muted/40 hover:bg-mkt-bg active:scale-[0.98]"
        >
          Connect a repo
        </button>
      </div>
    </aside>
  );
}
