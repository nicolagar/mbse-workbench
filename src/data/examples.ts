import type { Project } from "../domain/types";
import { createOhscSampleProject } from "./ohscSample";
import { createCoffeeMachineSampleProject } from "./sample";
import { createColdChainSimulationExample, createEmergencyLightingExample } from "./scopeExamples";

export type ExampleProjectId = "coffee-machine" | "aircraft-ohsc" | "emergency-lighting" | "cold-chain-simulation";

export interface ExampleProjectDefinition {
  id: ExampleProjectId;
  name: string;
  description: string;
  purpose: string;
}

export const exampleProjectDefinitions: ExampleProjectDefinition[] = [
  {
    id: "coffee-machine",
    name: "Coffee-machine product line",
    description: "Compact worked example with three alternatives and a complete MBSE/MBPLE workflow.",
    purpose: "Introduction"
  },
  {
    id: "aircraft-ohsc",
    name: "Aircraft OHSC product family",
    description: "Detailed aviation demonstrator comparing Standard A with three multi-axis product, process and resource change solutions.",
    purpose: "Trade-off Study"
  },
  {
    id: "emergency-lighting",
    name: "Portable Emergency Lighting Unit",
    description: "Compact architecture-only example from operational context through product and industrial architecture.",
    purpose: "Architecture scope"
  },
  {
    id: "cold-chain-simulation",
    name: "Reusable Cold-Chain Transport Box",
    description: "Architecture and simulation example with ordered pack-out, resource demand, cycle time and throughput.",
    purpose: "Architecture + simulation"
  }
];

export function createExampleProject(exampleId: ExampleProjectId, projectId?: string): Project {
  if (exampleId === "aircraft-ohsc") return createOhscSampleProject(projectId);
  if (exampleId === "emergency-lighting") return createEmergencyLightingExample(projectId);
  if (exampleId === "cold-chain-simulation") return createColdChainSimulationExample(projectId);
  return createCoffeeMachineSampleProject(projectId);
}
