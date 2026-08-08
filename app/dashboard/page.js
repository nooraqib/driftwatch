"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import RepoRail from "./RepoRail";
import ConnectRepoModal from "./ConnectRepoModal";
import DriftRail from "./DriftRail";
import IntegrationPanel from "./IntegrationPanel";
import { VENDORS } from "@/lib/vendors";

async function apiFetch(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request to ${url} failed (${res.status}).`);
  }
  return data;
}

export default function Dashboard() {
  const router = useRouter();
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
  // Guards that have to be read and written synchronously, so they can't be
  // React state: the poll callbacks below close over stale state values.
  //
  // The scan poller fires every 900ms while /api/scan/status routinely takes
  // longer than that (it pulls a 20-file batch from GitHub), so several
  // callbacks are normally in flight at once — and /api/scan/status reports
  // "done" to every one of them. stopPolling() clears the timer but cannot
  // cancel callbacks that have already been dispatched, so without these
  // each one would reach /api/check and open its own duplicate draft PR.
  const pollInFlight = useRef(false);
  const checkInFlight = useRef(false);

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
        router.push("/");
      }
    })();
  }, [router]);

  useEffect(() => {
    if (user === undefined || user === null) return;
    (async () => {
      await Promise.all([loadRepos(), loadChanges(), loadPrs()]);
    })();
  }, [user, loadRepos, loadChanges, loadPrs]);

  useEffect(() => {
    if (!selectedRepoId || integrationsByRepo[selectedRepoId]) return;
    (async () => {
      await loadIntegrations(selectedRepoId);
    })();
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
      pollInFlight.current = false;
      pollTimer.current = setInterval(async () => {
        // Skip this tick if the previous batch request hasn't come back yet.
        if (pollInFlight.current) return;
        pollInFlight.current = true;
        try {
          const status = await apiFetch(`/api/scan/status?jobId=${data.jobId}`);
          setScanJob({ jobId: data.jobId, repoId: fullName, ...status });
          setIntegrationsByRepo((prev) => ({ ...prev, [fullName]: status.integrations }));
          if (status.status === "done") {
            stopPolling();
            await loadRepos();
            // Run the check immediately once the scan finishes, so
            // connecting a repo can surface a draft PR without a second
            // manual click.
            await runCheckForRepo(fullName);
          }
        } catch (err) {
          stopPolling();
          setGlobalError(err.message);
        } finally {
          pollInFlight.current = false;
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

  async function runCheckForRepo(repoId, { force = false } = {}) {
    if (!repoId) return;
    // Concurrent runs only — a deliberate re-check (or a force re-check)
    // after this one settles is still allowed, because the flag is cleared
    // in the finally below. Set before the first await so two callers in the
    // same tick can't both get through: /api/check reads the store, then
    // spends seconds in patchAndShip before writing the PR record, so its
    // own already-shipped guard cannot see a request that is still running.
    if (checkInFlight.current) return;
    checkInFlight.current = true;
    setChecking(true);
    setCheckResults(null);
    setGlobalError(null);
    try {
      const data = await apiFetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoId, force }),
      });
      setCheckResults(data.results);
      await Promise.all([loadChanges(), loadPrs()]);
    } catch (err) {
      setGlobalError(err.message);
    } finally {
      checkInFlight.current = false;
      setChecking(false);
    }
  }

  async function runCheck() {
    await runCheckForRepo(selectedRepoId);
  }

  // Once a vendor has been checked, the stored snapshot matches the live
  // changelog and every later check is "unchanged". Forcing bypasses that
  // snapshot so the same changelog can be classified again.
  async function forceCheck() {
    await runCheckForRepo(selectedRepoId, { force: true });
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  if (user === undefined) {
    return (
      <div className="dashboard flex flex-1 items-center justify-center bg-mkt-bg text-sm text-mkt-muted">
        Loading your account...
      </div>
    );
  }

  const selectedIntegrations = selectedRepoId ? integrationsByRepo[selectedRepoId] || [] : [];
  const selectedRepo = allRepos.find((r) => r.id === selectedRepoId) || null;
  const connectedCount = allRepos.filter((r) => r.connected).length;
  const lastChangeText = changes[0]
    ? `last detected change ${new Date(changes[0].detectedAt).toLocaleString()}`
    : "no vendor changes detected yet";

  return (
    <div className="dashboard instrument-grid flex flex-1 flex-col bg-mkt-bg text-mkt-text">
      <header className="flex items-center justify-between border-b border-mkt-line bg-mkt-surface px-6 py-4">
        <div className="flex items-center gap-8">
          <span className="flex items-center gap-2.5">
            <span className="rail-node-mark h-3 w-3" />
            <span className="font-display text-lg font-semibold tracking-tight">Driftwatch</span>
          </span>
          <nav className="hidden items-center gap-6 sm:flex">
            <Link href="/" className="text-sm text-mkt-muted transition-colors hover:text-mkt-text">
              Home
            </Link>
            <Link href="/pricing" className="text-sm text-mkt-muted transition-colors hover:text-mkt-text">
              Pricing
            </Link>
          </nav>
        </div>
        {user ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full border border-mkt-line" />
            <span className="font-mono text-sm text-mkt-muted">{user.login}</span>
            <button
              onClick={handleLogout}
              className="rounded-[10px] border border-mkt-line px-3 py-1.5 text-sm text-mkt-muted transition-colors hover:border-mkt-muted/40 hover:bg-mkt-bg active:scale-[0.98]"
            >
              Sign out
            </button>
          </div>
        ) : null}
      </header>

      {globalError ? (
        <div className="border-b border-mkt-del/30 bg-mkt-del/5 px-6 py-3 text-sm text-mkt-del">{globalError}</div>
      ) : null}

      <div className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[260px_1fr_340px] lg:gap-5 lg:p-6">
        <div className="overflow-hidden rounded-[10px] border border-mkt-line bg-mkt-surface">
          <RepoRail
            repos={allRepos}
            integrationsByRepo={integrationsByRepo}
            selectedRepoId={selectedRepoId}
            onSelect={setSelectedRepoId}
            onConnectClick={() => setShowConnectModal(true)}
            onDisconnect={disconnectRepo}
          />
        </div>

        <div className="flex min-h-[420px] flex-col overflow-hidden rounded-[10px] border border-mkt-line bg-mkt-surface">
          <DriftRail
            changes={changes}
            prs={prs}
            selectedRepo={selectedRepo}
            selectedIntegrations={selectedIntegrations}
            onRunCheck={runCheck}
            onForceCheck={forceCheck}
            checking={checking}
            checkResults={checkResults}
            scanJob={scanJob}
          />
        </div>

        <div className="overflow-hidden rounded-[10px] border border-mkt-line bg-mkt-surface">
          <IntegrationPanel repo={selectedRepo} integrations={selectedIntegrations} scanJob={scanJob} />
        </div>
      </div>

      <footer className="border-t border-mkt-line bg-mkt-surface px-6 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 font-mono text-[11px] text-mkt-muted">
          <span>
            {connectedCount} repo{connectedCount === 1 ? "" : "s"} connected · watching{" "}
            {VENDORS.map((v) => v.name).join(", ")}
          </span>
          <span>{lastChangeText}</span>
        </div>
      </footer>

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
