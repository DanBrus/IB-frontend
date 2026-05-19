import React, { useEffect, useMemo, useState } from "react";
import type { BoardNode, CanonicalEntity } from "../boardTypes";
import type {
  BoardDescriptionSheet,
  EditableBoardDescriptionSheet,
} from "../boardDescription";
import {
  createEmptyDescriptionSheet,
  getSheetSourceLabel,
  toEditableDescriptionSheets,
  truncateSheetSourceLabel,
} from "../boardDescription";
import {
  getCanonicalEntityMergeTarget,
  getCanonicalEntityPicturePath,
  isCanonicalEntityMerged,
} from "../canonicalEntities";
import { FILE_RES_BASE_URL } from "../fileDataSource";
import "./NodeCard.css";
import {
  clampInspectorPanelWidth,
  DESKTOP_INSPECTOR_PANEL_DEFAULT_WIDTH,
} from "./panelSizing";

type DesktopResizeState = {
  pointerId: number;
  startX: number;
  startWidth: number;
} | null;

type SheetEditorState = {
  draft: EditableBoardDescriptionSheet;
  isNew: boolean;
} | null;

interface NodeInspectorProps {
  node: BoardNode | null;
  canonicalEntities: CanonicalEntity[];
  descriptionSheets: BoardDescriptionSheet[];
  connectedNodes: BoardNode[];
  onSaveNode: (
    id: number,
    patch: {
      ce_id: string;
      descriptionSheets: EditableBoardDescriptionSheet[];
    }
  ) => Promise<void>;
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function cloneEditableSheet(sheet: EditableBoardDescriptionSheet): EditableBoardDescriptionSheet {
  return {
    ...sheet,
    relatedNodeIds: [...sheet.relatedNodeIds],
    c_ids: [...sheet.c_ids],
  };
}

function formatCanonicalEntityOptionLabel(entity: CanonicalEntity): string {
  const mergedTarget = getCanonicalEntityMergeTarget(entity);
  const baseLabel = `${entity.name} (${entity.entity_type})`;
  return mergedTarget ? `${baseLabel} [MERGED -> ${mergedTarget}]` : baseLabel;
}

export const NodeInspector: React.FC<NodeInspectorProps> = ({
  node,
  canonicalEntities,
  descriptionSheets,
  connectedNodes,
  onSaveNode,
}) => {
  const [selectedCanonicalEntityId, setSelectedCanonicalEntityId] = useState("");
  const [canonicalEntityFilter, setCanonicalEntityFilter] = useState("");
  const [sheets, setSheets] = useState<EditableBoardDescriptionSheet[]>([]);
  const [sheetEditor, setSheetEditor] = useState<SheetEditorState>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [desktopWidth, setDesktopWidth] = useState(() =>
    clampInspectorPanelWidth(DESKTOP_INSPECTOR_PANEL_DEFAULT_WIDTH)
  );
  const [desktopResizeState, setDesktopResizeState] =
    useState<DesktopResizeState>(null);

  const connectedNodesById = useMemo(() => {
    const map = new Map<number, BoardNode>();
    connectedNodes.forEach((connectedNode) =>
      map.set(connectedNode.node_id, connectedNode)
    );
    return map;
  }, [connectedNodes]);

  const selectedCanonicalEntity = useMemo(
    () =>
      canonicalEntities.find(
        (entity) => entity.en_id === selectedCanonicalEntityId
      ) ?? null,
    [canonicalEntities, selectedCanonicalEntityId]
  );

  const selectedCanonicalEntityImageUrl = useMemo(() => {
    if (!selectedCanonicalEntity) return null;

    const picturePath = getCanonicalEntityPicturePath(selectedCanonicalEntity);
    return picturePath ? `${FILE_RES_BASE_URL}/res/${picturePath}` : null;
  }, [selectedCanonicalEntity]);

  const selectedCanonicalEntityMergeTarget = useMemo(
    () =>
      selectedCanonicalEntity
        ? getCanonicalEntityMergeTarget(selectedCanonicalEntity)
        : null,
    [selectedCanonicalEntity]
  );
  const selectedCanonicalEntityTextColor =
    selectedCanonicalEntity && isCanonicalEntityMerged(selectedCanonicalEntity)
      ? "#777"
      : "#222";

  const filteredCanonicalEntities = useMemo(() => {
    const normalizedFilter = normalizeSearchValue(canonicalEntityFilter);
    if (!normalizedFilter) return canonicalEntities;

    const filteredEntities = canonicalEntities.filter((entity) => {
      const haystack = [
        entity.name,
        entity.en_id,
        entity.entity_type,
        getCanonicalEntityMergeTarget(entity) ?? "",
      ]
        .map((value) => normalizeSearchValue(value))
        .join(" ");

      return haystack.includes(normalizedFilter);
    });

    if (
      selectedCanonicalEntity &&
      !filteredEntities.some((entity) => entity.en_id === selectedCanonicalEntity.en_id)
    ) {
      return [selectedCanonicalEntity, ...filteredEntities];
    }

    return filteredEntities;
  }, [canonicalEntities, canonicalEntityFilter, selectedCanonicalEntity]);

  useEffect(() => {
    if (node) {
      setSelectedCanonicalEntityId(node.ce_id ?? "");
      setCanonicalEntityFilter("");
      setSheets(toEditableDescriptionSheets(descriptionSheets));
    } else {
      setSelectedCanonicalEntityId("");
      setCanonicalEntityFilter("");
      setSheets([]);
    }

    setSheetEditor(null);
    setSaving(false);
    setError(null);
  }, [descriptionSheets, node]);

  useEffect(() => {
    const handleWindowResize = () => {
      setDesktopWidth((prevWidth) => clampInspectorPanelWidth(prevWidth));
    };

    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  useEffect(() => {
    if (!desktopResizeState) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== desktopResizeState.pointerId) return;

      event.preventDefault();

      const nextWidth =
        desktopResizeState.startWidth -
        (event.clientX - desktopResizeState.startX);
      setDesktopWidth(clampInspectorPanelWidth(nextWidth));
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerId !== desktopResizeState.pointerId) return;
      setDesktopResizeState(null);
    };

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [desktopResizeState]);

  const disabled = !node || saving;
  const currentEntityMissing =
    Boolean(selectedCanonicalEntityId) && selectedCanonicalEntity === null;

  const handleDesktopResizePointerDown = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!event.isPrimary || event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    setDesktopResizeState({
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: desktopWidth,
    });
  };

  const openSheetEditor = (
    sheet: EditableBoardDescriptionSheet,
    isNew: boolean
  ) => {
    if (disabled) return;

    setSheetEditor({
      draft: cloneEditableSheet(sheet),
      isNew,
    });
  };

  const handleAddSheet = () => {
    if (disabled) return;
    openSheetEditor(createEmptyDescriptionSheet(sheets), true);
  };

  const handleOpenExistingSheet = (sheetId: string) => {
    const sheet = sheets.find((item) => item.id === sheetId);
    if (!sheet) return;
    openSheetEditor(sheet, false);
  };

  const handleSheetCardKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    sheetId: string
  ) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    handleOpenExistingSheet(sheetId);
  };

  const handleCloseSheetEditor = () => {
    if (saving) return;
    setSheetEditor(null);
  };

  const handleEditorDraftChange = (
    patch: Partial<EditableBoardDescriptionSheet>
  ) => {
    setSheetEditor((currentEditor) =>
      currentEditor
        ? {
            ...currentEditor,
            draft: {
              ...currentEditor.draft,
              ...patch,
            },
          }
        : currentEditor
    );
  };

  const handleEditorRelatedNodeToggle = (relatedNodeId: number) => {
    setSheetEditor((currentEditor) => {
      if (!currentEditor) return currentEditor;

      const relatedNodeIds = new Set(currentEditor.draft.relatedNodeIds);
      if (relatedNodeIds.has(relatedNodeId)) {
        relatedNodeIds.delete(relatedNodeId);
      } else {
        relatedNodeIds.add(relatedNodeId);
      }

      return {
        ...currentEditor,
        draft: {
          ...currentEditor.draft,
          relatedNodeIds: connectedNodes
            .map((connectedNode) => connectedNode.node_id)
            .filter((nodeId) => relatedNodeIds.has(nodeId)),
        },
      };
    });
  };

  const handleApplySheetEditor = () => {
    if (!sheetEditor) return;

    const normalizedSheet = {
      ...sheetEditor.draft,
      description: sheetEditor.draft.description.trim(),
      timecode: sheetEditor.draft.timecode.trim(),
      relatedNodeIds: [...sheetEditor.draft.relatedNodeIds],
      isNodeOwned: sheetEditor.draft.relatedNodeIds.length === 0,
    };

    if (!normalizedSheet.description) {
      setError("У листка должен быть непустой текст.");
      return;
    }

    setError(null);
    setSheets((prev) =>
      sheetEditor.isNew
        ? [...prev, normalizedSheet]
        : prev.map((sheet) =>
            sheet.id === normalizedSheet.id ? normalizedSheet : sheet
          )
    );
    setSheetEditor(null);
  };

  const handleDeleteSheet = () => {
    if (!sheetEditor) return;

    if (!sheetEditor.isNew) {
      setSheets((prev) =>
        prev.filter((sheet) => sheet.id !== sheetEditor.draft.id)
      );
    }
    setSheetEditor(null);
  };

  const handleSave = async () => {
    if (!node) return;
    if (sheetEditor) {
      setError("Сначала сохраните или отмените редактирование открытого листка.");
      return;
    }

    if (!selectedCanonicalEntityId) {
      setError("Ноду нельзя сохранить без привязки к canonical entity.");
      return;
    }

    if (!selectedCanonicalEntity) {
      setError("Выберите существующую canonical entity.");
      return;
    }

    setError(null);
    setSaving(true);

    try {
      await onSaveNode(node.node_id, {
        ce_id: selectedCanonicalEntity.en_id,
        descriptionSheets: sheets,
      });
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Ошибка сохранения.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "relative",
        width: desktopWidth,
        borderLeft: "1px solid #ddd",
        backgroundColor: "#fafafa",
        padding: "10px 14px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div
        onPointerDown={handleDesktopResizePointerDown}
        style={{
          position: "absolute",
          left: -4,
          top: 0,
          bottom: 0,
          width: 12,
          cursor: "col-resize",
          zIndex: 2,
        }}
        aria-hidden="true"
      >
        <div
          style={{
            position: "absolute",
            left: 5,
            top: 0,
            bottom: 0,
            width: 2,
            backgroundColor: "rgba(0, 0, 0, 0.08)",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          flexGrow: 1,
          minHeight: 0,
          overflowY: "auto",
          paddingRight: 2,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14 }}>Инспектор узла</div>
          <button
            type="button"
            onClick={handleAddSheet}
            disabled={!node || saving}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #bbb",
              backgroundColor: !node || saving ? "#f2f2f2" : "#fff",
              color: !node || saving ? "#777" : "#333",
              cursor: !node || saving ? "default" : "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Новый листок
          </button>
        </div>

        {!node && (
          <div style={{ fontSize: 13, opacity: 0.6 }}>
            Нажмите «Редактировать» и выберите узел на доске.
          </div>
        )}

        {error && (
          <div style={{ fontSize: 12, color: "#b00020", whiteSpace: "pre-wrap" }}>
            {error}
          </div>
        )}

        <label style={{ fontSize: 12, fontWeight: 600, opacity: disabled ? 0.6 : 0.9 }}>
          Фильтр CE
          <input
            type="search"
            value={canonicalEntityFilter}
            disabled={disabled || canonicalEntities.length === 0}
            onChange={(event) => setCanonicalEntityFilter(event.target.value)}
            placeholder="Поиск по имени, типу или en_id"
            style={{
              width: "100%",
              marginTop: 4,
              padding: "6px 8px",
              fontSize: 13,
              borderRadius: 6,
              border: "1px solid #ccc",
              boxSizing: "border-box",
              backgroundColor:
                disabled || canonicalEntities.length === 0 ? "#f2f2f2" : "#fff",
            }}
          />
        </label>

        <label style={{ fontSize: 12, fontWeight: 600, opacity: disabled ? 0.6 : 0.9 }}>
          Canonical entity
          <select
            value={selectedCanonicalEntityId}
            disabled={disabled || canonicalEntities.length === 0}
            onChange={(event) => setSelectedCanonicalEntityId(event.target.value)}
            style={{
              width: "100%",
              marginTop: 4,
              padding: "6px 8px",
              fontSize: 13,
              borderRadius: 6,
              border: "1px solid #ccc",
              boxSizing: "border-box",
              color:
                selectedCanonicalEntity && isCanonicalEntityMerged(selectedCanonicalEntity)
                  ? "#777"
                  : "#222",
              backgroundColor:
                disabled || canonicalEntities.length === 0 ? "#f2f2f2" : "#fff",
            }}
          >
            <option value="">Выберите canonical entity</option>
            {currentEntityMissing && (
              <option value={selectedCanonicalEntityId}>
                Текущая CE недоступна: {selectedCanonicalEntityId}
              </option>
            )}
            {filteredCanonicalEntities.map((entity) => (
              <option
                key={entity.en_id}
                value={entity.en_id}
                style={{
                  color: isCanonicalEntityMerged(entity) ? "#777" : "#222",
                }}
              >
                {formatCanonicalEntityOptionLabel(entity)}
              </option>
            ))}
          </select>
        </label>

        {canonicalEntities.length > 0 && filteredCanonicalEntities.length === 0 && (
          <div
            style={{
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              padding: "10px 12px",
              fontSize: 12,
              color: "#555",
              lineHeight: 1.45,
            }}
          >
            По текущему фильтру canonical entities не найдены.
          </div>
        )}

        {canonicalEntities.length === 0 && (
          <div
            style={{
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              padding: "10px 12px",
              fontSize: 12,
              color: "#555",
              lineHeight: 1.45,
            }}
          >
            Сначала создайте хотя бы одну canonical entity через кнопку на верхней панели.
          </div>
        )}

        {currentEntityMissing && (
          <div
            style={{
              borderRadius: 10,
              border: "1px solid #e2b5b5",
              background: "#fff7f7",
              padding: "10px 12px",
              fontSize: 12,
              color: "#7a1f1f",
              lineHeight: 1.45,
            }}
          >
            Текущая привязка к CE не найдена в списке. Выберите существующую canonical entity
            перед сохранением.
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "#fff",
            padding: "12px 12px 14px",
            color:
              selectedCanonicalEntity && isCanonicalEntityMerged(selectedCanonicalEntity)
                ? "#666"
                : "#222",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700 }}>Что подтянется в ноду из CE</div>

          {selectedCanonicalEntity ? (
            <>
              <div
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  borderRadius: 14,
                  backgroundColor: selectedCanonicalEntityImageUrl ? "#000" : "#f0f0f0",
                  overflow: "hidden",
                  position: "relative",
                  border: "1px solid #ddd",
                }}
              >
                {selectedCanonicalEntityImageUrl ? (
                  <img
                    src={selectedCanonicalEntityImageUrl}
                    alt=""
                    draggable={false}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      color: "#666",
                      textAlign: "center",
                      padding: 12,
                      boxSizing: "border-box",
                    }}
                  >
                    У выбранной CE пока нет изображения.
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 12, color: "#666" }}>Имя</div>
                <div
                  style={{
                    fontSize: 13,
                    color: selectedCanonicalEntityTextColor,
                    fontWeight: 600,
                  }}
                >
                  {selectedCanonicalEntity.name || "Без имени"}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 12, color: "#666" }}>Тип</div>
                <div style={{ fontSize: 13, color: selectedCanonicalEntityTextColor }}>
                  {selectedCanonicalEntity.entity_type}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 12, color: "#666" }}>en_id</div>
                <div style={{ fontSize: 13, color: selectedCanonicalEntityTextColor }}>
                  {selectedCanonicalEntity.en_id}
                </div>
              </div>

              {selectedCanonicalEntityMergeTarget && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontSize: 11, color: "#b24444", letterSpacing: "0.08em" }}>
                    MERGED
                  </div>
                  <div style={{ fontSize: 12, color: "#777" }}>
                    merged_to: {selectedCanonicalEntityMergeTarget}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 12, color: "#666", lineHeight: 1.45 }}>
              Выберите canonical entity, и имя, тип и картинка ноды будут взяты из неё.
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700 }}>Описание по чанкам</div>
          <div style={{ fontSize: 11, opacity: 0.65 }}>
            Двойной клик открывает отдельное окно редактирования.
          </div>
        </div>

        <div className="paper-stack">
          {node ? (
            sheets.length > 0 ? (
              sheets.map((sheet) => {
                const fullSourceLabel = getSheetSourceLabel(
                  sheet.relatedNodeIds
                    .map(
                      (relatedNodeId) =>
                        connectedNodesById.get(relatedNodeId)?.name ?? ""
                    )
                    .filter(Boolean)
                );
                const previewSourceLabel =
                  truncateSheetSourceLabel(fullSourceLabel);

                return (
                  <article key={sheet.id} className="paper-note paper-note--editable">
                    <div className="paper-note__margin" title={fullSourceLabel || undefined}>
                      <div className="paper-note__sources">
                        {previewSourceLabel ? (
                          <div className="paper-note__source">{previewSourceLabel}</div>
                        ) : (
                          <div className="paper-note__source paper-note__source--empty">
                            &nbsp;
                          </div>
                        )}
                      </div>
                    </div>
                    <div
                      className="paper-note__body"
                      role="button"
                      tabIndex={disabled ? -1 : 0}
                      onDoubleClick={() => handleOpenExistingSheet(sheet.id)}
                      onKeyDown={(event) => handleSheetCardKeyDown(event, sheet.id)}
                    >
                      <div
                        className={`paper-note__text${
                          sheet.description ? "" : " paper-note__text--empty"
                        }`}
                      >
                        {sheet.description ||
                          "Пустой листок. Дважды щёлкните, чтобы заполнить его."}
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="paper-stack__empty">
                У этой ноды пока нет ни одного листка. Добавьте новый и распределите его
                по нужным связям.
              </div>
            )
          ) : null}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!node || saving}
          style={{
            marginTop: 4,
            alignSelf: "flex-start",
            padding: "8px 14px",
            fontSize: 13,
            borderRadius: 6,
            border: "1px solid #555",
            backgroundColor: !node || saving ? "#ddd" : "#333",
            color: !node || saving ? "#777" : "#f5f5f5",
            cursor: !node || saving ? "default" : "pointer",
            fontWeight: 600,
          }}
        >
          {saving ? "Сохраняю…" : "Сохранить"}
        </button>
      </div>

      {sheetEditor && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={handleCloseSheetEditor}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(640px, calc(100vw - 40px))",
              maxHeight: "min(680px, calc(100vh - 40px))",
              overflowY: "auto",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
              padding: "18px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  {sheetEditor.isNew ? "Новый листок" : "Редактирование листка"}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.68 }}>
                  Здесь можно изменить текст чанка, его приоритет и отметить связанные
                  ноды галочками.
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseSheetEditor}
                disabled={saving}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #bbb",
                  backgroundColor: "#fff",
                  color: "#333",
                  cursor: saving ? "default" : "pointer",
                  fontSize: 13,
                }}
              >
                Закрыть
              </button>
            </div>

            <label style={{ fontSize: 12, fontWeight: 600 }}>
              Текст листка
              <textarea
                value={sheetEditor.draft.description}
                onChange={(event) =>
                  handleEditorDraftChange({ description: event.target.value })
                }
                rows={8}
                style={{
                  width: "100%",
                  marginTop: 4,
                  padding: "8px 10px",
                  fontSize: 13,
                  lineHeight: 1.5,
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  boxSizing: "border-box",
                  resize: "vertical",
                  backgroundColor: "#fff",
                }}
              />
            </label>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              <label style={{ fontSize: 12, fontWeight: 600 }}>
                Приоритет
                <input
                  type="number"
                  min={0}
                  value={sheetEditor.draft.chunk_priority}
                  onChange={(event) =>
                    handleEditorDraftChange({
                      chunk_priority: Number.isFinite(Number(event.target.value))
                        ? Number(event.target.value)
                        : 0,
                    })
                  }
                  style={{
                    width: "100%",
                    marginTop: 4,
                    padding: "6px 8px",
                    fontSize: 13,
                    borderRadius: 6,
                    border: "1px solid #ccc",
                    boxSizing: "border-box",
                    backgroundColor: "#fff",
                  }}
                />
              </label>

              <label style={{ fontSize: 12, fontWeight: 600 }}>
                Timecode
                <input
                  type="text"
                  value={sheetEditor.draft.timecode}
                  onChange={(event) =>
                    handleEditorDraftChange({ timecode: event.target.value })
                  }
                  style={{
                    width: "100%",
                    marginTop: 4,
                    padding: "6px 8px",
                    fontSize: 13,
                    borderRadius: 6,
                    border: "1px solid #ccc",
                    boxSizing: "border-box",
                    backgroundColor: "#fff",
                  }}
                />
              </label>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Связанные ноды</div>
              <div
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  background: "#fff",
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {connectedNodes.length > 0 ? (
                  connectedNodes.map((connectedNode) => (
                    <label
                      key={connectedNode.node_id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 12,
                        color: "#333",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={sheetEditor.draft.relatedNodeIds.includes(
                          connectedNode.node_id
                        )}
                        onChange={() =>
                          handleEditorRelatedNodeToggle(connectedNode.node_id)
                        }
                      />
                      <span>{connectedNode.name}</span>
                    </label>
                  ))
                ) : (
                  <div style={{ fontSize: 12, color: "#666" }}>
                    У текущей ноды пока нет связанных соседей, поэтому листок будет
                    сохранён только в текст самой ноды.
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <button
                type="button"
                onClick={handleDeleteSheet}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #b00020",
                  backgroundColor: "#fff",
                  color: "#b00020",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {sheetEditor.isNew ? "Отменить новый листок" : "Удалить листок"}
              </button>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={handleCloseSheetEditor}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #bbb",
                    backgroundColor: "#f2f2f2",
                    color: "#333",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleApplySheetEditor}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid #555",
                    backgroundColor: "#333",
                    color: "#f5f5f5",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  Применить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
