import React, { useEffect, useMemo, useState } from "react";
import {
  type BoardDescriptionSheet,
  getSheetBoardSourceLabel,
  getSheetSourceLabel,
  truncateSheetSourceLabel,
} from "../boardDescription";
import type { BoardNode } from "../boardTypes";
import { FILE_RES_BASE_URL, type PictureMeta } from "../fileDataSource";
import "./NodeCard.css";
import { clampReadPanelWidth, DESKTOP_READ_PANEL_DEFAULT_WIDTH } from "./panelSizing";

type MobileSheetState = "half" | "full";
type DesktopResizeState = {
  pointerId: number;
  startX: number;
  startWidth: number;
} | null;

interface NodeReadPanelProps {
  node: BoardNode | null;
  pictureMeta?: PictureMeta | null;
  descriptionSheets: BoardDescriptionSheet[];
  onClose: () => void;
  mobile?: boolean;
  showAnalysisButton?: boolean;
  onOpenAnalysisBoard?: (() => void) | undefined;
  analysisButtonTitle?: string | undefined;
}

const MOBILE_DRAG_CLOSE_THRESHOLD = 96;
const MOBILE_DRAG_EXPAND_THRESHOLD = 72;

export const NodeReadPanel: React.FC<NodeReadPanelProps> = ({
  node,
  pictureMeta = null,
  descriptionSheets,
  onClose,
  mobile = false,
  showAnalysisButton = false,
  onOpenAnalysisBoard,
  analysisButtonTitle,
}) => {
  const [sheetState, setSheetState] = useState<MobileSheetState>("half");
  const [dragPointerId, setDragPointerId] = useState<number | null>(null);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [dragStartState, setDragStartState] = useState<MobileSheetState>("half");
  const [desktopWidth, setDesktopWidth] = useState(() => clampReadPanelWidth(DESKTOP_READ_PANEL_DEFAULT_WIDTH));
  const [desktopResizeState, setDesktopResizeState] = useState<DesktopResizeState>(null);

  useEffect(() => {
    setSheetState("half");
    setDragPointerId(null);
    setDragOffsetY(0);
  }, [node?.node_id]);

  useEffect(() => {
    if (mobile) return;

    const handleWindowResize = () => {
      setDesktopWidth((prevWidth) => clampReadPanelWidth(prevWidth));
    };

    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, [mobile]);

  useEffect(() => {
    if (dragPointerId === null) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== dragPointerId) return;

      event.preventDefault();
      setDragOffsetY(event.clientY - dragStartY);
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerId !== dragPointerId) return;

      const totalOffsetY = event.clientY - dragStartY;
      setDragPointerId(null);
      setDragOffsetY(0);

      if (dragStartState === "half") {
        if (totalOffsetY <= -MOBILE_DRAG_EXPAND_THRESHOLD) {
          setSheetState("full");
          return;
        }

        if (totalOffsetY >= MOBILE_DRAG_CLOSE_THRESHOLD) {
          onClose();
          return;
        }

        setSheetState("half");
        return;
      }

      if (totalOffsetY >= MOBILE_DRAG_CLOSE_THRESHOLD) {
        onClose();
        return;
      }

      if (totalOffsetY > MOBILE_DRAG_EXPAND_THRESHOLD) {
        setSheetState("half");
        return;
      }

      setSheetState("full");
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [dragPointerId, dragStartState, dragStartY, onClose]);

  useEffect(() => {
    if (mobile || !desktopResizeState) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== desktopResizeState.pointerId) return;

      event.preventDefault();

      const nextWidth = desktopResizeState.startWidth - (event.clientX - desktopResizeState.startX);
      setDesktopWidth(clampReadPanelWidth(nextWidth));
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
  }, [desktopResizeState, mobile]);

  const handleSheetPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!mobile || !event.isPrimary) return;

    event.preventDefault();
    setDragPointerId(event.pointerId);
    setDragStartY(event.clientY);
    setDragOffsetY(0);
    setDragStartState(sheetState);
  };

  const handleDesktopResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (mobile || !event.isPrimary || event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    setDesktopResizeState({
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: desktopWidth,
    });
  };

  const mobileTranslateY = useMemo(() => {
    const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
    const clampedOffsetY =
      sheetState === "full"
        ? Math.max(0, dragOffsetY)
        : Math.min(viewportHeight * 0.5, Math.max(-viewportHeight * 0.5, dragOffsetY));
    const baseOffset = sheetState === "half" ? "50%" : "0%";
    return `translateY(calc(${baseOffset} + ${clampedOffsetY}px))`;
  }, [dragOffsetY, sheetState]);

  const imageUrl = useMemo(() => {
    const picturePath = typeof node?.picture_path === "string" ? node.picture_path.trim() : "";
    return picturePath ? `${FILE_RES_BASE_URL}/res/${picturePath}` : null;
  }, [node?.picture_path]);

  const pictureAuthor = useMemo(() => {
    const author = typeof pictureMeta?.author === "string" ? pictureMeta.author.trim() : "";
    return author || null;
  }, [pictureMeta]);

  const imageContent = imageUrl ? (
    <div
      style={{
        flexShrink: 0,
        padding: mobile ? "14px 14px 0" : "2px 0 0",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: 16,
          overflow: "hidden",
          backgroundColor: "#111",
          border: "1px solid #ddd",
        }}
      >
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
        {pictureAuthor && (
          <div
            style={{
              position: "absolute",
              right: 10,
              bottom: 10,
              padding: "4px 8px",
              borderRadius: 999,
              background: "rgba(0, 0, 0, 0.45)",
              color: "#d0d0d0",
              fontSize: 11,
              lineHeight: 1.2,
            }}
          >
            Автор: {pictureAuthor}
          </div>
        )}
      </div>
    </div>
  ) : null;

  const descriptionContent = (
    <div
      className="paper-stack"
      style={{
        padding: mobile ? "16px 14px calc(18px + env(safe-area-inset-bottom, 0px))" : "16px 10px 18px",
        ["--paper-stack-bottom-gap" as string]: mobile
          ? "calc(56px + env(safe-area-inset-bottom, 0px))"
          : "24px",
      }}
    >
      {descriptionSheets.length > 0 ? (
        descriptionSheets.map((sheet) => {
          const boardSourceLabel = getSheetBoardSourceLabel(sheet.boardSources);
          const fullSourceLabel = getSheetSourceLabel(sheet.relatedNodeNames);
          const previewSourceLabel = truncateSheetSourceLabel(fullSourceLabel);
          const marginTitle = [boardSourceLabel, fullSourceLabel]
            .filter((part) => part.trim().length > 0)
            .join("\n");

          return (
            <article key={sheet.id} className="paper-note">
              <div className="paper-note__margin" title={marginTitle || undefined}>
                <div className="paper-note__margin-content">
                  {boardSourceLabel ? (
                    <div className="paper-note__board-source">{boardSourceLabel}</div>
                  ) : null}
                  <div className="paper-note__sources">
                    {previewSourceLabel ? (
                      <div className="paper-note__source">{previewSourceLabel}</div>
                    ) : (
                      <div className="paper-note__source paper-note__source--empty">&nbsp;</div>
                    )}
                  </div>
                </div>
              </div>
              <div className="paper-note__body">
                <div className="paper-note__text">{sheet.description}</div>
              </div>
            </article>
          );
        })
      ) : (
        <div className="paper-stack__empty">Описание отсутствует.</div>
      )}
    </div>
  );

  if (mobile) {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
          zIndex: 20,
        }}
      >
        <aside
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "100%",
            backgroundColor: "#fafafa",
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            boxShadow: "0 -10px 30px rgba(0,0,0,0.18)",
            display: "flex",
            flexDirection: "column",
            pointerEvents: "auto",
            transform: mobileTranslateY,
            transition: dragPointerId === null ? "transform 180ms ease-out" : "none",
            willChange: "transform",
          }}
        >
          <div
            style={{
              flexShrink: 0,
              padding: "10px 14px 8px",
              borderBottom: "1px solid #ddd",
              backgroundColor: "#fafafa",
            }}
          >
            <div
              onPointerDown={handleSheetPointerDown}
              style={{
                padding: "2px 0 10px",
                touchAction: "none",
                cursor: "grab",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 5,
                  borderRadius: 999,
                  backgroundColor: "#c2c2c2",
                  margin: "0 auto",
                }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, wordBreak: "break-word" }}>
                  {node ? node.name : "Описание узла"}
                </div>
                {node && <div style={{ marginTop: 2, fontSize: 12, opacity: 0.6 }}>{node.node_type}</div>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {showAnalysisButton && (
                  <button
                    type="button"
                    onClick={onOpenAnalysisBoard}
                    disabled={!onOpenAnalysisBoard}
                    title={analysisButtonTitle}
                    style={{
                      padding: "6px 8px",
                      borderRadius: 4,
                      border: "1px solid #bbb",
                      backgroundColor: onOpenAnalysisBoard ? "#fff" : "#f3f3f3",
                      color: onOpenAnalysisBoard ? "#222" : "#999",
                      cursor: onOpenAnalysisBoard ? "pointer" : "default",
                      fontSize: 12,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Доска по сущности
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    flexShrink: 0,
                    width: 28,
                    height: 28,
                    borderRadius: 4,
                    border: "1px solid #bbb",
                    backgroundColor: "#fff",
                    cursor: "pointer",
                    fontSize: 18,
                    lineHeight: "24px",
                  }}
                  aria-label="Закрыть описание"
                  title="Закрыть"
                >
                  x
                </button>
              </div>
            </div>
          </div>

          {imageContent}

          <div style={{ flexGrow: 1, minHeight: 0, overflowY: "auto" }}>{descriptionContent}</div>
        </aside>
      </div>
    );
  }

  return (
    <aside
      style={{
        position: "relative",
        width: desktopWidth,
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, wordBreak: "break-word" }}>
            {node ? node.name : "Описание узла"}
          </div>
          {node && <div style={{ marginTop: 2, fontSize: 12, opacity: 0.6 }}>{node.node_type}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {showAnalysisButton && (
            <button
              type="button"
              onClick={onOpenAnalysisBoard}
              disabled={!onOpenAnalysisBoard}
              title={analysisButtonTitle}
              style={{
                padding: "6px 8px",
                borderRadius: 4,
                border: "1px solid #bbb",
                backgroundColor: onOpenAnalysisBoard ? "#fff" : "#f3f3f3",
                color: onOpenAnalysisBoard ? "#222" : "#999",
                cursor: onOpenAnalysisBoard ? "pointer" : "default",
                fontSize: 12,
                whiteSpace: "nowrap",
              }}
            >
              Доска по сущности
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              flexShrink: 0,
              width: 28,
              height: 28,
              borderRadius: 4,
              border: "1px solid #bbb",
              backgroundColor: "#fff",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: "24px",
            }}
            aria-label="Закрыть описание"
            title="Закрыть"
          >
            x
          </button>
        </div>
      </div>

      {imageContent}

      <div style={{ flexGrow: 1, minHeight: 0, overflowY: "auto" }}>{descriptionContent}</div>
    </aside>
  );
};
