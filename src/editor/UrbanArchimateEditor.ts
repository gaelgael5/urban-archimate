/* eslint-disable @typescript-eslint/no-explicit-any */
import Modeler from '../../lib/Modeler.js';
import NavigatedViewer from '../../lib/NavigatedViewer.js';

import PaletteModule from '../../lib/features/palette/index.js';
import CanvasCreateModule from '../../lib/features/canvas-create/index.js';

import type {
  CartographyObject,
  Delegates,
  HydratedModel,
  ModelIssue,
  ModelView,
  SaveResult,
  ToolGroup
} from '../contract/types.ts';

import { loadHydratedModel } from '../model/load.ts';
import { dehydrateModel, cleanHydratedModel } from '../model/dehydrate.ts';
import { applyRules } from '../rules/engine.ts';
import { exportExchange } from '../exchange/export.ts';

import { buildModdleModel, type BuiltModel } from './build-moddle.ts';
import { saveGraphics } from './save-graphics.ts';

import {
  absorbDropResult,
  findNodeOfKey,
  placeElement,
  placeExistingRelation,
  placeFrame,
  placeNote,
  PlacementError,
  type PlacementContext
} from './placement.ts';

import { Toolbox, type ArmedTool } from '../toolbox/Toolbox.ts';

export interface EditorOptions {

  /** DOM element the diagram is rendered into. */
  container: HTMLElement;

  /** Functions provided by the host (toolbox, drop, allowedRelations). */
  delegates?: Delegates;

  /**
   * Read-only mode: the diagram can be explored (zoom, pan,
   * selection) but not modified, and no modification event is emitted.
   */
  readOnly?: boolean;
}

type Listener = (payload: unknown) => void;

/**
 * The component facade: loads a hydrated model, renders it through
 * the diagram engine, reports selections and modifications, and
 * returns the saved form (model without data, graphics file, new
 * relationships).
 */
export class UrbanArchimateEditor {

  private _viewer: any;
  private _delegates: Delegates;
  private _readOnly: boolean;

  private _hydrated: HydratedModel | null = null;
  private _built: BuiltModel | null = null;
  private _currentVue: ModelView | null = null;
  private _newRelationships: CartographyObject[] = [];

  private _listeners = new Map<string, Set<Listener>>();
  private _importing = false;

  private _toolbox: Toolbox | null = null;
  private _canvasHost: HTMLElement;
  private _armedTool: ArmedTool | null = null;
  private _placing = false;

  constructor(options: EditorOptions) {
    this._readOnly = !!options.readOnly;
    this._delegates = options.delegates || {};

    // layout: [ toolbox | canvas ] inside the host container
    const root = options.container;
    root.classList.add('ua-editeur');

    this._canvasHost = document.createElement('div');
    this._canvasHost.className = 'ua-canvas';
    this._canvasHost.style.flex = '1 1 auto';
    this._canvasHost.style.height = '100%';

    if (!this._readOnly) {
      root.style.display = 'flex';

      const toolboxHost = document.createElement('div');
      toolboxHost.style.flex = '0 0 auto';
      root.appendChild(toolboxHost);
      root.appendChild(this._canvasHost);

      this._toolbox = new Toolbox({
        container: toolboxHost,
        onArm: (tool) => {
          this._armedTool = tool;
          this._canvasHost.style.cursor = tool ? 'crosshair' : '';
        }
      });

      this._canvasHost.addEventListener('click', (event) => {
        this._onCanvasClick(event);
      });
    } else {
      root.appendChild(this._canvasHost);
    }

    // the component never creates free elements: the legacy palette
    // and double-click creation are replaced by the host toolbox
    const modeler: any = Modeler;
    const editingModules = (modeler.prototype._modules as any[]).filter(
      (module) => module !== PaletteModule && module !== CanvasCreateModule);

    this._viewer = this._readOnly
      ? new (NavigatedViewer as any)({ container: this._canvasHost })
      : new (Modeler as any)({
        container: this._canvasHost,
        modules: editingModules
      });

    const eventBus = this._viewer.get('eventBus');

    eventBus.on('selection.changed', (event: any) => {
      const selected = (event.newSelection && event.newSelection[ 0 ]) || null;

      if (!selected) {
        this._emit('selection', { cle: undefined, viewElementId: undefined, kind: null });
        return;
      }

      const businessObject = selected.businessObject || {};

      this._emit('selection', {
        cle: businessObject.hostKey,
        viewElementId: businessObject.hostNodeId || businessObject.hostConnexionId,
        kind: businessObject.hostConnexionId
          ? 'connection'
          : (businessObject.type === 'Label'
            ? 'note'
            : (businessObject.type === 'Container' ? 'cadre' : 'node'))
      });
    });

    if (!this._readOnly) {
      eventBus.on('commandStack.changed', () => {
        if (!this._importing) {
          this._emit('changed', { scope: 'graphics' });
        }
      });
    }
  }

  /** The host delegates. */
  get delegates(): Delegates {
    return this._delegates;
  }

  set delegates(delegates: Delegates) {
    this._delegates = delegates || {};
  }

  get readOnly(): boolean {
    return this._readOnly;
  }

  /** The underlying diagram-js viewer/modeler (service access). */
  getDiagram(): any {
    return this._viewer;
  }

  /**
   * Loads a hydrated model (YAML text or object), applies the rules
   * and renders the first view. Returns the load warnings.
   */
  async load(input: string | HydratedModel): Promise<{ warnings: ModelIssue[] }> {
    const { model, warnings } = loadHydratedModel(input);

    const ir = applyRules(model);

    const moddle = this._viewer._moddle;

    const built = buildModdleModel(moddle, model, ir);

    this._importing = true;
    try {
      await this._viewer.importModel(built.model, undefined, built.elementsById);

      if (typeof this._viewer._collectIds === 'function') {
        this._viewer._collectIds(built.model, { elementsById: built.elementsById });
      }
    } finally {
      this._importing = false;
    }

    this._hydrated = model;
    this._built = built;
    this._currentVue = (model.vues && model.vues[ 0 ]) || null;
    this._newRelationships = [];

    await this._refreshToolbox();

    this._emit('import.done', { warnings });

    return { warnings };
  }

  /** The view currently displayed. */
  get currentVue(): ModelView | null {
    return this._currentVue;
  }

  /**
   * Asks the host for the toolbox of the current view (the host
   * filters it by viewpoint). Without a toolbox delegate only the
   * view tools (note, frame) are offered.
   */
  private async _refreshToolbox(): Promise<void> {
    if (!this._toolbox) {
      return;
    }

    let groups: ToolGroup[] = [];

    if (this._delegates.toolbox && this._currentVue) {
      try {
        groups = await this._delegates.toolbox({
          pointDeVue: this._currentVue.point_de_vue,
          vueId: this._currentVue.id
        });
      } catch (error) {
        this._toolbox.showError(String((error as Error).message || error));
      }
    }

    this._toolbox.setGroups(groups || []);
  }

  private _placementContext(): PlacementContext {
    if (!this._hydrated || !this._built || !this._currentVue) {
      throw new Error('aucun modèle chargé');
    }

    return {
      viewer: this._viewer,
      hydrated: this._hydrated,
      vue: this._currentVue,
      view: this._built.viewsByVueId.get(this._currentVue.id)
    };
  }

  private _diagramPositionOf(event: MouseEvent): { x: number, y: number } {
    const canvas = this._viewer.get('canvas');
    const viewbox = canvas.viewbox();
    const rect = this._canvasHost.getBoundingClientRect();

    return {
      x: viewbox.x + (event.clientX - rect.left) / viewbox.scale,
      y: viewbox.y + (event.clientY - rect.top) / viewbox.scale
    };
  }

  private async _onCanvasClick(event: MouseEvent): Promise<void> {
    const tool = this._armedTool;

    if (!tool || this._placing || !this._hydrated) {
      return;
    }

    const position = this._diagramPositionOf(event);
    const context = this._placementContext();

    this._placing = true;

    try {
      if (tool.kind === 'note') {
        placeNote(context, position);
      } else if (tool.kind === 'cadre') {
        placeFrame(context, position);
      } else {
        // host tool: ask the host, once, with the key — and wait
        if (!this._delegates.drop) {
          throw new PlacementError('aucun délégué de pose n\'est fourni par l\'hôte');
        }

        this._toolbox?.setBusy(true);

        const result = await this._delegates.drop(tool.cle!);
        const objet = result.objet.data;

        if (objet.source && objet.cible) {
          // an existing relation is only placeable when both of its
          // ends are already in the view: check before touching the model
          for (const [ extremite, role ] of
            [ [ objet.source, 'source' ], [ objet.cible, 'cible' ] ] as const) {
            if (!findNodeOfKey(context.view, extremite)) {
              throw new PlacementError(
                `la relation « ${ objet.cle } » ne peut pas être posée : ` +
                `sa ${ role } « ${ extremite } » n'est pas dans la vue`);
            }
          }

          absorbDropResult(this._hydrated, result);
          placeExistingRelation(context, objet);
        } else {
          absorbDropResult(this._hydrated, result);
          placeElement(context, objet, position);
        }
      }

      this._toolbox?.setBusy(false);
      this._toolbox?.clearError();
    } catch (error) {
      // nothing was placed: show the message
      this._toolbox?.setBusy(false);
      this._toolbox?.showError(String((error as Error).message || error));
    } finally {
      this._placing = false;
      this._toolbox?.disarm();
      this._armedTool = null;
      this._canvasHost.style.cursor = '';
    }
  }

  /**
   * Returns what the host writes: the model without `data`, the
   * graphics file, and the new relationships drawn on the diagram.
   */
  save(): SaveResult {
    if (!this._hydrated || !this._built) {
      throw new Error('aucun modèle chargé');
    }

    cleanHydratedModel(this._hydrated);

    return {
      modele: dehydrateModel(this._hydrated),
      graphique: saveGraphics(
        this._hydrated.graphique.data, this._built.viewsByVueId),
      nouvellesRelations: this._newRelationships.map(
        (relation) => ({ ...relation }))
    };
  }

  /** Exports the Open Group exchange format (XSD 3.1) of the model. */
  exportExchange(): string {
    if (!this._hydrated) {
      throw new Error('aucun modèle chargé');
    }

    return exportExchange(this._hydrated);
  }

  on(event: string, listener: Listener): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }

    this._listeners.get(event)!.add(listener);
  }

  off(event: string, listener: Listener): void {
    this._listeners.get(event)?.delete(listener);
  }

  destroy(): void {
    this._viewer.destroy();
    this._toolbox?.destroy();
    this._listeners.clear();
  }

  private _emit(event: string, payload: unknown): void {
    for (const listener of this._listeners.get(event) || []) {
      try {
        listener(payload);
      } catch (error) {
        console.error(`écouteur « ${ event } » en erreur`, error);
      }
    }
  }
}
