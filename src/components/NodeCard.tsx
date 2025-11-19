import React, { useState } from "react";
import type { BoardNode } from "../boardTypes";
import "./NodeCard.css";

interface NodeCardProps {
  node: BoardNode;
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>, node: BoardNode) => void;
}

export const NodeCard: React.FC<NodeCardProps> = ({ node, onMouseDown }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    onMouseDown?.(e, node);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // чтобы двойной клик не улетел куда-то выше по дереву
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  return (
    <div
        className="node-card"
        style={{ left: node.x, top: node.y }}
        onMouseDown={handleMouseDown}
        >
        {/* ПОЛАРОИД */}
        <div
            className="node-card__polaroid"
            onDoubleClick={(e) => {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
            }}
        >
            <div className="node-card__photo" />
            <div className="node-card__title">{node.title}</div>
        </div>

        {isOpen && (
            <div className="node-card__sheet">
            {node.description}
            </div>
        )}
    </div>
  );
};
