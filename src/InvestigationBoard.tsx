import React, { useMemo, useRef, useState } from "react";
import { EdgeLine } from "./components/EdgeLine";
import { NodeCard } from "./components/NodeCard";
import { BoardToolbar } from "./components/BoardToolbar";
import type { BoardMode } from "./components/BoardToolbar";
import { NodeInspector } from "./components/NodeInspector";
import type { BoardNode, BoardEdge, BoardVersion } from "./boardTypes";

interface InvestigationBoardProps {
  title?: string;
  nodes: BoardNode[];
  edges: BoardEdge[];
  mode: BoardMode;
  selectedNode: BoardNode | null;

  versions: BoardVersion[];
  currentVersion: string;
  onVersionChange: (version: string) => void;

  onPublish: () => void;

  onNodeAddClick: () => void;
  onNodeDeleteClick: () => void;
  onNodeEditClick: () => void;
  onEdgeAddClick: () => void;
  onEdgeDeleteClick: () => void;

  onBoardClick: (x: number, y: number) => void;
  onNodeClick: (node: BoardNode) => void;
  onNodePositionChange?: (id: number, x: number, y: number) => void;

  onSelectedNodeSave: (
    id: number,
    patch: { name: string; description: string; picture_path?: string | null }
  ) => Promise<void>;

  onUploadImage: (blob: Blob) => Promise<{ id: string; url: string }>;
}

type DragState = {
  nodeId: number;
  offsetX: number;
  offsetY: number;
} | null;

export const InvestigationBoard: React.FC<InvestigationBoardProps> = ({
  title = "Доска расследований",
  nodes,
  edges,
  mode,
  selectedNode,
  versions,
  currentVersion,
  onVersionChange,
  onPublish,
  onNodeAddClick,
  onNodeDeleteClick,
  onNodeEditClick,
  onEdgeAddClick,
  onEdgeDeleteClick,
  onBoardClick,
  onNodeClick,
  onNodePositionChange,
  onSelectedNodeSave,
  onUploadImage,
}) => {
  const nodesById = useMemo(() => {
    const map = new Map<number, BoardNode>();
    nodes.forEach((n) => map.set(n.node_id, n));
    return map;
  }, [nodes]);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState>(null);

  const handleBoardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!boardRef.current) return;

    const rect = boardRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    onBoardClick(mouseX, mouseY);
  };

  const handleNodeMouseDown = (
    e: React.MouseEvent<HTMLDivElement>,
    node: BoardNode
  ) => {
    if (!boardRef.current) return;

    e.preventDefault();
    e.stopPropagation();

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

  const handleVersionSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onVersionChange(e.target.value);
  };

  const handlePublishClick = () => {
    const ok = window.confirm(
      "Вы действительно хотите опубликовать эту версию доски?\n" +
        "Действие необратимо: данные текущей версии будут перезаписаны."
    );
    if (ok) onPublish();
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* HEADER */}
      <div
        style={{
          padding: "10px 16px",
          backgroundColor: "#222",
          color: "white",
          fontSize: 20,
          fontWeight: "bold",
          flexShrink: 0,
          userSelect: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <span>{title}</span>
        {versions.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <span style={{ opacity: 0.8 }}>Версия:</span>
            <select
              value={currentVersion}
              onChange={handleVersionSelectChange}
              style={{
                padding: "3px 6px",
                borderRadius: 4,
                border: "1px solid #555",
                backgroundColor: "#333",
                color: "#f5f5f5",
                fontSize: 13,
              }}
            >
              {versions.map((v) => (
                <option key={v.version} value={v.version}>
                  {v.version} — {v.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handlePublishClick}
              style={{
                padding: "4px 10px",
                borderRadius: 4,
                border: "1px solid #888",
                backgroundColor: "#444",
                color: "#f5f5f5",
                fontSize: 13,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Опубликовать
            </button>
          </div>
        )}
      </div>

      {/* TOOLBAR */}
      <BoardToolbar
        mode={mode}
        onNodeAddClick={onNodeAddClick}
        onNodeDeleteClick={onNodeDeleteClick}
        onNodeEditClick={onNodeEditClick}
        onEdgeAddClick={onEdgeAddClick}
        onEdgeDeleteClick={onEdgeDeleteClick}
      />

      {/* CONTENT */}
      <div style={{ position: "relative", flexGrow: 1, display: "flex", backgroundColor: "#fdfdfd", overflow: "hidden" }}>
        <div
          ref={boardRef}
          style={{
            position: "relative",
            flexGrow: 1,
            overflow: "hidden",
            cursor: drag != null ? "grabbing" : mode === "add-node" ? "crosshair" : "default",
          }}
          onClick={handleBoardClick}
          onMouseMove={handleBoardMouseMove}
          onMouseUp={stopDragging}
          onMouseLeave={stopDragging}
        >
          {nodes.map((node) => (
            <NodeCard key={node.node_id} node={node} onMouseDown={handleNodeMouseDown} />
          ))}

          <svg width="100%" height="100%" style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
            {edges.map((edge) => {
              const from = nodesById.get(edge.node1);
              const to = nodesById.get(edge.node2);
              if (!from || !to) return null;
              return <EdgeLine key={edge.edge_id} edge={edge} from={from} to={to} />;
            })}
          </svg>
        </div>

        {mode === "edit-node" && (
          <NodeInspector node={selectedNode} onSaveNode={onSelectedNodeSave} onUploadImage={onUploadImage} />
        )}
      </div>
    </div>
  );
};
