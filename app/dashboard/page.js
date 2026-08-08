"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import RepoRail from "./RepoRail";
import ConnectRepoModal from "./ConnectRepoModal";
import DriftRail from "./DriftRail";
import IntegrationPanel from "./IntegrationPanel";

async function apiFetch(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request to ${url} failed (${res.status}).`);
  }
  return data;
}

export default function Dashboard() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out
  const [globalError, setGlobalError] = useState(null);

  const [allRepos, setAllRepos] = useState([]);
  const [selectedRepoId, setSelectedRepoId] = useState(null);
  const [integrationsByRepo, setIntegrationsByRepo] = useState({});

  const [changes, setChanges] = useState([]);
  const [prs, setPrs] = useState([]);

  const [showConnectModal, setShowConnectModal] = useState(false);
  const [scanJob, setScanJob] = useState(null); // { jobId, repoId, progress, filesScanned, total, status }

  const [checking, setChecking] = useState(false);
  const [checkResults, setCheckResults] = useState(null);

  const pollTimer = useRef(null);

  const loadRepos = useCallback(async () => {
    try {
      const data = await apiFetch("/api/repos");
      setAllRepos(data.repos);
      setSelectedRepoId((current) => current || data.repos.find((r) => r.connected)?.id || null);

      const connected = data.repos.filter((r) => r.connected);
      const results = await Promise.all(
        connected.map((r) =>
          apiFetch(`/api/integrations?repoId=${encodeURIComponent(r.id)}`)
            .then((d) => [r.id, d.integrations])
            .catch(() => [r.id, []])
        )
      );
      setIntegrationsByRepo((prev) => ({ ...prev, ...Object.fromEntries(results) }));
    } catch (err) {
      setGlobalError(err.message);
    }
  }, []);

  const loadChanges = useCallback(async () => {
    try {
      const data = await apiFetch("/api/changes");
      setChanges(data.changes);
    } catch (err) {
      setGlobalError(err.message);
    }
  }, []);

  const loadPrs = useCallback(async () => {
    try {
      const data = await apiFetch("/api/prs");
      setPrs(data.prs);
    } catch (err) {
      setGlobalError(err.message);
    }
  }, []);

  const loadIntegrations = useCallback(async (repoId) => {
    try {
      const data = await apiFetch(`/api/integrations?repoId=${encodeURIComponent(repoId)}`);
      setIntegrationsByRepo((prev) => ({ ...prev, [repoId]: data.integrations }));
    } catch (err) {
      setGlobalError(err.message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const me = await apiFetch("/api/auth/me");
        setUser(me);
      } catch {
        window.location.href = "/";
      }
    })();
  }, []);

  useEffect(() => {
    if (user === undefined || user === null) return;
    loadRepos();
    loadChanges();
    loadPrs();
  }, [user, loadRepos, loadChanges, loadPrs]);

  useEffect(() => {
    if (selectedRepoId && !integrationsByRepo[selectedRepoId]) {
      loadIntegrations(selectedRepoId);
    }
  }, [selectedRepoId, integrationsByRepo, loadIntegrations]);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  function stopPolling() {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }

  async function connectRepo(fullName) {
    setGlobalError(null);
    try {
      const data = await apiFetch("/api/repos/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName }),
      });
      setShowConnectModal(false);
      setSelectedRepoId(fullName);
      setScanJob({ jobId: data.jobId, repoId: fullName, progress: 0, filesScanned: 0, total: data.total, status: "scanning" });

      stopPolling();
      pollTimer.current = setInterval(async () => {
        try {
          const status = await apiFetch(`/api/scan/status?jobId=${data.jobId}`);
          setScanJob({ jobId: data.jobId, repoId: fullName, ...status });
          setIntegrationsByRepo((prev) => ({ ...prev, [fullName]: status.integrations }));
          if (status.status === "done") {
            stopPolling();
            loadRepos();
          }
        } catch (err) {
          stopPolling();
          setGlobalError(err.message);
        }
      }, 900);
    } catch (err) {
      setGlobalError(err.message);
    }
  }

  async function disconnectRepo(fullName) {
    setGlobalError(null);
    try {
      await apiFetch("/api/repos/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName }),
      });
      setIntegrationsByRepo((prev) => {
        const next = { ...prev };
        delete next[fullName];
        return next;
      });
      setSelectedRepoId((current) => (current === fullName ? null : current));
      await loadRepos();
    } catch (err) {
      setGlobalError(err.message);
    }
  }

  async function runCheck() {
    if (!selectedRepoId) return;
    setChecking(true);
    setCheckResults(null);
    setGlobalError(null);
    try {
      const data = await apiFetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoId: selectedRepoId }),
      });
      setCheckResults(data.results);
      await Promise.all([loadChanges(), loadPrs()]);
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      setChecking(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  if (user === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-ink/60">Loading your account...</div>
    );
  }

  const selectedIntegrations = selectedRepoId ? integrationsByRepo[selectedRepoId] || [] : [];
  const selectedRepo = allRepos.find((r) => r.id === selectedRepoId) || null;

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <span className="flex items-center gap-2.5">
          <span className="rail-node-mark h-3 w-3" />
          <span className="font-display text-lg font-semibold tracking-tight">Driftwatch</span>
        </span>
        {user ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full border border-line" />
            <span className="font-mono text-sm text-ink/70">{user.login}</span>
            <button
              onClick={handleLogout}
              className="rounded-md border border-line px-3 py-1.5 text-sm text-ink/70 transition-colors hover:bg-surface"
            >
              Sign out
            </button>
          </div>
        ) : null}
      </header>

      {globalError ? (
        <div className="border-b border-del/30 bg-del/5 px-6 py-3 text-sm text-del">{globalError}</div>
      ) : null}

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[240px_1fr_320px]">
        <RepoRail
          repos={allRepos}
          integrationsByRepo={integrationsByRepo}
          selectedRepoId={selectedRepoId}
          onSelect={setSelectedRepoId}
          onConnectClick={() => setShowConnectModal(true)}
          onDisconnect={disconnectRepo}
        />

        <DriftRail
          changes={changes}
          prs={prs}
          selectedRepo={selectedRepo}
          onRunCheck={runCheck}
          checking={checking}
          checkResults={checkResults}
          scanJob={scanJob}
        />

        <IntegrationPanel repo={selectedRepo} integrations={selectedIntegrations} scanJob={scanJob} />
      </div>

      {showConnectModal ? (
        <ConnectRepoModal
          repos={allRepos.filter((r) => !r.connected)}
          onClose={() => setShowConnectModal(false)}
          onConnect={connectRepo}
        />
      ) : null}
    </div>
  );
}
