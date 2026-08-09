import { NextResponse } from "next/server";
import { getToken, GhError } from "@/lib/gh";
import { getState, setState } from "@/lib/store";
import { VENDORS } from "@/lib/vendors";
import { detectVendorChange, matchAffectedCallSites } from "@/lib/detect";
import { patchAndShip } from "@/lib/patch";

// Up to 4 sequential Gemini calls plus several GitHub writes happen inline
// here, so the default serverless function timeout is not enough headroom.
export const maxDuration = 60;

// A forced re-check re-classifies the whole changelog, so it produces a fresh
// vendorChange every time — that new node animating into the Drift Rail is
// the point. To stop repeated forced runs from stacking identical nodes,
// drop older records for the same vendor that say the same thing AND never
// produced a pull request. Anything that shipped a PR is history worth
// keeping (and the Drift Rail hangs those PRs off their change node).
function pruneSupersededChanges(changes, incoming, pullRequests) {
  const changeIdsWithPrs = new Set(Object.values(pullRequests).map((pr) => pr.changeId));
  return changes.filter(
    (c) => c.vendor !== incoming.vendor || c.summary !== incoming.summary || changeIdsWithPrs.has(c.id)
  );
}

// Runs detect -> match -> patch -> ship for one connected repo, across every
// vendor that has a specUrl configured. Returns every outcome, including
// "no match" ones, so the UI can show "detected, not applicable" instead of
// staying silent.
//
// `force` ignores the stored changelog snapshot so a check that already ran
// can be run again — without it, the second run of any vendor always returns
// "unchanged" and the pipeline never reaches a pull request.
export async function POST(request) {
  try {
    const { repoId, force } = await request.json();
    if (!repoId) return NextResponse.json({ error: "repoId is required." }, { status: 400 });
    const forced = Boolean(force);

    const token = await getToken();
    const state = getState();
    const repo = state.repos[repoId];
    if (!repo) return NextResponse.json({ error: "Repo is not connected. Connect it first." }, { status: 400 });

    const integrations = state.integrations[repoId] || [];
    const [owner, repoName] = repoId.split("/");
    const vendorsToCheck = VENDORS.filter((v) => v.specUrl);
    const results = [];

    for (const vendor of vendorsToCheck) {
      // Passing null makes detectVendorChange treat the entire changelog as
      // the diff, exactly as it does on a vendor's very first check.
      const previousSnapshot = forced ? null : state.vendorSnapshots[vendor.name] || null;

      let detection;
      try {
        detection = await detectVendorChange(vendor, previousSnapshot);
      } catch (err) {
        results.push({ vendor: vendor.name, outcome: "error", error: err.message });
        continue;
      }

      setState((s) => ({ ...s, vendorSnapshots: { ...s.vendorSnapshots, [vendor.name]: detection.rawText } }));

      let vendorChange;
      if (detection.changed) {
        vendorChange = {
          id: crypto.randomUUID(),
          vendor: vendor.name,
          sourceUrl: vendor.specUrl,
          rawText: detection.rawText,
          severity: detection.severity,
          breaking: detection.breaking,
          affectedSymbols: detection.affectedSymbols || [],
          summary: detection.summary,
          migration: detection.migration,
          sourceLine: detection.sourceLine,
          deadline: detection.deadline,
          detectedAt: new Date().toISOString(),
        };
        setState((s) => ({
          ...s,
          vendorChanges: [
            vendorChange,
            ...(forced ? pruneSupersededChanges(s.vendorChanges, vendorChange, s.pullRequests) : s.vendorChanges),
          ],
        }));
      } else {
        // The changelog text hasn't moved since the last time ANY repo
        // checked it — that's expected, since the snapshot (and the one
        // Gemini classification) is shared across every repo watching this
        // vendor. But this specific repo may not have been matched against
        // that change yet (e.g. it was just connected, or checked for the
        // first time after another repo already triggered detection). Reuse
        // the most recent known change for this vendor instead of stopping.
        vendorChange = getState().vendorChanges.find((c) => c.vendor === vendor.name) || null;
        if (!vendorChange) {
          results.push({ vendor: vendor.name, outcome: "unchanged" });
          continue;
        }
      }

      if (!vendorChange.breaking) {
        results.push({ vendor: vendor.name, outcome: "non-breaking", change: vendorChange });
        continue;
      }

      // Skipped when forced: a forced run is an explicit "do it again", and
      // the reuse branch above can hand back a stored change this repo has
      // already shipped a pull request for — which would stop the forced run
      // dead, exactly the thing force exists to avoid.
      const alreadyShipped =
        !forced &&
        Object.values(getState().pullRequests).some(
          (pr) => pr.changeId === vendorChange.id && pr.repoId === repoId
        );
      if (alreadyShipped) {
        results.push({ vendor: vendor.name, outcome: "already-shipped", change: vendorChange });
        continue;
      }

      const matched = matchAffectedCallSites(vendorChange.affectedSymbols, integrations);
      if (!matched.length) {
        results.push({ vendor: vendor.name, outcome: "not-applicable", change: vendorChange });
        continue;
      }

      try {
        const pr = await patchAndShip({
          owner,
          repo: repoName,
          defaultBranch: repo.defaultBranch,
          token,
          vendorChange,
          matchedCallSites: matched,
        });

        const prRecord = {
          id: crypto.randomUUID(),
          repoId,
          changeId: vendorChange.id,
          number: pr.number,
          url: pr.url,
          title: `Driftwatch: ${vendor.name} — ${vendorChange.summary}`,
          filesChanged: pr.filesChanged,
          callSites: matched,
          status: "open",
          verifyPassed: pr.verifyPassed,
        };
        setState((s) => ({ ...s, pullRequests: { ...s.pullRequests, [prRecord.id]: prRecord } }));

        results.push({
          vendor: vendor.name,
          outcome: "pr-opened",
          change: vendorChange,
          pr: prRecord,
          matchedCallSites: matched,
        });
      } catch (err) {
        results.push({ vendor: vendor.name, outcome: "error", change: vendorChange, error: err.message });
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    const status = err instanceof GhError ? err.status : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
