import type { Tool, ToolGroup } from '../contract/types.ts';

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

  private _groups: ToolGroup[] = [];
  private _filter = '';
  private _armed: { element: HTMLElement, tool: ArmedTool } | null = null;

  private _list: HTMLElement;
  private _status: HTMLElement;

  constructor(options: ToolboxOptions) {
    this._container = options.container;
    this._onArm = options.onArm;

    this._container.classList.add('ua-toolbox');

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

  /** Clears the armed tool (after a placement or an escape). */
  disarm(): void {
    if (this._armed) {
      this._armed.element.classList.remove('ua-outil-arme');
      this._armed = null;
    }
  }

  destroy(): void {
    this._container.classList.remove('ua-toolbox');
    this._container.innerHTML = '';
  }

  private _arm(element: HTMLElement, tool: ArmedTool): void {
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
    this._onArm(tool);
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

      button.addEventListener('click', () => this._arm(button, entry.tool));

      section.appendChild(button);
    }

    this._list.appendChild(section);
  }
}
