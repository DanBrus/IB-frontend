import React, { useEffect, useMemo, useState } from "react";
import type { BoardNode } from "../boardTypes";
import { FILE_RES_BASE_URL } from "../fileDataSource";
import "./NodeCard.css";

interface NodeCardProps {
  node: BoardNode;
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>, node: BoardNode) => void;
}

export const NodeCard: React.FC<NodeCardProps> = ({ node, onMouseDown }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    onMouseDown?.(e, node);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  const imgSrc = useMemo(() => {
    const id = node.picture_path;
    if (!id) return null;
    return `${FILE_RES_BASE_URL}/res/${id}`;
  }, [node.picture_path]);

  useEffect(() => {
    setImgFailed(false);
  }, [node.picture_path]);

  const showImage = !!imgSrc && !imgFailed;

  return (
    <div
      className="node-card"
      style={{ left: node.pos_x, top: node.pos_y }}
      onMouseDown={handleMouseDown}
    >
      {/* ПОЛАРОИД */}
      <div className="node-card__polaroid" onDoubleClick={handleDoubleClick}>
        <div className="node-card__photo">
          {showImage ? (
            <img
              key={imgSrc}
              src={imgSrc}
              alt=""
              draggable={false}
              onError={() => setImgFailed(true)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center",
                display: "block",
              }}
            />
          ) : null}
        </div>

        <div className="node-card__title">{node.name}</div>
      </div>

      {isOpen && <div className="node-card__sheet">{node.description}</div>}
    </div>
  );
};
