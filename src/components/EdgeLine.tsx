import React from "react";
import type { BoardNode, BoardEdge } from "../boardTypes";
import {
  CARD_WIDTH,
  CARD_HEIGHT,
  CARD_PADDING,
  CARD_BORDER,
} from "../cardLayout";

interface EdgeLineProps {
  edge: BoardEdge;
  from: BoardNode;
  to: BoardNode;
}

export const EdgeLine: React.FC<EdgeLineProps> = ({ edge, from, to }) => {
  const x1 = from.x + CARD_WIDTH / 2;
  const y1 = from.y + CARD_BORDER + CARD_PADDING / 2;

  const x2 = to.x + CARD_WIDTH / 2;
  const y2 = to.y + CARD_BORDER + CARD_PADDING / 2;

  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="red"
      strokeWidth={2}
    />
  );
};
