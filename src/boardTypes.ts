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

export type BoardChunk = {
  c_id: number;
  description: string;
  chunk_priority: number;
  timecode: string;
};

export type BoardNode = {
  node_id: number;
  ce_id: string;
  name: string;
  pos_x: number;
  pos_y: number;
  node_type: BoardNodeType;
  description: BoardChunk[];
  picture_path?: string | null;
};

export type BoardEdge = {
  edge_id: number;
  node1: number;
  node2: number;
  description: BoardChunk[];
};

export type BoardVersion = {
  version: number;
  name: string;
  description: string;
  is_published?: boolean | null;
};

export type CanonicalEntity = {
  en_id: string;
  name: string;
  entity_type: BoardNodeType;
  picture_paths: string[];
  merged_to?: string | null;
};

export type FreeIds = {
  node_id: number;
  edge_id: number;
  chunk_id: number;
};

export function parseBoardVersion(rawVersion: unknown): number | null {
  if (typeof rawVersion === "number") {
    return Number.isFinite(rawVersion) ? rawVersion : null;
  }

  if (typeof rawVersion !== "string") return null;

  const normalized = rawVersion.trim().replace(/^s/i, "");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatBoardVersion(version: number): string {
  return String(version);
}
