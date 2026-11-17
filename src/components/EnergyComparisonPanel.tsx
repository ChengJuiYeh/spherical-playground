"use client";

import { useEffect } from "react";
import { useSimStore, comparisonKey, comparisonBestByGroup, comparisonValue } from "@/store/useSimStore";

export default function EnergyComparisonPanel() {
  const pot = useSimStore((s) => s.pot);
  const allRecords = useSimStore((s) => s.comparisonRecords);
  const open = useSimStore((s) => s.comparisonOpen);
  const hydrated = useSimStore((s) => s.comparisonHydrated);
  const storageError = useSimStore((s) => s.comparisonStorageError);
  const hydrate = useSimStore((s) => s.hydrateComparison);
  const setOpen = useSimStore((s) => s.setComparisonOpen);
  const record = useSimStore((s) => s.recordConfiguration);
  const load = useSimStore((s) => s.loadConfiguration);
  const clear = useSimStore((s) => s.clearComparison);
  useEffect(() => { hydrate(); }, [hydrate]);
  const records = allRecords.filter(r => r.pot.kind === pot.kind);
  const bestByGroup = comparisonBestByGroup(records);
  const mixed = pot.kind === "mixed", ra = pot.kind === "lj";
  const hasS = pot.kind === "riesz" || mixed;
  const hasP = pot.kind === "power" || pot.kind === "pframe";

  if (!open) return (
    <button type="button"
      className="pointer-events-auto shrink-0 rounded-full border bg-white/90 px-3 py-2 text-xs shadow-sm backdrop-blur hover:bg-white"
      aria-expanded={false} aria-label="Show Energy Comparison" onClick={() => setOpen(true)}>
      Energy Comparison ({records.length})
    </button>
  );

  return (
    <section className={`pointer-events-auto ${mixed || ra ? "w-[620px]" : "w-[360px]"} max-w-full shrink-0 rounded-lg border bg-white/95 p-3 shadow-sm backdrop-blur`}>
      <button type="button" className="flex w-full items-center justify-between text-sm font-medium"
        aria-expanded={true} aria-controls="energy-comparison-content" onClick={() => setOpen(false)}>
        <span>Energy Comparison ({records.length})</span><span>Hide</span>
      </button>
      <div id="energy-comparison-content" className="mt-3">
        <div className="my-3 flex flex-wrap gap-2">
          <button type="button" className="rounded bg-black px-3 py-2 text-xs text-white disabled:opacity-40" disabled={!hydrated} onClick={record}>Record current configuration</button>
          <button type="button" className="rounded border px-3 py-2 text-xs disabled:opacity-40" disabled={!hydrated || !records.length} onClick={clear} title="Clear all records for this potential">Clear records</button>
        </div>
        {storageError && <p role="status" className="mb-2 text-xs text-amber-700">{storageError}</p>}
        {!records.length ? <p className="py-2 text-xs text-gray-500">{hydrated ? "No records yet." : "Restoring records…"}</p> :
          <div className="max-h-64 overflow-auto rounded border">
            <table className="w-full whitespace-nowrap text-right text-xs tabular-nums">
              <thead className="sticky top-0 bg-gray-100"><tr>
                {hasS && <th className="p-2">s</th>}
                {hasP && <th className="p-2">p</th>}
                {mixed && <><th className="p-2">γ</th><th className="p-2">Scale α</th></>}
                {ra && <><th className="p-2">α</th><th className="p-2">β</th><th className="p-2">Domain</th><th className="p-2">Min / Max</th></>}
                <th className="p-2">N</th>
                {mixed && <th className="p-2">Scaled energy</th>}
                <th className="p-2">{mixed ? "True energy" : "Energy"}</th>
                <th className="p-2"><span className="sr-only">Actions</span></th>
              </tr></thead>
              <tbody>{records.map((r) => {
                const best = bestByGroup.get(comparisonKey(r.pot, r.domain))!;
                const isBest = Math.abs(best - comparisonValue(r)) <= 1e-8 * Math.max(1, Math.abs(best));
                return <tr key={r.id} className="border-t">
                  {(r.pot.kind === "riesz" || r.pot.kind === "mixed") && <td className="p-2">{r.pot.s}</td>}
                  {(r.pot.kind === "power" || r.pot.kind === "pframe") && <td className="p-2">{r.pot.p}</td>}
                  {r.pot.kind === "mixed" && <><td className="p-2">{r.pot.gamma}</td><td className="p-2">{r.pot.scale}</td></>}
                  {r.pot.kind === "lj" && <><td className="p-2">{r.pot.alpha}</td><td className="p-2">{r.pot.beta}</td><td className="p-2">{r.domain === "sphere" ? "S²" : "ℝ³"}</td><td className="p-2">{r.pot.direction === "minimize" ? "Min" : "Max"}</td></>}
                  <td className="p-2">{r.N}</td>
                  {r.pot.kind === "mixed" && <td className="p-2">{r.energy.toFixed(8)}</td>}
                  <td className={`p-2 ${isBest ? "font-semibold text-red-600" : ""}`} title={isBest ? "Best for these parameters, domain and direction (including numerical ties)" : undefined}>{comparisonValue(r).toFixed(8)}{isBest && <span className="sr-only"> (best for these parameters)</span>}</td>
                  <td className="p-2"><button type="button" className="rounded border px-2 py-1 hover:bg-gray-100" onClick={() => load(r.id)} aria-label={`Load record ${r.id}, N=${r.N}`}>Load</button></td>
                </tr>;
              })}</tbody>
            </table>
          </div>}
      </div>
    </section>
  );
}
