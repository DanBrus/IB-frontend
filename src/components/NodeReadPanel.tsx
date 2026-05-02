import React, { useEffect, useMemo, useState } from "react";
import type { BoardNode } from "../boardTypes";
import "./NodeCard.css";

type MobileSheetState = "half" | "full";
type DesktopResizeState = {
  pointerId: number;
  startX: number;
  startWidth: number;
} | null;

interface NodeReadPanelProps {
  node: BoardNode | null;
  onClose: () => void;
  mobile?: boolean;
}

const MOBILE_DRAG_CLOSE_THRESHOLD = 96;
const MOBILE_DRAG_EXPAND_THRESHOLD = 72;
const DESKTOP_PANEL_DEFAULT_WIDTH = 540;
const DESKTOP_PANEL_MIN_WIDTH = 360;
const DESKTOP_PANEL_MAX_WIDTH = 960;

function clampDesktopPanelWidth(width: number) {
  const viewportWidth = typeof window === "undefined" ? 1440 : window.innerWidth;
  const maxWidth = Math.max(
    DESKTOP_PANEL_MIN_WIDTH,
    Math.min(DESKTOP_PANEL_MAX_WIDTH, viewportWidth - 120)
  );

  return Math.min(maxWidth, Math.max(DESKTOP_PANEL_MIN_WIDTH, width));
}

export const NodeReadPanel: React.FC<NodeReadPanelProps> = ({ node, onClose, mobile = false }) => {
  const [sheetState, setSheetState] = useState<MobileSheetState>("half");
  const [dragPointerId, setDragPointerId] = useState<number | null>(null);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [dragStartState, setDragStartState] = useState<MobileSheetState>("half");
  const [desktopWidth, setDesktopWidth] = useState(() => clampDesktopPanelWidth(DESKTOP_PANEL_DEFAULT_WIDTH));
  const [desktopResizeState, setDesktopResizeState] = useState<DesktopResizeState>(null);

  useEffect(() => {
    setSheetState("half");
    setDragPointerId(null);
    setDragOffsetY(0);
  }, [node?.node_id]);

  useEffect(() => {
    if (mobile) return;

    const handleWindowResize = () => {
      setDesktopWidth((prevWidth) => clampDesktopPanelWidth(prevWidth));
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
      setDesktopWidth(clampDesktopPanelWidth(nextWidth));
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
    if (!mobile) return;
    if (!event.isPrimary) return;

    event.preventDefault();

    setDragPointerId(event.pointerId);
    setDragStartY(event.clientY);
    setDragOffsetY(0);
    setDragStartState(sheetState);
  };

  const handleDesktopResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (mobile) return;
    if (!event.isPrimary || event.button !== 0) return;

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

  const descriptionContent = (
    <div
      className="notebook-sheet"
      style={{
        minHeight: "100%",
        paddingTop: 16,
        paddingBottom: mobile ? "calc(16px + env(safe-area-inset-bottom, 0px))" : 16,
        fontSize: 13,
        borderRadius: mobile ? 0 : 4,
        borderLeft: mobile ? "none" : "1px solid #dddddd",
        borderRight: mobile ? "none" : "1px solid #dddddd",
        boxShadow: mobile ? "none" : "0 1px 3px rgba(0, 0, 0, 0.15)",
      }}
    >
      <div style={{ transform: "translateY(-9px)", paddingBottom: 9 }}>
        {node?.description?.trim() ? node.description : "Описание отсутствует."}
      </div>
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

          <div
            style={{
              flexGrow: 1,
              minHeight: 0,
              overflowY: "auto",
            }}
          >
            {descriptionContent}
          </div>
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

      <div
        style={{
          flexGrow: 1,
          minHeight: 0,
          overflowY: "auto",
        }}
      >
        {descriptionContent}
      </div>
    </aside>
  );
};
