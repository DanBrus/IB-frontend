import React, { useMemo, useRef, useState } from "react";
import { EdgeLine } from "./components/EdgeLine";
import { NodeCard } from "./components/NodeCard";
import type { BoardNode, BoardEdge } from "./boardTypes";

interface InvestigationBoardProps {
  nodes: BoardNode[];
  edges: BoardEdge[];
  title?: string;
  onNodePositionChange?: (id: string, x: number, y: number) => void;
}

type DragState = {
  nodeId: string;
  offsetX: number;
  offsetY: number;
} | null;

export const InvestigationBoard: React.FC<InvestigationBoardProps> = ({
  nodes,
  edges,
  title = "Доска расследований",
  onNodePositionChange,
}) => {
  const nodesById = useMemo(() => {
    const map = new Map<string, BoardNode>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState>(null);

  // старт перетаскивания
  const handleNodeMouseDown = (
    e: React.MouseEvent<HTMLDivElement>,
    node: BoardNode
  ) => {
    if (!boardRef.current) return;

    const rect = boardRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setDrag({
      nodeId: node.id,
      offsetX: mouseX - node.x,
      offsetY: mouseY - node.y,
    });

    e.preventDefault(); // чтобы не выделялся текст
  };

  // перетаскивание
  const handleBoardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drag || !boardRef.current || !onNodePositionChange) return;

    const rect = boardRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newX = mouseX - drag.offsetX;
    const newY = mouseY - drag.offsetY;

    onNodePositionChange(drag.nodeId, newX, newY);
  };

  // завершение перетаскивания
  const stopDragging = () => {
    if (drag) {
      setDrag(null);
    }
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
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
        }}
      >
        {title}
      </div>

      {/* BOARD AREA */}
            <div
        ref={boardRef}
        style={{
          position: "relative",
          flexGrow: 1,
          backgroundColor: "#fdfdfd",
          overflow: "hidden",
          cursor: drag ? "grabbing" : "default",
        }}
        onMouseMove={handleBoardMouseMove}
        onMouseUp={stopDragging}
        onMouseLeave={stopDragging}
      >
        {/* Ноды */}
        {nodes.map((node) => (
          <NodeCard
            key={node.id}
            node={node}
            onMouseDown={handleNodeMouseDown}
          />
        ))}

        {/* Линии поверх карточек */}
        <svg
          width="100%"
          height="100%"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            pointerEvents: "none",
          }}
        >
          {edges.map((edge) => {
            const from = nodesById.get(edge.from);
            const to = nodesById.get(edge.to);
            if (!from || !to) return null;

            return (
              <EdgeLine
                key={edge.id}
                edge={edge}
                from={from}
                to={to}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
};
