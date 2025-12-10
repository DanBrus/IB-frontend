import React, { useMemo, useState } from "react";
import { InvestigationBoard } from "./InvestigationBoard";
import type { BoardNode, BoardEdge, BoardVersion } from "./boardTypes";
import type { BoardMode } from "./components/BoardToolbar";
import { boardDataSource } from "./boardDataSource";

interface InvestigationBoardScreenProps {
  title?: string;
  initialNodes: BoardNode[];
  initialEdges: BoardEdge[];
  versions: BoardVersion[];
  currentVersion: string;
  onChangeVersion: (version: string) => void;
}

export const InvestigationBoardScreen: React.FC<
  InvestigationBoardScreenProps
> = ({
  title = "Доска расследований",
  initialNodes,
  initialEdges,
  versions,
  currentVersion,
  onChangeVersion,
}) => {
  const [nodes, setNodes] = useState<BoardNode[]>(initialNodes);
  const [edges, setEdges] = useState<BoardEdge[]>(initialEdges);

  const [mode, setMode] = useState<BoardMode>("idle");
  const [edgeActionFirstNodeId, setEdgeActionFirstNodeId] = useState<
    number | null
  >(null);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);

  const [isPublishing, setIsPublishing] = useState(false);

  const nodesById = useMemo(() => {
    const map = new Map<number, BoardNode>();
    nodes.forEach((n) => map.set(n.node_id, n));
    return map;
  }, [nodes]);

  const selectedNode =
    selectedNodeId !== null ? nodesById.get(selectedNodeId) ?? null : null;

  const resetEdgeAction = () => {
    setEdgeActionFirstNodeId(null);
  };

  // --- переключатели режимов для тулбара ---

  const handleNodeAddClick = () => {
    setMode((prev) => (prev === "add-node" ? "idle" : "add-node"));
    resetEdgeAction();
    setSelectedNodeId(null);
  };

  const handleNodeDeleteClick = () => {
    setMode((prev) => (prev === "delete-node" ? "idle" : "delete-node"));
    resetEdgeAction();
    setSelectedNodeId(null);
  };

  const handleNodeEditClick = () => {
    setMode((prev) => (prev === "edit-node" ? "idle" : "edit-node"));
    resetEdgeAction();
    if (mode === "edit-node") {
      setSelectedNodeId(null);
    }
  };

  const handleEdgeAddClick = () => {
    setMode((prev) => (prev === "add-edge" ? "idle" : "add-edge"));
    resetEdgeAction();
    setSelectedNodeId(null);
  };

  const handleEdgeDeleteClick = () => {
    setMode((prev) => (prev === "delete-edge" ? "idle" : "delete-edge"));
    resetEdgeAction();
    setSelectedNodeId(null);
  };

  // --- действия доски ---

  const handleBoardClick = (x: number, y: number) => {
    if (mode !== "add-node") return;

    const maxId =
      nodes.length > 0
        ? nodes.reduce(
            (max, n) => (n.node_id > max ? n.node_id : max),
            nodes[0].node_id
          )
        : 0;
    const newId = maxId + 1;

    const newNode: BoardNode = {
      node_id: newId,
      name: `Node ${newId}`,
      pos_x: x,
      pos_y: y,
      description: "",
    };

    setNodes((prev) => [...prev, newNode]);
    setMode("idle");
  };

  const handleNodeClick = (node: BoardNode) => {
    // удаление ноды
    if (mode === "delete-node") {
      setNodes((prevNodes) =>
        prevNodes.filter((n) => n.node_id !== node.node_id)
      );
      setEdges((prevEdges) =>
        prevEdges.filter(
          (edge) => edge.node1 !== node.node_id && edge.node2 !== node.node_id
        )
      );
      setMode("idle");
      return;
    }

    // выбор ноды для инспектора
    if (mode === "edit-node") {
      setSelectedNodeId(node.node_id);
      return;
    }

    // добавление связи
    if (mode === "add-edge") {
      if (edgeActionFirstNodeId === null) {
        setEdgeActionFirstNodeId(node.node_id);
      } else {
        const fromId = edgeActionFirstNodeId;
        const toId = node.node_id;

        resetEdgeAction();
        setMode("idle");

        if (fromId === toId) {
          return;
        }

        const exists = edges.some(
          (edge) =>
            (edge.node1 === fromId && edge.node2 === toId) ||
            (edge.node1 === toId && edge.node2 === fromId)
        );
        if (exists) {
          return;
        }

        const maxEdgeId =
          edges.length > 0
            ? edges.reduce(
                (max, e) => (e.edge_id > max ? e.edge_id : max),
                edges[0].edge_id
              )
            : 0;

        const newEdge: BoardEdge = {
          edge_id: maxEdgeId + 1,
          node1: fromId,
          node2: toId,
        };

        setEdges((prev) => [...prev, newEdge]);
      }
      return;
    }

    // удаление связи
    if (mode === "delete-edge") {
      if (edgeActionFirstNodeId === null) {
        setEdgeActionFirstNodeId(node.node_id);
      } else {
        const n1 = edgeActionFirstNodeId;
        const n2 = node.node_id;

        resetEdgeAction();
        setMode("idle");

        const edgeToDelete = edges.find(
          (edge) =>
            (edge.node1 === n1 && edge.node2 === n2) ||
            (edge.node1 === n2 && edge.node2 === n1)
        );

        if (edgeToDelete) {
          setEdges((prev) =>
            prev.filter((e) => e.edge_id !== edgeToDelete.edge_id)
          );
        }
      }
      return;
    }
  };

  const handleNodePositionChange = (id: number, pos_x: number, pos_y: number) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.node_id === id ? { ...node, pos_x, pos_y } : node
      )
    );
  };

  const handleSelectedNodeSave = (
    id: number,
    patch: { name: string; description: string }
  ) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.node_id === id
          ? { ...node, name: patch.name, description: patch.description }
          : node
      )
    );
  };

  const handleVersionChange = (version: string) => {
    onChangeVersion(version);
  };

  const handlePublish = async () => {
    if (isPublishing) return;
    setIsPublishing(true);
    try {
      await boardDataSource.updateBoard({
        version: currentVersion,
        nodes,
        edges,
        description: null,
        board_name: null,
      });
      console.log("[InvestigationBoardScreen] Публикация завершена");
    } catch (e) {
      console.error("[InvestigationBoardScreen] Ошибка публикации", e);
      // тут можно повесить UI-ошибку / тост, если понадобится
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <InvestigationBoard
      title={title}
      nodes={nodes}
      edges={edges}
      mode={mode}
      selectedNode={selectedNode}
      versions={versions}
      currentVersion={currentVersion}
      onVersionChange={handleVersionChange}
      onPublish={handlePublish}
      onNodeAddClick={handleNodeAddClick}
      onNodeDeleteClick={handleNodeDeleteClick}
      onNodeEditClick={handleNodeEditClick}
      onEdgeAddClick={handleEdgeAddClick}
      onEdgeDeleteClick={handleEdgeDeleteClick}
      onBoardClick={handleBoardClick}
      onNodeClick={handleNodeClick}
      onNodePositionChange={handleNodePositionChange}
      onSelectedNodeSave={handleSelectedNodeSave}
    />
  );
};
