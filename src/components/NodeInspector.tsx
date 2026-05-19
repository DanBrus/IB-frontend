import React, { useEffect, useMemo, useState } from "react";
import {
  BOARD_NODE_TYPES,
  normalizeNodeType,
  type BoardNode,
  type BoardNodeType,
} from "../boardTypes";
import type { BoardDescriptionSheet, EditableBoardDescriptionSheet } from "../boardDescription";
import {
  createEmptyDescriptionSheet,
  getSheetSourceLabel,
  toEditableDescriptionSheets,
  truncateSheetSourceLabel,
} from "../boardDescription";
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
  descriptionSheets: BoardDescriptionSheet[];
  connectedNodes: BoardNode[];
  onSaveNode: (
    id: number,
    patch: {
      name: string;
      descriptionSheets: EditableBoardDescriptionSheet[];
      node_type: BoardNodeType;
    }
  ) => Promise<void>;
}

const MAX_NAME_LEN = 64;

function clampName(value: string) {
  return value.length > MAX_NAME_LEN ? value.slice(0, MAX_NAME_LEN) : value;
}

function cloneEditableSheet(sheet: EditableBoardDescriptionSheet): EditableBoardDescriptionSheet {
  return {
    ...sheet,
    relatedNodeIds: [...sheet.relatedNodeIds],
    c_ids: [...sheet.c_ids],
  };
}

export const NodeInspector: React.FC<NodeInspectorProps> = ({
  node,
  descriptionSheets,
  connectedNodes,
  onSaveNode,
}) => {
  const [name, setName] = useState("");
  const [nodeType, setNodeType] = useState<BoardNodeType>(BOARD_NODE_TYPES[0]);
  const [sheets, setSheets] = useState<EditableBoardDescriptionSheet[]>([]);
  const [sheetEditor, setSheetEditor] = useState<SheetEditorState>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [desktopWidth, setDesktopWidth] = useState(() =>
    clampInspectorPanelWidth(DESKTOP_INSPECTOR_PANEL_DEFAULT_WIDTH)
  );
  const [desktopResizeState, setDesktopResizeState] = useState<DesktopResizeState>(null);

  const connectedNodesById = useMemo(() => {
    const map = new Map<number, BoardNode>();
    connectedNodes.forEach((connectedNode) => map.set(connectedNode.node_id, connectedNode));
    return map;
  }, [connectedNodes]);

  useEffect(() => {
    if (node) {
      setName(node.name ?? "");
      setNodeType(normalizeNodeType(node.node_type));
      setSheets(toEditableDescriptionSheets(descriptionSheets));
    } else {
      setName("");
      setNodeType(BOARD_NODE_TYPES[0]);
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

      const nextWidth = desktopResizeState.startWidth - (event.clientX - desktopResizeState.startX);
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

  const handleDesktopResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    setDesktopResizeState({
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: desktopWidth,
    });
  };

  const openSheetEditor = (sheet: EditableBoardDescriptionSheet, isNew: boolean) => {
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

  const handleEditorDraftChange = (patch: Partial<EditableBoardDescriptionSheet>) => {
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
    };

    if (!normalizedSheet.description) {
      setError("У листка должен быть непустой текст.");
      return;
    }

    setError(null);
    setSheets((prev) =>
      sheetEditor.isNew
        ? [...prev, normalizedSheet]
        : prev.map((sheet) => (sheet.id === normalizedSheet.id ? normalizedSheet : sheet))
    );
    setSheetEditor(null);
  };

  const handleDeleteSheet = () => {
    if (!sheetEditor) return;

    if (!sheetEditor.isNew) {
      setSheets((prev) => prev.filter((sheet) => sheet.id !== sheetEditor.draft.id));
    }
    setSheetEditor(null);
  };

  const handleSave = async () => {
    if (!node) return;
    if (sheetEditor) {
      setError("Сначала сохраните или отмените редактирование открытого листка.");
      return;
    }

    setError(null);
    setSaving(true);

    try {
      await onSaveNode(node.node_id, {
        name: clampName(name),
        node_type: nodeType,
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
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
          Имя (до 64 символов)
          <input
            type="text"
            value={name}
            maxLength={MAX_NAME_LEN}
            disabled={disabled}
            onChange={(event) => setName(event.target.value)}
            style={{
              width: "100%",
              marginTop: 4,
              padding: "6px 8px",
              fontSize: 13,
              borderRadius: 6,
              border: "1px solid #ccc",
              boxSizing: "border-box",
              backgroundColor: disabled ? "#f2f2f2" : "#fff",
            }}
          />
        </label>

        <label style={{ fontSize: 12, fontWeight: 600, opacity: disabled ? 0.6 : 0.9 }}>
          Тип узла
          <select
            value={nodeType}
            disabled={disabled}
            onChange={(event) => setNodeType(event.target.value as BoardNodeType)}
            style={{
              width: "100%",
              marginTop: 4,
              padding: "6px 8px",
              fontSize: 13,
              borderRadius: 6,
              border: "1px solid #ccc",
              boxSizing: "border-box",
              backgroundColor: disabled ? "#f2f2f2" : "#fff",
            }}
          >
            {BOARD_NODE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

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
          Картинка ноды теперь настраивается не здесь, а в окне управления canonical entities.
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>Описание по чанкам</div>
          <div style={{ fontSize: 11, opacity: 0.65 }}>Двойной клик открывает отдельное окно редактирования.</div>
        </div>

        <div className="paper-stack">
          {node ? (
            sheets.length > 0 ? (
              sheets.map((sheet) => {
                const fullSourceLabel = getSheetSourceLabel(
                  sheet.relatedNodeIds
                    .map((relatedNodeId) => connectedNodesById.get(relatedNodeId)?.name ?? "")
                    .filter(Boolean)
                );
                const previewSourceLabel = truncateSheetSourceLabel(fullSourceLabel);

                return (
                  <article key={sheet.id} className="paper-note paper-note--editable">
                    <div className="paper-note__margin" title={fullSourceLabel || undefined}>
                      <div className="paper-note__sources">
                        {previewSourceLabel ? (
                          <div className="paper-note__source">{previewSourceLabel}</div>
                        ) : (
                          <div className="paper-note__source paper-note__source--empty">&nbsp;</div>
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
                      <div className={`paper-note__text${sheet.description ? "" : " paper-note__text--empty"}`}>
                        {sheet.description || "Пустой листок. Дважды щёлкните, чтобы заполнить его."}
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="paper-stack__empty">
                У этой ноды пока нет ни одного листка. Добавьте новый и распределите его по нужным связям.
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  {sheetEditor.isNew ? "Новый листок" : "Редактирование листка"}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.68 }}>
                  Здесь можно изменить текст чанка, его приоритет и отметить связанные ноды галочками.
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
                onChange={(event) => handleEditorDraftChange({ description: event.target.value })}
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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
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
                  onChange={(event) => handleEditorDraftChange({ timecode: event.target.value })}
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

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={sheetEditor.draft.isNodeOwned}
                onChange={(event) => handleEditorDraftChange({ isNodeOwned: event.target.checked })}
              />
              <span>Сохранить этот чанк и как собственный текст текущей ноды</span>
            </label>

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
                        checked={sheetEditor.draft.relatedNodeIds.includes(connectedNode.node_id)}
                        onChange={() => handleEditorRelatedNodeToggle(connectedNode.node_id)}
                      />
                      <span>{connectedNode.name}</span>
                    </label>
                  ))
                ) : (
                  <div style={{ fontSize: 12, color: "#666" }}>
                    У текущей ноды пока нет связанных соседей, поэтому листок можно сохранить только в неё саму.
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
