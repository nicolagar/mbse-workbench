import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { builtInUnitDefinitions, validateUnitDefinition } from "../domain/units";
import type { UnitDefinition } from "../domain/types";
import { selectActiveProject, useAppStore } from "../store/useAppStore";

export function UnitCatalogueDialog({ onClose }: { onClose: () => void }) {
  const project = useAppStore(selectActiveProject)!;
  const addUnit = useAppStore((state) => state.addUnitDefinition);
  const deleteUnit = useAppStore((state) => state.deleteUnitDefinition);
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [quantityName, setQuantityName] = useState("");
  const [factor, setFactor] = useState("1");
  const [dimension, setDimension] = useState('{"length": 1}');
  const [aliases, setAliases] = useState("");
  const [error, setError] = useState("");

  const create = () => {
    try {
      const parsed = JSON.parse(dimension) as Record<string, number>;
      if (!parsed || typeof parsed !== "object" || Object.values(parsed).some((value) => typeof value !== "number" || !Number.isFinite(value))) {
        throw new Error("Dimension must be a JSON object with numeric exponents.");
      }
      const definition: UnitDefinition = {
        id: `unit-${crypto.randomUUID()}`,
        symbol: symbol.trim(),
        name: name.trim(),
        quantityName: quantityName.trim(),
        dimension: parsed,
        factorToSI: Number(factor),
        aliases: aliases.split(",").map((alias) => alias.trim()).filter(Boolean)
      };
      const validationError = validateUnitDefinition(definition, project.unitDefinitions);
      if (validationError) throw new Error(validationError);
      addUnit(definition);
      setSymbol("");
      setName("");
      setQuantityName("");
      setAliases("");
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The custom unit is invalid.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-6">
      <section className="card max-h-[90vh] w-full max-w-5xl overflow-auto p-5" role="dialog" aria-modal="true" aria-label="Unit catalogue">
        <div className="flex items-start gap-3"><div className="flex-1"><h2 className="text-xl font-bold">Engineering unit catalogue</h2><p className="text-sm text-slate-500">Built-in quantities follow ISO 80000 quantity/SI conventions. Project extensions explicitly define dimensions and conversion factors; this demonstrator does not claim standards certification.</p></div><button className="btn p-2" aria-label="Close unit catalogue" onClick={onClose}><X size={16} /></button></div>
        <div className="mt-5 grid grid-cols-[1.2fr_1fr] gap-5">
          <section>
            <h3 className="font-bold">Built-in catalogue</h3>
            <div className="mt-2 max-h-96 overflow-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-xs"><thead><tr><th className="table-cell">Symbol</th><th className="table-cell">Quantity</th><th className="table-cell">Reference</th></tr></thead><tbody>{builtInUnitDefinitions.map((unit) => <tr key={unit.id}><td className="table-cell font-mono font-bold">{unit.symbol}</td><td className="table-cell">{unit.quantityName}</td><td className="table-cell">{unit.isoReference ?? "Engineering extension"}</td></tr>)}</tbody></table>
            </div>
          </section>
          <section>
            <h3 className="font-bold">Add project unit</h3>
            <div className="mt-2 space-y-2 rounded-lg border border-slate-200 p-3">
              <div className="grid grid-cols-2 gap-2"><label><span className="label">Symbol</span><input className="field" value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder="ft" /></label><label><span className="label">Name</span><input className="field" value={name} onChange={(event) => setName(event.target.value)} placeholder="foot" /></label></div>
              <label><span className="label">Quantity name</span><input className="field" value={quantityName} onChange={(event) => setQuantityName(event.target.value)} placeholder="length" /></label>
              <label><span className="label">Dimension exponents</span><input className="field font-mono" value={dimension} onChange={(event) => setDimension(event.target.value)} /><span className="mt-1 block text-[11px] text-slate-500">Examples: {`{"length":1}`} or {`{"length":1,"time":-1}`}.</span></label>
              <label><span className="label">Factor to SI</span><input className="field" type="number" step="any" min="0" value={factor} onChange={(event) => setFactor(event.target.value)} /></label>
              <label><span className="label">Aliases, comma separated</span><input className="field" value={aliases} onChange={(event) => setAliases(event.target.value)} /></label>
              {error && <p className="rounded bg-red-50 p-2 text-xs text-red-700">{error}</p>}
              <button className="btn btn-primary w-full" onClick={create}><Plus size={14} /> Add custom unit</button>
            </div>
            <h3 className="mt-5 font-bold">Project units</h3>
            <div className="mt-2 space-y-2">{project.unitDefinitions.map((unit) => <div className="flex items-center gap-2 rounded border border-slate-200 p-2 text-sm" key={unit.id}><code className="font-bold text-blue-700">{unit.symbol}</code><span className="min-w-0 flex-1">{unit.name} · ×{unit.factorToSI} SI</span><button className="btn btn-danger p-2" aria-label={`Delete ${unit.symbol}`} onClick={() => deleteUnit(unit.id)}><Trash2 size={13} /></button></div>)}{!project.unitDefinitions.length && <p className="text-sm text-slate-500">No project-specific units.</p>}</div>
          </section>
        </div>
      </section>
    </div>
  );
}
