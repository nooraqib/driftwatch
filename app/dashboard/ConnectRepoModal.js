"use client";

import { useState } from "react";

export default function ConnectRepoModal({ repos, onClose, onConnect }) {
  const [connectingId, setConnectingId] = useState(null);

  async function handleConnect(fullName) {
    setConnectingId(fullName);
    await onConnect(fullName);
    setConnectingId(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-[10px] border border-mkt-line bg-mkt-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-mkt-line px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-mkt-text">Connect a repo</h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-sm text-mkt-muted hover:bg-mkt-bg">
            Close
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-2 py-2">
          {repos.length === 0 ? (
            <p className="px-3 py-6 text-sm text-mkt-muted">
              All your repos are already connected, or GitHub returned none for this account.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {repos.map((repo) => (
                <li key={repo.id}>
                  <button
                    onClick={() => handleConnect(repo.fullName)}
                    disabled={connectingId !== null}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-mkt-bg disabled:opacity-50"
                  >
                    <span className="min-w-0 flex-1 truncate font-mono text-sm text-mkt-text">{repo.fullName}</span>
                    <span className="shrink-0 text-xs font-medium text-mkt-signal">
                      {connectingId === repo.fullName ? "Connecting..." : "Connect"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
