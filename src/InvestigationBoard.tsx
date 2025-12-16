import React, { useMemo, useRef, useState } from "react";
import { EdgeLine } from "./components/EdgeLine";
import { NodeCard } from "./components/NodeCard";
import { BoardToolbar } from "./components/BoardToolbar";
import type { BoardMode } from "./components/BoardToolbar";
import { NodeInspector } from "./components/NodeInspector";
import type { BoardNode, BoardEdge, BoardVersion, BoardNodeType } from "./boardTypes";

interface InvestigationBoardProps {
  title?: string;
  nodes: BoardNode[];
  edges: BoardEdge[];
  mode: BoardMode;
  selectedNode: BoardNode | null;

  versions: BoardVersion[];
  currentVersion: string;
  onVersionChange: (version: string) => void;
  onCreateVersion: (payload: { version: string; name: string; description: string }) => Promise<void>;
  onDeleteVersion: (version: string) => Promise<void>;

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
    patch: { name: string; description: string; node_type: BoardNodeType; picture_path?: string | null }
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
  onCreateVersion,
  onDeleteVersion,
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
  const [newVersionOpen, setNewVersionOpen] = useState(false);
  const [newVersion, setNewVersion] = useState("");
  const [newVersionName, setNewVersionName] = useState("");
  const [newVersionDescription, setNewVersionDescription] = useState("");
  const [newVersionError, setNewVersionError] = useState<string | null>(null);
  const [newVersionSaving, setNewVersionSaving] = useState(false);
  const [deleteVersionOpen, setDeleteVersionOpen] = useState(false);
  const [deleteVersionId, setDeleteVersionId] = useState<string>("");
  const [deleteVersionError, setDeleteVersionError] = useState<string | null>(null);
  const [deleteVersionSaving, setDeleteVersionSaving] = useState(false);

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

  const openNewVersionDialog = () => {
    setNewVersionOpen(true);
    setNewVersion("");
    setNewVersionName("");
    setNewVersionDescription("");
    setNewVersionError(null);
  };

  const closeNewVersionDialog = () => {
    if (newVersionSaving) return;
    setNewVersionOpen(false);
  };

  const handleCreateVersionSubmit = async () => {
    const version = newVersion.trim();
    const name = newVersionName.trim();
    const description = newVersionDescription.trim();

    if (!version || !name || !description) {
      setNewVersionError("Все поля обязательны.");
      return;
    }
    if (/\s/.test(version)) {
      setNewVersionError("Поле version не должно содержать пробелов.");
      return;
    }

    setNewVersionError(null);
    setNewVersionSaving(true);
    try {
      await onCreateVersion({ version, name, description });
      setNewVersionOpen(false);
    } catch (e: any) {
      setNewVersionError(e?.message ? String(e.message) : "Не удалось создать версию.");
    } finally {
      setNewVersionSaving(false);
    }
  };

  const openDeleteVersionDialog = () => {
    setDeleteVersionError(null);
    setDeleteVersionId(currentVersion || versions[0]?.version || "");
    setDeleteVersionOpen(true);
  };

  const closeDeleteVersionDialog = () => {
    if (deleteVersionSaving) return;
    setDeleteVersionOpen(false);
  };

  const handleDeleteVersionSubmit = async () => {
    const version = deleteVersionId.trim();
    if (!version) {
      setDeleteVersionError("Выберите версию для удаления.");
      return;
    }
    const confirm = window.confirm(
      `Вы уверены, что хотите удалить версию "${version}"?\nДействие необратимо.`
    );
    if (!confirm) return;

    setDeleteVersionError(null);
    setDeleteVersionSaving(true);
    try {
      await onDeleteVersion(version);
      setDeleteVersionOpen(false);
    } catch (e: any) {
      setDeleteVersionError(e?.message ? String(e.message) : "Не удалось удалить версию.");
    } finally {
      setDeleteVersionSaving(false);
    }
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
              onClick={openNewVersionDialog}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: "1px solid #888",
                backgroundColor: "#444",
                color: "#f5f5f5",
                fontSize: 18,
                lineHeight: "22px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label="Создать новую версию"
              title="Создать новую версию"
            >
              +
            </button>
            <button
              type="button"
              onClick={openDeleteVersionDialog}
              disabled={versions.length === 0}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: "1px solid #888",
                backgroundColor: versions.length === 0 ? "#666" : "#444",
                color: "#f5f5f5",
                fontSize: 16,
                lineHeight: "22px",
                cursor: versions.length === 0 ? "default" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label="Удалить версию"
              title="Удалить версию"
            >
              ×
            </button>
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

          <svg
            width="100%"
            height="100%"
            style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", zIndex: 5 }}
          >
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

      {newVersionOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={closeNewVersionDialog}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 380,
              background: "#fff",
              borderRadius: 10,
              boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16 }}>Новая версия</div>

            {newVersionError && (
              <div style={{ fontSize: 12, color: "#b00020", whiteSpace: "pre-wrap" }}>{newVersionError}</div>
            )}

            <label style={{ fontSize: 12, fontWeight: 600 }}>
              version
              <input
                type="text"
                value={newVersion}
                disabled={newVersionSaving}
                onChange={(e) => setNewVersion(e.target.value)}
                style={{
                  width: "100%",
                  marginTop: 4,
                  padding: "6px 8px",
                  fontSize: 13,
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  boxSizing: "border-box",
                }}
              />
            </label>

            <label style={{ fontSize: 12, fontWeight: 600 }}>
              name
              <input
                type="text"
                value={newVersionName}
                disabled={newVersionSaving}
                onChange={(e) => setNewVersionName(e.target.value)}
                style={{
                  width: "100%",
                  marginTop: 4,
                  padding: "6px 8px",
                  fontSize: 13,
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  boxSizing: "border-box",
                }}
              />
            </label>

            <label style={{ fontSize: 12, fontWeight: 600 }}>
              description
              <textarea
                value={newVersionDescription}
                disabled={newVersionSaving}
                onChange={(e) => setNewVersionDescription(e.target.value)}
                rows={3}
                style={{
                  width: "100%",
                  marginTop: 4,
                  padding: "6px 8px",
                  fontSize: 13,
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  boxSizing: "border-box",
                  resize: "vertical",
                }}
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
              <button
                type="button"
                onClick={closeNewVersionDialog}
                disabled={newVersionSaving}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #bbb",
                  backgroundColor: "#f2f2f2",
                  cursor: newVersionSaving ? "default" : "pointer",
                  fontSize: 13,
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleCreateVersionSubmit}
                disabled={newVersionSaving}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid #444",
                  backgroundColor: newVersionSaving ? "#ddd" : "#333",
                  color: newVersionSaving ? "#777" : "#f5f5f5",
                  cursor: newVersionSaving ? "default" : "pointer",
                  fontSize: 13,
                }}
              >
                {newVersionSaving ? "Создаем…" : "Создать"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteVersionOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={closeDeleteVersionDialog}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 360,
              background: "#fff",
              borderRadius: 10,
              boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16 }}>Удаление версии</div>

            {deleteVersionError && (
              <div style={{ fontSize: 12, color: "#b00020", whiteSpace: "pre-wrap" }}>{deleteVersionError}</div>
            )}

            <label style={{ fontSize: 12, fontWeight: 600 }}>
              Выберите версию
              <select
                value={deleteVersionId}
                disabled={deleteVersionSaving}
                onChange={(e) => setDeleteVersionId(e.target.value)}
                style={{
                  width: "100%",
                  marginTop: 4,
                  padding: "6px 8px",
                  fontSize: 13,
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  boxSizing: "border-box",
                  backgroundColor: deleteVersionSaving ? "#f2f2f2" : "#fff",
                }}
              >
                <option value="" disabled>
                  Выберите версию
                </option>
                {versions.map((v) => (
                  <option key={v.version} value={v.version}>
                    {v.version} — {v.name}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
              <button
                type="button"
                onClick={closeDeleteVersionDialog}
                disabled={deleteVersionSaving}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #bbb",
                  backgroundColor: "#f2f2f2",
                  cursor: deleteVersionSaving ? "default" : "pointer",
                  fontSize: 13,
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleDeleteVersionSubmit}
                disabled={deleteVersionSaving || versions.length === 0}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid #b00020",
                  backgroundColor: deleteVersionSaving ? "#f2c9c9" : "#d32f2f",
                  color: "#fff",
                  cursor: deleteVersionSaving || versions.length === 0 ? "default" : "pointer",
                  fontSize: 13,
                }}
              >
                {deleteVersionSaving ? "Удаляем…" : "Удалить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
