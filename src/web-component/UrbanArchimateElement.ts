/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * `<urban-archimate>` : the component as a custom element, usable
 * without any framework and from React.
 *
 * - styles are isolated from the host page (shadow DOM);
 * - the interface theme follows the host through CSS variables
 *   (`--ua-*`), which pierce the shadow boundary; the ArchiMate
 *   notation colors stay those of the specification;
 * - same contract as the `UrbanArchimateEditor` facade: `delegates`,
 *   `loadModel`, `save`, `exportExchange`, view management, and the
 *   `changed` / `selection` / `vue-changed` / `import-done` events
 *   (CustomEvent, payload in `detail`).
 */

import diagramCss from 'diagram-js/assets/diagram-js.css?inline';
import uiCss from '../../assets/urban-archimate-ui.css?inline';

import type {
  Delegates,
  HydratedModel,
  SaveResult
} from '../contract/types.ts';

import { UrbanArchimateEditor } from '../editor/UrbanArchimateEditor.ts';

const COMPONENT_CSS = `
:host {
  display: block;
  width: 100%;
  height: 100%;
  font-family: var(--ua-police, system-ui, sans-serif);
}

.ua-racine {
  width: 100%;
  height: 100%;
}

/* minimal context pad glyphs (no embedded icon catalogue) */
.ua-pad-relier::before {
  content: '→';
  font-weight: 700;
}

.ua-pad-retirer::before {
  content: '✕';
  font-weight: 700;
}
`;

export class UrbanArchimateElement extends HTMLElement {

  static get observedAttributes(): string[] {
    return [ 'read-only' ];
  }

  private _editor: UrbanArchimateEditor | null = null;
  private _root: HTMLElement | null = null;
  private _delegates: Delegates = {};
  private _lastInput: string | HydratedModel | null = null;

  connectedCallback(): void {
    if (this.shadowRoot) {
      return;
    }

    const shadow = this.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = [ diagramCss, uiCss, COMPONENT_CSS ].join('\n');
    shadow.appendChild(style);

    this._root = document.createElement('div');
    this._root.className = 'ua-racine';
    shadow.appendChild(this._root);

    this._createEditor();
  }

  disconnectedCallback(): void {
    this._editor?.destroy();
    this._editor = null;
  }

  attributeChangedCallback(name: string): void {
    if (name === 'read-only' && this.shadowRoot && this._editor) {
      // the mode changes the editing surface: rebuild the editor
      this._createEditor();

      if (this._lastInput) {
        this.loadModel(this._lastInput).catch((error) =>
          this._dispatch('error', { message: String(error.message || error) }));
      }
    }
  }

  /** The host delegates (toolbox, drop, allowedRelations). */
  get delegates(): Delegates {
    return this._delegates;
  }

  set delegates(delegates: Delegates) {
    this._delegates = delegates || {};

    if (this._editor) {
      this._editor.delegates = this._delegates;
    }
  }

  get readOnly(): boolean {
    return this.hasAttribute('read-only');
  }

  set readOnly(value: boolean) {
    if (value) {
      this.setAttribute('read-only', '');
    } else {
      this.removeAttribute('read-only');
    }
  }

  /** The underlying editor facade. */
  get editor(): UrbanArchimateEditor | null {
    return this._editor;
  }

  /** Loads a hydrated model (YAML text or object). */
  async loadModel(input: string | HydratedModel): Promise<{ warnings: unknown[] }> {
    if (!this._editor) {
      throw new Error('composant non attaché au document');
    }

    this._lastInput = input;

    return this._editor.load(input);
  }

  /** The model without data, the graphics file, the new relations. */
  save(): SaveResult {
    if (!this._editor) {
      throw new Error('composant non attaché au document');
    }

    return this._editor.save();
  }

  /** Open Group exchange format (XSD 3.1) of the model. */
  exportExchange(): string {
    if (!this._editor) {
      throw new Error('composant non attaché au document');
    }

    return this._editor.exportExchange();
  }

  async setCurrentVue(vueId: string): Promise<void> {
    return this._editor?.setCurrentVue(vueId);
  }

  private _createEditor(): void {
    this._editor?.destroy();

    if (!this._root) {
      return;
    }

    this._root.innerHTML = '';

    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    this._root.appendChild(container);

    this._editor = new UrbanArchimateEditor({
      container,
      delegates: this._delegates,
      readOnly: this.readOnly
    });

    this._editor.on('changed', (detail) => this._dispatch('changed', detail));
    this._editor.on('selection', (detail) => this._dispatch('selection', detail));
    this._editor.on('vue.changed', (detail) => this._dispatch('vue-changed', detail));
    this._editor.on('import.done', (detail) => this._dispatch('import-done', detail));
  }

  private _dispatch(type: string, detail: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
  }
}

/** Registers `<urban-archimate>` (idempotent). */
export function register(): void {
  if (typeof customElements !== 'undefined' &&
      !customElements.get('urban-archimate')) {
    customElements.define('urban-archimate', UrbanArchimateElement);
  }
}
