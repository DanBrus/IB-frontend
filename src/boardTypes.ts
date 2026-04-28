export const BOARD_NODE_TYPES = ["person_node", "location_node", "artifact_node", "note"] as const;
export type BoardNodeType = (typeof BOARD_NODE_TYPES)[number];
export type BoardAccessMode = "read" | "edit";

function readNodeTypeValue(rawNodeType: unknown): string | null {
  if (typeof rawNodeType === "string") return rawNodeType;

  if (rawNodeType && typeof rawNodeType === "object") {
    const record = rawNodeType as Record<string, unknown>;
    const nestedValue = record.value ?? record.name ?? record.type ?? record.node_type ?? record.nodeType;
    return readNodeTypeValue(nestedValue);
  }

  return null;
}

export function normalizeNodeType(rawNodeType: unknown): BoardNodeType {
  const value = readNodeTypeValue(rawNodeType)?.trim().toLowerCase().replace(/[\s-]+/g, "_");

  switch (value) {
    case "person_node":
    case "person":
    case "prson_node":
      return "person_node";
    case "location_node":
    case "location":
      return "location_node";
    case "artifact_node":
    case "artifact":
    case "artefact":
    case "artefact_node":
      return "artifact_node";
    case "note":
    case "note_node":
      return "note";
    default:
      console.warn("[boardTypes] Неизвестный node_type, используем person_node", rawNodeType);
      return "person_node";
  }
}

export type BoardNode = {
  node_id: number;
  name: string;
  pos_x: number;
  pos_y: number;
  node_type: BoardNodeType;
  description: string;
  picture_path?: string | null; 
};

export type BoardEdge = {
  edge_id: number;
  node1: number;
  node2: number;
};

export type BoardVersion = {
  version: string;
  name: string;
  description: string;
};
