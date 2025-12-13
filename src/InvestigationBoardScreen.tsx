import React, { useMemo, useState } from "react";
import { InvestigationBoard } from "./InvestigationBoard";
import type { BoardNode, BoardEdge, BoardVersion } from "./boardTypes";
import type { BoardMode } from "./components/BoardToolbar";
import { boardDataSource } from "./boardDataSource";
import { fileDataSource } from "./fileDataSource";

interface InvestigationBoardScreenProps {
  title?: string;
  initialNodes: BoardNode[];
  initialEdges: BoardEdge[];
  versions: BoardVersion[];
  currentVersion: string;
  onChangeVersion: (version: string) => void;
}

export const InvestigationBoardScreen: React.FC<InvestigationBoardScreenProps> = ({
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
  const [edgeActionFirstNodeId, setEdgeActionFirstNodeId] = useState<number | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);

  const [isPublishing, setIsPublishing] = useState(false);

  const nodesById = useMemo(() => {
    const map = new Map<number, BoardNode>();
    nodes.forEach((n) => map.set(n.node_id, n));
    return map;
  }, [nodes]);

  const selectedNode = selectedNodeId !== null ? nodesById.get(selectedNodeId) ?? null : null;

  const resetEdgeAction = () => setEdgeActionFirstNodeId(null);

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
    if (mode === "edit-node") setSelectedNodeId(null);
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

  const handleBoardClick = (x: number, y: number) => {
    if (mode !== "add-node") return;

    const maxId = nodes.length > 0 ? nodes.reduce((m, n) => (n.node_id > m ? n.node_id : m), nodes[0].node_id) : 0;
    const newId = maxId + 1;

    setNodes((prev) => [
      ...prev,
      { node_id: newId, name: `Node ${newId}`, pos_x: x, pos_y: y, description: "", picture_path: null },
    ]);

    setMode("idle");
  };

  const handleNodeClick = (node: BoardNode) => {
    if (mode === "delete-node") {
      setNodes((prev) => prev.filter((n) => n.node_id !== node.node_id));
      setEdges((prev) => prev.filter((e) => e.node1 !== node.node_id && e.node2 !== node.node_id));
      setMode("idle");
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
          (e) => (e.node1 === fromId && e.node2 === toId) || (e.node1 === toId && e.node2 === fromId)
        );
        if (exists) return;

        const maxEdgeId = edges.length > 0 ? edges.reduce((m, e) => (e.edge_id > m ? e.edge_id : m), edges[0].edge_id) : 0;

        setEdges((prev) => [...prev, { edge_id: maxEdgeId + 1, node1: fromId, node2: toId }]);
      }
      return;
    }

    if (mode === "delete-edge") {
      if (edgeActionFirstNodeId === null) {
        setEdgeActionFirstNodeId(node.node_id);
      } else {
        const n1 = edgeActionFirstNodeId;
        const n2 = node.node_id;

        resetEdgeAction();
        setMode("idle");

        const edgeToDelete = edges.find(
          (e) => (e.node1 === n1 && e.node2 === n2) || (e.node1 === n2 && e.node2 === n1)
        );
        if (edgeToDelete) setEdges((prev) => prev.filter((e) => e.edge_id !== edgeToDelete.edge_id));
      }
      return;
    }
  };

  const handleNodePositionChange = (id: number, pos_x: number, pos_y: number) => {
    setNodes((prev) => prev.map((n) => (n.node_id === id ? { ...n, pos_x, pos_y } : n)));
  };

  // PATCH узла (включая picture_path) — async, чтобы инспектор мог await
  const handleSelectedNodeSave = async (
    id: number,
    patch: { name: string; description: string; picture_path?: string | null }
  ) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.node_id === id
          ? {
              ...n,
              name: patch.name,
              description: patch.description,
              ...(patch.picture_path !== undefined ? { picture_path: patch.picture_path } : {}),
            }
          : n
      )
    );
  };

  // Upload blob → {id,url}
  const handleUploadImage = (blob: Blob) => {
    // filename не критичен, но пусть будет
    return fileDataSource.uploadImage(blob, "node.png");
  };

  const handleVersionChange = (version: string) => onChangeVersion(version);

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
      onUploadImage={handleUploadImage}
    />
  );
};
