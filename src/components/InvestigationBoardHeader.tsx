import React from "react";
import type { BoardVersion } from "../boardTypes";

interface InvestigationBoardHeaderProps {
  title: string;
  versions: BoardVersion[];
  currentVersion: string;
  onVersionChange: (version: string) => void;
  onPublish: () => void;
}

export const InvestigationBoardHeader: React.FC<InvestigationBoardHeaderProps> = ({
  title,
  versions,
  currentVersion,
  onVersionChange,
  onPublish,
}) => {
  const handleVersionSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onVersionChange(e.target.value);
  };

  const handlePublishClick = () => {
    const ok = window.confirm(
      "Вы действительно хотите опубликовать эту версию доски?\n" +
        "Действие необратимо: данные текущей версии будут перезаписаны."
    );
    if (ok) onPublish();
  };

  return (
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
  );
};
