import type { ToolGroup } from '../contract/types.ts';

/** A tool armed for placement. */
export interface ArmedTool {

  /** 'host' (drop delegate) | 'note' | 'cadre'. */
  kind: string;

  /** Tool key (host tools). */
  cle?: string;
}

export interface ToolboxOptions {

  /** Element the toolbox panel is rendered into. */
  container: HTMLElement;

  /** Called when a tool is selected (armed) or cleared (null). */
  onArm: (tool: ArmedTool | null) => void;

  /** Called when a tool is dragged and dropped (viewport coordinates). */
  onDrop?: (tool: ArmedTool, clientX: number, clientY: number) => void;

  /** Called when the panel is collapsed (true) or reopened (false). */
  onCollapse?: (repliee: boolean) => void;
}

/**
 * The toolbox panel. Its whole content comes from the host (groups,
 * labels, icons, keys); the component itself only adds the view tools
 * (note and group frame), which never reach the host. No catalogue of
 * icons or types is embedded.
 */
export class Toolbox {

  private _container: HTMLElement;
  private _onArm: ToolboxOptions['onArm'];
  private _onDrop: ToolboxOptions['onDrop'];
  private _onCollapse: ToolboxOptions['onCollapse'];

  private _groups: ToolGroup[] = [];
  private _filter = '';
  private _armed: { element: HTMLElement, tool: ArmedTool } | null = null;
  private _armMessage = '';
  private _suppressClick = false;

  private _list: HTMLElement;
  private _status: HTMLElement;

  constructor(options: ToolboxOptions) {
    this._container = options.container;
    this._onArm = options.onArm;
    this._onDrop = options.onDrop;
    this._onCollapse = options.onCollapse;

    this._container.classList.add('ua-toolbox');

    // header: the collapse button; collapsed, the whole panel goes
    // away and the host of the panel shows its own reopen control
    const header = document.createElement('div');
    header.className = 'ua-toolbox-entete';

    const collapse = document.createElement('button');
    collapse.type = 'button';
    collapse.className = 'ua-toolbox-replier';
    collapse.title = 'Masquer la boîte à outils';
    collapse.textContent = '‹';
    collapse.addEventListener('click', () => this.setCollapsed(true));

    header.appendChild(collapse);
    this._container.appendChild(header);

    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'Rechercher un outil…';
    search.className = 'ua-toolbox-recherche';
    search.addEventListener('input', () => {
      this._filter = search.value.trim().toLowerCase();
      this._render();
    });
    this._container.appendChild(search);

    this._list = document.createElement('div');
    this._list.className = 'ua-toolbox-groupes';
    this._container.appendChild(this._list);

    this._status = document.createElement('div');
    this._status.className = 'ua-toolbox-statut';
    this._container.appendChild(this._status);

    this._render();
  }

  /** Replaces the host groups (after load or a view change). */
  setGroups(groups: ToolGroup[]): void {
    this._groups = groups || [];
    this._render();
  }

  /** Shows the busy indicator while the host answers a drop. */
  setBusy(busy: boolean): void {
    this._status.classList.toggle('ua-toolbox-occupe', busy);
    this._status.textContent = busy ? 'Pose en cours…' : '';
  }

  /** Displays an error message (e.g. from the host). */
  showError(message: string): void {
    this._status.classList.remove('ua-toolbox-occupe');
    this._status.textContent = message;
    this._status.classList.add('ua-toolbox-erreur');
  }

  clearError(): void {
    this._status.textContent = '';
    this._status.classList.remove('ua-toolbox-erreur');
  }

  /** Collapses the panel entirely, or brings it back. */
  setCollapsed(repliee: boolean): void {
    this._container.classList.toggle('ua-toolbox-repliee', repliee);
    this._onCollapse?.(repliee);
  }

  /** Clears the armed tool (after a placement or an escape). */
  disarm(): void {
    if (this._armed) {
      this._armed.element.classList.remove('ua-outil-arme');
      this._armed = null;
    }

    // only clear the status when it still shows the arming hint
    if (this._armMessage && this._status.textContent === this._armMessage) {
      this._status.textContent = '';
    }
    this._armMessage = '';
  }

  destroy(): void {
    this._container.classList.remove('ua-toolbox', 'ua-toolbox-repliee');
    this._container.innerHTML = '';
  }

  private _arm(element: HTMLElement, tool: ArmedTool, libelle: string): void {
    if (this._armed && this._armed.element === element) {
      // clicking the armed tool again disarms it
      this.disarm();
      this._onArm(null);
      return;
    }

    this.disarm();
    this.clearError();

    element.classList.add('ua-outil-arme');
    this._armed = { element, tool };

    this._armMessage =
      `Cliquez sur le dessin pour poser « ${ libelle } » (Échap pour annuler).`;
    this._status.textContent = this._armMessage;

    this._onArm(tool);
  }

  /**
   * Drag of a tool button: past a small threshold the button follows
   * the pointer as a ghost, and releasing it hands the drop point to
   * the host of the panel. A plain click (no movement) still arms.
   */
  private _beginDrag(
      button: HTMLElement,
      entry: { tool: ArmedTool, libelle: string },
      down: PointerEvent
  ): void {

    const threshold = 6;
    let ghost: HTMLElement | null = null;

    const move = (event: PointerEvent) => {
      if (!ghost) {
        if (Math.hypot(event.clientX - down.clientX,
          event.clientY - down.clientY) < threshold) {
          return;
        }

        ghost = document.createElement('div');
        ghost.className = 'ua-outil-fantome';
        ghost.textContent = entry.libelle;
        this._container.appendChild(ghost);

        button.classList.add('ua-outil-glisse');

        try {
          button.setPointerCapture(down.pointerId);
        } catch {
          // synthetic pointers (tests) cannot be captured; the window
          // listeners still see every move and the release
        }
      }

      ghost.style.left = `${ event.clientX + 12 }px`;
      ghost.style.top = `${ event.clientY + 12 }px`;
    };

    const up = (event: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);

      if (!ghost) {
        return; // no movement: the click event will arm the tool
      }

      ghost.remove();
      button.classList.remove('ua-outil-glisse');

      // the browser fires a click on the capturing button right after
      // pointerup: it must not arm the tool we just dropped
      this._suppressClick = true;
      setTimeout(() => { this._suppressClick = false; }, 0);

      if (event.type === 'pointerup') {
        this._onDrop!(entry.tool, event.clientX, event.clientY);
      }
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  private _render(): void {
    this._list.innerHTML = '';
    this._armed = null;

    for (const group of this._groups) {
      this._renderGroup(
        group.libelle || group.id,
        (group.outils || []).map((outil) => ({
          tool: { kind: 'host', cle: outil.cle } as ArmedTool,
          libelle: outil.libelle,
          icone: outil.icone
        })));
    }

    // view tools, provided by the component itself
    this._renderGroup('Vue', [
      { tool: { kind: 'note' }, libelle: 'Note', icone: undefined },
      { tool: { kind: 'cadre' }, libelle: 'Cadre de regroupement', icone: undefined }
    ]);
  }

  private _renderGroup(
      libelle: string,
      entries: { tool: ArmedTool, libelle: string, icone?: string }[]
  ): void {

    const visible = entries.filter((entry) =>
      !this._filter || entry.libelle.toLowerCase().includes(this._filter));

    if (!visible.length) {
      return;
    }

    const section = document.createElement('div');
    section.className = 'ua-toolbox-groupe';

    const title = document.createElement('div');
    title.className = 'ua-toolbox-groupe-titre';
    title.textContent = libelle;
    section.appendChild(title);

    for (const entry of visible) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ua-outil';
      button.title = entry.libelle;

      if (entry.tool.cle) {
        button.dataset.cle = entry.tool.cle;
      }
      button.dataset.kind = entry.tool.kind;

      const icon = document.createElement('span');
      icon.className = 'ua-outil-icone';

      if (entry.icone) {
        if (entry.icone.trim().startsWith('<svg')) {
          icon.innerHTML = entry.icone;
        } else {
          const img = document.createElement('img');
          img.src = entry.icone;
          img.alt = '';
          icon.appendChild(img);
        }
      }

      const label = document.createElement('span');
      label.className = 'ua-outil-libelle';
      label.textContent = entry.libelle;

      button.appendChild(icon);
      button.appendChild(label);

      button.addEventListener('click', () => {
        if (this._suppressClick) {
          this._suppressClick = false;
          return;
        }
        this._arm(button, entry.tool, entry.libelle);
      });

      if (this._onDrop) {
        button.addEventListener('pointerdown', (event) => {
          if (event.button === 0) {
            this._beginDrag(button, entry, event);
          }
        });
      }

      section.appendChild(button);
    }

    this._list.appendChild(section);
  }
}
