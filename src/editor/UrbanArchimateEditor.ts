/* eslint-disable @typescript-eslint/no-explicit-any */
import Modeler from '../../lib/Modeler.js';
import NavigatedViewer from '../../lib/NavigatedViewer.js';

import type {
  CartographyObject,
  Delegates,
  HydratedModel,
  ModelIssue,
  SaveResult
} from '../contract/types.ts';

import { loadHydratedModel } from '../model/load.ts';
import { dehydrateModel, cleanHydratedModel } from '../model/dehydrate.ts';
import { applyRules } from '../rules/engine.ts';
import { exportExchange } from '../exchange/export.ts';

import { buildModdleModel, type BuiltModel } from './build-moddle.ts';
import { saveGraphics } from './save-graphics.ts';

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
  private _newRelationships: CartographyObject[] = [];

  private _listeners = new Map<string, Set<Listener>>();
  private _importing = false;

  constructor(options: EditorOptions) {
    this._readOnly = !!options.readOnly;
    this._delegates = options.delegates || {};

    this._viewer = this._readOnly
      ? new (NavigatedViewer as any)({ container: options.container })
      : new (Modeler as any)({ container: options.container });

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
    this._newRelationships = [];

    this._emit('import.done', { warnings });

    return { warnings };
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
