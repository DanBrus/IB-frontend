import React, { useEffect, useMemo, useRef, useState } from "react";
import { InvestigationBoard } from "./InvestigationBoard";
import type { EditableBoardDescriptionSheet } from "./boardDescription";
import { buildDescriptionAssignments } from "./boardDescription";
import {
  applyCanonicalEntityPicturesToNodes,
  createEmptyCanonicalEntity,
  getCanonicalEntityPicturePathChain,
  getPrimaryNodePicturePath,
  sortCanonicalEntities,
} from "./canonicalEntities";
import type {
  BoardAccessMode,
  BoardViewMode,
  BoardEdge,
  FreeIds,
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
import { fileDataSource, type PictureMeta } from "./fileDataSource";

const BOARD_ID = "demo-board";

interface InvestigationBoardScreenProps {
  title?: string;
  initialNodes: BoardNode[];
  initialEdges: BoardEdge[];
  initialCanonicalEntities: CanonicalEntity[];
  versions: BoardVersion[];
  currentVersion: number;
  accessMode: BoardAccessMode;
  boardViewMode: BoardViewMode;
  currentAnalysisCeId: number | null;
  analysisBoardInfo: {
    version: number;
    name: string | null;
    description: string | null;
  } | null;
  onChangeVersion: (version: number) => void;
  onCreateVersion: (payload: {
    version: number;
    name: string;
    description: string;
    is_published?: boolean | null;
  }) => Promise<void>;
  onDeleteVersion: (version: number) => Promise<void>;
  onPersistBoard: (payload: {
    version: number;
    nodes: BoardNode[];
    edges: BoardEdge[];
    is_published: boolean;
  }) => Promise<void>;
  onCanonicalEntitiesChange: (
    entities: CanonicalEntity[]
  ) => Promise<CanonicalEntitiesSyncResult>;
  onCanonicalEntityDelete: (
    entityId: number
  ) => Promise<CanonicalEntityDeleteResult>;
  onRequestEditMode: () => void;
  onOpenCanonicalEntityAnalysis: (ceId: number) => Promise<void>;
}

export const InvestigationBoardScreen: React.FC<InvestigationBoardScreenProps> = ({
  title = "Доска расследований",
  initialNodes,
  initialEdges,
  initialCanonicalEntities,
  versions,
  currentVersion,
  accessMode,
  boardViewMode,
  currentAnalysisCeId,
  analysisBoardInfo,
  onChangeVersion,
  onCreateVersion,
  onDeleteVersion,
  onPersistBoard,
  onCanonicalEntitiesChange,
  onCanonicalEntityDelete,
  onRequestEditMode,
  onOpenCanonicalEntityAnalysis,
}) => {
  const [nodes, setNodes] = useState<BoardNode[]>(() =>
    applyCanonicalEntityPicturesToNodes(initialNodes, initialCanonicalEntities)
  );
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
  const [freeIdsLoading, setFreeIdsLoading] = useState(false);
  const [freeIdsError, setFreeIdsError] = useState<string | null>(null);
  const [pictureMetaById, setPictureMetaById] = useState<Record<string, PictureMeta | null>>({});
  const [nodePictureMetaByNodeId, setNodePictureMetaByNodeId] = useState<
    Record<number, PictureMeta | null>
  >({});
  const freeIdsRef = useRef<FreeIds | null>(null);

  const nodesById = useMemo(() => {
    const map = new Map<number, BoardNode>();
    nodes.forEach((node) => map.set(node.node_id, node));
    return map;
  }, [nodes]);

  const canonicalEntitiesById = useMemo(() => {
    const map = new Map<number, CanonicalEntity>();
    canonicalEntities.forEach((entity) => map.set(entity.en_id, entity));
    return map;
  }, [canonicalEntities]);

  const pictureNodeIdsMap = useMemo(() => {
    const map = new Map<string, number[]>();

    nodes.forEach((node) => {
      const pictureId = getPrimaryNodePicturePath(node.picture_path);
      if (!pictureId) return;

      const nodeIds = map.get(pictureId);
      if (nodeIds) {
        nodeIds.push(node.node_id);
        return;
      }

      map.set(pictureId, [node.node_id]);
    });

    return map;
  }, [nodes]);

  const pictureIds = useMemo(
    () => [...pictureNodeIdsMap.keys()].sort((left, right) => left.localeCompare(right)),
    [pictureNodeIdsMap]
  );
  const pictureIdsKey = pictureIds.join("|");

  useEffect(() => {
    setIsPublished(Boolean(initialIsPublished));
  }, [currentVersion, initialIsPublished]);

  useEffect(() => {
    setNodes(applyCanonicalEntityPicturesToNodes(initialNodes, initialCanonicalEntities));
    setEdges(initialEdges);
    setMode("idle");
    setEdgeActionFirstNodeId(null);
    setSelectedNodeId(null);
    setDraftNode(null);
  }, [currentVersion, initialCanonicalEntities, initialEdges, initialNodes]);

  useEffect(() => {
    setCanonicalEntities(sortCanonicalEntities(initialCanonicalEntities));
  }, [initialCanonicalEntities]);

  useEffect(() => {
    setNodes((prevNodes) => applyCanonicalEntityPicturesToNodes(prevNodes, canonicalEntities));
  }, [canonicalEntities]);

  useEffect(() => {
    let cancelled = false;

    if (pictureIds.length === 0) {
      return () => {
        cancelled = true;
      };
    }

    void fileDataSource
      .getImageMetadata(pictureIds)
      .then((nextMetadata) => {
        if (cancelled) return;
        setPictureMetaById((prev) => ({
          ...prev,
          ...nextMetadata,
        }));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("[InvestigationBoardScreen] Не удалось загрузить метаданные картинок", error);
      });

    return () => {
      cancelled = true;
    };
  }, [pictureIdsKey]);

  useEffect(() => {
    const nextNodePictureMetaByNodeId: Record<number, PictureMeta | null> = {};

    pictureNodeIdsMap.forEach((nodeIds, pictureId) => {
      const pictureMeta = Object.prototype.hasOwnProperty.call(pictureMetaById, pictureId)
        ? pictureMetaById[pictureId] ?? null
        : null;

      nodeIds.forEach((nodeId) => {
        nextNodePictureMetaByNodeId[nodeId] = pictureMeta;
      });
    });

    setNodePictureMetaByNodeId(nextNodePictureMetaByNodeId);
  }, [pictureMetaById, pictureNodeIdsMap]);

  const isEditMode = accessMode === "edit";

  useEffect(() => {
    if (!isEditMode) {
      freeIdsRef.current = null;
      setFreeIdsLoading(false);
      setFreeIdsError(null);
      return;
    }

    let cancelled = false;
    setFreeIdsLoading(true);
    setFreeIdsError(null);

    void boardDataSource
      .getFreeIds(BOARD_ID)
      .then((nextFreeIds) => {
        if (cancelled) return;
        freeIdsRef.current = { ...nextFreeIds };
        setFreeIdsLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        freeIdsRef.current = null;
        setFreeIdsLoading(false);
        setFreeIdsError(
          error instanceof Error
            ? error.message
            : "Не удалось получить свободные id с сервера."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [currentVersion, initialEdges, initialNodes, isEditMode]);

  const selectedNode =
    draftNode ?? (selectedNodeId !== null ? nodesById.get(selectedNodeId) ?? null : null);

  const resetEdgeAction = () => setEdgeActionFirstNodeId(null);

  const allocateNextFreeId = (kind: keyof FreeIds): number => {
    const freeIds = freeIdsRef.current;
    if (!freeIds) {
      throw new Error(
        freeIdsLoading
          ? "Свободные id ещё загружаются. Попробуйте снова через секунду."
          : freeIdsError
            ? `Не удалось получить свободные id: ${freeIdsError}`
            : "Свободные id недоступны. Попробуйте обновить страницу."
      );
    }

    const nextId = freeIds[kind];
    freeIdsRef.current = {
      ...freeIds,
      [kind]: nextId + 1,
    };
    return nextId;
  };

  const ensureFreeIdsReady = (): boolean => {
    if (freeIdsRef.current) return true;

    const message = freeIdsLoading
      ? "Свободные id ещё загружаются. Попробуйте снова через секунду."
      : freeIdsError
        ? `Не удалось получить свободные id: ${freeIdsError}`
        : "Свободные id недоступны. Попробуйте обновить страницу.";

    window.alert(message);
    return false;
  };

  const clearNodeSelection = () => {
    setSelectedNodeId(null);
    setDraftNode(null);
  };

  const handleNodeAddClick = () => {
    if (!isEditMode) return;
    if (!ensureFreeIdsReady()) return;
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
    if (!ensureFreeIdsReady()) return;
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

    setDraftNode({
      node_id: allocateNextFreeId("node_id"),
      ce_id: null,
      name: "",
      pos_x: x,
      pos_y: y,
      node_type: BOARD_NODE_TYPES[0],
      description: [],
      picture_path: [],
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

        setEdges((prev) => [
          ...prev,
          {
            edge_id: allocateNextFreeId("edge_id"),
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
      ce_id: number;
      descriptionSheets: EditableBoardDescriptionSheet[];
    }
  ) => {
    if (!isEditMode) return;

    const canonicalEntity = canonicalEntitiesById.get(patch.ce_id);
    if (!canonicalEntity) {
      throw new Error("Выберите существующую canonical entity.");
    }

    const { nodeChunks, edgeChunksByEdgeId } = buildDescriptionAssignments(
      id,
      edges,
      patch.descriptionSheets,
      () => allocateNextFreeId("chunk_id")
    );

    const nodePatch = {
      ce_id: canonicalEntity.en_id,
      name: canonicalEntity.name,
      node_type: canonicalEntity.entity_type,
      picture_path: getCanonicalEntityPicturePathChain(
        canonicalEntity.en_id,
        canonicalEntities
      ),
      description: nodeChunks,
    };

    if (draftNode && draftNode.node_id === id) {
      setNodes((prev) => [
        ...prev,
        {
          node_id: draftNode.node_id,
          pos_x: draftNode.pos_x,
          pos_y: draftNode.pos_y,
          ...nodePatch,
        },
      ].sort((left, right) => left.node_id - right.node_id));
      setDraftNode(null);
      setSelectedNodeId(draftNode.node_id);
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

  const handleLoadImageMetadata = async (
    pictureIdsToLoad: string[]
  ): Promise<Record<string, PictureMeta | null>> => {
    const nextMetadata = await fileDataSource.getImageMetadata(pictureIdsToLoad);
    setPictureMetaById((prev) => ({
      ...prev,
      ...nextMetadata,
    }));
    return nextMetadata;
  };

  const handleUpdateImageMetadata = async (
    pictureId: string,
    metadata: PictureMeta | null
  ): Promise<PictureMeta | null> => {
    if (!isEditMode) {
      throw new Error("Режим редактирования недоступен.");
    }

    const updatedMetadata = await fileDataSource.updateImageMetadata(pictureId, metadata);
    setPictureMetaById((prev) => ({
      ...prev,
      [pictureId]: updatedMetadata,
    }));
    return updatedMetadata;
  };

  const handleCanonicalEntitiesSave = async (
    nextEntities: CanonicalEntity[]
  ): Promise<CanonicalEntitiesSyncResult> => {
    if (!isEditMode) {
      throw new Error("Режим редактирования недоступен.");
    }

    const sortedEntities = sortCanonicalEntities(nextEntities);
    const syncResult = await onCanonicalEntitiesChange(sortedEntities);
    if (!syncResult.persisted) {
      setCanonicalEntities(sortedEntities);
    }
    return syncResult;
  };

  const createCanonicalEntityDraft = (): CanonicalEntity | null => {
    if (!ensureFreeIdsReady()) return null;
    return createEmptyCanonicalEntity(allocateNextFreeId("ce_id"));
  };

  const handleCanonicalEntityDelete = async (
    entityId: number
  ): Promise<CanonicalEntityDeleteResult> => {
    if (!isEditMode) {
      throw new Error("Режим редактирования недоступен.");
    }

    return onCanonicalEntityDelete(entityId);
  };

  const handleCanonicalEntitiesDialogClose = async () => undefined;

  const handleVersionChange = (version: number) => onChangeVersion(version);

  const handlePublish = async () => {
    if (!isEditMode || isPublishing) return;

    setIsPublishing(true);
    try {
      await onPersistBoard({
        version: currentVersion,
        nodes,
        edges,
        is_published: isPublished,
      });
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
      pictureMetaById={pictureMetaById}
      nodePictureMetaByNodeId={nodePictureMetaByNodeId}
      mode={mode}
      selectedNode={selectedNode}
      versions={versions}
      currentVersion={currentVersion}
      currentVersionIsPublished={isPublished}
      accessMode={accessMode}
      boardViewMode={boardViewMode}
      currentAnalysisCeId={currentAnalysisCeId}
      analysisBoardInfo={analysisBoardInfo}
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
      onCreateCanonicalEntityDraft={createCanonicalEntityDraft}
      onCanonicalEntitiesManagerClose={handleCanonicalEntitiesDialogClose}
      onLoadImageMetadata={handleLoadImageMetadata}
      onUpdateImageMetadata={handleUpdateImageMetadata}
      onUploadImage={handleUploadImage}
      onOpenCanonicalEntityAnalysis={onOpenCanonicalEntityAnalysis}
    />
  );
};
