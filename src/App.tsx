import { Dashboard } from "./components/Dashboard";
import { ArchitectView } from "./components/ArchitectView";
import { PerspectiveSelection } from "./components/PerspectiveSelection";
import { SimplifiedTradeStudyWorkspace } from "./components/SimplifiedTradeStudyWorkspace";
import { ExportWorkspace } from "./components/ExportWorkspace";
import { ModelWorkspace } from "./components/ModelWorkspace";
import { ParametersWorkspace } from "./components/ParametersWorkspace";
import { RecoveryView } from "./components/RecoveryView";
import { Shell } from "./components/Shell";
import { SimulationWorkspace } from "./components/SimulationWorkspace";
import { VariabilityWorkspace } from "./components/VariabilityWorkspace";
import { ProjectRecapWorkspace } from "./components/ProjectRecapWorkspace";
import { ScopeOntologyWorkspace } from "./components/ScopeOntologyWorkspace";
import { useAppStore } from "./store/useAppStore";

export function App() {
  const corrupt = useAppStore((state) => state.corruptRaw);
  const workspace = useAppStore((state) => state.uiPreferences.activeWorkspace);
  const perspective = useAppStore((state) => state.uiPreferences.activePerspective);
  if (corrupt !== undefined) return <RecoveryView />;
  if (perspective === "architect") return <ArchitectView />;
  return (
    <>
      <Shell>
        {workspace === "dashboard" && <Dashboard />}
        {workspace === "model" && <ModelWorkspace />}
        {workspace === "ontology" && <ScopeOntologyWorkspace />}
        {workspace === "variability" && <VariabilityWorkspace />}
        {workspace === "parameters" && <ParametersWorkspace />}
        {workspace === "simulation" && <SimulationWorkspace />}
        {workspace === "comparison" && <SimplifiedTradeStudyWorkspace />}
        {workspace === "recap" && <ProjectRecapWorkspace />}
        {workspace === "export" && <ExportWorkspace />}
      </Shell>
      {!perspective && <PerspectiveSelection />}
    </>
  );
}
