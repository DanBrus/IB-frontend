import React, { useState } from "react";
import type { BoardMode } from "./components/BoardToolbar";
import type { BoardNode, BoardEdge, BoardVersion, BoardNodeType } from "./boardTypes";
import { InvestigationBoardHeader } from "./components/InvestigationBoardHeader";
import { InvestigationBoardToolbar } from "./components/InvestigationBoardToolbar";
import { InvestigationBoardWorkspace } from "./components/InvestigationBoardWorkspace";

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

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <InvestigationBoardHeader
        title={title}
        versions={versions}
        currentVersion={currentVersion}
        onVersionChange={onVersionChange}
        onPublish={onPublish}
      />

      <InvestigationBoardToolbar
        mode={mode}
        onNodeAddClick={onNodeAddClick}
        onNodeDeleteClick={onNodeDeleteClick}
        onNodeEditClick={onNodeEditClick}
        onEdgeAddClick={onEdgeAddClick}
        onEdgeDeleteClick={onEdgeDeleteClick}
        onNewVersionClick={openNewVersionDialog}
        onDeleteVersionClick={openDeleteVersionDialog}
        canDeleteVersion={versions.length > 0}
      />

      <InvestigationBoardWorkspace
        nodes={nodes}
        edges={edges}
        mode={mode}
        selectedNode={selectedNode}
        onBoardClick={onBoardClick}
        onNodeClick={onNodeClick}
        onNodePositionChange={onNodePositionChange}
        onSelectedNodeSave={onSelectedNodeSave}
        onUploadImage={onUploadImage}
      />

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
