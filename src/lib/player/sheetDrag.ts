// Drag the collapsed bar up to open the player, or the open player down to close
// it (upstream player_ui.rs `use_sheet_drag`). The sheet follows the pointer;
// release past a distance or with enough speed to finish, otherwise it springs back.
// A drag never turns into a click on whatever it started on.

const BAR_HEIGHT = 72;
const DRAG_SLOP = 8;

export function createSheetDrag(getSheet: () => HTMLElement | undefined, isExpanded: () => boolean, setExpanded: (v: boolean) => void) {
  let pointer: number | null = null;
  let start = [0, 0];
  let active = false;
  let expanded = false;
  let vh = 800;
  let offset = 0;
  let samples: [number, number][] = [];
  let suppressUntil = 0;

  const swallow = (e: MouseEvent) => {
    if (performance.now() < suppressUntil) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  };
  window.addEventListener('click', swallow, true);

  const clear = (el: HTMLElement) => {
    el.style.removeProperty('height');
    el.style.removeProperty('transform');
    el.style.removeProperty('--sheet-p');
    el.classList.remove('is-dragging');
  };

  function onpointerdown(e: PointerEvent) {
    if (e.button !== 0 || !e.isPrimary) return;
    pointer = e.pointerId;
    start = [e.clientX, e.clientY];
    active = false;
    offset = 0;
    expanded = isExpanded();
    samples = [];
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onpointermove(e: PointerEvent) {
    if (pointer !== e.pointerId) return;
    const dx = e.clientX - start[0],
      dy = e.clientY - start[1];
    const el = getSheet();
    if (!el) return;
    if (!active) {
      const toward = expanded ? dy : -dy;
      if (toward > DRAG_SLOP && Math.abs(dy) > Math.abs(dx)) {
        active = true;
        vh = innerHeight || 800;
        el.classList.add('is-dragging');
      } else if (Math.abs(dx) > DRAG_SLOP || Math.abs(dy) > DRAG_SLOP) {
        pointer = null;
        return;
      } else return;
    }
    e.preventDefault();
    const t = performance.now();
    samples.push([t, e.clientY]);
    samples = samples.filter(([st]) => t - st < 120);
    if (expanded) {
      const down = Math.max(dy, 0) + Math.min(dy, 0) * 0.15;
      offset = down;
      el.style.setProperty('transform', `translateY(${Math.max(down, 0).toFixed(1)}px)`);
      el.style.setProperty('--sheet-p', Math.min(1, Math.max(0, 1 - Math.max(down, 0) / vh)).toFixed(5));
    } else {
      const up = Math.max(-dy, 0);
      offset = up;
      el.style.setProperty('height', `${Math.min(BAR_HEIGHT + up, vh).toFixed(1)}px`, 'important');
      el.style.setProperty('--sheet-p', Math.min(1, Math.max(0, up / (vh - BAR_HEIGHT))).toFixed(5));
    }
  }

  function finish(e: PointerEvent, cancelled: boolean) {
    if (pointer !== e.pointerId) return;
    pointer = null;
    if (!active) return;
    active = false;
    suppressUntil = performance.now() + 350;
    const [a, b] = [samples[0], samples[samples.length - 1]];
    const velocity = a && b && b[0] - a[0] > 8 ? (b[1] - a[1]) / (b[0] - a[0]) : 0;
    const flip = !cancelled && (expanded ? offset > 120 || velocity > 0.45 : offset > 90 || velocity < -0.45);
    const el = getSheet();
    if (el) {
      clear(el);
      if (flip) el.classList.toggle('expanded', !expanded);
    }
    if (flip) setExpanded(!expanded);
  }

  return {
    handlers: {
      onpointerdown,
      onpointermove,
      onpointerup: (e: PointerEvent) => finish(e, false),
      onpointercancel: (e: PointerEvent) => finish(e, true)
    },
    destroy: () => window.removeEventListener('click', swallow, true)
  };
}
