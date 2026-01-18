import React from "react";

const baseButtonStyle: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 4,
  border: "1px solid #555",
  backgroundColor: "#333",
  color: "#f5f5f5",
  cursor: "pointer",
  fontSize: 13,
};

const activeButtonStyle: React.CSSProperties = {
  ...baseButtonStyle,
  backgroundColor: "#555",
  borderColor: "#aaa",
};

export type BoardMode =
  | "idle"
  | "add-node"
  | "delete-node"
  | "edit-node"
  | "add-edge"
  | "delete-edge";

interface BoardToolbarProps {
  mode: BoardMode;
  onNodeAddClick: () => void;
  onNodeDeleteClick: () => void;
  onNodeEditClick: () => void;
  onEdgeAddClick: () => void;
  onEdgeDeleteClick: () => void;
  onNewVersionClick: () => void;
  onDeleteVersionClick: () => void;
  canDeleteVersion: boolean;
}

export const BoardToolbar: React.FC<BoardToolbarProps> = ({
  mode,
  onNodeAddClick,
  onNodeDeleteClick,
  onNodeEditClick,
  onEdgeAddClick,
  onEdgeDeleteClick,
  onNewVersionClick,
  onDeleteVersionClick,
  canDeleteVersion,
}) => {
  const nodeAddActive = mode === "add-node";
  const nodeDeleteActive = mode === "delete-node";
  const nodeEditActive = mode === "edit-node";
  const edgeAddActive = mode === "add-edge";
  const edgeDeleteActive = mode === "delete-edge";

  const versionButtonStyle: React.CSSProperties = { ...baseButtonStyle, whiteSpace: "nowrap" };
  const disabledVersionButtonStyle: React.CSSProperties = {
    ...versionButtonStyle,
    backgroundColor: "#555",
    borderColor: "#777",
    color: "#bbb",
    cursor: "default",
  };

  return (
    <div
      style={{
        display: "flex",
        flexShrink: 0,
        padding: "8px 16px",
        backgroundColor: "#2a2a2a",
        borderBottom: "1px solid #444",
        color: "#f5f5f5",
        fontSize: 14,
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 16,
        userSelect: "none",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ opacity: 0.7 }}>Узлы:</span>
          <button
            type="button"
            style={nodeAddActive ? activeButtonStyle : baseButtonStyle}
            onClick={onNodeAddClick}
          >
            Добавить
          </button>
          <button
            type="button"
            style={nodeEditActive ? activeButtonStyle : baseButtonStyle}
            onClick={onNodeEditClick}
          >
            Редактировать
          </button>
          <button
            type="button"
            style={nodeDeleteActive ? activeButtonStyle : baseButtonStyle}
            onClick={onNodeDeleteClick}
          >
            Удалить
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ opacity: 0.7 }}>Связи:</span>
          <button
            type="button"
            style={edgeAddActive ? activeButtonStyle : baseButtonStyle}
            onClick={onEdgeAddClick}
          >
            Добавить
          </button>
          <button type="button" style={baseButtonStyle} disabled>
            Редактировать
          </button>
          <button
            type="button"
            style={edgeDeleteActive ? activeButtonStyle : baseButtonStyle}
            onClick={onEdgeDeleteClick}
          >
            Удалить
          </button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
        <button
          type="button"
          style={versionButtonStyle}
          onClick={onNewVersionClick}
        >
          New version
        </button>
        <button
          type="button"
          style={canDeleteVersion ? versionButtonStyle : disabledVersionButtonStyle}
          disabled={!canDeleteVersion}
          onClick={onDeleteVersionClick}
        >
          Delete version
        </button>
      </div>
    </div>
  );
};
