/**
 * Resizable side panels: a thin grab handle on the inner edge of a
 * panel adjusts its width with the pointer. The panel keeps its CSS
 * width until the first drag, then carries the chosen width inline
 * (so it survives a collapse and reopen).
 */

const LARGEUR_MIN = 170;
const LARGEUR_MAX = 560;

export function makeResizablePanel(
    panel: HTMLElement,
    bord: 'gauche' | 'droite'
): void {

  const handle = document.createElement('div');
  handle.className = `ua-poignee ua-poignee-${ bord }`;

  // the handle is a flex separator NEXT TO the panel (inside a
  // scrolling panel it would scroll away with the content)
  if (bord === 'droite') {
    panel.insertAdjacentElement('afterend', handle);
  } else {
    panel.insertAdjacentElement('beforebegin', handle);
  }

  handle.addEventListener('pointerdown', (down: PointerEvent) => {
    if (down.button !== 0) {
      return;
    }

    down.preventDefault();

    const depart = panel.getBoundingClientRect().width;

    try {
      handle.setPointerCapture(down.pointerId);
    } catch {
      // synthetic pointers (tests) cannot be captured; the window
      // listeners still see every move and the release
    }

    const move = (event: PointerEvent) => {
      const delta = event.clientX - down.clientX;
      const largeur = bord === 'droite' ? depart + delta : depart - delta;

      panel.style.width =
        `${ Math.min(LARGEUR_MAX, Math.max(LARGEUR_MIN, largeur)) }px`;
    };

    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
}
