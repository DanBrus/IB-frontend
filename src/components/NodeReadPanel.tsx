import React from "react";
import type { BoardNode } from "../boardTypes";
import "./NodeCard.css";

interface NodeReadPanelProps {
  node: BoardNode | null;
  onClose: () => void;
}

export const NodeReadPanel: React.FC<NodeReadPanelProps> = ({ node, onClose }) => {
  return (
    <aside
      style={{
        width: 360,
        borderLeft: "1px solid #ddd",
        backgroundColor: "#fafafa",
        padding: "10px 14px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, wordBreak: "break-word" }}>
            {node ? node.name : "Описание узла"}
          </div>
          {node && <div style={{ marginTop: 2, fontSize: 12, opacity: 0.6 }}>{node.node_type}</div>}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            flexShrink: 0,
            width: 28,
            height: 28,
            borderRadius: 4,
            border: "1px solid #bbb",
            backgroundColor: "#fff",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: "24px",
          }}
          aria-label="Закрыть описание"
          title="Закрыть"
        >
          x
        </button>
      </div>

      <div
        className="notebook-sheet"
        style={{
          flexGrow: 1,
          minHeight: 0,
          overflowY: "auto",
          paddingTop: 16,
          paddingBottom: 16,
          fontSize: 13,
        }}
      >
        {node?.description?.trim() ? node.description : "Описание отсутствует."}
      </div>
    </aside>
  );
};
