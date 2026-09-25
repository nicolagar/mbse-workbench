import { prepareOntologySample } from "./ontologySample";
import { deriveConfiguration } from "../domain/derivation";
import { runSimulation } from "../domain/simulation";
import { runBoundedRobustness, runFixedWeightSensitivity, runTradeStudyMethodology } from "../domain/tradeStudyMethodology";
import type {
  Architecture,
  ComparisonRisk,
  ComparisonStudy,
  Configuration,
  ElementMetadata,
  ElementType,
  Feature,
  FeatureConstraint,
  FeatureGroup,
  FunctionSequence,
  KPI,
  ModelElement,
  Parameter,
  Project,
  Relationship,
  ScalarValue,
  SimulationRun,
  VariabilityAxis,
  VariationPoint,
  VariationScope
} from "../domain/types";

const stamp = "2026-09-09T08:00:00.000Z";
const configurationIds = ["CFG-A", "CFG-B", "CFG-C", "CFG-D"];
const scopes: VariationScope[] = ["structure", "behavior", "process", "resources", "verification"];

const p = (
  id: string,
  ownerElementId: string,
  name: string,
  semanticKey: string,
  value: ScalarValue,
  unit?: string,
  uncertaintyPercent = 5
): Parameter => ({
  id,
  ownerElementId,
  name,
  semanticKey,
  description: `${name} for the fictional OHSC demonstrator.`,
  dataType: typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string",
  value,
  unit,
  valueOrigin: "assumed",
  source: "OHSC demonstrator assumption — not approved aircraft-design data",
  uncertaintyPercent: typeof value === "number" ? uncertaintyPercent : undefined,
  applicableConfigurationIds: [...configurationIds]
});

const e = (
  id: string,
  elementType: ElementType,
  name: string,
  description: string,
  metadata: ElementMetadata = {},
  parameters: Parameter[] = []
): ModelElement => ({
  id,
  elementType,
  name,
  description,
  status: "reviewed",
  architectureScope: "common",
  parameters,
  customAttributeValues: {},
  tags: ["OHSC", elementType],
  metadata: {
    source: "OHSC demonstrator specification v4.0",
    owner: "Systems Engineering",
    creationOrigin: "sample",
    ...metadata
  },
  createdAt: stamp,
  updatedAt: stamp
});

let relationshipIndex = 0;
const r = (
  sourceId: string,
  relationshipType: Relationship["relationshipType"],
  targetId: string,
  patch: Partial<Relationship> = {}
): Relationship => ({
  id: `OHSC-REL-${String(++relationshipIndex).padStart(4, "0")}`,
  sourceId,
  relationshipType,
  targetId,
  creationOrigin: "sample",
  createdAt: stamp,
  updatedAt: stamp,
  ...patch
});

const productExpressions = {
  A: "FEAT-AX01-COMPACT and FEAT-AX02-STANDARD",
  B: "FEAT-AX01-EXTENDED and FEAT-AX02-REINFORCED",
  C: "FEAT-AX01-BALANCED and FEAT-AX02-WEIGHT-OPT",
  D: "FEAT-AX01-COMPACT and FEAT-AX02-WEIGHT-OPT"
};
const routeExpressions = {
  A: "FEAT-AX07-STANDARD-ROUTE",
  B: "FEAT-AX07-CAPACITY-ROUTE",
  C: "FEAT-AX07-MODULAR-ROUTE",
  D: "FEAT-AX07-LIGHTWEIGHT-ROUTE"
};

const valueRules = (id: string, values: [ScalarValue, ScalarValue, ScalarValue, ScalarValue], route = false) =>
  (["A", "B", "C", "D"] as const).map((key, index) => ({
    id: `${id}-${key}`,
    featureExpression: (route ? routeExpressions : productExpressions)[key],
    featureValueConditions: [],
    value: values[index]
  }));

const parameterVariation = (
  id: string,
  ownerId: string,
  parameterId: string,
  values: [ScalarValue, ScalarValue, ScalarValue, ScalarValue],
  scope: VariationScope,
  route = false,
  featureExpression = ""
): VariationPoint => ({
  id,
  name: `${parameterId} configured value`,
  description: "Applies a feature-controlled parameter value while preserving the stable parameter identity.",
  kind: "primitiveProperty",
  constrainedElementIds: [ownerId],
  constrainedRelationshipIds: [],
  featureExpression,
  featureValueConditions: [],
  propertyPath: `parameter:${parameterId}:value`,
  valueRules: valueRules(id, values, route),
  unmatchedBehavior: "error",
  scope,
  enabled: true,
  createdAt: stamp,
  updatedAt: stamp
});

const requirementDefinitions = [
  ["OHSC-REQ-001", "The OHSC segment shall provide at least 760 L aggregate usable storage volume.", "mandatory", "@usable_volume >= 760", "kpi", "KPI-01", "PF-02", "VM-01"],
  ["OHSC-REQ-002", "The OHSC segment shall accommodate at least 12 defined reference bags in the prescribed loading orientation.", "important", "@reference_bag_count >= 12", "parameter", "PAR-PC01-REFERENCE-BAG-COUNT", "PF-01", "VM-02"],
  ["OHSC-REQ-003", "The OHSC segment placarded maximum contents mass shall be at least 96 kg.", "mandatory", "@placarded_content_mass >= 96", "parameter", "PAR-PC01-PLACARDED-CONTENT-MASS", "PF-03", "VM-03"],
  ["OHSC-REQ-004", "Each reference opening shall provide at least 610 mm clear width in the defined loading position.", "important", "@clear_opening_width >= 610", "parameter", "PAR-PC02-CLEAR-WIDTH", "PF-01", "VM-13"],
  ["OHSC-REQ-005", "Each reference opening shall provide at least 260 mm clear height in the defined loading position.", "important", "@clear_opening_height >= 260", "parameter", "PAR-PC02-CLEAR-HEIGHT", "PF-01", "VM-13"],
  ["OHSC-REQ-006", "Opening force at the declared handle point shall not exceed 60 N under the defined load condition.", "important", "@opening_force <= 60", "parameter", "PAR-PC02-OPENING-FORCE", "PF-12", "VM-11"],
  ["OHSC-REQ-007", "Closing force at the declared handle point shall not exceed 80 N under the defined load condition.", "important", "@closing_force <= 80", "parameter", "PAR-PC02-CLOSING-FORCE", "PF-04", "VM-11"],
  ["OHSC-REQ-008", "Cabin crew shall be able to determine secure state within 2 seconds per bin position.", "important", "@secure_state_inspection_time <= 2", "parameter", "PAR-PC03-SECURE-CHECK-TIME", "PF-05", "VM-09"],
  ["OHSC-REQ-009", "The latch and retention concept shall have a service-life goal of at least 20000 representative cycles.", "important", "@latch_durability >= 20000", "parameter", "PAR-PC03-LATCH-DURABILITY", "PF-03", "VM-08"],
  ["OHSC-REQ-010", "The OHSC empty installed-segment mass shall not exceed 32 kg.", "mandatory", "@empty_mass <= 32", "kpi", "KPI-02", "PF-06", "VM-14"],
  ["OHSC-REQ-011", "Empty-segment centre-of-gravity radial offset shall not exceed 120 mm from the reference point.", "important", "@empty_cg_offset <= 120", "parameter", "PAR-PC01-EMPTY-CG-OFFSET", "PF-06", "VM-15"],
  ["OHSC-REQ-012", "Preliminary attachment screening utilisation shall not exceed 1.0 for the declared static case.", "mandatory", "@attachment_screening_utilization <= 1", "parameter", "PAR-PC05-ATTACHMENT-UTILIZATION", "PF-06", "VM-04"],
  ["OHSC-REQ-013", "The installation geometry shall preserve at least 20 mm static clearance to adjacent service envelopes.", "mandatory", "@minimum_static_service_clearance >= 20", "parameter", "PAR-PC09-MIN-CLEARANCE", "PF-07", "VM-13"],
  ["OHSC-REQ-014", "OHSC-segment installation effort shall not exceed 15 person-hours under the declared scenario.", "mandatory", "@installation_effort <= 15", "kpi", "KPI-04", "PRF-07", "VM-18"],
  ["OHSC-REQ-015", "The representative latch module shall be replaceable within 1.10 technician-hour.", "mandatory", "@latch_replacement_time <= 1.10", "kpi", "KPI-05", "PF-09", "VM-16"],
  ["OHSC-REQ-016", "At least 70 percent of the controlled Standard A common part-number set shall be reused.", "important", "@common_part_reuse >= 70", "parameter", "PAR-PC08-COMMON-PART-REUSE", "PF-09", "VM-20"],
  ["OHSC-REQ-017", "End-of-line verification duration shall not exceed 0.75 hour per OHSC segment.", "important", "@eol_verification_duration <= 0.75", "parameter", "PAR-ISC06-EOL-DURATION", "PRF-06", "VM-18"],
  ["OHSC-REQ-018", "Relative recurring-cost index shall not exceed 130 with Standard A fixed at 100.", "important", "@recurring_cost_index <= 130", "kpi", "KPI-03", "PRF-05", "VM-21"],
  ["OHSC-REQ-019", "The installed segment shall display the configuration-consistent contents-weight limitation.", "mandatory", "", "", "", "PF-11", "VM-03"],
  ["OHSC-REQ-020", "Each compartment shall address its placarded contents mass and declared critical load distribution.", "mandatory", "", "", "", "PF-03", "VM-04"],
  ["OHSC-REQ-021", "The contents-restraint concept shall prevent baggage from becoming a hazard by shifting.", "mandatory", "", "", "", "PF-03", "VM-05"],
  ["OHSC-REQ-022", "The installed OHSC segment shall remain retained under the declared flight, ground and emergency conditions.", "mandatory", "", "", "", "PF-06", "VM-04"],
  ["OHSC-REQ-023", "The OHSC and its contents shall not create an unacceptable occupant-injury or projection condition.", "mandatory", "", "", "", "PF-07", "VM-06"],
  ["OHSC-REQ-024", "OHSC deformation, detachment or contents release shall not create an adjacent-system hazard.", "mandatory", "", "", "", "PF-07", "VM-06"],
  ["OHSC-REQ-025", "OHSC deformation, detachment or contents release shall not invalidate emergency-egress interfaces.", "mandatory", "", "", "", "PF-07", "VM-07"],
  ["OHSC-REQ-026", "Doors, buckets, hinges and latches shall retain their restraint function after expected deterioration.", "mandatory", "", "", "", "PF-03", "VM-08"],
  ["OHSC-REQ-027", "Each selected material and finish configuration shall identify cabin-interior flammability evidence.", "mandatory", "", "", "", "PF-08", "VM-10"],
  ["OHSC-REQ-028", "Heat-release and smoke-emission criteria shall be assessed and recorded for selected interior surfaces.", "mandatory", "", "", "", "PF-08", "VM-10"],
  ["OHSC-REQ-029", "The installed configuration shall preserve declared PSU, lighting, ECS and oxygen-system envelopes.", "mandatory", "", "", "", "PF-07", "VM-13"],
  ["OHSC-REQ-030", "Each 100 percent configuration shall reference one controlled maintenance, EOL and installation data set.", "mandatory", "", "", "", "PF-10", "VM-17"]
] as const;

const requirementBasisById: Record<string, string> = {
  "OHSC-REQ-001": "DEMONSTRATOR_ASSUMPTION informed by SR-11 and SR-12", "OHSC-REQ-002": "DEMONSTRATOR_ASSUMPTION informed by SR-11 and the declared reference bag",
  "OHSC-REQ-003": "REGULATORY_BASIS SR-01 and SR-06 plus the demonstrator loading convention", "OHSC-REQ-004": "DEMONSTRATOR_ASSUMPTION based on the reference-bag envelope",
  "OHSC-REQ-005": "DEMONSTRATOR_ASSUMPTION based on the reference-bag envelope", "OHSC-REQ-006": "DEMONSTRATOR_ASSUMPTION; not a regulatory force limit",
  "OHSC-REQ-007": "DEMONSTRATOR_ASSUMPTION; not a regulatory force limit", "OHSC-REQ-008": "DEMONSTRATOR_ASSUMPTION; no validated human-factors claim",
  "OHSC-REQ-009": "DEMONSTRATOR_ASSUMPTION informed by SR-01 and SR-09", "OHSC-REQ-010": "DEMONSTRATOR_ASSUMPTION defining the Standard A empty-mass bound",
  "OHSC-REQ-011": "DEMONSTRATOR_ASSUMPTION; simplified local mass-property metric", "OHSC-REQ-012": "DEMONSTRATOR_CALCULATION; concept screening only",
  "OHSC-REQ-013": "DEMONSTRATOR_ASSUMPTION informed by SR-10 and SR-12", "OHSC-REQ-014": "DEMONSTRATOR_ASSUMPTION defining the Standard A installation-effort bound",
  "OHSC-REQ-015": "DEMONSTRATOR_ASSUMPTION informed by SR-07 and SR-12", "OHSC-REQ-016": "DEMONSTRATOR_CALCULATION against the controlled Standard A common-part set",
  "OHSC-REQ-017": "DEMONSTRATOR_ASSUMPTION for the industrial system", "OHSC-REQ-018": "DEMONSTRATOR_CALCULATION; relative index with Standard A equal to 100",
  "OHSC-REQ-019": "REGULATORY_BASIS SR-06 and SR-09", "OHSC-REQ-020": "REGULATORY_BASIS SR-01 and SR-09",
  "OHSC-REQ-021": "REGULATORY_BASIS SR-01 and SR-09", "OHSC-REQ-022": "REGULATORY_BASIS SR-02, SR-03, SR-09 and SR-13",
  "OHSC-REQ-023": "REGULATORY_BASIS SR-01, SR-02 and SR-09", "OHSC-REQ-024": "REGULATORY_BASIS SR-01, SR-02 and SR-09",
  "OHSC-REQ-025": "REGULATORY_BASIS SR-01, SR-02 and SR-09", "OHSC-REQ-026": "REGULATORY_BASIS SR-01 and SR-09",
  "OHSC-REQ-027": "REGULATORY_BASIS SR-04, SR-05 and SR-09", "OHSC-REQ-028": "REGULATORY_BASIS SR-04, SR-05 and SR-09",
  "OHSC-REQ-029": "PUBLIC_PRODUCT_CONTEXT SR-10 and SR-12 plus a demonstrator oxygen-interface assumption", "OHSC-REQ-030": "REGULATORY_BASIS SR-07 plus demonstrator configuration control"
};

const ohscSampleCache = new Map<string, Project>();

function buildOhscSampleProject(projectId: string): Project {
  relationshipIndex = 0;
  const elements: ModelElement[] = [];

  elements.push(e("OHSC-MIS-001", "mission", "Enable safe and effective overhead stowage in a single-aisle passenger cabin", "Provide passengers and cabin crew with usable, secure and maintainable stowage for permitted carry-on items throughout aircraft ground, flight, turnaround, maintenance and relevant emergency conditions, while remaining compatible with the defined cabin and aircraft interfaces. This mission does not prescribe Standard A, a successor architecture or a future trade decision."));

  elements.push(e("STK-00", "system", "Configurable OHSC Installation Segment", "The delivered OHSC installation segment is the system of interest. It includes the bucket or bin, door, latch, assistance, attachment kit, closeouts, placards and maintainability provisions; it excludes the aircraft structure, cabin monuments, PSU, lighting, ECS, oxygen system, baggage and industrial equipment.", {
    architectureRootId: "STK-00-assembly",
    systemBoundary: "Inside: the delivered four-position OHSC installation segment and its installation provisions. Outside: aircraft structure, cabin lining, PSU/lighting, ECS, passenger oxygen, baggage, people and industrial equipment. Aircraft-side modification mass, cost and schedule are outside the OHSC KPI boundary."
  }));
  const stakeholders = [
    ["STK-01", "Airline operator"], ["STK-02", "Passenger"], ["STK-03", "Cabin crew"],
    ["STK-04", "Aircraft integrator"], ["STK-05", "Maintenance organisation"],
    ["STK-06", "Airworthiness and certification function"], ["STK-07", "Manufacturing and installation engineering"],
    ["STK-08", "Configuration-management function"]
  ] as const;
  stakeholders.forEach(([id, name]) => elements.push(e(id, "stakeholder", name, `${name} represented in the OHSC lifecycle context.`)));

  const needs = [
    ["N-01", "Accommodate the intended cabin-baggage demand without unacceptable mass, recurring cost, installation burden or downtime"],
    ["N-02", "Load and retrieve the reference bag with understandable, manageable interaction and controlled contents release"],
    ["N-03", "Determine that each OHSC is closed and positively latched before critical flight phases"],
    ["N-04", "Install the selected OHSC without unacceptable structural, mass-property, envelope or adjacent-system impacts"],
    ["N-05", "Inspect the OHSC and replace declared wear items efficiently using controlled data and tooling"],
    ["N-06", "Receive traceable requirements, applicability, proposed means of compliance and evidence maturity"],
    ["N-07", "Produce and install multiple configurations from controlled common product, process and resource content"],
    ["N-08", "Assess a controlled change without losing the fictional Standard A baseline definition or evidence history"]
  ] as const;
  const objectives = [
    ["OBJ-01", "Increase usable baggage capacity while maintaining a viable aircraft-integration and lifecycle concept"],
    ["OBJ-02", "Provide adequate opening geometry and bounded operating forces for the declared use conditions"],
    ["OBJ-03", "Provide an unambiguous, rapidly inspectable secure-state indication and manageable loaded operation"],
    ["OBJ-04", "Maintain controlled mass, attachment, clearance, egress, PSU, ECS, lighting and oxygen-system interfaces"],
    ["OBJ-05", "Provide defined access, effectivity, instructions and bounded latch-replacement time"],
    ["OBJ-06", "Preserve regulatory basis, verification method, conditions, limitations and immutable evidence history without asserting compliance"],
    ["OBJ-07", "Reuse common parts, data and resources while applying configuration-correct work steps, tooling and inspections"],
    ["OBJ-08", "Evaluate coordinated OHSC product, integration, service and industrialisation variability using traced requirements, KPI calculations and documented risks, without presupposing a replacement decision"]
  ] as const;
  needs.forEach(([id, name]) => elements.push(e(id, "need", name, `${name}.`)));
  objectives.forEach(([id, name]) => elements.push(e(id, "objective", name, `${name}.`)));

  const useCases = [
    ["UC-01", "Load defined reference baggage"], ["UC-02", "Close and secure the loaded OHSC"],
    ["UC-03", "Verify cabin-secure state"], ["UC-04", "Open OHSC and retrieve baggage"],
    ["UC-05", "Inspect and service OHSC"], ["UC-06", "Produce the selected OHSC configuration"],
    ["UC-07", "Install OHSC in the representative cabin section"], ["UC-08", "Accept the completed and installed OHSC configuration"]
  ] as const;
  useCases.forEach(([id, name]) => elements.push(e(id, "useCase", name, `${name} within the declared OHSC lifecycle boundary.`, { subjectSystemId: "STK-00" })));

  const productFunctions = [
    ["PF-01", "Provide access for baggage loading and retrieval"], ["PF-02", "Provide usable baggage-stowage envelope"],
    ["PF-03", "Restrain baggage throughout applicable operating conditions"], ["PF-04", "Close and positively retain the door or bucket"],
    ["PF-05", "Indicate secure state to cabin crew"], ["PF-06", "Transfer empty-OHSC and placarded-contents loads to aircraft interfaces"],
    ["PF-07", "Protect occupants, escape paths and adjacent systems"], ["PF-08", "Provide applicable cabin-interior fire-performance characteristics"],
    ["PF-09", "Enable inspection and controlled replacement of wear items"], ["PF-10", "Enable configuration-correct installation and removal"],
    ["PF-11", "Provide load-limit and configuration identification"], ["PF-12", "Release the latch and control opening motion"]
  ] as const;
  productFunctions.forEach(([id, name]) => elements.push(e(id, "productFunction", name, `${name} for the OHSC installation segment.`)));

  const componentParameters: Record<string, Parameter[]> = {
    "PC-01": [
      p("PAR-PC01-VOLUME-POS-01", "PC-01", "Usable volume position 1", "usableStorageVolumePosition01", 185, "L", 3),
      p("PAR-PC01-VOLUME-POS-02", "PC-01", "Usable volume position 2", "usableStorageVolumePosition02", 195, "L", 3),
      p("PAR-PC01-VOLUME-POS-03", "PC-01", "Usable volume position 3", "usableStorageVolumePosition03", 195, "L", 3),
      p("PAR-PC01-VOLUME-POS-04", "PC-01", "Usable volume position 4", "usableStorageVolumePosition04", 185, "L", 3),
      p("PAR-PC01-PRODUCT-COST-POINTS", "PC-01", "Product recurring cost points", "recurringProductCostPoints", 55, "indexpoint", 15),
      p("PAR-PC01-REFERENCE-BAG-COUNT", "PC-01", "Reference bag count", "referenceBagCount", 12, "part", 0),
      p("PAR-PC01-BUCKET-MASS", "PC-01", "Bucket and shell mass", "mass", 12, "kg", 5),
      p("PAR-PC01-PLACARDED-CONTENT-MASS", "PC-01", "Placarded content mass", "placardedContentMass", 96, "kg", 0),
      p("PAR-PC01-EMPTY-CG-OFFSET", "PC-01", "Empty CG radial offset", "emptyAssemblyCgOffset", 100, "mm", 5)
    ],
    "PC-02": [
      p("PAR-PC02-DOOR-MASS", "PC-02", "Door mass", "mass", 7, "kg", 5),
      p("PAR-PC02-CLEAR-WIDTH", "PC-02", "Clear opening width", "clearOpeningWidth", 610, "mm", 3),
      p("PAR-PC02-CLEAR-HEIGHT", "PC-02", "Clear opening height", "clearOpeningHeight", 260, "mm", 3),
      p("PAR-PC02-OPENING-FORCE", "PC-02", "Opening force", "openingForce", 58, "N", 10),
      p("PAR-PC02-CLOSING-FORCE", "PC-02", "Closing force", "closingForce", 78, "N", 10)
    ],
    "PC-03": [
      p("PAR-PC03-LATCH-MASS", "PC-03", "Latch mass", "mass", 1.5, "kg", 5),
      p("PAR-PC03-TIME-ACCESS", "PC-03", "Latch access time", "latchAccessTime", 0.2, "h", 20),
      p("PAR-PC03-TIME-REMOVE", "PC-03", "Latch removal time", "latchRemovalTime", 0.3, "h", 20),
      p("PAR-PC03-TIME-INSTALL", "PC-03", "Latch installation time", "latchInstallationTime", 0.35, "h", 20),
      p("PAR-PC03-TIME-FUNCTIONAL-CHECK", "PC-03", "Latch functional-check time", "latchFunctionalCheckTime", 0.25, "h", 20),
      p("PAR-PC03-SECURE-CHECK-TIME", "PC-03", "Secure-state inspection time", "secureStateInspectionTime", 2, "s", 10),
      p("PAR-PC03-LATCH-DURABILITY", "PC-03", "Latch durability", "latchDurability", 20000, "cycle", 10)
    ],
    "PC-04": [
      p("PAR-PC04-ASSIST-MASS", "PC-04", "Passive assist mass", "mass", 1.5, "kg", 5),
      p("PAR-PC04-ASSIST-INSTALLED", "PC-04", "Passive assist installed", "assistInstalled", true),
      p("PAR-PC04-CLOSING-FORCE-CONTRIBUTION", "PC-04", "Closing-force contribution", "closingForceContribution", -13, "N", 10)
    ],
    "PC-05": [
      p("PAR-PC05-ATTACHMENT-KIT-MASS", "PC-05", "Attachment kit mass", "mass", 6, "kg", 5),
      p("PAR-PC05-ATTACHMENT-UTILIZATION", "PC-05", "Attachment screening utilisation", "attachmentScreeningUtilization", 0.91, "1", 10),
      p("PAR-PC05-INTERFACE-PATTERN-ID", "PC-05", "Interface pattern identifier", "interfacePatternId", "A-IFC")
    ],
    "PC-06": [p("PAR-PC06-CLOSEOUT-MASS", "PC-06", "Closeout mass", "mass", 5, "kg", 5), p("PAR-PC06-MATERIAL-EVIDENCE-STATUS", "PC-06", "Material evidence status", "materialEvidenceStatus", "preliminary-record-linked")],
    "PC-07": [p("PAR-PC07-PLACARD-INSTALLED", "PC-07", "Placard installed", "placardInstalled", true), p("PAR-PC07-WEIGHT-DISPLAYED", "PC-07", "Placarded weight displayed", "placardedWeightDisplayed", true)],
    "PC-08": [p("PAR-PC08-COMMON-PART-REUSE", "PC-08", "Common part reuse", "commonPartReuse", 100, "%", 5), p("PAR-PC08-INSPECTION-ACCESS", "PC-08", "Inspection access available", "inspectionAccessAvailable", true), p("PAR-PC08-SPECIAL-TOOL-COUNT", "PC-08", "Special-tool count", "specialToolCount", 1, "part", 0)],
    "PC-09": [p("PAR-PC09-MIN-CLEARANCE", "PC-09", "Minimum static service clearance", "minimumStaticServiceClearance", 25, "mm", 5), p("PAR-PC09-CLEARANCE-STATUS", "PC-09", "Adjacent-service clearance status", "clearanceStatus", "preliminary-pass"), p("PAR-PC09-OXYGEN-STATUS", "PC-09", "Oxygen-mask deployment status", "oxygenMaskDeploymentStatus", "assessment-open")]
  };
  const components = [
    ["PC-01", "Storage bucket and shell"], ["PC-02", "Door and lid assembly"],
    ["PC-03", "Latch and secure-state indicator"], ["PC-04", "Passive door-assist mechanism"],
    ["PC-05", "Aircraft attachment and installation kit"], ["PC-06", "Closeouts and end panels"],
    ["PC-07", "Placard and identification set"], ["PC-08", "Maintenance-access provision"],
    ["PC-09", "Adjacent-system compatibility provision"]
  ] as const;
  const nonSeparateMass: Record<string, string> = {
    "PC-07": "Placard mass is included in the PC-06 closeout contribution.",
    "PC-08": "Maintenance-access hardware mass is included in the PC-05 attachment-kit contribution.",
    "PC-09": "This is a functional interface provision; any physical provisions are included in PC-01, PC-05 or PC-06."
  };
  components.forEach(([id, name]) => elements.push(e(id, "productComponent", name, `${name} within the common 150 percent OHSC architecture.`, nonSeparateMass[id] ? { massAccounting: "includedElsewhere", massAccountingNote: nonSeparateMass[id] } : {}, componentParameters[id])));

  ["Structural attachment", "Ceiling and sidewall envelope", "PSU and lighting clearance", "ECS duct clearance", "Passenger oxygen deployment", "Passenger and crew handling", "Maintenance access"].forEach((name, index) =>
    elements.push(e(`PI-${String(index + 1).padStart(2, "0")}`, "productInterface", `${name} interface`, `Controlled ${name.toLowerCase()} interface.`))
  );
  [
    ["EXT-01", "Aircraft supporting structure", "Aircraft-side attachment points and allowable loads outside the OHSC system boundary."],
    ["EXT-02", "Cabin ceiling and sidewall assembly", "Adjacent cabin lining and envelope outside the OHSC system boundary."],
    ["EXT-03", "Passenger-service and lighting installation", "Aircraft PSU and lighting equipment adjacent to the OHSC."],
    ["EXT-04", "Environmental-control ducting", "Aircraft ECS ducting adjacent to the OHSC installation envelope."],
    ["EXT-05", "Passenger oxygen system", "Aircraft passenger-oxygen equipment and deployment envelope adjacent to the OHSC."]
  ].forEach(([id, name, description]) => elements.push(e(id, "externalSystem", name, description, { owner: "Aircraft Integration" })));

  const processFunctions = [
    ["PRF-01", "Form and trim bucket and shell parts", "manufacturing"],
    ["PRF-02", "Prepare attachment and interface features", "manufacturing"],
    ["PRF-03", "Assemble door bucket and hinge set", "assembly"],
    ["PRF-04", "Install latch and passive-assist equipment", "assembly"],
    ["PRF-05", "Integrate OHSC segment", "integration"],
    ["PRF-06", "Perform end-of-line inspection and functional test", "verification"],
    ["PRF-07", "Install in representative cabin section", "integration"],
    ["PRF-08", "Perform installation acceptance inspection", "verification"]
  ] as const;
  processFunctions.forEach(([id, name, processType], index) => elements.push(e(id, "processFunction", name, `${name} for the configured OHSC segment.`, { processType, duration: [2, 2, 2, 1.5, 3, 0.7, 7, 1][index], durationUnit: "hour", owner: "Industrial Engineering" })));

  const industrialComponents = [
    ["ISC-01", "Forming and trim station"], ["ISC-02", "Drilling and interface fixture"],
    ["ISC-03", "Door and bucket assembly station"], ["ISC-04", "Latch and passive-assist station"],
    ["ISC-05", "Final assembly fixture"], ["ISC-06", "End-of-line inspection and test station"],
    ["ISC-07", "Cabin installation and support tooling"], ["ISC-08", "Installation QA station"]
  ] as const;
  const industrialParams: Record<string, Parameter[]> = {
    "ISC-05": [p("PAR-ISC05-PROCESS-COST-POINTS", "ISC-05", "Process recurring cost points", "recurringProcessCostPoints", 30, "indexpoint", 15)],
    "ISC-06": [p("PAR-ISC06-EOL-DURATION", "ISC-06", "End-of-line verification duration", "eolVerificationDuration", 0.7, "h", 20)],
    "ISC-07": [
      p("PAR-ISC07-RESOURCE-COST-POINTS", "ISC-07", "Resource recurring cost points", "recurringResourceCostPoints", 15, "indexpoint", 15),
      p("PAR-ISC07-EFFORT-PREPARE", "ISC-07", "Installation preparation effort", "installationPrepareEffort", 2, "person*h", 20),
      p("PAR-ISC07-EFFORT-POSITION", "ISC-07", "Installation positioning effort", "installationPositionEffort", 3, "person*h", 20),
      p("PAR-ISC07-EFFORT-ATTACH", "ISC-07", "Installation attachment effort", "installationAttachEffort", 5, "person*h", 20),
      p("PAR-ISC07-EFFORT-INTERFACE", "ISC-07", "Installation interface effort", "installationInterfaceEffort", 2, "person*h", 20),
      p("PAR-ISC07-EFFORT-LOCAL-CHECK", "ISC-07", "Installation local-check effort", "installationLocalCheckEffort", 2, "person*h", 20)
    ]
  };
  industrialComponents.forEach(([id, name]) => elements.push(e(id, "industrialSystemComponent", name, `${name} in the configurable industrial architecture.`, { owner: "Industrial Engineering" }, industrialParams[id] ?? [])));

  ["Material and part transfer", "Configuration data exchange", "Installation acceptance handoff"].forEach((name, index) =>
    elements.push(e(`PRI-${String(index + 1).padStart(2, "0")}`, "processInterface", `${name} interface`, `Controlled ${name.toLowerCase()} interface.`))
  );

  const resources = [
    ["RES-01", "Composite and interior manufacturing technician", "person"],
    ["RES-02", "Assembly technician", "person"], ["RES-03", "Installation technician", "person"],
    ["RES-04", "Quality and test technician", "person"], ["RES-05", "Forming and trim tooling", "tool"],
    ["RES-06", "Configuration-specific drilling fixture", "tool"], ["RES-07", "Calibrated torque tool", "tool"],
    ["RES-08", "Force gauge and functional-test fixture", "tool"], ["RES-09", "Digital inspection workstation", "software"],
    ["RES-10", "Configuration-controlled work-instruction dataset", "software"], ["RES-11", "OHSC handling and lifting support fixture", "tool"],
    ["RES-12", "Standard A route tooling package", "tool"], ["RES-13", "Capacity-upgrade route tooling package", "tool"],
    ["RES-14", "Modular route tooling package", "tool"], ["RES-15", "Lightweight rapid-install route tooling package", "tool"]
  ] as const;
  resources.forEach(([id, name, resourceType]) => elements.push(e(id, "resource", name, `${name} required by the declared industrial concept.`, { resourceType, owner: "Industrial Planning", hourlyRate: resourceType === "person" ? 60 : 20, costUnit: "indexpoint/h", capacityHours: 160, availabilityPercent: 85 })));

  const verificationMethods = [
    ["VM-01", "Geometry-volume analysis", "analysis"], ["VM-02", "Reference-bag loading demonstration", "demonstration"],
    ["VM-03", "Data and placard inspection", "inspection"], ["VM-04", "Preliminary load-path screening review", "analysis"],
    ["VM-05", "Contents-restraint demonstration", "demonstration"], ["VM-06", "Safety and compliance-planning review", "inspection"],
    ["VM-07", "Envelope and egress-interface inspection", "inspection"], ["VM-08", "Latch and retention durability-plan review", "inspection"],
    ["VM-09", "Crew secure-state demonstration", "demonstration"], ["VM-10", "Material evidence inspection", "inspection"],
    ["VM-11", "Door-force demonstration", "test"], ["VM-13", "Interface-control inspection", "inspection"],
    ["VM-14", "Mass roll-up analysis and weighing plan", "analysis"], ["VM-15", "Centre-of-gravity analysis", "analysis"],
    ["VM-16", "Timed maintenance demonstration", "demonstration"], ["VM-17", "Controlled-data-set inspection", "inspection"],
    ["VM-18", "Installation and process analysis", "analysis"], ["VM-19", "Installation-acceptance record inspection", "inspection"],
    ["VM-20", "Configuration-commonality analysis", "analysis"], ["VM-21", "Recurring-cost-index calculation", "analysis"]
  ] as const;
  verificationMethods.forEach(([id, name, verificationCategory]) => elements.push(e(id, "verificationMethod", name, `${name}; preliminary demonstrator evidence only.`, { verificationCategory, evidenceReviewStatus: "confirmed", evidenceReviewNote: "Reference and method reviewed; no compliance credit." })));

  const kpis: KPI[] = [
    { id: "KPI-01", name: "Usable storage volume", description: "Aggregate configured volume.", needIds: ["N-01", "N-08"], objectiveIds: ["OBJ-01", "OBJ-08"], calculationMode: "formula", formula: 'sum(param("PAR-PC01-VOLUME-POS-01"), param("PAR-PC01-VOLUME-POS-02"), param("PAR-PC01-VOLUME-POS-03"), param("PAR-PC01-VOLUME-POS-04"))', outputUnit: "L", optimizationDirection: "maximize", weight: 35, targetValue: 760, minimumThreshold: 760, inputParameterIds: ["PAR-PC01-VOLUME-POS-01", "PAR-PC01-VOLUME-POS-02", "PAR-PC01-VOLUME-POS-03", "PAR-PC01-VOLUME-POS-04"], dependsOnKpiIds: [], lastCalculatedValue: 760, calculationWarnings: [], createdAt: stamp, updatedAt: stamp },
    { id: "KPI-02", name: "OHSC empty installed-segment mass", description: "Active component mass roll-up excluding baggage and aircraft-side reinforcement.", needIds: ["N-01", "N-04", "N-08"], objectiveIds: ["OBJ-01", "OBJ-04", "OBJ-08"], calculationMode: "standardAlgorithm", standardAlgorithmKey: "totalMass", outputUnit: "kg", optimizationDirection: "minimize", weight: 25, maximumThreshold: 32, inputParameterIds: [], dependsOnKpiIds: [], lastCalculatedValue: 31.5, calculationWarnings: [], createdAt: stamp, updatedAt: stamp },
    { id: "KPI-03", name: "Relative recurring-cost index", description: "Product, process and resource comparative cost-point sum.", needIds: ["N-01", "N-07", "N-08"], objectiveIds: ["OBJ-01", "OBJ-07", "OBJ-08"], calculationMode: "formula", formula: 'sum(param("PAR-PC01-PRODUCT-COST-POINTS"), param("PAR-ISC05-PROCESS-COST-POINTS"), param("PAR-ISC07-RESOURCE-COST-POINTS"))', outputUnit: "indexpoint", optimizationDirection: "minimize", weight: 10, maximumThreshold: 130, inputParameterIds: ["PAR-PC01-PRODUCT-COST-POINTS", "PAR-ISC05-PROCESS-COST-POINTS", "PAR-ISC07-RESOURCE-COST-POINTS"], dependsOnKpiIds: [], lastCalculatedValue: 100, calculationWarnings: [], createdAt: stamp, updatedAt: stamp },
    { id: "KPI-04", name: "Installation effort", description: "Sum of five controlled installation task efforts.", needIds: ["N-04", "N-07", "N-08"], objectiveIds: ["OBJ-04", "OBJ-07", "OBJ-08"], calculationMode: "formula", formula: 'sum(param("PAR-ISC07-EFFORT-PREPARE"), param("PAR-ISC07-EFFORT-POSITION"), param("PAR-ISC07-EFFORT-ATTACH"), param("PAR-ISC07-EFFORT-INTERFACE"), param("PAR-ISC07-EFFORT-LOCAL-CHECK"))', outputUnit: "person*h", optimizationDirection: "minimize", weight: 15, maximumThreshold: 15, inputParameterIds: ["PAR-ISC07-EFFORT-PREPARE", "PAR-ISC07-EFFORT-POSITION", "PAR-ISC07-EFFORT-ATTACH", "PAR-ISC07-EFFORT-INTERFACE", "PAR-ISC07-EFFORT-LOCAL-CHECK"], dependsOnKpiIds: [], lastCalculatedValue: 14, calculationWarnings: [], createdAt: stamp, updatedAt: stamp },
    { id: "KPI-05", name: "Latch-replacement time", description: "Sum of access, removal, installation and functional-check time.", needIds: ["N-05", "N-08"], objectiveIds: ["OBJ-05", "OBJ-08"], calculationMode: "formula", formula: 'sum(param("PAR-PC03-TIME-ACCESS"), param("PAR-PC03-TIME-REMOVE"), param("PAR-PC03-TIME-INSTALL"), param("PAR-PC03-TIME-FUNCTIONAL-CHECK"))', outputUnit: "h", optimizationDirection: "minimize", weight: 15, maximumThreshold: 1.1, inputParameterIds: ["PAR-PC03-TIME-ACCESS", "PAR-PC03-TIME-REMOVE", "PAR-PC03-TIME-INSTALL", "PAR-PC03-TIME-FUNCTIONAL-CHECK"], dependsOnKpiIds: [], lastCalculatedValue: 1.1, calculationWarnings: [], createdAt: stamp, updatedAt: stamp }
  ];

  requirementDefinitions.forEach(([id, name, requirementClass, expression, bindingKind, targetId, , ]) => {
    const requirement = e(id, "systemRequirement", name, `${name} This is an unchanged Standard A baseline requirement.`, {
      requirementClass,
      source: requirementBasisById[id],
      notes: "Public sources establish traceability themes only. The workbench does not determine regulatory compliance.",
      verificationMethod: requirementDefinitions.find((definition) => definition[0] === id)?.[7],
      evidenceReviewStatus: expression ? undefined : "confirmed",
      evidenceReviewNote: expression ? undefined : "Preliminary evidence reference and method reviewed; no certification credit."
    });
    if (expression) {
      const symbol = expression.match(/^@([A-Za-z_][A-Za-z0-9_]*)/)?.[1] ?? "value";
      requirement.requirementFormula = {
        expression,
        bindings: [{ id: `BIND-${id}`, symbol, kind: bindingKind as "parameter" | "kpi", targetId }]
      };
    }
    elements.push(requirement);
  });

  const relationships: Relationship[] = [r("OHSC-MIS-001", "hasSOI", "STK-00")];
  stakeholders.forEach(([id]) => relationships.push(r("OHSC-MIS-001", "hasStakeholder", id)));
  ["EXT-01", "EXT-02", "EXT-03", "EXT-04", "EXT-05"].forEach((id) => relationships.push(r("OHSC-MIS-001", "participatesInMission", id)));
  needs.forEach(([id], index) => relationships.push(r(`STK-${String(index + 1).padStart(2, "0")}`, "hasNeed", id)));
  objectives.forEach(([id], index) => relationships.push(r(`STK-${String(index + 1).padStart(2, "0")}`, "hasObjective", id)));
  [["STK-01", ["UC-01", "UC-02", "UC-03", "UC-04", "UC-05"]], ["STK-02", ["UC-01", "UC-02", "UC-04"]], ["STK-03", ["UC-01", "UC-02", "UC-03", "UC-04"]], ["STK-04", ["UC-07", "UC-08"]], ["STK-05", ["UC-05"]], ["STK-06", ["UC-08"]], ["STK-07", ["UC-06", "UC-07", "UC-08"]], ["STK-08", ["UC-06", "UC-07", "UC-08"]]].forEach(([stakeholderId, ids]) => (ids as string[]).forEach((id) => relationships.push(r(stakeholderId as string, "involvedIn", id))));

  const needRequirementMap: Record<string, string[]> = {
    "N-01": ["OHSC-REQ-001", "OHSC-REQ-002", "OHSC-REQ-003", "OHSC-REQ-010", "OHSC-REQ-014", "OHSC-REQ-015", "OHSC-REQ-018"],
    "N-02": ["OHSC-REQ-002", "OHSC-REQ-004", "OHSC-REQ-005", "OHSC-REQ-006", "OHSC-REQ-007", "OHSC-REQ-021", "OHSC-REQ-023"],
    "N-03": ["OHSC-REQ-006", "OHSC-REQ-007", "OHSC-REQ-008", "OHSC-REQ-019", "OHSC-REQ-021", "OHSC-REQ-026"],
    "N-04": ["OHSC-REQ-010", "OHSC-REQ-011", "OHSC-REQ-012", "OHSC-REQ-013", "OHSC-REQ-020", "OHSC-REQ-022", "OHSC-REQ-024", "OHSC-REQ-025", "OHSC-REQ-029"],
    "N-05": ["OHSC-REQ-009", "OHSC-REQ-015", "OHSC-REQ-016", "OHSC-REQ-026", "OHSC-REQ-030"],
    "N-06": ["OHSC-REQ-019", "OHSC-REQ-020", "OHSC-REQ-021", "OHSC-REQ-022", "OHSC-REQ-023", "OHSC-REQ-024", "OHSC-REQ-025", "OHSC-REQ-026", "OHSC-REQ-027", "OHSC-REQ-028", "OHSC-REQ-029", "OHSC-REQ-030"],
    "N-07": ["OHSC-REQ-014", "OHSC-REQ-016", "OHSC-REQ-017", "OHSC-REQ-018", "OHSC-REQ-030"],
    "N-08": ["OHSC-REQ-001", "OHSC-REQ-010", "OHSC-REQ-014", "OHSC-REQ-015", "OHSC-REQ-016", "OHSC-REQ-017", "OHSC-REQ-018"]
  };
  Object.entries(needRequirementMap).forEach(([needId, ids]) => ids.forEach((requirementId) => relationships.push(r(needId, "derives", requirementId))));
  Object.entries(needRequirementMap).forEach(([needId, ids]) => ids.forEach((requirementId) => relationships.push(r(`OBJ-${needId.slice(2)}`, "derives", requirementId))));

  const useCaseFunctions: Record<string, string[]> = {
    "UC-01": ["PF-01", "PF-02", "PF-03", "PF-06", "PF-07", "PF-08", "PF-11"],
    "UC-02": ["PF-03", "PF-04", "PF-05", "PF-06", "PF-07", "PF-08", "PF-11"],
    "UC-03": ["PF-05", "PF-07", "PF-11"], "UC-04": ["PF-01", "PF-03", "PF-07", "PF-12"], "UC-05": ["PF-09", "PF-11"],
    "UC-06": ["PRF-01", "PRF-02", "PRF-03", "PRF-04", "PRF-05", "PRF-06"],
    "UC-07": ["PF-10", "PRF-07"], "UC-08": ["PF-06", "PF-07", "PF-08", "PRF-08"]
  };
  Object.entries(useCaseFunctions).forEach(([useCaseId, ids]) => ids.forEach((functionId) => relationships.push(r(useCaseId, "hasFunction", functionId))));
  const useCaseIntentMap: Record<string, string[]> = {
    "UC-01": ["N-01", "OBJ-01", "N-02", "OBJ-02"], "UC-02": ["N-02", "OBJ-02", "N-03", "OBJ-03"],
    "UC-03": ["N-03", "OBJ-03"], "UC-04": ["N-02", "OBJ-02", "N-03", "OBJ-03"],
    "UC-05": ["N-05", "OBJ-05", "N-06", "OBJ-06"], "UC-06": ["N-07", "OBJ-07", "N-08", "OBJ-08"],
    "UC-07": ["N-04", "OBJ-04", "N-07", "OBJ-07", "N-08", "OBJ-08"],
    "UC-08": ["N-04", "OBJ-04", "N-06", "OBJ-06", "N-07", "OBJ-07", "N-08", "OBJ-08"]
  };
  Object.entries(useCaseIntentMap).forEach(([useCaseId, ids]) => ids.forEach((intentId) => relationships.push(r(useCaseId, "addresses", intentId))));

  const functionComponentMap: Record<string, string[]> = {
    "PF-01": ["PC-01", "PC-02"], "PF-02": ["PC-01", "PC-06"], "PF-03": ["PC-01", "PC-02", "PC-03"], "PF-04": ["PC-02", "PC-03", "PC-04"],
    "PF-05": ["PC-03"], "PF-06": ["PC-01", "PC-05"], "PF-07": ["PC-01", "PC-02", "PC-05", "PC-06", "PC-09"], "PF-08": ["PC-01", "PC-02", "PC-06"],
    "PF-09": ["PC-03", "PC-04", "PC-08"], "PF-10": ["PC-05", "PC-08"], "PF-11": ["PC-07"], "PF-12": ["PC-02", "PC-03", "PC-04"]
  };
  Object.entries(functionComponentMap).forEach(([functionId, ids]) => ids.forEach((componentId) => relationships.push(r(functionId, "realizedBy", componentId))));
  processFunctions.forEach(([id], index) => relationships.push(r(id, "realizedBy", `ISC-${String(index + 1).padStart(2, "0")}`)));
  [
    ["EXT-01", "PI-01"], ["EXT-02", "PI-02"], ["EXT-03", "PI-03"], ["EXT-04", "PI-04"], ["EXT-05", "PI-05"],
    ["PC-05", "PI-01"], ["PC-01", "PI-02"], ["PC-02", "PI-02"], ["PC-09", "PI-03"], ["PC-09", "PI-04"], ["PC-09", "PI-05"],
    ["PC-02", "PI-06"], ["PC-03", "PI-06"], ["PC-03", "PI-07"], ["PC-08", "PI-07"],
    ["PF-06", "PI-01"], ["PF-07", "PI-02"], ["PF-07", "PI-03"], ["PF-07", "PI-04"], ["PF-07", "PI-05"], ["PF-01", "PI-06"], ["PF-09", "PI-07"]
  ].forEach(([sourceId, targetId]) => relationships.push(r(sourceId, "connects", targetId)));
  [
    ["PRF-01", "PRI-01"], ["PRF-02", "PRI-01"], ["ISC-01", "PRI-01"], ["ISC-02", "PRI-01"],
    ["PRF-06", "PRI-02"], ["PRF-08", "PRI-02"], ["ISC-06", "PRI-02"], ["ISC-08", "PRI-02"],
    ["PRF-07", "PRI-03"], ["PRF-08", "PRI-03"], ["ISC-07", "PRI-03"], ["ISC-08", "PRI-03"]
  ].forEach(([sourceId, targetId]) => relationships.push(r(sourceId, "connects", targetId)));
  const requirementSatisfactionMap: Record<string, string[]> = {
    "OHSC-REQ-001": ["PF-02", "PC-01"], "OHSC-REQ-002": ["PF-01", "PF-02", "PC-01", "PC-02"], "OHSC-REQ-003": ["PF-03", "PF-11", "PC-01", "PC-07"],
    "OHSC-REQ-004": ["PF-01", "PC-02"], "OHSC-REQ-005": ["PF-01", "PC-02"], "OHSC-REQ-006": ["PF-12", "PC-02", "PC-04"],
    "OHSC-REQ-007": ["PF-04", "PC-02", "PC-04"], "OHSC-REQ-008": ["PF-05", "PC-03"], "OHSC-REQ-009": ["PF-03", "PF-04", "PF-12", "PC-03"],
    "OHSC-REQ-010": ["PF-06", "PC-01", "PC-02", "PC-03", "PC-04", "PC-05", "PC-06"], "OHSC-REQ-011": ["PF-06", "PC-01", "PC-02", "PC-05"],
    "OHSC-REQ-012": ["PF-06", "PC-05"], "OHSC-REQ-013": ["PF-07", "PC-09"], "OHSC-REQ-014": ["PF-10", "PRF-07", "PC-05", "PC-08", "ISC-07"],
    "OHSC-REQ-015": ["PF-09", "PC-03", "PC-08"], "OHSC-REQ-016": ["PF-09", "PF-10", "PC-03", "PC-05", "PC-08"], "OHSC-REQ-017": ["PRF-06", "ISC-06"],
    "OHSC-REQ-018": ["PRF-01", "PRF-02", "PRF-03", "PRF-04", "PRF-05", "PRF-06", "PRF-07", "PRF-08", "ISC-01", "ISC-02", "ISC-03", "ISC-04", "ISC-05", "ISC-06", "ISC-07", "ISC-08"],
    "OHSC-REQ-019": ["PF-11", "PC-07"], "OHSC-REQ-020": ["PF-03", "PF-06", "PC-01", "PC-05"], "OHSC-REQ-021": ["PF-03", "PC-01", "PC-02", "PC-03"],
    "OHSC-REQ-022": ["PF-06", "PC-05"], "OHSC-REQ-023": ["PF-07", "PC-01", "PC-02", "PC-05", "PC-06"], "OHSC-REQ-024": ["PF-07", "PC-05", "PC-09"],
    "OHSC-REQ-025": ["PF-07", "PC-01", "PC-02", "PC-05"], "OHSC-REQ-026": ["PF-03", "PF-04", "PF-12", "PC-02", "PC-03"], "OHSC-REQ-027": ["PF-08", "PC-01", "PC-02", "PC-06"],
    "OHSC-REQ-028": ["PF-08", "PC-01", "PC-02", "PC-06"], "OHSC-REQ-029": ["PF-07", "PC-09"], "OHSC-REQ-030": ["PF-09", "PF-10", "PF-11", "PRF-06", "PRF-08", "PC-07", "PC-08", "ISC-06", "ISC-08"]
  };
  Object.entries(requirementSatisfactionMap).forEach(([requirementId, ids]) => ids.forEach((ownerId) => relationships.push(r(requirementId, "satisfiedBy", ownerId))));
  requirementDefinitions.forEach(([id, , , , , , , verificationId]) => relationships.push(r(verificationId, "verifies", id)));
  relationships.push(r("VM-19", "verifies", "OHSC-REQ-030"));

  const sequenceDefinitions = [
    ["FS-P-01", "Reference-baggage loading sequence", "product", "UC-01", ["PF-01", "PF-02", "PF-03"]],
    ["FS-P-02", "Loaded-OHSC secure sequence", "product", "UC-02", ["PF-04", "PF-05"]],
    ["FS-P-03", "Cabin secure-state verification sequence", "product", "UC-03", ["PF-05"]],
    ["FS-P-04", "Baggage retrieval sequence", "product", "UC-04", ["PF-12", "PF-01"]],
    ["FS-P-05", "OHSC service sequence", "product", "UC-05", ["PF-11", "PF-09"]],
    ["FS-P-06", "OHSC installation-support sequence", "product", "UC-07", ["PF-10"]],
    ["FS-I-01", "OHSC production sequence", "process", "UC-06", ["PRF-01", "PRF-02", "PRF-03", "PRF-04", "PRF-05", "PRF-06"]],
    ["FS-I-02", "OHSC cabin-installation sequence", "process", "UC-07", ["PRF-07"]],
    ["FS-I-03", "OHSC installation-acceptance sequence", "process", "UC-08", ["PRF-08"]]
  ] as const;
  const functionSequences: FunctionSequence[] = sequenceDefinitions.map(([id, name, domain, useCaseId, functionIds]) => {
    const relationshipIds: string[] = [];
    for (let index = 0; index < functionIds.length - 1; index += 1) {
      const relationship = r(functionIds[index], "precedes", functionIds[index + 1], { sequenceId: id });
      relationships.push(relationship);
      relationshipIds.push(relationship.id);
    }
    return { id, name, description: `${name} using only functions that participate in the declared serial flow.`, domain, useCaseIds: [useCaseId], functionIds: [...functionIds], relationshipIds, createdAt: stamp, updatedAt: stamp };
  });
  processFunctions.forEach(([id]) => {
    // Successive work states of the same OHSC assembly; optional assist hardware is not the handoff itself.
    const input = "STK-00-assembly";
    const output = "STK-00-assembly";
    relationships.push(
      r(id, "consumes", input, { quantity: 1, unit: "assembly", itemFlowName: `${input} configured input` }),
      r(id, "produces", output, { quantity: 1, unit: "assembly", itemFlowName: `${output} controlled output` })
    );
  });
  const processAllocationMap: Record<string, string[]> = {
    "PRF-01": ["PC-01"], "PRF-02": ["PC-01", "PC-05"], "PRF-03": ["PC-01", "PC-02"], "PRF-04": ["PC-02", "PC-03", "PC-04"],
    "PRF-05": ["PC-01", "PC-02", "PC-03", "PC-05"], "PRF-06": ["PC-01"], "PRF-07": ["PC-05"], "PRF-08": ["PC-05", "PC-07"]
  };
  Object.entries(processAllocationMap).forEach(([processId, ids]) => ids.forEach((componentId) => relationships.push(r(processId, "allocatedTo", componentId))));
  const resourceDemandMap: Record<string, Array<[string, number, string]>> = {
    "ISC-01": [["RES-01", 1, "person"], ["RES-05", 1, "tool"], ["RES-10", 1, "dataset"]],
    "ISC-02": [["RES-01", 1, "person"], ["RES-06", 1, "fixture"], ["RES-10", 1, "dataset"]],
    "ISC-03": [["RES-02", 1, "person"], ["RES-10", 1, "dataset"]],
    "ISC-04": [["RES-02", 1, "person"], ["RES-10", 1, "dataset"]],
    "ISC-05": [["RES-02", 2, "person"], ["RES-07", 1, "tool"], ["RES-10", 1, "dataset"], ["RES-11", 1, "fixture"]],
    "ISC-06": [["RES-04", 1, "person"], ["RES-08", 1, "fixture"], ["RES-09", 1, "workstation"], ["RES-10", 1, "dataset"]],
    "ISC-07": [["RES-03", 2, "person"], ["RES-07", 1, "tool"], ["RES-10", 1, "dataset"], ["RES-11", 1, "fixture"]],
    "ISC-08": [["RES-04", 1, "person"], ["RES-09", 1, "workstation"], ["RES-10", 1, "dataset"]]
  };
  Object.entries(resourceDemandMap).forEach(([componentId, demands]) => demands.forEach(([resourceId, requiredQuantity, unit]) => relationships.push(r(componentId, "requiresResource", resourceId, { requiredQuantity, unit }))));
  ["RES-12", "RES-13", "RES-14", "RES-15"].forEach((resourceId) => ["ISC-01", "ISC-02", "ISC-03", "ISC-05", "ISC-07"].forEach((componentId) => relationships.push(r(componentId, "requiresResource", resourceId, { requiredQuantity: 1, unit: "tooling package" }))));

  const featureGroups: FeatureGroup[] = [
    ["AX-01", "Capacity and geometry"], ["AX-02", "Structural concept"], ["AX-03", "Door kinematics"], ["AX-04", "Closure assistance"],
    ["AX-05", "Aircraft interface kit"], ["AX-06", "Service concept"], ["AX-07", "Production and installation route"], ["AX-08", "Production-evidence route"]
  ].map(([id, name], index) => ({ id: `FG-${id}`, name, description: `${name} variability group.`, parentFeatureId: "FEAT-OHSC-ROOT", sortOrder: index }));
  const variabilityAxes: VariabilityAxis[] = featureGroups.map((group, index) => ({ id: `AX-${String(index + 1).padStart(2, "0")}`, name: group.name, description: group.description, featureGroupId: group.id, createdAt: stamp, updatedAt: stamp }));
  const features: Feature[] = [
    { id: "FEAT-OHSC-ROOT", name: "OHSC product family", featureType: "root" as const, sortOrder: 0, description: "Root of the controlled OHSC family." },
    ...[["FEAT-COM-RETENTION", "Contents retention"], ["FEAT-COM-ATTACHMENT", "Aircraft attachment"], ["FEAT-COM-LATCHED-CLOSURE", "Latched closure"], ["FEAT-COM-PLACARD", "Weight placard"], ["FEAT-COM-MAINTENANCE", "Maintenance access"], ["FEAT-COM-EOL-VERIFICATION", "End-of-line verification"]].map(([id, name], index) => ({ id, parentId: "FEAT-OHSC-ROOT", name, featureType: "mandatory" as const, sortOrder: index + 1, description: `${name} is common mandatory content.` })),
    ...[["FEAT-AX01-COMPACT", "Compact"], ["FEAT-AX01-BALANCED", "Balanced"], ["FEAT-AX01-EXTENDED", "Extended"]].map(([id, name], index) => ({ id, parentId: "FEAT-OHSC-ROOT", parentGroupId: "FG-AX-01", name, featureType: "xor" as const, groupId: "capacity-geometry", sortOrder: 10 + index, description: `${name} capacity and geometry choice.` })),
    ...[["FEAT-AX02-STANDARD", "Standard sandwich"], ["FEAT-AX02-REINFORCED", "Reinforced sandwich"], ["FEAT-AX02-WEIGHT-OPT", "Weight-optimised sandwich"]].map(([id, name], index) => ({ id, parentId: "FEAT-OHSC-ROOT", parentGroupId: "FG-AX-02", name, featureType: "xor" as const, groupId: "structural-concept", sortOrder: 20 + index, description: `${name} structural choice.` })),
    ...[["FEAT-AX03-PIVOTING", "Pivoting bucket"], ["FEAT-AX03-UPWARD-DOOR", "Fixed bin with upward-opening door"]].map(([id, name], index) => ({ id, parentId: "FEAT-OHSC-ROOT", parentGroupId: "FG-AX-03", name, featureType: "xor" as const, groupId: "door-kinematics", sortOrder: 30 + index, description: `${name} kinematic choice.` })),
    { id: "FEAT-AX04-PASSIVE-ASSIST", parentId: "FEAT-OHSC-ROOT", parentGroupId: "FG-AX-04", name: "Passive spring-assisted closure", featureType: "optional" as const, sortOrder: 40, description: "Adds non-powered closure assistance when selected." },
    ...[["FEAT-AX05-STANDARD-KIT", "Standard A attachment kit"], ["FEAT-AX05-REINFORCED-KIT", "Reinforced capacity kit"], ["FEAT-AX05-MODULAR-KIT", "Modular installation kit"], ["FEAT-AX05-LIGHTWEIGHT-KIT", "Lightweight rapid-install kit"]].map(([id, name], index) => ({ id, parentId: "FEAT-OHSC-ROOT", parentGroupId: "FG-AX-05", name, featureType: "xor" as const, groupId: "interface-kit", sortOrder: 50 + index, description: `${name} choice.` })),
    ...[["FEAT-AX06-STANDARD-LATCH", "Standard latch module"], ["FEAT-AX06-QUICK-LATCH", "Quick-replace latch module"]].map(([id, name], index) => ({ id, parentId: "FEAT-OHSC-ROOT", parentGroupId: "FG-AX-06", name, featureType: "xor" as const, groupId: "service-concept", sortOrder: 60 + index, description: `${name} service choice.` })),
    ...[["FEAT-AX07-STANDARD-ROUTE", "Standard A route"], ["FEAT-AX07-CAPACITY-ROUTE", "Capacity-upgrade route"], ["FEAT-AX07-MODULAR-ROUTE", "Modular route"], ["FEAT-AX07-LIGHTWEIGHT-ROUTE", "Lightweight rapid-install route"]].map(([id, name], index) => ({ id, parentId: "FEAT-OHSC-ROOT", parentGroupId: "FG-AX-07", name, featureType: "xor" as const, groupId: "industrial-route", sortOrder: 70 + index, description: `${name} industrial choice.` })),
    ...[["FEAT-AX08-MANUAL-EVIDENCE", "Manual inspection record"], ["FEAT-AX08-DIGITAL-EVIDENCE", "Digital inspection record"]].map(([id, name], index) => ({ id, parentId: "FEAT-OHSC-ROOT", parentGroupId: "FG-AX-08", name, featureType: "xor" as const, groupId: "evidence-route", sortOrder: 80 + index, description: `${name} evidence choice.` }))
  ].map((feature) => ({ ...feature, valueType: "boolean", allowedValues: [], defaultValue: false, variabilityScope: feature.featureType === "mandatory" ? "internal" : "external" }));

  const featureConstraints: FeatureConstraint[] = [
    ["FC-01", "FEAT-AX01-EXTENDED", "FEAT-AX02-REINFORCED"], ["FC-02", "FEAT-AX01-EXTENDED", "FEAT-AX04-PASSIVE-ASSIST"],
    ["FC-04", "FEAT-AX03-UPWARD-DOOR", "FEAT-AX04-PASSIVE-ASSIST"], ["FC-05", "FEAT-AX05-MODULAR-KIT", "FEAT-AX08-DIGITAL-EVIDENCE"],
    ["FC-06", "FEAT-AX06-QUICK-LATCH", "FEAT-COM-MAINTENANCE"],
    ["FC-07", "FEAT-AX01-EXTENDED", "FEAT-AX07-CAPACITY-ROUTE"], ["FC-08", "FEAT-AX01-EXTENDED", "FEAT-AX05-REINFORCED-KIT"],
    ["FC-09", "FEAT-AX05-REINFORCED-KIT", "FEAT-AX07-CAPACITY-ROUTE"], ["FC-10", "FEAT-AX05-MODULAR-KIT", "FEAT-AX07-MODULAR-ROUTE"],
    ["FC-11", "FEAT-AX05-LIGHTWEIGHT-KIT", "FEAT-AX07-LIGHTWEIGHT-ROUTE"], ["FC-12", "FEAT-AX07-LIGHTWEIGHT-ROUTE", "FEAT-AX02-WEIGHT-OPT"],
    ["FC-13", "FEAT-AX07-CAPACITY-ROUTE", "FEAT-AX05-REINFORCED-KIT"], ["FC-14", "FEAT-AX07-MODULAR-ROUTE", "FEAT-AX05-MODULAR-KIT"],
    ["FC-15", "FEAT-AX07-LIGHTWEIGHT-ROUTE", "FEAT-AX05-LIGHTWEIGHT-KIT"], ["FC-16", "FEAT-AX01-BALANCED", "FEAT-AX05-MODULAR-KIT"]
  ].map(([id, sourceFeatureId, targetFeatureId]) => ({ id, type: "requires", sourceFeatureId, targetFeatureId }));
  featureConstraints.push({ id: "FC-03", type: "excludes", sourceFeatureId: "FEAT-AX01-EXTENDED", targetFeatureId: "FEAT-AX02-WEIGHT-OPT" });

  const variationPoints: VariationPoint[] = [
    { id: "VP-EX-001", name: "Passive assist existence", description: "Includes the passive assist only when selected.", kind: "existence", constrainedElementIds: ["PC-04"], constrainedRelationshipIds: [], featureExpression: "FEAT-OHSC-ROOT and FEAT-COM-LATCHED-CLOSURE and FEAT-AX04-PASSIVE-ASSIST", featureValueConditions: [], valueRules: [], scope: "structure", enabled: true, createdAt: stamp, updatedAt: stamp },
    { id: "VP-EX-002", name: "Digital inspection workstation existence", description: "Includes the digital workstation for the digital evidence route.", kind: "existence", constrainedElementIds: ["RES-09"], constrainedRelationshipIds: [], featureExpression: "FEAT-COM-EOL-VERIFICATION and FEAT-AX08-DIGITAL-EVIDENCE", featureValueConditions: [], valueRules: [], realizationScopes: ["verification", "resources"], enabled: true, createdAt: stamp, updatedAt: stamp },
    ...(["A", "B", "C", "D"] as const).map((key, index) => ({ id: `VP-EX-00${index + 3}`, name: `${key} route tooling existence`, description: "Includes the route-specific tooling package.", kind: "existence" as const, constrainedElementIds: [`RES-${12 + index}`], constrainedRelationshipIds: [], featureExpression: `${["FEAT-COM-RETENTION", "FEAT-COM-ATTACHMENT", "FEAT-COM-PLACARD", "FEAT-COM-MAINTENANCE"][index]} and ${routeExpressions[key]}`, featureValueConditions: [], valueRules: [], scope: "resources" as const, enabled: true, createdAt: stamp, updatedAt: stamp })),
    parameterVariation("VP-PV-001", "PC-01", "PAR-PC01-VOLUME-POS-01", [185, 255, 220, 195], "structure"),
    parameterVariation("VP-PV-002", "PC-01", "PAR-PC01-VOLUME-POS-02", [195, 275, 230, 205], "structure"),
    parameterVariation("VP-PV-003", "PC-01", "PAR-PC01-VOLUME-POS-03", [195, 275, 230, 205], "structure"),
    parameterVariation("VP-PV-004", "PC-01", "PAR-PC01-VOLUME-POS-04", [185, 255, 220, 195], "structure"),
    parameterVariation("VP-PV-005", "PC-01", "PAR-PC01-REFERENCE-BAG-COUNT", [12, 16, 14, 12], "behavior"),
    parameterVariation("VP-PV-006", "PC-01", "PAR-PC01-PLACARDED-CONTENT-MASS", [96, 128, 112, 96], "behavior"),
    parameterVariation("VP-PV-007", "PC-01", "PAR-PC01-PRODUCT-COST-POINTS", [55, 66, 62, 70], "structure"),
    parameterVariation("VP-PV-008", "PC-01", "PAR-PC01-BUCKET-MASS", [12, 13.5, 10.5, 9.5], "structure"),
    parameterVariation("VP-PV-009", "PC-01", "PAR-PC01-EMPTY-CG-OFFSET", [100, 115, 90, 80], "structure"),
    parameterVariation("VP-PV-010", "PC-02", "PAR-PC02-CLEAR-WIDTH", [610, 650, 630, 610], "structure"),
    parameterVariation("VP-PV-011", "PC-02", "PAR-PC02-CLEAR-HEIGHT", [260, 300, 280, 260], "structure"),
    parameterVariation("VP-PV-012", "PC-02", "PAR-PC02-OPENING-FORCE", [58, 52, 48, 55], "behavior"),
    parameterVariation("VP-PV-013", "PC-02", "PAR-PC02-CLOSING-FORCE", [78, 65, 60, 72], "behavior"),
    parameterVariation("VP-PV-014", "PC-02", "PAR-PC02-DOOR-MASS", [7, 7.5, 6.5, 5.8], "structure"),
    parameterVariation("VP-PV-015", "PC-03", "PAR-PC03-LATCH-MASS", [1.5, 1.4, 1.2, 1.1], "structure"),
    parameterVariation("VP-PV-016", "PC-03", "PAR-PC03-SECURE-CHECK-TIME", [2, 1.5, 1, 1.5], "verification"),
    parameterVariation("VP-PV-017", "PC-03", "PAR-PC03-LATCH-DURABILITY", [20000, 24000, 25000, 22000], "behavior"),
    parameterVariation("VP-PV-018", "PC-03", "PAR-PC03-TIME-ACCESS", [0.2, 0.1, 0.1, 0.1], "behavior"),
    parameterVariation("VP-PV-019", "PC-03", "PAR-PC03-TIME-REMOVE", [0.3, 0.2, 0.15, 0.2], "behavior"),
    parameterVariation("VP-PV-020", "PC-03", "PAR-PC03-TIME-INSTALL", [0.35, 0.25, 0.2, 0.25], "behavior"),
    parameterVariation("VP-PV-021", "PC-03", "PAR-PC03-TIME-FUNCTIONAL-CHECK", [0.25, 0.35, 0.15, 0.2], "behavior"),
    { ...parameterVariation("VP-PV-022", "PC-04", "PAR-PC04-ASSIST-MASS", [1.5, 1.5, 1.2, 1.2], "structure", false, "FEAT-AX04-PASSIVE-ASSIST"), valueRules: valueRules("VP-PV-022", [1.5, 1.5, 1.2, 1.2]).filter((_, index) => index === 1 || index === 2) },
    parameterVariation("VP-PV-023", "PC-05", "PAR-PC05-ATTACHMENT-KIT-MASS", [6, 6.6, 5.2, 4.3], "structure"),
    parameterVariation("VP-PV-024", "PC-05", "PAR-PC05-ATTACHMENT-UTILIZATION", [0.91, 0.95, 0.87, 0.91], "structure"),
    parameterVariation("VP-PV-025", "PC-05", "PAR-PC05-INTERFACE-PATTERN-ID", ["A-IFC", "CAP-IFC", "MOD-IFC", "LWT-IFC"], "structure"),
    parameterVariation("VP-PV-026", "PC-06", "PAR-PC06-CLOSEOUT-MASS", [5, 3.5, 4.4, 3.8], "structure"),
    parameterVariation("VP-PV-027", "PC-08", "PAR-PC08-COMMON-PART-REUSE", [100, 72, 78, 70], "structure"),
    parameterVariation("VP-PV-028", "PC-09", "PAR-PC09-MIN-CLEARANCE", [25, 22, 25, 20], "structure"),
    parameterVariation("VP-PV-029", "ISC-05", "PAR-ISC05-PROCESS-COST-POINTS", [30, 30, 33, 36], "process", true),
    parameterVariation("VP-PV-030", "ISC-06", "PAR-ISC06-EOL-DURATION", [0.7, 0.75, 0.55, 0.6], "verification", true),
    parameterVariation("VP-PV-031", "ISC-07", "PAR-ISC07-RESOURCE-COST-POINTS", [15, 16, 23, 22], "resources", true),
    parameterVariation("VP-PV-032", "ISC-07", "PAR-ISC07-EFFORT-PREPARE", [2, 2, 1.5, 1.5], "process", true),
    parameterVariation("VP-PV-033", "ISC-07", "PAR-ISC07-EFFORT-POSITION", [3, 4, 2, 1.5], "process", true),
    parameterVariation("VP-PV-034", "ISC-07", "PAR-ISC07-EFFORT-ATTACH", [5, 5.5, 3.5, 2.5], "process", true),
    parameterVariation("VP-PV-035", "ISC-07", "PAR-ISC07-EFFORT-INTERFACE", [2, 2, 1.5, 1.5], "process", true),
    parameterVariation("VP-PV-036", "ISC-07", "PAR-ISC07-EFFORT-LOCAL-CHECK", [2, 1.5, 1.5, 1.5], "process", true),
    { id: "VP-PV-037", name: "EOL station duration", description: "Applies route-specific EOL elapsed duration.", kind: "primitiveProperty", constrainedElementIds: ["ISC-06"], constrainedRelationshipIds: [], featureExpression: "", featureValueConditions: [], propertyPath: "metadata:duration", valueRules: valueRules("VP-PV-037", [0.7, 0.75, 0.55, 0.6], true), unmatchedBehavior: "error", scope: "verification", enabled: true, createdAt: stamp, updatedAt: stamp },
    { id: "VP-PV-038", name: "Installation tooling duration", description: "Applies route-specific elapsed installation duration.", kind: "primitiveProperty", constrainedElementIds: ["ISC-07"], constrainedRelationshipIds: [], featureExpression: "", featureValueConditions: [], propertyPath: "metadata:duration", valueRules: valueRules("VP-PV-038", [7, 7.5, 5, 4.25], true), unmatchedBehavior: "error", scope: "process", enabled: true, createdAt: stamp, updatedAt: stamp }
  ];
  const featureContexts: Record<string, [string, string, string, string]> = {
    "VP-PV-012": ["FEAT-AX03-PIVOTING", "FEAT-AX03-UPWARD-DOOR", "FEAT-AX03-UPWARD-DOOR", "FEAT-AX03-PIVOTING"],
    "VP-PV-013": ["FEAT-AX03-PIVOTING", "FEAT-AX03-UPWARD-DOOR", "FEAT-AX03-UPWARD-DOOR", "FEAT-AX03-PIVOTING"],
    "VP-PV-015": ["FEAT-AX06-STANDARD-LATCH", "FEAT-AX06-QUICK-LATCH", "FEAT-AX06-QUICK-LATCH", "FEAT-AX06-QUICK-LATCH"],
    "VP-PV-018": ["FEAT-AX06-STANDARD-LATCH", "FEAT-AX06-QUICK-LATCH", "FEAT-AX06-QUICK-LATCH", "FEAT-AX06-QUICK-LATCH"],
    "VP-PV-019": ["FEAT-AX06-STANDARD-LATCH", "FEAT-AX06-QUICK-LATCH", "FEAT-AX06-QUICK-LATCH", "FEAT-AX06-QUICK-LATCH"],
    "VP-PV-020": ["FEAT-AX06-STANDARD-LATCH", "FEAT-AX06-QUICK-LATCH", "FEAT-AX06-QUICK-LATCH", "FEAT-AX06-QUICK-LATCH"],
    "VP-PV-021": ["FEAT-AX06-STANDARD-LATCH", "FEAT-AX06-QUICK-LATCH", "FEAT-AX06-QUICK-LATCH", "FEAT-AX06-QUICK-LATCH"],
    "VP-PV-023": ["FEAT-AX05-STANDARD-KIT", "FEAT-AX05-REINFORCED-KIT", "FEAT-AX05-MODULAR-KIT", "FEAT-AX05-LIGHTWEIGHT-KIT"],
    "VP-PV-024": ["FEAT-AX05-STANDARD-KIT", "FEAT-AX05-REINFORCED-KIT", "FEAT-AX05-MODULAR-KIT", "FEAT-AX05-LIGHTWEIGHT-KIT"],
    "VP-PV-025": ["FEAT-AX05-STANDARD-KIT", "FEAT-AX05-REINFORCED-KIT", "FEAT-AX05-MODULAR-KIT", "FEAT-AX05-LIGHTWEIGHT-KIT"],
    "VP-PV-030": ["FEAT-AX08-MANUAL-EVIDENCE", "FEAT-AX08-DIGITAL-EVIDENCE", "FEAT-AX08-DIGITAL-EVIDENCE", "FEAT-AX08-DIGITAL-EVIDENCE"]
  };
  Object.entries(featureContexts).forEach(([variationPointId, contexts]) => {
    const point = variationPoints.find((candidate) => candidate.id === variationPointId);
    point?.valueRules.forEach((rule, index) => { rule.featureExpression = `(${rule.featureExpression}) and ${contexts[index]}`; });
  });

  const architectures: Architecture[] = [
    ["ARCH-OHSC-STANDARD-A", "Standard A — Current OHSC", "CFG-A"], ["ARCH-OHSC-CAPACITY", "Change Solution 1 — Capacity Upgrade", "CFG-B"],
    ["ARCH-OHSC-BALANCED", "Change Solution 2 — Balanced Modular", "CFG-C"], ["ARCH-OHSC-LIGHTWEIGHT", "Change Solution 3 — Lightweight Rapid-Install", "CFG-D"]
  ].map(([id, name, configurationId]) => ({ id, name, description: `${name} 100 percent architecture derived from the common OHSC family.`, status: "configured", configurationId, createdAt: stamp, updatedAt: stamp }));
  const configurations: Configuration[] = [
    { id: "CFG-A", name: "Standard A — Current OHSC", architectureId: "ARCH-OHSC-STANDARD-A", manuallySelectedFeatureIds: ["FEAT-AX01-COMPACT", "FEAT-AX02-STANDARD", "FEAT-AX03-PIVOTING", "FEAT-AX05-STANDARD-KIT", "FEAT-AX06-STANDARD-LATCH", "FEAT-AX07-STANDARD-ROUTE", "FEAT-AX08-MANUAL-EVIDENCE"] },
    { id: "CFG-B", name: "Change Solution 1 — Capacity Upgrade", architectureId: "ARCH-OHSC-CAPACITY", manuallySelectedFeatureIds: ["FEAT-AX01-EXTENDED", "FEAT-AX03-UPWARD-DOOR", "FEAT-AX06-QUICK-LATCH", "FEAT-AX08-DIGITAL-EVIDENCE"], automaticConstraintFeatureIds: ["FEAT-AX02-REINFORCED", "FEAT-AX04-PASSIVE-ASSIST", "FEAT-AX05-REINFORCED-KIT", "FEAT-AX07-CAPACITY-ROUTE"] },
    { id: "CFG-C", name: "Change Solution 2 — Balanced Modular", architectureId: "ARCH-OHSC-BALANCED", manuallySelectedFeatureIds: ["FEAT-AX01-BALANCED", "FEAT-AX02-WEIGHT-OPT", "FEAT-AX03-UPWARD-DOOR", "FEAT-AX06-QUICK-LATCH", "FEAT-AX07-MODULAR-ROUTE"], automaticConstraintFeatureIds: ["FEAT-AX04-PASSIVE-ASSIST", "FEAT-AX05-MODULAR-KIT", "FEAT-AX08-DIGITAL-EVIDENCE"] },
    { id: "CFG-D", name: "Change Solution 3 — Lightweight Rapid-Install", architectureId: "ARCH-OHSC-LIGHTWEIGHT", manuallySelectedFeatureIds: ["FEAT-AX01-COMPACT", "FEAT-AX02-WEIGHT-OPT", "FEAT-AX03-PIVOTING", "FEAT-AX06-QUICK-LATCH", "FEAT-AX07-LIGHTWEIGHT-ROUTE", "FEAT-AX08-DIGITAL-EVIDENCE"], automaticConstraintFeatureIds: ["FEAT-AX05-LIGHTWEIGHT-KIT"] }
  ].map((configuration) => ({ ...configuration, automaticConstraintFeatureIds: (configuration as { automaticConstraintFeatureIds?: string[] }).automaticConstraintFeatureIds ?? [], effectiveSelectedFeatureIds: [], autoSelectedFeatureIds: [], realizationScopes: [...scopes], validationStatus: "notValidated", validationMessages: [], derivedElementIds: [], excludedElementIds: [], createdAt: stamp, updatedAt: stamp }));

  const project: Project = {
    id: projectId,
    schemaVersion: 14,
    modelRevision: 1,
    name: "Aircraft OHSC Product Family",
    description: "A complete fictional aviation MBSE/MBPLE example comparing Standard A with three multi-axis product, process and resource change solutions.",
    overallScope: "tradeStudy",
    objectives: objectives.map(([, name]) => name),
    openDecisions: [{ id: "OD-OHSC-CHANGE", question: "Retain Standard A or establish a preferred preliminary successor baseline?", description: "Decide using unchanged requirements, comparable KPI evidence and declared risks.", status: "closed", relatedElementIds: ["OBJ-08"], linkedFormalDecisionId: "DEC-OHSC-NEW" }],
    activeArchitectureId: "ARCH-OHSC-STANDARD-A",
    baselineArchitectureId: "ARCH-OHSC-BALANCED",
    activeComparisonStudyId: "TS-OHSC-CHANGE-01",
    createdAt: stamp,
    updatedAt: stamp,
    architectures,
    elements,
    relationships,
    functionSequences,
    selectedUseCaseIds: useCases.map(([id]) => id),
    rowOrderByType: {},
    unitDefinitions: [
      { id: "UNIT-CYCLE", symbol: "cycle", name: "cycle", quantityName: "cycle count", dimension: { cycle: 1 }, factorToSI: 1, aliases: [] },
      { id: "UNIT-INDEXPOINT", symbol: "indexpoint", name: "relative index point", quantityName: "relative cost index", dimension: { indexpoint: 1 }, factorToSI: 1, aliases: ["index-point"] },
      { id: "UNIT-ASSEMBLY", symbol: "assembly", name: "assembly", quantityName: "item count", dimension: { count: 1 }, factorToSI: 1, aliases: ["fixture", "dataset", "workstation", "toolingpackage"] }
    ],
    customAttributeDefinitions: [],
    features,
    featureGroups,
    variabilityAxes,
    featureConstraints,
    variationPoints,
    configurations,
    kpis,
    simulationRuns: [],
    comparisonStudies: [],
    comparisonRisks: [],
    decisions: [],
    validationResults: []
  };

  prepareOntologySample(project);
  project.configurations = project.configurations.map((configuration) => {
    const attempt = deriveConfiguration(project, configuration);
    return attempt.result ? attempt.configuration : { ...attempt.configuration, validationStatus: "invalid", validationMessages: attempt.errors };
  });
  const selectedKpiIds = project.kpis.map((kpi) => kpi.id);
  project.simulationRuns = project.configurations.map((configuration) => runSimulation(project, {
    name: `${configuration.name} — comparable OHSC KPI run`,
    configurationId: configuration.id,
    selectedKpiIds,
    selectedAlgorithmKeys: []
  }).run).filter((run): run is SimulationRun => Boolean(run));

  const study: ComparisonStudy = {
    id: "TS-OHSC-CHANGE-01",
    name: "Standard A OHSC configuration evaluation",
    description: "Compare one valid starting baseline with three multi-axis change solutions from the same 150 percent family.",
    question: "Which combination of OHSC product-design, integration/service and industrialisation choices provides the preferred balance of storage, mass, cost, installation effort and maintainability while satisfying the established requirements?",
    intendedOutcome: "Record an internal decision to retain Standard A or establish one preliminary successor design baseline.",
    lifecycleScope: "OHSC product, production, installation, verification and maintenance concept definition",
    systemScope: "One generic single-aisle cabin-side OHSC installation segment spanning four nominal positions",
    status: "decided",
    originatingOpenDecisionId: "OD-OHSC-CHANGE",
    needIds: ["N-08"],
    objectiveIds: ["OBJ-08"],
    useCaseIds: ["UC-06", "UC-07", "UC-08"],
    rootFeatureId: "FEAT-OHSC-ROOT",
    selectedVariabilityAxisIds: variabilityAxes.map((axis) => axis.id),
    baselineRequirementIds: requirementDefinitions.map((definition) => definition[0]),
    referenceArchitectureId: "ARCH-OHSC-STANDARD-A",
    mandatoryRequirementIds: ["OHSC-REQ-001", "OHSC-REQ-010", "OHSC-REQ-014", "OHSC-REQ-015", "OHSC-REQ-016", "OHSC-REQ-017", "OHSC-REQ-018"],
    exploredFeatureIds: features.filter((feature) => feature.featureType !== "root" && feature.featureType !== "mandatory").map((feature) => feature.id),
    criteria: project.kpis.map((kpi) => ({ id: `CRIT-${kpi.id}`, name: kpi.name, description: kpi.description, type: "optimization", sourceObjectiveIds: [...kpi.objectiveIds], sourceRequirementIds: requirementDefinitions.filter((definition) => definition[5] === kpi.id).map((definition) => definition[0]), kpiId: kpi.id, weight: kpi.weight, stakeholderValueFunction: kpi.optimizationDirection === "maximize" ? { type: "maximize", worst: 760, best: 1060 } : kpi.id === "KPI-02" ? { type: "minimize", worst: 34, best: 24.5 } : kpi.id === "KPI-03" ? { type: "minimize", worst: 128, best: 100 } : kpi.id === "KPI-04" ? { type: "minimize", worst: 15, best: 8.5 } : { type: "minimize", worst: 1.1, best: 0.6 } })),
    candidateRefs: project.configurations.map((configuration) => ({ id: `CAND-${configuration.id}`, label: configuration.name, configurationId: configuration.id, architectureId: configuration.architectureId })),
    alternativeRefs: project.configurations.map((configuration) => ({ id: `ALT-${configuration.id}`, label: configuration.name, configurationId: configuration.id, architectureId: configuration.architectureId, simulationRunId: project.simulationRuns.find((run) => run.configurationId === configuration.id)?.id ?? "" })),
    selectedKpiIds,
    kpiSettings: Object.fromEntries(project.kpis.map((kpi) => [kpi.id, { weight: kpi.weight, optimizationDirection: kpi.optimizationDirection, threshold: kpi.minimumThreshold !== undefined || kpi.maximumThreshold !== undefined ? { minimum: kpi.minimumThreshold, maximum: kpi.maximumThreshold, mode: "hard" } : undefined }])),
    createdAt: stamp,
    updatedAt: stamp,
    settingsUpdatedAt: stamp,
    results: [],
    scenarios: [
      { id: "SCN-VOLUME", name: "Volume uncertainty", description: "Bounded adverse minus-three-percent volume case.", createdAt: stamp, effects: [{ id: "SCN-VOLUME-EFFECT", type: "kpiPercent" as const, targetId: "KPI-01", percent: -3 }] },
      { id: "SCN-MASS", name: "Mass uncertainty", description: "Bounded adverse plus-five-percent empty-mass case.", createdAt: stamp, effects: [{ id: "SCN-MASS-EFFECT", type: "kpiPercent" as const, targetId: "KPI-02", percent: 5 }] },
      { id: "SCN-COST", name: "Cost-index uncertainty", description: "Bounded adverse plus-fifteen-percent recurring-cost-index case.", createdAt: stamp, effects: [{ id: "SCN-COST-EFFECT", type: "kpiPercent" as const, targetId: "KPI-03", percent: 15 }] },
      { id: "SCN-INSTALL", name: "Installation-effort uncertainty", description: "Bounded adverse plus-twenty-percent installation-effort case.", createdAt: stamp, effects: [{ id: "SCN-INSTALL-EFFECT", type: "kpiPercent" as const, targetId: "KPI-04", percent: 20 }] },
      { id: "SCN-SERVICE", name: "Latch-service uncertainty", description: "Bounded adverse plus-twenty-percent latch-replacement-time case.", createdAt: stamp, effects: [{ id: "SCN-SERVICE-EFFECT", type: "kpiPercent" as const, targetId: "KPI-05", percent: 20 }] }
    ],
    robustnessResults: [],
    feasibilityExceptions: {}
  };
  project.comparisonStudies = [study];

  const risks = [
    { id: "RSK-01", comparisonStudyId: study.id, alternativeId: "ALT-CFG-A", title: "Preference may be mistaken for validity", description: "Standard A has the lowest value score although it remains requirement-feasible.", inherentLikelihood: 3, inherentImpact: 3, residualLikelihood: 2, residualImpact: 2, mitigation: "Display feasibility and weighted value separately.", owner: "Configuration Management", status: "mitigating", applicableArchitectureIds: ["ARCH-OHSC-STANDARD-A"], applicableConfigurationIds: ["CFG-A"], applicableRequirementIds: [], applicableParameterIds: [], applicableKpiIds: selectedKpiIds, reviewRequired: false },
    { id: "RSK-02", comparisonStudyId: study.id, alternativeId: "ALT-CFG-B", title: "Capacity solution empty-mass exceedance", description: "Capacity Upgrade exceeds the unchanged 32 kg requirement.", inherentLikelihood: 4, inherentImpact: 3, residualLikelihood: 3, residualImpact: 2, mitigation: "Mature structural design or reject the alternative.", owner: "Product Architect", status: "open", applicableArchitectureIds: ["ARCH-OHSC-CAPACITY"], applicableConfigurationIds: ["CFG-B"], applicableRequirementIds: ["OHSC-REQ-010"], applicableParameterIds: ["PAR-PC01-BUCKET-MASS"], applicableKpiIds: ["KPI-02"], reviewRequired: true },
    { id: "RSK-03", comparisonStudyId: study.id, alternativeId: "ALT-CFG-C", title: "Balanced concept maturity", description: "Weight-optimised structure, modular kit and digital inspection need maturation.", inherentLikelihood: 4, inherentImpact: 4, residualLikelihood: 3, residualImpact: 3, mitigation: "Prototype installation and mature structural substantiation.", owner: "Chief Engineer", status: "mitigating", applicableArchitectureIds: ["ARCH-OHSC-BALANCED"], applicableConfigurationIds: ["CFG-C"], applicableRequirementIds: ["OHSC-REQ-012", "OHSC-REQ-022"], applicableParameterIds: ["PAR-PC05-ATTACHMENT-UTILIZATION"], applicableKpiIds: ["KPI-02", "KPI-04"], reviewRequired: true },
    { id: "RSK-04", comparisonStudyId: study.id, alternativeId: "ALT-CFG-D", title: "Lightweight recurring-cost uncertainty", description: "Lightweight Rapid-Install has the highest relative recurring-cost-index uncertainty.", inherentLikelihood: 3, inherentImpact: 3, residualLikelihood: 2, residualImpact: 2, mitigation: "Mature supplier, process and industrial-route inputs before detailed design.", owner: "Industrial Cost Engineering", status: "open", applicableArchitectureIds: ["ARCH-OHSC-LIGHTWEIGHT"], applicableConfigurationIds: ["CFG-D"], applicableRequirementIds: ["OHSC-REQ-018"], applicableParameterIds: ["PAR-PC01-PRODUCT-COST-POINTS", "PAR-ISC05-PROCESS-COST-POINTS", "PAR-ISC07-RESOURCE-COST-POINTS"], applicableKpiIds: ["KPI-03"], reviewRequired: true },
    { id: "RSK-05", comparisonStudyId: study.id, title: "Preliminary structural-screening limitation", description: "Static attachment screening omits full stress, fatigue, damage tolerance and dynamic crash response.", inherentLikelihood: 5, inherentImpact: 5, residualLikelihood: 4, residualImpact: 5, mitigation: "Use utilization only as a concept-screening gate and retain open structural and crashworthiness substantiation work.", owner: "Structures and Airworthiness", status: "open", applicableArchitectureIds: architectures.map((architecture) => architecture.id), applicableConfigurationIds: configurationIds, applicableRequirementIds: ["OHSC-REQ-012", "OHSC-REQ-020", "OHSC-REQ-022"], applicableParameterIds: ["PAR-PC05-ATTACHMENT-UTILIZATION"], applicableKpiIds: ["KPI-02"], reviewRequired: true },
    { id: "RSK-06", comparisonStudyId: study.id, title: "Aggregate baggage-capacity limitation", description: "The four-position aggregate bag count may conceal local packing, door-clearance and mixed-position effects.", inherentLikelihood: 3, inherentImpact: 3, residualLikelihood: 2, residualImpact: 2, mitigation: "Retain the separate reference-bag geometry demonstration and configuration-specific packing record.", owner: "Cabin Integration", status: "mitigating", applicableArchitectureIds: architectures.map((architecture) => architecture.id), applicableConfigurationIds: configurationIds, applicableRequirementIds: ["OHSC-REQ-001", "OHSC-REQ-002", "OHSC-REQ-004", "OHSC-REQ-005"], applicableParameterIds: ["PAR-PC01-REFERENCE-BAG-COUNT", "PAR-PC02-CLEAR-WIDTH", "PAR-PC02-CLEAR-HEIGHT"], applicableKpiIds: ["KPI-01"], reviewRequired: true },
    { id: "RSK-07", comparisonStudyId: study.id, title: "Alternative-set normalization sensitivity", description: "Min-max normalization can change weighted scores when candidates are added or removed.", inherentLikelihood: 3, inherentImpact: 3, residualLikelihood: 2, residualImpact: 2, mitigation: "Display raw values and normalization bounds with weight and bounded-scenario sensitivity.", owner: "Trade Study Lead", status: "mitigating", applicableArchitectureIds: architectures.map((architecture) => architecture.id), applicableConfigurationIds: configurationIds, applicableRequirementIds: [], applicableParameterIds: [], applicableKpiIds: selectedKpiIds, reviewRequired: true },
    { id: "RSK-08", comparisonStudyId: study.id, title: "Adjacent-system envelope maturity", description: "PSU, lighting, ducting and oxygen-mask interfaces are represented only by preliminary envelopes and statuses.", inherentLikelihood: 4, inherentImpact: 5, residualLikelihood: 3, residualImpact: 4, mitigation: "Keep interface verification open until installation-level geometry and functional checks exist.", owner: "Aircraft Integration", status: "open", applicableArchitectureIds: architectures.map((architecture) => architecture.id), applicableConfigurationIds: configurationIds, applicableRequirementIds: ["OHSC-REQ-013", "OHSC-REQ-024", "OHSC-REQ-025", "OHSC-REQ-029"], applicableParameterIds: ["PAR-PC09-MIN-CLEARANCE"], applicableKpiIds: [], reviewRequired: true },
    { id: "RSK-09", comparisonStudyId: study.id, alternativeId: "ALT-CFG-B", title: "Aircraft-level impact outside OHSC boundary", description: "Aircraft-side reinforcement and electrical or ECS modification mass, cost and schedule remain outside the OHSC-owned KPI boundary.", inherentLikelihood: 4, inherentImpact: 4, residualLikelihood: 3, residualImpact: 4, mitigation: "Carry an aircraft-integration risk and do not present the 34 kg OHSC KPI as total aircraft impact.", owner: "Aircraft Integration", status: "open", applicableArchitectureIds: ["ARCH-OHSC-CAPACITY"], applicableConfigurationIds: ["CFG-B"], applicableRequirementIds: ["OHSC-REQ-010", "OHSC-REQ-013", "OHSC-REQ-029"], applicableParameterIds: ["PAR-PC01-BUCKET-MASS", "PAR-PC05-ATTACHMENT-KIT-MASS"], applicableKpiIds: ["KPI-02", "KPI-03", "KPI-04"], reviewRequired: true }
  ].map((risk): ComparisonRisk => ({ ...risk, alternativeId: (risk as { alternativeId?: string }).alternativeId ?? "ALT-CFG-A" } as ComparisonRisk));
  project.comparisonRisks = risks;
  const methodology = runTradeStudyMethodology(project, study, new Date(stamp));
  if (methodology.result) {
    study.results = [methodology.result];
    study.sensitivityResult = runFixedWeightSensitivity(project, study, new Date(stamp)).result;
    study.robustnessResults = [runBoundedRobustness(project, study, methodology.result, new Date(stamp))];
  }
  const result = study.results.at(-1);
  const decisionDate = "2026-09-09T09:00:00.000Z";
  const standardARun = project.simulationRuns.find((run) => run.configurationId === "CFG-A")!;
  const standardADerivationId = project.configurations.find((configuration) => configuration.id === "CFG-A")?.derivation?.id;
  const standardAFeasibility = result?.feasibility?.["ALT-CFG-A"];
  project.decisions = [
    { id: "DEC-OHSC-A", question: "Approve Standard A as the current OHSC internal architecture baseline?", alternatives: ["Standard A — Current OHSC"], criteria: ["Established requirements and reviewed preliminary evidence"], selectedAlternative: "Standard A — Current OHSC", rationale: "Fictional prior internal baseline retained as immutable starting evidence; this is not regulatory approval.", supportingSimulationRunIds: [standardARun.id], supportingComparisonStudyIds: [], assumptions: [], risks: [], openActions: [], status: "approved", owner: "Fictional OHSC Configuration Board", decisionDate: "2026-08-01T09:00:00.000Z", baselineApprovalConfirmed: true, evidenceSnapshot: { capturedAt: "2026-08-01T09:00:00.000Z", projectModelRevision: project.modelRevision, question: "Approve Standard A as the current OHSC internal architecture baseline?", intendedOutcome: "Record the fictional as-is Standard A internal design baseline without asserting compliance or installation approval.", objectiveIds: objectives.map(([id]) => id), criteria: [], candidateAlternatives: [{ id: "ALT-CFG-A", label: "Standard A — Current OHSC", configurationId: "CFG-A", architectureId: "ARCH-OHSC-STANDARD-A", simulationRunId: standardARun.id }], selectedAlternative: "Standard A — Current OHSC", rejectedAlternatives: [], mandatoryCompliance: standardAFeasibility ? { "ALT-CFG-A": structuredClone(standardAFeasibility) } : {}, valueFunctionsAndWeights: [], rawEvidence: { "ALT-CFG-A": Object.fromEntries(standardARun.results.filter((item) => item.kpiId).map((item) => [item.kpiId!, item.value])) }, transformedEvidence: {}, paretoResults: {}, risks: [], scenarios: [], robustnessResults: [], assumptions: [], limitations: ["Preliminary engineering estimate — not a verified detailed-design result.", "Internal baseline evidence only; no regulatory compliance or installation approval is implied."], derivationIds: standardADerivationId ? [standardADerivationId] : [], simulationRunIds: [standardARun.id], rationale: "Standard A is the feasible, completely modelled as-is reference at study opening.", owner: "Fictional OHSC Configuration Board", decisionDate: "2026-08-01T09:00:00.000Z", openActions: [] }, createdAt: "2026-08-01T09:00:00.000Z", updatedAt: "2026-08-01T09:00:00.000Z" },
    { id: "DEC-OHSC-NEW", question: study.question, alternatives: study.alternativeRefs.map((alternative) => alternative.label), criteria: study.criteria.map((criterion) => criterion.name), selectedAlternative: "Change Solution 2 — Balanced Modular", rationale: "Balanced Modular is requirement-feasible and has the highest calculated score under the declared KPI weights and evidence.", supportingSimulationRunIds: study.alternativeRefs.map((alternative) => alternative.simulationRunId), supportingComparisonStudyIds: [study.id], assumptions: [], risks: risks.map((risk) => risk.title), openActions: ["Mature structural and installation evidence before detailed design."], status: "approved", owner: "OHSC Configuration Management Board", decisionDate, baselineApprovalConfirmed: true, evidenceSnapshot: result ? { capturedAt: decisionDate, projectModelRevision: project.modelRevision, question: study.question, intendedOutcome: study.intendedOutcome, objectiveIds: [...study.objectiveIds], criteria: structuredClone(study.criteria), candidateAlternatives: structuredClone(study.alternativeRefs), selectedAlternative: "Change Solution 2 — Balanced Modular", rejectedAlternatives: study.alternativeRefs.filter((alternative) => alternative.configurationId !== "CFG-C").map((alternative) => alternative.label), mandatoryCompliance: structuredClone(result.feasibility ?? {}), valueFunctionsAndWeights: study.criteria.map((criterion) => ({ criterionId: criterion.id, kpiId: criterion.kpiId, weight: criterion.weight ?? 0, valueFunction: structuredClone(criterion.stakeholderValueFunction) })), rawEvidence: structuredClone(result.rawValues), transformedEvidence: structuredClone(result.stakeholderValues ?? result.normalizedScores), paretoResults: structuredClone(result.pareto ?? {}), sensitivity: structuredClone(study.sensitivityResult), risks: structuredClone(risks), scenarios: structuredClone(study.scenarios ?? []), robustnessResults: structuredClone(study.robustnessResults ?? []), assumptions: [], limitations: ["Preliminary engineering estimate — not a verified detailed-design result."], derivationIds: project.configurations.map((configuration) => configuration.derivation?.id).filter((id): id is string => Boolean(id)), simulationRunIds: project.simulationRuns.map((run) => run.id), rationale: "Balanced Modular is the preferred formula-feasible alternative under the declared evidence.", owner: "OHSC Configuration Management Board", decisionDate, openActions: ["Mature structural and installation evidence before detailed design."] } : undefined, createdAt: decisionDate, updatedAt: decisionDate }
  ];
  project.architectures = project.architectures.map((architecture) => ({ ...architecture, status: architecture.id === project.baselineArchitectureId ? "baseline" : "candidate" }));
  return project;
}

export function createOhscSampleProject(projectId = "project-ohsc"): Project {
  const cached = ohscSampleCache.get(projectId);
  if (cached) return structuredClone(cached);
  const project = buildOhscSampleProject(projectId);
  ohscSampleCache.set(projectId, structuredClone(project));
  return project;
}
