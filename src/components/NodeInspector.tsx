import React, { useEffect, useState } from "react";
import type { BoardNode } from "../boardTypes";

interface NodeInspectorProps {
  node: BoardNode | null;
  onSave: (id: number, patch: { name: string; description: string }) => void;
}

export const NodeInspector: React.FC<NodeInspectorProps> = ({ node, onSave }) => {
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  // обновляем локальное состояние при смене выбранного узла
  useEffect(() => {
    if (node) {
      setName(node.name ?? "");
      setDescription(node.description ?? "");
    } else {
      setName("");
      setDescription("");
    }
  }, [node]);

  const handleSaveClick = () => {
    if (!node) return;
    onSave(node.node_id, { name, description });
  };

  const disabled = !node;

  const maxNameLength = 64;
  const remaining = maxNameLength - name.length;

  return (
    <div
      style={{
        width: 320,
        borderLeft: "1px solid #ddd",
        backgroundColor: "#fafafa",
        padding: "10px 14px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          fontWeight: 600,
          fontSize: 14,
          marginBottom: 4,
        }}
      >
        Инспектор узла
      </div>

      {!node && (
        <div style={{ fontSize: 13, opacity: 0.6 }}>
          Нажмите «Редактировать» и выберите узел на доске.
        </div>
      )}

      {/* Имя */}
      <label
        style={{
          fontSize: 12,
          fontWeight: 500,
          opacity: disabled ? 0.5 : 0.9,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        Имя узла
        <input
          type="text"
          value={name}
          maxLength={maxNameLength}
          disabled={disabled}
          onChange={(e) => setName(e.target.value)}
          style={{
            padding: "4px 6px",
            fontSize: 13,
            borderRadius: 4,
            border: "1px solid #ccc",
            outline: "none",
            opacity: disabled ? 0.6 : 1,
          }}
        />
        <span style={{ fontSize: 10, opacity: 0.5 }}>
          Осталось символов: {remaining}
        </span>
      </label>

      {/* Описание */}
      <label
        style={{
          fontSize: 12,
          fontWeight: 500,
          opacity: disabled ? 0.5 : 0.9,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          flexGrow: 1,
        }}
      >
        Описание
        <textarea
          value={description}
          disabled={disabled}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          style={{
            padding: "4px 6px",
            fontSize: 13,
            borderRadius: 4,
            border: "1px solid #ccc",
            outline: "none",
            resize: "vertical",
            minHeight: 80,
            opacity: disabled ? 0.6 : 1,
          }}
        />
      </label>

      {/* Кнопка сохранить */}
      <button
        type="button"
        onClick={handleSaveClick}
        disabled={disabled}
        style={{
          marginTop: 4,
          alignSelf: "flex-start",
          padding: "4px 10px",
          fontSize: 13,
          borderRadius: 4,
          border: "1px solid #555",
          backgroundColor: disabled ? "#ddd" : "#333",
          color: disabled ? "#777" : "#f5f5f5",
          cursor: disabled ? "default" : "pointer",
        }}
      >
        Сохранить
      </button>
    </div>
  );
};
