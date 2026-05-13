const PANEL_MIN_WIDTH = 360;
const PANEL_VIEWPORT_GUTTER = 120;
const PANEL_RESIZE_EXTENSION = 840;

export const DESKTOP_PANEL_MIN_WIDTH = PANEL_MIN_WIDTH;
export const DESKTOP_READ_PANEL_DEFAULT_WIDTH = 540;
export const DESKTOP_READ_PANEL_MAX_WIDTH =
  DESKTOP_READ_PANEL_DEFAULT_WIDTH + PANEL_RESIZE_EXTENSION;
export const DESKTOP_INSPECTOR_PANEL_DEFAULT_WIDTH = 360;
export const DESKTOP_INSPECTOR_PANEL_MAX_WIDTH =
  DESKTOP_INSPECTOR_PANEL_DEFAULT_WIDTH + PANEL_RESIZE_EXTENSION;

function clampPanelWidth(width: number, maxPanelWidth: number) {
  const viewportWidth = typeof window === "undefined" ? 1440 : window.innerWidth;
  const maxWidth = Math.max(
    PANEL_MIN_WIDTH,
    Math.min(maxPanelWidth, viewportWidth - PANEL_VIEWPORT_GUTTER)
  );

  return Math.min(maxWidth, Math.max(PANEL_MIN_WIDTH, width));
}

export function clampReadPanelWidth(width: number) {
  return clampPanelWidth(width, DESKTOP_READ_PANEL_MAX_WIDTH);
}

export function clampInspectorPanelWidth(width: number) {
  return clampPanelWidth(width, DESKTOP_INSPECTOR_PANEL_MAX_WIDTH);
}
