import React, { useState } from "react";
import type { BoardAccessMode, BoardVersion, BoardViewMode } from "../boardTypes";
import { formatBoardVersion, parseBoardVersion } from "../boardTypes";
import { useIsMobile } from "../useIsMobile";

const ANALYSIS_SELECT_VALUE = "__analysis_board__";

interface InvestigationBoardHeaderProps {
  title: string;
  versions: BoardVersion[];
  currentVersion: number;
  accessMode: BoardAccessMode;
  boardViewMode: BoardViewMode;
  analysisBoardInfo: {
    version: number;
    name: string | null;
    description: string | null;
  } | null;
  onVersionChange: (version: number) => void;
  onPublish: () => void;
  onRequestEditMode: () => void;
  onCanonicalEntitiesClick?: (() => void) | undefined;
}

export const InvestigationBoardHeader: React.FC<InvestigationBoardHeaderProps> = ({
  title,
  versions,
  currentVersion,
  accessMode,
  boardViewMode,
  analysisBoardInfo,
  onVersionChange,
  onPublish,
  onRequestEditMode,
  onCanonicalEntitiesClick,
}) => {
  const isMobile = useIsMobile();
  const [versionPickerOpen, setVersionPickerOpen] = useState(false);
  const isAnalysisMode = boardViewMode === "analysis";
  const analysisBoardLabel =
    analysisBoardInfo
      ? `${formatBoardVersion(analysisBoardInfo.version)} — ${
          analysisBoardInfo.name?.trim() || "Аналитическая доска"
        }`
      : "0 — Аналитическая доска";

  const handleVersionSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === ANALYSIS_SELECT_VALUE) return;
    const parsedVersion = parseBoardVersion(e.target.value);
    if (parsedVersion === null) return;
    onVersionChange(parsedVersion);
  };

  const isEditMode = accessMode === "edit";
  const canRequestEditMode = accessMode === "read" && !isAnalysisMode;

  const handlePublishClick = () => {
    const ok = window.confirm(
      "Сохранить изменения текущей версии доски?\n" +
        "Будут обновлены данные графа и текущее состояние общедоступности."
    );
    if (ok) onPublish();
  };

  const openVersionPicker = () => {
    setVersionPickerOpen(true);
  };

  const closeVersionPicker = () => {
    setVersionPickerOpen(false);
  };

  const handleVersionPick = (version: number) => {
    onVersionChange(version);
    closeVersionPicker();
  };

  return (
    <>
      <div
        style={{
          padding: isMobile ? "10px 12px" : "10px 16px",
          backgroundColor: "#222",
          color: "white",
          fontSize: isMobile ? 18 : 20,
          fontWeight: "bold",
          flexShrink: 0,
          userSelect: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span>{title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, flexWrap: "wrap" }}>
          {versions.length > 0 && (
            <>
              {isMobile ? (
                <button
                  type="button"
                  onClick={openVersionPicker}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 4,
                    border: "1px solid #888",
                    backgroundColor: "#444",
                    color: "#f5f5f5",
                    fontSize: 13,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    maxWidth: "min(60vw, 320px)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {isAnalysisMode ? analysisBoardLabel : "Выбрать доску"}
                </button>
              ) : (
                <>
                  <span style={{ opacity: 0.8 }}>Версия:</span>
                  <select
                    value={
                      isAnalysisMode
                        ? ANALYSIS_SELECT_VALUE
                        : formatBoardVersion(currentVersion)
                    }
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
                    {isAnalysisMode && (
                      <option value={ANALYSIS_SELECT_VALUE} disabled>
                        {analysisBoardLabel}
                      </option>
                    )}
                    {versions.map((version) => (
                      <option key={version.version} value={formatBoardVersion(version.version)}>
                        {formatBoardVersion(version.version)} — {version.name}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </>
          )}
          {accessMode === "read" && onCanonicalEntitiesClick && (
            <button
              type="button"
              onClick={onCanonicalEntitiesClick}
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
              Сущности
            </button>
          )}
          {isEditMode ? (
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
              Сохранить
            </button>
          ) : (
            !isMobile && canRequestEditMode && (
              <button
                type="button"
                onClick={onRequestEditMode}
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
                Режим редактирования
              </button>
            )
          )}
        </div>
      </div>
      {isMobile && versionPickerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 12,
          }}
          onClick={closeVersionPicker}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(420px, 100%)",
              maxHeight: "min(520px, calc(100vh - 24px))",
              overflowY: "auto",
              background: "#fff",
              borderRadius: 10,
              boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16 }}>Доски для просмотра</div>
            {isAnalysisMode && (
              <div
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #222",
                  backgroundColor: "#f3f3f3",
                  color: "#111",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <span style={{ fontWeight: 600 }}>
                  {analysisBoardInfo?.name?.trim() || "Аналитическая доска"}
                </span>
                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  {formatBoardVersion(analysisBoardInfo?.version ?? 0)}
                </span>
                {analysisBoardInfo?.description?.trim() ? (
                  <span style={{ fontSize: 12, opacity: 0.72 }}>
                    {analysisBoardInfo.description.trim()}
                  </span>
                ) : null}
              </div>
            )}
            {versions.map((version) => {
              const isCurrentVersion = !isAnalysisMode && version.version === currentVersion;

              return (
                <button
                  key={version.version}
                  type="button"
                  onClick={() => handleVersionPick(version.version)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: isCurrentVersion ? "1px solid #222" : "1px solid #ccc",
                    backgroundColor: isCurrentVersion ? "#f3f3f3" : "#fff",
                    color: "#111",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{version.name}</span>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>{formatBoardVersion(version.version)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};
