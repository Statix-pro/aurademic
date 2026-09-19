import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// Mirrors the menu's CSS max-height, and the breathing room it keeps from the
// control and from the edge of the window.
const MENU_MAX_HEIGHT = 240;
const MENU_GAP = 4;
const VIEWPORT_MARGIN = 8;

export interface MenuBox {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

interface FloatingMenuOptions {
  isOpen: boolean;
  /** Called on a pointer press outside both the control and the menu. */
  onClose: () => void;
  /**
   * Anything whose change alters how tall the menu wants to be — the number of
   * filtered options, say. A list that shrinks as it is filtered is placed
   * again, because its height decides which way it opens.
   */
  contentKey?: unknown;
}

/**
 * Places a dropdown menu that is rendered into `document.body` rather than
 * beside its control, and closes it on an outside click.
 *
 * The menu is portalled because inside a table the control's own scroll
 * container (`.pf-table-wrap`, which needs `overflow-x` for narrow windows)
 * cropped the list to the row — the options below the first were unreachable.
 * Portalled out, nothing above it can crop it, so it is positioned by hand
 * against the control's measured box.
 */
export function useFloatingMenu<T extends HTMLElement>({
  isOpen,
  onClose,
  contentKey,
}: FloatingMenuOptions) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  // State, not a ref: the first placement has to happen once the menu is in the
  // DOM, and a ref changing does not re-run the effect that places it. Held as
  // state, the node arriving is a render, so the menu is measured and placed
  // from its real height instead of the 240px ceiling assumed in its absence —
  // which parked an upward-opening menu a gap above the field it belongs to.
  const [menuNode, setMenuNode] = useState<T | null>(null);
  const [menuBox, setMenuBox] = useState<MenuBox>({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: MENU_MAX_HEIGHT,
  });

  // Held in a ref so a caller passing a fresh closure each render does not
  // resubscribe the document and window listeners on every render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const positionMenu = useCallback(() => {
    const control = wrapperRef.current;
    if (!control) return;

    const rect = control.getBoundingClientRect();
    // `scrollHeight`, not `offsetHeight`: the menu we are measuring may already
    // be capped by a maxHeight this function set for a tighter position.
    const wanted = Math.min(menuNode?.scrollHeight ?? MENU_MAX_HEIGHT, MENU_MAX_HEIGHT);
    const below = window.innerHeight - rect.bottom - MENU_GAP - VIEWPORT_MARGIN;
    const above = rect.top - MENU_GAP - VIEWPORT_MARGIN;

    // Below the control, as a dropdown should be — unless the list would run
    // off the bottom of the window and there is more room above it. The last
    // row of a long form otherwise opens its options where nobody can reach
    // them without scrolling the page underneath.
    const openUp = below < wanted && above > below;
    const maxHeight = Math.max(0, Math.min(wanted, openUp ? above : below));

    setMenuBox({
      top: openUp ? rect.top - MENU_GAP - maxHeight : rect.bottom + MENU_GAP,
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
  }, [menuNode]);

  // Before paint, so the menu never shows at the previous row's coordinates.
  useLayoutEffect(() => {
    if (isOpen) positionMenu();
  }, [isOpen, positionMenu, contentKey]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      // The menu is outside the wrapper in the DOM now, so a click on an option
      // has to be recognised as inside.
      if (!wrapperRef.current?.contains(target) && !menuNode?.contains(target)) {
        onCloseRef.current();
      }
    };

    // Anything that moves the control moves the menu with it; `true` catches
    // scrolling in the table wrapper and the page alike.
    const reposition = () => positionMenu();

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [isOpen, menuNode, positionMenu]);

  return { wrapperRef, menuNode, setMenuNode, menuBox };
}
