import type { BoardChunk, BoardEdge, BoardNode } from "./boardTypes";

export type BoardDescriptionSheet = {
  id: string;
  description: string;
  chunk_priority: number;
  timecode: string;
  relatedNodeIds: number[];
  relatedNodeNames: string[];
  isNodeOwned: boolean;
  c_ids: number[];
};

export type EditableBoardDescriptionSheet = {
  id: string;
  description: string;
  chunk_priority: number;
  timecode: string;
  relatedNodeIds: number[];
  isNodeOwned: boolean;
  c_ids: number[];
};

type DescriptionOrigin = {
  description: string;
  chunk_priority: number;
  timecode: string;
  relatedNodeId: number | null;
  isNodeOwned: boolean;
  c_id: number;
  order: number;
};

type DescriptionAssignment = {
  nodeChunks: BoardChunk[];
  edgeChunksByEdgeId: Map<number, BoardChunk[]>;
};

const SHEET_SOURCE_SEPARATOR = ", ";

function createLocalSheetId(prefix = "sheet"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeSheetDescription(description: string): string {
  return description.trim();
}

function sortByNameAndId(nodes: BoardNode[]): BoardNode[] {
  return [...nodes].sort(
    (left, right) =>
      left.name.localeCompare(right.name, "ru") ||
      left.node_id - right.node_id
  );
}

function sortNodeIdsByName(nodeIds: number[], nodesById: Map<number, BoardNode>): number[] {
  return [...nodeIds].sort((left, right) => {
    const leftName = nodesById.get(left)?.name ?? "";
    const rightName = nodesById.get(right)?.name ?? "";

    return leftName.localeCompare(rightName, "ru") || left - right;
  });
}

export function sortChunks(chunks: BoardChunk[]): BoardChunk[] {
  return [...chunks].sort(
    (left, right) =>
      left.chunk_priority - right.chunk_priority ||
      left.c_id - right.c_id ||
      left.description.localeCompare(right.description, "ru")
  );
}

export function getConnectedNodeIds(nodeId: number, edges: BoardEdge[]): number[] {
  const connectedNodeIds = new Set<number>();

  edges.forEach((edge) => {
    if (edge.node1 === nodeId) connectedNodeIds.add(edge.node2);
    if (edge.node2 === nodeId) connectedNodeIds.add(edge.node1);
  });

  return [...connectedNodeIds.values()];
}

export function getConnectedNodes(nodeId: number, nodes: BoardNode[], edges: BoardEdge[]): BoardNode[] {
  const connectedNodeIds = new Set(getConnectedNodeIds(nodeId, edges));
  return sortByNameAndId(nodes.filter((node) => connectedNodeIds.has(node.node_id)));
}

export function buildNodeDescriptionSheets(
  node: BoardNode | null,
  nodes: BoardNode[],
  edges: BoardEdge[]
): BoardDescriptionSheet[] {
  if (!node) return [];

  const nodesById = new Map(nodes.map((item) => [item.node_id, item] as const));
  const connectedEdges = edges
    .filter((edge) => edge.node1 === node.node_id || edge.node2 === node.node_id)
    .sort((left, right) => left.edge_id - right.edge_id);

  const origins: DescriptionOrigin[] = [];
  let order = 0;

  sortChunks(node.description).forEach((chunk) => {
    const description = normalizeSheetDescription(chunk.description);
    if (!description) return;

    origins.push({
      description,
      chunk_priority: chunk.chunk_priority,
      timecode: chunk.timecode,
      relatedNodeId: null,
      isNodeOwned: true,
      c_id: chunk.c_id,
      order: order++,
    });
  });

  connectedEdges.forEach((edge) => {
    const relatedNodeId = edge.node1 === node.node_id ? edge.node2 : edge.node1;

    sortChunks(edge.description).forEach((chunk) => {
      const description = normalizeSheetDescription(chunk.description);
      if (!description) return;

      origins.push({
        description,
        chunk_priority: chunk.chunk_priority,
        timecode: chunk.timecode,
        relatedNodeId,
        isNodeOwned: false,
        c_id: chunk.c_id,
        order: order++,
      });
    });
  });

  origins.sort(
    (left, right) =>
      left.chunk_priority - right.chunk_priority ||
      left.order - right.order ||
      left.c_id - right.c_id
  );

  const sheetsByDescription = new Map<
    string,
    {
      id: string;
      description: string;
      chunk_priority: number;
      timecode: string;
      relatedNodeIds: Set<number>;
      isNodeOwned: boolean;
      c_ids: Set<number>;
      order: number;
    }
  >();

  origins.forEach((origin) => {
    const existing = sheetsByDescription.get(origin.description);

    if (!existing) {
      const relatedNodeIds = new Set<number>();
      if (origin.relatedNodeId !== null) relatedNodeIds.add(origin.relatedNodeId);

      const cIds = new Set<number>();
      if (origin.c_id > 0) cIds.add(origin.c_id);

      sheetsByDescription.set(origin.description, {
        id: `sheet-${origin.order}-${origin.c_id || 0}`,
        description: origin.description,
        chunk_priority: origin.chunk_priority,
        timecode: origin.timecode,
        relatedNodeIds,
        isNodeOwned: origin.isNodeOwned,
        c_ids: cIds,
        order: origin.order,
      });
      return;
    }

    existing.chunk_priority = Math.min(existing.chunk_priority, origin.chunk_priority);
    if (!existing.timecode && origin.timecode) existing.timecode = origin.timecode;
    existing.isNodeOwned ||= origin.isNodeOwned;
    existing.order = Math.min(existing.order, origin.order);
    if (origin.relatedNodeId !== null) existing.relatedNodeIds.add(origin.relatedNodeId);
    if (origin.c_id > 0) existing.c_ids.add(origin.c_id);
  });

  return [...sheetsByDescription.values()]
    .sort(
      (left, right) =>
        left.chunk_priority - right.chunk_priority ||
        left.order - right.order ||
        left.description.localeCompare(right.description, "ru")
    )
    .map((sheet) => {
      const relatedNodeIds = sortNodeIdsByName([...sheet.relatedNodeIds.values()], nodesById);

      return {
        id: sheet.id,
        description: sheet.description,
        chunk_priority: sheet.chunk_priority,
        timecode: sheet.timecode,
        relatedNodeIds,
        relatedNodeNames: relatedNodeIds
          .map((relatedNodeId) => nodesById.get(relatedNodeId)?.name ?? "")
          .filter(Boolean),
        isNodeOwned: sheet.isNodeOwned,
        c_ids: [...sheet.c_ids.values()].sort((left, right) => left - right),
      };
    });
}

export function toEditableDescriptionSheets(
  sheets: BoardDescriptionSheet[]
): EditableBoardDescriptionSheet[] {
  return sheets.map((sheet) => ({
    id: sheet.id,
    description: sheet.description,
    chunk_priority: sheet.chunk_priority,
    timecode: sheet.timecode,
    relatedNodeIds: [...sheet.relatedNodeIds],
    isNodeOwned: sheet.isNodeOwned,
    c_ids: [...sheet.c_ids],
  }));
}

export function createEmptyDescriptionSheet(
  existingSheets: EditableBoardDescriptionSheet[]
): EditableBoardDescriptionSheet {
  const nextPriority =
    existingSheets.reduce(
      (maxPriority, sheet) => Math.max(maxPriority, sheet.chunk_priority),
      0
    ) + 1;

  return {
    id: createLocalSheetId(),
    description: "",
    chunk_priority: nextPriority,
    timecode: "",
    relatedNodeIds: [],
    isNodeOwned: false,
    c_ids: [],
  };
}

export function buildDescriptionAssignments(
  nodeId: number,
  edges: BoardEdge[],
  sheets: EditableBoardDescriptionSheet[]
): DescriptionAssignment {
  const connectedEdgeByNodeId = new Map<number, BoardEdge>();
  const edgeChunksByEdgeId = new Map<number, BoardChunk[]>();

  edges.forEach((edge) => {
    if (edge.node1 === nodeId) {
      connectedEdgeByNodeId.set(edge.node2, edge);
      edgeChunksByEdgeId.set(edge.edge_id, []);
      return;
    }

    if (edge.node2 === nodeId) {
      connectedEdgeByNodeId.set(edge.node1, edge);
      edgeChunksByEdgeId.set(edge.edge_id, []);
    }
  });

  const normalizedSheets = sheets
    .map((sheet) => ({
      ...sheet,
      description: normalizeSheetDescription(sheet.description),
      timecode: sheet.timecode.trim(),
      relatedNodeIds: [...new Set(sheet.relatedNodeIds)].filter((relatedNodeId) =>
        connectedEdgeByNodeId.has(relatedNodeId)
      ),
    }))
    .filter((sheet) => sheet.description.length > 0)
    .sort(
      (left, right) =>
        left.chunk_priority - right.chunk_priority ||
        left.description.localeCompare(right.description, "ru")
    );

  const nodeChunks: BoardChunk[] = [];

  normalizedSheets.forEach((sheet, index) => {
    const chunk: BoardChunk = {
      c_id: sheet.c_ids[0] && sheet.c_ids[0] > 0 ? sheet.c_ids[0] : -(index + 1),
      description: sheet.description,
      chunk_priority: sheet.chunk_priority,
      timecode: sheet.timecode,
    };

    const saveToNode = sheet.relatedNodeIds.length === 0 || sheet.isNodeOwned;
    if (saveToNode) nodeChunks.push({ ...chunk });

    sheet.relatedNodeIds.forEach((relatedNodeId) => {
      const edge = connectedEdgeByNodeId.get(relatedNodeId);
      if (!edge) return;

      const edgeChunks = edgeChunksByEdgeId.get(edge.edge_id);
      if (!edgeChunks) return;

      edgeChunks.push({ ...chunk });
    });
  });

  edgeChunksByEdgeId.forEach((edgeChunks, edgeId) => {
    edgeChunksByEdgeId.set(edgeId, sortChunks(edgeChunks));
  });

  return {
    nodeChunks: sortChunks(nodeChunks),
    edgeChunksByEdgeId,
  };
}

export function getDescriptionPreviewText(chunks: BoardChunk[]): string {
  return sortChunks(chunks)
    .map((chunk) => normalizeSheetDescription(chunk.description))
    .filter(Boolean)
    .join("\n\n");
}

export function getSheetSourceLabel(relatedNodeNames: string[]): string {
  return relatedNodeNames
    .map((relatedNodeName) => relatedNodeName.trim())
    .filter(Boolean)
    .join(SHEET_SOURCE_SEPARATOR);
}

export function truncateSheetSourceLabel(sourceLabel: string, maxChars = 20): string {
  const normalized = sourceLabel.trim();
  if (normalized.length <= maxChars) return normalized;
  if (maxChars <= 3) return ".".repeat(Math.max(0, maxChars));

  return `${normalized.slice(0, maxChars - 3).trimEnd()}...`;
}
