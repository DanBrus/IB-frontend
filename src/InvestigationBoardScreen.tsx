import React, { useEffect, useMemo, useState } from "react";
import { InvestigationBoard } from "./InvestigationBoard";
import type { EditableBoardDescriptionSheet } from "./boardDescription";
import { buildDescriptionAssignments } from "./boardDescription";
import { sortCanonicalEntities } from "./canonicalEntities";
import type {
  BoardAccessMode,
  BoardEdge,
  BoardNode,
  BoardNodeType,
  BoardVersion,
  CanonicalEntity,
} from "./boardTypes";
import { BOARD_NODE_TYPES } from "./boardTypes";
import type { BoardMode } from "./components/BoardToolbar";
import { boardDataSource } from "./boardDataSource";
import { fileDataSource } from "./fileDataSource";

interface InvestigationBoardScreenProps {
  title?: string;
  initialNodes: BoardNode[];
  initialEdges: BoardEdge[];
  initialCanonicalEntities: CanonicalEntity[];
  versions: BoardVersion[];
  currentVersion: number;
  accessMode: BoardAccessMode;
  onChangeVersion: (version: number) => void;
  onCreateVersion: (payload: {
    version: number;
    name: string;
    description: string;
    is_published?: boolean | null;
  }) => Promise<void>;
  onDeleteVersion: (version: number) => Promise<void>;
  onCurrentVersionPublicationChange: (version: number, isPublished: boolean) => void;
  onCanonicalEntitiesChange: (entities: CanonicalEntity[]) => Promise<void>;
  onRequestEditMode: () => void;
}

export const InvestigationBoardScreen: React.FC<InvestigationBoardScreenProps> = ({
  title = "Доска расследований",
  initialNodes,
  initialEdges,
  initialCanonicalEntities,
  versions,
  currentVersion,
  accessMode,
  onChangeVersion,
  onCreateVersion,
  onDeleteVersion,
  onCurrentVersionPublicationChange,
  onCanonicalEntitiesChange,
  onRequestEditMode,
}) => {
  const [nodes, setNodes] = useState<BoardNode[]>(initialNodes);
  const [edges, setEdges] = useState<BoardEdge[]>(initialEdges);
  const [canonicalEntities, setCanonicalEntities] = useState<CanonicalEntity[]>(() =>
    sortCanonicalEntities(initialCanonicalEntities)
  );

  const [mode, setMode] = useState<BoardMode>("idle");
  const [edgeActionFirstNodeId, setEdgeActionFirstNodeId] = useState<number | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);

  const [isPublishing, setIsPublishing] = useState(false);
  const initialIsPublished = versions.find((version) => version.version === currentVersion)?.is_published ?? false;
  const [isPublished, setIsPublished] = useState(Boolean(initialIsPublished));

  const nodesById = useMemo(() => {
    const map = new Map<number, BoardNode>();
    nodes.forEach((node) => map.set(node.node_id, node));
    return map;
  }, [nodes]);

  useEffect(() => {
    setIsPublished(Boolean(initialIsPublished));
  }, [currentVersion, initialIsPublished]);

  useEffect(() => {
    setCanonicalEntities(sortCanonicalEntities(initialCanonicalEntities));
  }, [initialCanonicalEntities]);

  const selectedNode = selectedNodeId !== null ? nodesById.get(selectedNodeId) ?? null : null;
  const isEditMode = accessMode === "edit";

  const resetEdgeAction = () => setEdgeActionFirstNodeId(null);

  const handleNodeAddClick = () => {
    if (!isEditMode) return;
    setMode((prev) => (prev === "add-node" ? "idle" : "add-node"));
    resetEdgeAction();
    setSelectedNodeId(null);
  };

  const handleNodeDeleteClick = () => {
    if (!isEditMode) return;
    setMode((prev) => (prev === "delete-node" ? "idle" : "delete-node"));
    resetEdgeAction();
    setSelectedNodeId(null);
  };

  const handleNodeEditClick = () => {
    if (!isEditMode) return;
    setMode((prev) => (prev === "edit-node" ? "idle" : "edit-node"));
    resetEdgeAction();
    if (mode === "edit-node") setSelectedNodeId(null);
  };

  const handleEdgeAddClick = () => {
    if (!isEditMode) return;
    setMode((prev) => (prev === "add-edge" ? "idle" : "add-edge"));
    resetEdgeAction();
    setSelectedNodeId(null);
  };

  const handleEdgeDeleteClick = () => {
    if (!isEditMode) return;
    setMode((prev) => (prev === "delete-edge" ? "idle" : "delete-edge"));
    resetEdgeAction();
    setSelectedNodeId(null);
  };

  const handleBoardClick = (x: number, y: number) => {
    if (!isEditMode || mode !== "add-node") return;

    const maxId = nodes.length > 0 ? nodes.reduce((maxIdSoFar, node) => Math.max(maxIdSoFar, node.node_id), 0) : 0;
    const newId = maxId + 1;

    setNodes((prev) => [
      ...prev,
      {
        node_id: newId,
        name: `Node ${newId}`,
        pos_x: x,
        pos_y: y,
        node_type: BOARD_NODE_TYPES[0],
        description: [],
        picture_path: null,
      },
    ]);

    setMode("idle");
  };

  const handleNodeClick = (node: BoardNode) => {
    if (!isEditMode) return;

    if (mode === "delete-node") {
      setNodes((prev) => prev.filter((item) => item.node_id !== node.node_id));
      setEdges((prev) => prev.filter((edge) => edge.node1 !== node.node_id && edge.node2 !== node.node_id));
      setMode("idle");
      if (selectedNodeId === node.node_id) setSelectedNodeId(null);
      return;
    }

    if (mode === "edit-node") {
      setSelectedNodeId(node.node_id);
      return;
    }

    if (mode === "add-edge") {
      if (edgeActionFirstNodeId === null) {
        setEdgeActionFirstNodeId(node.node_id);
      } else {
        const fromId = edgeActionFirstNodeId;
        const toId = node.node_id;

        resetEdgeAction();
        setMode("idle");

        if (fromId === toId) return;

        const exists = edges.some(
          (edge) =>
            (edge.node1 === fromId && edge.node2 === toId) ||
            (edge.node1 === toId && edge.node2 === fromId)
        );
        if (exists) return;

        const maxEdgeId = edges.length > 0 ? edges.reduce((maxIdSoFar, edge) => Math.max(maxIdSoFar, edge.edge_id), 0) : 0;

        setEdges((prev) => [
          ...prev,
          {
            edge_id: maxEdgeId + 1,
            node1: fromId,
            node2: toId,
            description: [],
          },
        ]);
      }
      return;
    }

    if (mode === "delete-edge") {
      if (edgeActionFirstNodeId === null) {
        setEdgeActionFirstNodeId(node.node_id);
      } else {
        const node1 = edgeActionFirstNodeId;
        const node2 = node.node_id;

        resetEdgeAction();
        setMode("idle");

        const edgeToDelete = edges.find(
          (edge) =>
            (edge.node1 === node1 && edge.node2 === node2) ||
            (edge.node1 === node2 && edge.node2 === node1)
        );
        if (edgeToDelete) setEdges((prev) => prev.filter((edge) => edge.edge_id !== edgeToDelete.edge_id));
      }
    }
  };

  const handleNodePositionChange = (id: number, pos_x: number, pos_y: number) => {
    setNodes((prev) => prev.map((node) => (node.node_id === id ? { ...node, pos_x, pos_y } : node)));
  };

  const handleSelectedNodeSave = async (
    id: number,
    patch: {
      name: string;
      descriptionSheets: EditableBoardDescriptionSheet[];
      node_type: BoardNodeType;
    }
  ) => {
    if (!isEditMode) return;

    const { nodeChunks, edgeChunksByEdgeId } = buildDescriptionAssignments(id, edges, patch.descriptionSheets);

    setNodes((prev) =>
      prev.map((node) =>
        node.node_id === id
          ? {
              ...node,
              name: patch.name,
              node_type: patch.node_type,
              description: nodeChunks,
            }
          : node
      )
    );

    setEdges((prev) =>
      prev.map((edge) =>
        edgeChunksByEdgeId.has(edge.edge_id)
          ? {
              ...edge,
              description: edgeChunksByEdgeId.get(edge.edge_id) ?? [],
            }
          : edge
      )
    );
  };

  const handleUploadImage = (blob: Blob) => {
    if (!isEditMode) {
      return Promise.reject(new Error("Режим редактирования недоступен."));
    }

    return fileDataSource.uploadImage(blob, "canonical-entity.png");
  };

  const handleCanonicalEntitiesSave = async (nextEntities: CanonicalEntity[]) => {
    if (!isEditMode) return;

    const sortedEntities = sortCanonicalEntities(nextEntities);
    setCanonicalEntities(sortedEntities);
    await onCanonicalEntitiesChange(sortedEntities);
  };

  const handleVersionChange = (version: number) => onChangeVersion(version);

  const handlePublish = async () => {
    if (!isEditMode || isPublishing) return;

    setIsPublishing(true);
    try {
      await boardDataSource.updateBoard({
        version: currentVersion,
        nodes,
        edges,
        description: null,
        board_name: null,
        is_published: isPublished,
      });
      onCurrentVersionPublicationChange(currentVersion, isPublished);
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : "Не удалось сохранить текущую версию.");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <InvestigationBoard
      title={title}
      nodes={nodes}
      edges={edges}
      canonicalEntities={canonicalEntities}
      mode={mode}
      selectedNode={selectedNode}
      versions={versions}
      currentVersion={currentVersion}
      currentVersionIsPublished={isPublished}
      accessMode={accessMode}
      onVersionChange={handleVersionChange}
      onCreateVersion={onCreateVersion}
      onDeleteVersion={onDeleteVersion}
      onRequestEditMode={onRequestEditMode}
      onPublish={handlePublish}
      onCurrentVersionPublishedChange={setIsPublished}
      onNodeAddClick={handleNodeAddClick}
      onNodeDeleteClick={handleNodeDeleteClick}
      onNodeEditClick={handleNodeEditClick}
      onEdgeAddClick={handleEdgeAddClick}
      onEdgeDeleteClick={handleEdgeDeleteClick}
      onBoardClick={handleBoardClick}
      onNodeClick={handleNodeClick}
      onNodePositionChange={handleNodePositionChange}
      onSelectedNodeSave={handleSelectedNodeSave}
      onCanonicalEntitiesChange={handleCanonicalEntitiesSave}
      onUploadImage={handleUploadImage}
    />
  );
};
