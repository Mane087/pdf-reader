export interface SelectionAnchor {
  /** Viewport coordinates of the selection (from `getBoundingClientRect`). */
  left: number;
  top: number;
  width: number;
  height: number;
}

const TEXT_LAYER_SELECTOR = '.textLayer';

/**
 * Returns the bounding box of the current selection when it is not collapsed
 * and every range is inside a single PDF.js text layer under `root`; `null`
 * otherwise (same rule PDF.js applies before creating a highlight).
 */
export function getTextLayerSelectionAnchor(
  selection: Selection | null,
  root: Element,
): SelectionAnchor | null {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }
  let textLayer: Element | null = null;
  for (let index = 0; index < selection.rangeCount; index += 1) {
    const range = selection.getRangeAt(index);
    const layer = closestTextLayer(range.commonAncestorContainer);
    if (!layer || !root.contains(layer)) {
      return null;
    }
    if (textLayer && textLayer !== layer) {
      return null;
    }
    textLayer = layer;
  }
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return null;
  }
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function closestTextLayer(node: Node): Element | null {
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return element?.closest(TEXT_LAYER_SELECTOR) ?? null;
}
