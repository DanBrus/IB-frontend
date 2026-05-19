import React, { useEffect, useMemo, useState } from "react";
import { InvestigationBoard } from "./InvestigationBoard";
import type { EditableBoardDescriptionSheet } from "./boardDescription";
import { buildDescriptionAssignments } from "./boardDescription";
import {
  getCanonicalEntityPicturePath,
  sortCanonicalEntities,
} from "./canonicalEntities";
import type {
  BoardAccessMode,
  BoardEdge,
  BoardNode,
  BoardVersion,
  CanonicalEntity,
} from "./boardTypes";
import { BOARD_NODE_TYPES } from "./boardTypes";
import type { BoardMode } from "./components/BoardToolbar";
import type {
  CanonicalEntitiesSyncResult,
  CanonicalEntityDeleteResult,
} from "./boardDataSource";
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
  onCanonicalEntitiesChange: (
    entities: CanonicalEntity[]
  ) => Promise<CanonicalEntitiesSyncResult>;
  onCanonicalEntityDelete: (
    entityId: string
  ) => Promise<CanonicalEntityDeleteResult>;
  onRequestEditMode: () => void;
}

function mergeRefreshedNodes(currentNodes: BoardNode[], refreshedNodes: BoardNode[]): BoardNode[] {
  const refreshedNodesById = new Map(
    refreshedNodes.map((node) => [node.node_id, node] as const)
  );

  const mergedNodes = currentNodes.map((node) => {
    const refreshedNode = refreshedNodesById.get(node.node_id);
    if (!refreshedNode) return node;

    refreshedNodesById.delete(node.node_id);
    return {
      ...node,
      CE_id: refreshedNode.CE_id,
      name: refreshedNode.name,
      node_type: refreshedNode.node_type,
      picture_path: refreshedNode.picture_path,
    };
  });

  return [...mergedNodes, ...refreshedNodesById.values()].sort(
    (left, right) => left.node_id - right.node_id
  );
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
  onCanonicalEntityDelete,
  onRequestEditMode,
}) => {
  const [nodes, setNodes] = useState<BoardNode[]>(initialNodes);
  const [edges, setEdges] = useState<BoardEdge[]>(initialEdges);
  const [canonicalEntities, setCanonicalEntities] = useState<CanonicalEntity[]>(() =>
    sortCanonicalEntities(initialCanonicalEntities)
  );
  const [draftNode, setDraftNode] = useState<BoardNode | null>(null);

  const [mode, setMode] = useState<BoardMode>("idle");
  const [edgeActionFirstNodeId, setEdgeActionFirstNodeId] = useState<number | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);

  const [isPublishing, setIsPublishing] = useState(false);
  const initialIsPublished =
    versions.find((version) => version.version === currentVersion)?.is_published ?? false;
  const [isPublished, setIsPublished] = useState(Boolean(initialIsPublished));

  const nodesById = useMemo(() => {
    const map = new Map<number, BoardNode>();
    nodes.forEach((node) => map.set(node.node_id, node));
    return map;
  }, [nodes]);

  const canonicalEntitiesById = useMemo(() => {
    const map = new Map<string, CanonicalEntity>();
    canonicalEntities.forEach((entity) => map.set(entity.en_id, entity));
    return map;
  }, [canonicalEntities]);

  useEffect(() => {
    setIsPublished(Boolean(initialIsPublished));
  }, [currentVersion, initialIsPublished]);

  useEffect(() => {
    setCanonicalEntities(sortCanonicalEntities(initialCanonicalEntities));
  }, [initialCanonicalEntities]);

  const selectedNode =
    draftNode ?? (selectedNodeId !== null ? nodesById.get(selectedNodeId) ?? null : null);
  const isEditMode = accessMode === "edit";

  const resetEdgeAction = () => setEdgeActionFirstNodeId(null);

  const clearNodeSelection = () => {
    setSelectedNodeId(null);
    setDraftNode(null);
  };

  const handleNodeAddClick = () => {
    if (!isEditMode) return;
    setMode((prev) => (prev === "add-node" ? "idle" : "add-node"));
    resetEdgeAction();
    clearNodeSelection();
  };

  const handleNodeDeleteClick = () => {
    if (!isEditMode) return;
    setMode((prev) => (prev === "delete-node" ? "idle" : "delete-node"));
    resetEdgeAction();
    clearNodeSelection();
  };

  const handleNodeEditClick = () => {
    if (!isEditMode) return;
    setMode((prev) => (prev === "edit-node" ? "idle" : "edit-node"));
    resetEdgeAction();
    setDraftNode(null);
    if (mode === "edit-node") setSelectedNodeId(null);
  };

  const handleEdgeAddClick = () => {
    if (!isEditMode) return;
    setMode((prev) => (prev === "add-edge" ? "idle" : "add-edge"));
    resetEdgeAction();
    clearNodeSelection();
  };

  const handleEdgeDeleteClick = () => {
    if (!isEditMode) return;
    setMode((prev) => (prev === "delete-edge" ? "idle" : "delete-edge"));
    resetEdgeAction();
    clearNodeSelection();
  };

  const handleBoardClick = (x: number, y: number) => {
    if (!isEditMode || mode !== "add-node") return;

    const nextDraftNodeId =
      nodes.reduce(
        (minNodeId, node) => Math.min(minNodeId, node.node_id),
        0
      ) - 1;

    setDraftNode({
      node_id: nextDraftNodeId,
      CE_id: "",
      name: "",
      pos_x: x,
      pos_y: y,
      node_type: BOARD_NODE_TYPES[0],
      description: [],
      picture_path: null,
    });
    setSelectedNodeId(null);
    setMode("edit-node");
  };

  const handleNodeClick = (node: BoardNode) => {
    if (!isEditMode) return;

    if (mode === "delete-node") {
      setNodes((prev) => prev.filter((item) => item.node_id !== node.node_id));
      setEdges((prev) =>
        prev.filter(
          (edge) => edge.node1 !== node.node_id && edge.node2 !== node.node_id
        )
      );
      setMode("idle");
      if (selectedNodeId === node.node_id) setSelectedNodeId(null);
      return;
    }

    if (mode === "edit-node") {
      setDraftNode(null);
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

        const maxEdgeId =
          edges.length > 0
            ? edges.reduce(
                (maxIdSoFar, edge) => Math.max(maxIdSoFar, edge.edge_id),
                0
              )
            : 0;

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
        if (edgeToDelete) {
          setEdges((prev) =>
            prev.filter((edge) => edge.edge_id !== edgeToDelete.edge_id)
          );
        }
      }
    }
  };

  const handleNodePositionChange = (id: number, pos_x: number, pos_y: number) => {
    setNodes((prev) =>
      prev.map((node) => (node.node_id === id ? { ...node, pos_x, pos_y } : node))
    );
  };

  const handleSelectedNodeSave = async (
    id: number,
    patch: {
      CE_id: string;
      descriptionSheets: EditableBoardDescriptionSheet[];
    }
  ) => {
    if (!isEditMode) return;

    const canonicalEntity = canonicalEntitiesById.get(patch.CE_id);
    if (!canonicalEntity) {
      throw new Error("Выберите существующую canonical entity.");
    }

    const { nodeChunks, edgeChunksByEdgeId } = buildDescriptionAssignments(
      id,
      edges,
      patch.descriptionSheets
    );

    const nodePatch = {
      CE_id: canonicalEntity.en_id,
      name: canonicalEntity.name,
      node_type: canonicalEntity.entity_type,
      picture_path: getCanonicalEntityPicturePath(canonicalEntity),
      description: nodeChunks,
    };

    if (draftNode && draftNode.node_id === id) {
      const maxNodeId =
        nodes.length > 0
          ? nodes.reduce(
              (maxIdSoFar, node) => Math.max(maxIdSoFar, node.node_id),
              0
            )
          : 0;
      const newNodeId = maxNodeId + 1;

      setNodes((prev) => [
        ...prev,
        {
          node_id: newNodeId,
          pos_x: draftNode.pos_x,
          pos_y: draftNode.pos_y,
          ...nodePatch,
        },
      ]);
      setDraftNode(null);
      setSelectedNodeId(newNodeId);
      return;
    }

    setNodes((prev) =>
      prev.map((node) =>
        node.node_id === id
          ? {
              ...node,
              ...nodePatch,
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

  const handleCanonicalEntitiesSave = async (
    nextEntities: CanonicalEntity[]
  ): Promise<CanonicalEntitiesSyncResult> => {
    if (!isEditMode) {
      throw new Error("Режим редактирования недоступен.");
    }

    const sortedEntities = sortCanonicalEntities(nextEntities);
    const syncResult = await onCanonicalEntitiesChange(sortedEntities);
    setCanonicalEntities(sortedEntities);
    return syncResult;
  };

  const handleCanonicalEntityDelete = async (
    entityId: string
  ): Promise<CanonicalEntityDeleteResult> => {
    if (!isEditMode) {
      throw new Error("Режим редактирования недоступен.");
    }

    const deleteResult = await onCanonicalEntityDelete(entityId);
    if (deleteResult.outcome === "deleted") {
      setCanonicalEntities((prev) =>
        prev.filter((entity) => entity.en_id !== entityId)
      );
    }

    return deleteResult;
  };

  const refreshNodesFromServer = async () => {
    const nextNodes = await boardDataSource.getNodes("demo-board", currentVersion);
    setNodes((prev) => mergeRefreshedNodes(prev, nextNodes));
  };

  const handleCanonicalEntitiesDialogClose = async (shouldRefreshNodes: boolean) => {
    if (!shouldRefreshNodes) return;

    try {
      await refreshNodesFromServer();
    } catch (error) {
      console.error("[InvestigationBoardScreen] Не удалось обновить ноды после CE", error);
      window.alert("Не удалось перечитать ноды после изменения canonical entity.");
    }
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
      window.alert(
        e instanceof Error ? e.message : "Не удалось сохранить текущую версию."
      );
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
      onCanonicalEntityDelete={handleCanonicalEntityDelete}
      onCanonicalEntitiesManagerClose={handleCanonicalEntitiesDialogClose}
      onUploadImage={handleUploadImage}
    />
  );
};
