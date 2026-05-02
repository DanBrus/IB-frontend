import React, { useState } from "react";
import type { BoardVersion, BoardAccessMode } from "../boardTypes";
import { useIsMobile } from "../useIsMobile";

interface InvestigationBoardHeaderProps {
  title: string;
  versions: BoardVersion[];
  currentVersion: string;
  accessMode: BoardAccessMode;
  onVersionChange: (version: string) => void;
  onPublish: () => void;
  onRequestEditMode: () => void;
}

export const InvestigationBoardHeader: React.FC<InvestigationBoardHeaderProps> = ({
  title,
  versions,
  currentVersion,
  accessMode,
  onVersionChange,
  onPublish,
  onRequestEditMode,
}) => {
  const isMobile = useIsMobile();
  const [versionPickerOpen, setVersionPickerOpen] = useState(false);

  const handleVersionSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onVersionChange(e.target.value);
  };

  const isEditMode = accessMode === "edit";

  const handlePublishClick = () => {
    const ok = window.confirm(
      "Вы действительно хотите опубликовать эту версию доски?\n" +
        "Действие необратимо: данные текущей версии будут перезаписаны."
    );
    if (ok) onPublish();
  };

  const openVersionPicker = () => {
    setVersionPickerOpen(true);
  };

  const closeVersionPicker = () => {
    setVersionPickerOpen(false);
  };

  const handleVersionPick = (version: string) => {
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
                  }}
                >
                  Выбрать доску
                </button>
              ) : (
                <>
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
                </>
              )}
            </>
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
              Опубликовать
            </button>
          ) : (
            !isMobile && (
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
            {versions.map((version) => {
              const isCurrentVersion = version.version === currentVersion;

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
                  <span style={{ fontSize: 12, opacity: 0.7 }}>{version.version}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};
