import React, { useMemo, useRef, useState } from "react";
import type { BoardMode } from "./BoardToolbar";
import type { BoardNode, BoardEdge, BoardNodeType, BoardAccessMode } from "../boardTypes";
import { NodeCard } from "./NodeCard";
import { EdgeLine } from "./EdgeLine";
import { NodeInspector } from "./NodeInspector";
import { NodeReadPanel } from "./NodeReadPanel";

type DragState = {
  nodeId: number;
  offsetX: number;
  offsetY: number;
} | null;

interface InvestigationBoardWorkspaceProps {
  nodes: BoardNode[];
  edges: BoardEdge[];
  mode: BoardMode;
  selectedNode: BoardNode | null;
  accessMode: BoardAccessMode;
  onBoardClick: (x: number, y: number) => void;
  onNodeClick: (node: BoardNode) => void;
  onNodePositionChange?: (id: number, x: number, y: number) => void;
  onSelectedNodeSave: (
    id: number,
    patch: { name: string; description: string; node_type: BoardNodeType; picture_path?: string | null }
  ) => Promise<void>;
  onUploadImage: (blob: Blob) => Promise<{ id: string; url: string }>;
}

export const InvestigationBoardWorkspace: React.FC<InvestigationBoardWorkspaceProps> = ({
  nodes,
  edges,
  mode,
  selectedNode,
  accessMode,
  onBoardClick,
  onNodeClick,
  onNodePositionChange,
  onSelectedNodeSave,
  onUploadImage,
}) => {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState>(null);
  const [readPanelNodeId, setReadPanelNodeId] = useState<number | null>(null);

  const nodesById = useMemo(() => {
    const map = new Map<number, BoardNode>();
    nodes.forEach((n) => map.set(n.node_id, n));
    return map;
  }, [nodes]);

  const readPanelNode =
    accessMode === "read" && readPanelNodeId !== null ? nodesById.get(readPanelNodeId) ?? null : null;

  const handleBoardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!boardRef.current) return;
    if (accessMode === "read") return;

    const rect = boardRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    onBoardClick(mouseX, mouseY);
  };

  const handleNodeMouseDown = (e: React.MouseEvent<HTMLDivElement>, node: BoardNode) => {
    if (!boardRef.current) return;

    e.preventDefault();
    e.stopPropagation();

    if (accessMode === "read") {
      const rect = boardRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setDrag({
        nodeId: node.node_id,
        offsetX: mouseX - node.pos_x,
        offsetY: mouseY - node.pos_y,
      });
      return;
    }

    if (mode !== "idle") {
      onNodeClick(node);
      return;
    }

    const rect = boardRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setDrag({
      nodeId: node.node_id,
      offsetX: mouseX - node.pos_x,
      offsetY: mouseY - node.pos_y,
    });
  };

  const handleBoardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drag || !boardRef.current || !onNodePositionChange) return;

    const rect = boardRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    onNodePositionChange(drag.nodeId, mouseX - drag.offsetX, mouseY - drag.offsetY);
  };

  const stopDragging = () => {
    if (drag) setDrag(null);
  };

  const handleNodeDoubleClick = (node: BoardNode) => {
    if (accessMode !== "read") return;
    setReadPanelNodeId(node.node_id);
  };

  const handleReadPanelClose = () => {
    setReadPanelNodeId(null);
  };

  return (
    <div
      data-access-mode={accessMode}
      style={{ position: "relative", flexGrow: 1, display: "flex", backgroundColor: "#fdfdfd", overflow: "hidden" }}
    >
      <div
        ref={boardRef}
        style={{
          position: "relative",
          flexGrow: 1,
          overflow: "hidden",
          cursor: drag != null ? "grabbing" : accessMode === "edit" && mode === "add-node" ? "crosshair" : "default",
        }}
        onClick={handleBoardClick}
        onMouseMove={handleBoardMouseMove}
        onMouseUp={stopDragging}
        onMouseLeave={stopDragging}
      >
        {nodes.map((node) => (
          <NodeCard
            key={node.node_id}
            node={node}
            onMouseDown={handleNodeMouseDown}
            onDoubleClick={handleNodeDoubleClick}
            showInlineDescription={accessMode === "edit"}
          />
        ))}

        <svg
          width="100%"
          height="100%"
          style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", zIndex: 5 }}
        >
          {edges.map((edge) => {
            const from = nodesById.get(edge.node1);
            const to = nodesById.get(edge.node2);
            if (!from || !to) return null;
            return <EdgeLine key={edge.edge_id} edge={edge} from={from} to={to} />;
          })}
        </svg>
      </div>

      {accessMode === "edit" && mode === "edit-node" && (
        <NodeInspector node={selectedNode} onSaveNode={onSelectedNodeSave} onUploadImage={onUploadImage} />
      )}

      {accessMode === "read" && readPanelNodeId !== null && (
        <NodeReadPanel node={readPanelNode} onClose={handleReadPanelClose} />
      )}
    </div>
  );
};
