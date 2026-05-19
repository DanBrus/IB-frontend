import React, { useMemo, useState } from "react";
import {
  formatCanonicalEntityId,
  getCanonicalEntityPicturePath,
  isCanonicalEntityMerged,
  sortCanonicalEntities,
} from "../canonicalEntities";
import type {
  BoardNodeType,
  CanonicalEntity,
} from "../boardTypes";
import { FILE_RES_BASE_URL } from "../fileDataSource";

interface CanonicalEntityBrowserProps {
  entities: CanonicalEntity[];
  currentAnalysisCeId: number | null;
  onClose: () => void;
  onOpenAnalysisBoard: (ceId: number) => void | Promise<void>;
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function buildGroupedEntities(
  entities: CanonicalEntity[],
  searchTerm: string
): Array<[BoardNodeType, CanonicalEntity[]]> {
  const normalizedSearchTerm = normalizeSearchValue(searchTerm);
  const filteredEntities = sortCanonicalEntities(
    entities.filter((entity) => !isCanonicalEntityMerged(entity))
  ).filter((entity) => {
    if (!normalizedSearchTerm) return true;

    const haystack = [
      entity.name,
      entity.entity_type,
      String(entity.en_id),
      formatCanonicalEntityId(entity.en_id),
    ]
      .map((value) => normalizeSearchValue(value))
      .join(" ");

    return haystack.includes(normalizedSearchTerm);
  });

  const groups = new Map<BoardNodeType, CanonicalEntity[]>();
  filteredEntities.forEach((entity) => {
    const group = groups.get(entity.entity_type) ?? [];
    group.push(entity);
    groups.set(entity.entity_type, group);
  });

  return [...groups.entries()].sort(([leftType], [rightType]) =>
    leftType.localeCompare(rightType, "ru")
  );
}

export const CanonicalEntityBrowser: React.FC<CanonicalEntityBrowserProps> = ({
  entities,
  currentAnalysisCeId,
  onClose,
  onOpenAnalysisBoard,
}) => {
  const [search, setSearch] = useState("");

  const groupedEntities = useMemo(
    () => buildGroupedEntities(entities, search),
    [entities, search]
  );

  const handleOpenEntity = (entityId: number) => {
    void onOpenAnalysisBoard(entityId);
  };

  return (
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
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(980px, calc(100vw - 40px))",
          height: "min(760px, calc(100vh - 40px))",
          borderRadius: 12,
          border: "1px solid #ddd",
          background: "#fff",
          boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 18px 12px",
            borderBottom: "1px solid #e5e5e5",
            display: "flex",
            flexDirection: "column",
            gap: 12,
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
              <div style={{ fontWeight: 700, fontSize: 17 }}>Сущности</div>
              <div style={{ marginTop: 4, fontSize: 12, opacity: 0.68 }}>
                Двойной щелчок по сущности открывает аналитическую доску. Вмерженные сущности скрыты.
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #bbb",
                backgroundColor: "#fff",
                color: "#333",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Закрыть
            </button>
          </div>

          <label style={{ fontSize: 12, fontWeight: 600 }}>
            Поиск
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Фильтр по имени, типу или ce-id"
              style={{
                width: "100%",
                marginTop: 4,
                padding: "7px 9px",
                fontSize: 13,
                borderRadius: 6,
                border: "1px solid #ccc",
                boxSizing: "border-box",
              }}
            />
          </label>
        </div>

        <div
          style={{
            flexGrow: 1,
            overflowY: "auto",
            padding: "16px 18px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 18,
            backgroundColor: "#fafafa",
          }}
        >
          {groupedEntities.length > 0 ? (
            groupedEntities.map(([entityType, groupEntities]) => (
              <section
                key={entityType}
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, color: "#333" }}>
                  {entityType}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                    gap: 10,
                  }}
                >
                  {groupEntities.map((entity) => {
                    const picturePath = getCanonicalEntityPicturePath(entity);
                    const imageUrl = picturePath
                      ? `${FILE_RES_BASE_URL}/res/${picturePath}`
                      : null;
                    const isCurrent = currentAnalysisCeId === entity.en_id;

                    return (
                      <div
                        key={entity.en_id}
                        role="button"
                        tabIndex={0}
                        onDoubleClick={() => handleOpenEntity(entity.en_id)}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.preventDefault();
                          handleOpenEntity(entity.en_id);
                        }}
                        title={`Открыть аналитическую доску для ${entity.name || formatCanonicalEntityId(entity.en_id)}`}
                        style={{
                          textAlign: "left",
                          padding: 0,
                          borderRadius: 12,
                          border: isCurrent ? "1px solid #222" : "1px solid #d9d9d9",
                          background: "#fff",
                          cursor: "pointer",
                          overflow: "hidden",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                          outline: "none",
                        }}
                      >
                        <div style={{ display: "flex", minHeight: 120 }}>
                          <div
                            style={{
                              width: 96,
                              flexShrink: 0,
                              background: imageUrl ? "#111" : "#f0f0f0",
                              borderRight: "1px solid #e5e5e5",
                            }}
                          >
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt=""
                                draggable={false}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  display: "block",
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  textAlign: "center",
                                  fontSize: 11,
                                  color: "#666",
                                  padding: 10,
                                  boxSizing: "border-box",
                                }}
                              >
                                Без картинки
                              </div>
                            )}
                          </div>

                          <div
                            style={{
                              flexGrow: 1,
                              padding: "10px 12px",
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: 14,
                                color: "#222",
                              }}
                            >
                              {entity.name || "Без имени"}
                            </div>
                            <div style={{ fontSize: 12, color: "#666" }}>
                              {formatCanonicalEntityId(entity.en_id)}
                            </div>
                            {isCurrent && (
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "#244a7d",
                                  fontWeight: 600,
                                  letterSpacing: "0.04em",
                                }}
                              >
                                ОТКРЫТА СЕЙЧАС
                              </div>
                            )}
                            <div
                              style={{
                                marginTop: "auto",
                                fontSize: 12,
                                color: "#444",
                              }}
                            >
                              {entity.entity_type}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          ) : (
            <div
              style={{
                borderRadius: 12,
                border: "1px dashed #c8c8c8",
                background: "#fff",
                padding: "18px 16px",
                fontSize: 13,
                color: "#555",
              }}
            >
              По текущему фильтру сущности не найдены.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
