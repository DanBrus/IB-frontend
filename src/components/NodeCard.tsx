import React, { useEffect, useMemo, useState } from "react";
import type { BoardNode } from "../boardTypes";
import { getNodeCardLayout } from "../cardLayout";
import { FILE_RES_BASE_URL } from "../fileDataSource";
import "./NodeCard.css";

interface NodeCardProps {
  node: BoardNode;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>, node: BoardNode) => void;
  onDoubleClick?: (node: BoardNode) => void;
  showInlineDescription?: boolean;
}

export const NodeCard: React.FC<NodeCardProps> = ({
  node,
  onPointerDown,
  onDoubleClick,
  showInlineDescription = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const layout = getNodeCardLayout(node.node_type);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    onPointerDown?.(e, node);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onDoubleClick?.(node);
    if (showInlineDescription) {
      setIsOpen((prev) => !prev);
    }
  };

  const imgSrc = useMemo(() => {
    if (!layout.hasImage) return null;
    const id = node.picture_path;
    if (!id) return null;
    return `${FILE_RES_BASE_URL}/res/${id}`;
  }, [layout.hasImage, node.picture_path]);

  useEffect(() => {
    setImgFailed(false);
  }, [node.picture_path]);

  useEffect(() => {
    if (!layout.hasImage && node.picture_path) {
      console.warn("[NodeCard] Картинка игнорируется для note-ноды", {
        node_id: node.node_id,
        picture_path: node.picture_path,
      });
    }
  }, [layout.hasImage, node.node_id, node.picture_path]);

  const showImage = !!imgSrc && !imgFailed;
  const cardStyle = {
    left: node.pos_x,
    top: node.pos_y,
    "--node-card-width": `${layout.cardWidth}px`,
    "--node-photo-height": `${layout.photoHeight}px`,
  } as React.CSSProperties;

  return (
    <div
      className={`node-card ${layout.className}`}
      style={cardStyle}
      data-node-type={node.node_type}
      onPointerDown={handlePointerDown}
    >
      {/* ПОЛАРОИД */}
      <div className="node-card__polaroid" onDoubleClick={handleDoubleClick}>
        {layout.hasImage && (
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
        )}

        <div className="node-card__title">{node.name}</div>
      </div>

      {showInlineDescription && isOpen && <div className="node-card__sheet notebook-sheet">{node.description}</div>}
    </div>
  );
};
