import React from "react";
import type { BoardNode, BoardEdge } from "../boardTypes";
import { getNodeAnchor } from "../cardLayout";

interface EdgeLineProps {
  edge: BoardEdge;
  from: BoardNode;
  to: BoardNode;
}

export const EdgeLine: React.FC<EdgeLineProps> = ({ edge, from, to }) => {
  const fromAnchor = getNodeAnchor(from);
  const toAnchor = getNodeAnchor(to);

  return (
    <line
      data-edge-id={edge.edge_id}
      x1={fromAnchor.x}
      y1={fromAnchor.y}
      x2={toAnchor.x}
      y2={toAnchor.y}
      stroke="red"
      strokeWidth={2}
    />
  );
};
