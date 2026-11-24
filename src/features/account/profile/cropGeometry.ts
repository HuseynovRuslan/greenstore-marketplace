/*
 * The crop of «Loqonu dəyiş» and «Üz şəklini dəyiş» (PhotoCropDialog), as plain numbers: no DOM, so it is tested
 * alone. Everything is in the source picture's pixels. The crop window has the slot's shape (a square, or 4:1); at
 * zoom 1 it is the largest such window that fits the picture, and zooming in makes it smaller around its centre. The
 * window never leaves the picture, and never gets smaller than the API's minimum (400 px, 1200 × 300 px), so whatever
 * is saved passes the server's size check.
 */

export interface CropSpec {
  /** Width over height of the crop: 1 for a logo, 4 for a cover */
  aspect: number
  /** The smallest width (and so height) the API takes */
  minWidth: number
  /** The width of the picture sent: larger crops are scaled down to it */
  outWidth: number
  /** How far one may zoom in, at most */
  maxZoom: number
}

/** The crop: its zoom (1 = the largest window) and the window's centre in source pixels. */
export interface CropState {
  zoom: number
  cx: number
  cy: number
}

export interface CropWindow {
  x: number
  y: number
  width: number
  height: number
}

/** The largest window of the spec's shape that fits a `width` × `height` picture. */
export function baseWindow(width: number, height: number, spec: Pick<CropSpec, 'aspect'>): { width: number; height: number } {
  const w = Math.min(width, height * spec.aspect)
  return { width: w, height: w / spec.aspect }
}

/** Whether the picture is large enough for the slot at all (at zoom 1 the window is at least the minimum). */
export function isLargeEnough(width: number, height: number, spec: CropSpec): boolean {
  return baseWindow(width, height, spec).width >= spec.minWidth
}

/** The zoom range: from 1 to the point where the window would get smaller than the API's minimum (or `maxZoom`). */
export function zoomBounds(width: number, height: number, spec: CropSpec): { min: number; max: number } {
  const base = baseWindow(width, height, spec).width
  return { min: 1, max: Math.max(1, Math.min(spec.maxZoom, base / spec.minWidth)) }
}

/** The crop window of a state (not clamped: see `clampCrop`). */
export function cropWindow(state: CropState, width: number, height: number, spec: CropSpec): CropWindow {
  const base = baseWindow(width, height, spec)
  const w = base.width / state.zoom
  const h = base.height / state.zoom
  return { x: state.cx - w / 2, y: state.cy - h / 2, width: w, height: h }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** The state with its zoom in range and its window inside the picture. */
export function clampCrop(state: CropState, width: number, height: number, spec: CropSpec): CropState {
  const bounds = zoomBounds(width, height, spec)
  const zoom = clamp(Number.isFinite(state.zoom) ? state.zoom : 1, bounds.min, bounds.max)
  const { width: w, height: h } = cropWindow({ zoom, cx: 0, cy: 0 }, width, height, spec)
  return { zoom, cx: clamp(state.cx, w / 2, width - w / 2), cy: clamp(state.cy, h / 2, height - h / 2) }
}

/** The first crop of a picture: the largest window, in the middle. */
export function initialCrop(width: number, height: number): CropState {
  return { zoom: 1, cx: width / 2, cy: height / 2 }
}

/** Moves the window by `dx`, `dy` source pixels (a drag moves the picture the other way: pass the negated delta). */
export function moveCrop(state: CropState, dx: number, dy: number, width: number, height: number, spec: CropSpec): CropState {
  return clampCrop({ ...state, cx: state.cx + dx, cy: state.cy + dy }, width, height, spec)
}

/** Zooms around the window's centre. */
export function zoomCrop(state: CropState, zoom: number, width: number, height: number, spec: CropSpec): CropState {
  return clampCrop({ ...state, zoom }, width, height, spec)
}

/**
 * The size of the picture sent: the window's own size, scaled down to `outWidth` when larger. Whole pixels, the
 * height from the width and the shape (never under the minimum, since the window never is).
 */
export function outputSize(window: CropWindow, spec: CropSpec): { width: number; height: number } {
  const width = Math.max(spec.minWidth, Math.floor(Math.min(spec.outWidth, window.width)))
  return { width, height: Math.round(width / spec.aspect) }
}
