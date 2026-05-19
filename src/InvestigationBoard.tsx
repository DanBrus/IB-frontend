import React, { useState } from "react";
import type { BoardMode } from "./components/BoardToolbar";
import type {
  BoardAccessMode,
  BoardEdge,
  BoardNode,
  BoardVersion,
  CanonicalEntity,
} from "./boardTypes";
import { formatBoardVersion, parseBoardVersion } from "./boardTypes";
import type { EditableBoardDescriptionSheet } from "./boardDescription";
import type {
  CanonicalEntitiesSyncResult,
  CanonicalEntityDeleteResult,
} from "./boardDataSource";
import { CanonicalEntityManager } from "./components/CanonicalEntityManager";
import { InvestigationBoardHeader } from "./components/InvestigationBoardHeader";
import { InvestigationBoardToolbar } from "./components/InvestigationBoardToolbar";
import { InvestigationBoardWorkspace } from "./components/InvestigationBoardWorkspace";

interface InvestigationBoardProps {
  title?: string;
  nodes: BoardNode[];
  edges: BoardEdge[];
  canonicalEntities: CanonicalEntity[];
  mode: BoardMode;
  selectedNode: BoardNode | null;

  versions: BoardVersion[];
  currentVersion: number;
  currentVersionIsPublished: boolean;
  accessMode: BoardAccessMode;
  onVersionChange: (version: number) => void;
  onCreateVersion: (payload: {
    version: number;
    name: string;
    description: string;
    is_published?: boolean | null;
  }) => Promise<void>;
  onDeleteVersion: (version: number) => Promise<void>;
  onRequestEditMode: () => void;

  onPublish: () => void;
  onCurrentVersionPublishedChange: (value: boolean) => void;

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
    patch: {
      CE_id: string;
      descriptionSheets: EditableBoardDescriptionSheet[];
    }
  ) => Promise<void>;

  onCanonicalEntitiesChange: (
    entities: CanonicalEntity[]
  ) => Promise<CanonicalEntitiesSyncResult>;
  onCanonicalEntityDelete: (
    entityId: string
  ) => Promise<CanonicalEntityDeleteResult>;
  onCanonicalEntitiesManagerClose: (shouldRefreshNodes: boolean) => void | Promise<void>;
  onUploadImage: (blob: Blob) => Promise<{ id: string; url: string }>;
}

export const InvestigationBoard: React.FC<InvestigationBoardProps> = ({
  title = "Доска расследований",
  nodes,
  edges,
  canonicalEntities,
  mode,
  selectedNode,
  versions,
  currentVersion,
  currentVersionIsPublished,
  accessMode,
  onVersionChange,
  onCreateVersion,
  onDeleteVersion,
  onRequestEditMode,
  onPublish,
  onCurrentVersionPublishedChange,
  onNodeAddClick,
  onNodeDeleteClick,
  onNodeEditClick,
  onEdgeAddClick,
  onEdgeDeleteClick,
  onBoardClick,
  onNodeClick,
  onNodePositionChange,
  onSelectedNodeSave,
  onCanonicalEntitiesChange,
  onCanonicalEntityDelete,
  onCanonicalEntitiesManagerClose,
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
  const [canonicalEntitiesOpen, setCanonicalEntitiesOpen] = useState(false);
  const [canonicalEntityCreateRequestToken, setCanonicalEntityCreateRequestToken] = useState(0);

  const openNewVersionDialog = () => {
    if (accessMode !== "edit") return;
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
    if (accessMode !== "edit") return;

    const parsedVersion = parseBoardVersion(newVersion);
    const name = newVersionName.trim();
    const description = newVersionDescription.trim();

    if (parsedVersion === null || !name || !description) {
      setNewVersionError("Заполните version числом, name и description.");
      return;
    }

    setNewVersionError(null);
    setNewVersionSaving(true);
    try {
      await onCreateVersion({ version: parsedVersion, name, description, is_published: false });
      setNewVersionOpen(false);
    } catch (e: unknown) {
      setNewVersionError(e instanceof Error ? e.message : "Не удалось создать версию.");
    } finally {
      setNewVersionSaving(false);
    }
  };

  const openDeleteVersionDialog = () => {
    if (accessMode !== "edit") return;
    setDeleteVersionError(null);
    setDeleteVersionId(formatBoardVersion(currentVersion ?? versions[0]?.version ?? 0));
    setDeleteVersionOpen(true);
  };

  const closeDeleteVersionDialog = () => {
    if (deleteVersionSaving) return;
    setDeleteVersionOpen(false);
  };

  const handleDeleteVersionSubmit = async () => {
    if (accessMode !== "edit") return;

    const parsedVersion = parseBoardVersion(deleteVersionId);
    if (parsedVersion === null) {
      setDeleteVersionError("Выберите версию для удаления.");
      return;
    }

    const confirmed = window.confirm(
      `Вы уверены, что хотите удалить версию "${formatBoardVersion(parsedVersion)}"?\nДействие необратимо.`
    );
    if (!confirmed) return;

    setDeleteVersionError(null);
    setDeleteVersionSaving(true);
    try {
      await onDeleteVersion(parsedVersion);
      setDeleteVersionOpen(false);
    } catch (e: unknown) {
      setDeleteVersionError(e instanceof Error ? e.message : "Не удалось удалить версию.");
    } finally {
      setDeleteVersionSaving(false);
    }
  };

  const openCanonicalEntitiesDialog = () => {
    if (accessMode !== "edit") return;
    setCanonicalEntitiesOpen(true);
  };

  const closeCanonicalEntitiesDialog = (options?: { shouldRefreshNodes: boolean }) => {
    setCanonicalEntitiesOpen(false);
    setCanonicalEntityCreateRequestToken(0);
    void onCanonicalEntitiesManagerClose(options?.shouldRefreshNodes ?? false);
  };

  const handleQuickCreateCanonicalEntity = () => {
    if (accessMode !== "edit") return;
    setCanonicalEntitiesOpen(true);
    setCanonicalEntityCreateRequestToken((prev) => prev + 1);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <InvestigationBoardHeader
        title={title}
        versions={versions}
        currentVersion={currentVersion}
        accessMode={accessMode}
        onVersionChange={onVersionChange}
        onPublish={onPublish}
        onRequestEditMode={onRequestEditMode}
      />

      {accessMode === "edit" && (
        <InvestigationBoardToolbar
          accessMode={accessMode}
          mode={mode}
          currentVersionIsPublished={currentVersionIsPublished}
          onNodeAddClick={onNodeAddClick}
          onNodeDeleteClick={onNodeDeleteClick}
          onNodeEditClick={onNodeEditClick}
          onEdgeAddClick={onEdgeAddClick}
          onEdgeDeleteClick={onEdgeDeleteClick}
          onCurrentVersionPublishedChange={onCurrentVersionPublishedChange}
          onNewVersionClick={openNewVersionDialog}
          onDeleteVersionClick={openDeleteVersionDialog}
          onCanonicalEntitiesClick={openCanonicalEntitiesDialog}
          onCreateCanonicalEntityClick={handleQuickCreateCanonicalEntity}
          canDeleteVersion={versions.length > 0}
        />
      )}

      <InvestigationBoardWorkspace
        nodes={nodes}
        edges={edges}
        canonicalEntities={canonicalEntities}
        mode={mode}
        selectedNode={selectedNode}
        accessMode={accessMode}
        onBoardClick={onBoardClick}
        onNodeClick={onNodeClick}
        onNodePositionChange={onNodePositionChange}
        onSelectedNodeSave={onSelectedNodeSave}
      />

      {canonicalEntitiesOpen && (
        <CanonicalEntityManager
          entities={canonicalEntities}
          createRequestToken={canonicalEntityCreateRequestToken}
          onClose={closeCanonicalEntitiesDialog}
          onChange={onCanonicalEntitiesChange}
          onDelete={onCanonicalEntityDelete}
          onUploadImage={onUploadImage}
        />
      )}

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
                placeholder="1.2"
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
                {versions.map((version) => (
                  <option key={version.version} value={formatBoardVersion(version.version)}>
                    {formatBoardVersion(version.version)} — {version.name}
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
