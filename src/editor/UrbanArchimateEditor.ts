/* eslint-disable @typescript-eslint/no-explicit-any */
import Modeler from '../../lib/Modeler.js';
import NavigatedViewer from '../../lib/NavigatedViewer.js';

import PaletteModule from '../../lib/features/palette/index.js';
import CanvasCreateModule from '../../lib/features/canvas-create/index.js';
import ArchimateContextPadModule from '../../lib/features/context-pad/index.js';
import CopyPasteModule from '../../lib/features/copy-paste/index.js';
import ReplacePreviewModule from '../../lib/features/replace-preview/index.js';

import EditingModule from './editing-module.ts';
import ImportCropModule from './import-crop-module.ts';

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
import { applyRules } from '../rules/engine.ts';
import { exportExchange } from '../exchange/export.ts';

import {
  deriveModel,
  deriveViews,
  snapshotOf,
  type LoadSnapshot
} from './derive-model.ts';

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
import { PropertyGrid } from '../property-grid/PropertyGrid.ts';
import { ViewTabs } from '../view-tabs/ViewTabs.ts';

import { archimateIdOf, schemasOf } from '../rules/engine.ts';

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
  private _snapshot: LoadSnapshot | null = null;
  private _currentVue: ModelView | null = null;
  private _newRelationships: CartographyObject[] = [];

  private _listeners = new Map<string, Set<Listener>>();
  private _importing = false;

  private _toolbox: Toolbox | null = null;
  private _grid: PropertyGrid | null = null;
  private _viewTabs: ViewTabs | null = null;
  private _canvasHost: HTMLElement;
  private _resizeObserver: ResizeObserver | null = null;
  private _armedTool: ArmedTool | null = null;
  private _onEscape: ((event: KeyboardEvent) => void) | null = null;
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
    this._canvasHost.style.minHeight = '0';

    root.style.display = 'flex';

    // middle column: view tabs above the canvas
    const middle = document.createElement('div');
    middle.className = 'ua-colonne-centrale';
    middle.style.flex = '1 1 auto';
    middle.style.display = 'flex';
    middle.style.flexDirection = 'column';
    middle.style.minWidth = '0';
    middle.style.height = '100%';

    if (!this._readOnly) {
      const toolboxHost = document.createElement('div');
      toolboxHost.style.flex = '0 0 auto';
      root.appendChild(toolboxHost);

      // collapsed toolbox: a floating icon at the top left of the
      // drawing brings the panel back
      const reopen = document.createElement('button');
      reopen.type = 'button';
      reopen.className = 'ua-toolbox-rouvrir';
      reopen.title = 'Afficher la boîte à outils';
      reopen.innerHTML =
        '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/>' +
        '<line x1="6" y1="2.5" x2="6" y2="13.5"/></svg>';
      reopen.addEventListener('click', () => {
        this._toolbox?.setCollapsed(false);
      });
      this._canvasHost.appendChild(reopen);

      this._toolbox = new Toolbox({
        container: toolboxHost,
        onArm: (tool) => {
          this._armedTool = tool;
          this._canvasHost.style.cursor = tool ? 'crosshair' : '';
        },
        onCollapse: (repliee) => {
          reopen.classList.toggle('ua-toolbox-rouvrir-visible', repliee);
        },
        onDrop: (tool, clientX, clientY) => {
          const rect = this._canvasHost.getBoundingClientRect();

          if (clientX >= rect.left && clientX <= rect.right &&
              clientY >= rect.top && clientY <= rect.bottom) {
            this._placeTool(tool, { clientX, clientY });
          }
        }
      });

      this._canvasHost.addEventListener('click', (event) => {
        this._onCanvasClick(event);
      });

      // Échap désarme l'outil en attente de pose
      this._onEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && this._armedTool) {
          this._toolbox?.disarm();
          this._armedTool = null;
          this._canvasHost.style.cursor = '';
        }
      };
      window.addEventListener('keydown', this._onEscape);
    }

    root.appendChild(middle);

    this._viewTabs = new ViewTabs({
      container: middle,
      onSelect: (vueId) => {
        this.setCurrentVue(vueId).catch((error) =>
          this._toolbox?.showError(String(error.message || error)));
      },
      onAdd: (nom, pointDeVue) => {
        if (!this._readOnly) {
          this.addVue(nom, pointDeVue).catch((error) =>
            this._toolbox?.showError(String(error.message || error)));
        }
      },
      onRename: (vueId, nom) => {
        if (!this._readOnly) {
          this.renameVue(vueId, nom);
        }
      },
      onDelete: (vueId) => {
        if (!this._readOnly) {
          this.deleteVue(vueId).catch((error) =>
            this._toolbox?.showError(String(error.message || error)));
        }
      }
    });

    if (this._readOnly) {
      middle.classList.add('ua-vues-lecture');
    }

    middle.appendChild(this._canvasHost);

    // property grid panel (read-only display in every mode)
    const gridHost = document.createElement('div');
    gridHost.style.flex = '0 0 auto';
    root.appendChild(gridHost);
    this._grid = new PropertyGrid(gridHost);

    // the component never creates free elements: the legacy palette,
    // double-click creation, copy-paste and the catalogue-driven
    // context pad are replaced by the host toolbox and a minimal pad
    const modeler: any = Modeler;
    const excluded = new Set<any>([
      PaletteModule,
      CanvasCreateModule,
      ArchimateContextPadModule,
      CopyPasteModule,
      ReplacePreviewModule
    ]);

    const editingModules = (modeler.prototype._modules as any[])
      .filter((module) => !excluded.has(module))
      .concat([ EditingModule, ImportCropModule ]);

    // labels drawn in the diagram follow the host theme
    // (--ua-police-diagramme); the renderer also measures text with this
    // font, so it is set at creation rather than overridden in CSS
    const textRenderer = { defaultStyle: { fontFamily: diagramFont(this._canvasHost) } };
    // same for the notation colors (blocks, layer lines, strokes, labels): resolved
    // from the --ua-notation-* tokens, they become the default style of the
    // drawn elements (the specification does not standardize colors)
    const archimateNotation = notationTokens(this._canvasHost);

    this._viewer = this._readOnly
      ? new (NavigatedViewer as any)({
        container: this._canvasHost,
        additionalModules: [ ImportCropModule ],
        textRenderer,
        archimateNotation
      })
      : new (Modeler as any)({
        container: this._canvasHost,
        modules: editingModules,
        textRenderer,
        archimateNotation
      });

    if (!this._readOnly) {
      // the connect gesture asks the host which relations are allowed
      this._viewer.get('uaConnectBehavior').setHandler(
        (source: any, target: any) => {
          this.connectNodes(source, target).catch((error: Error) => {
            this._toolbox?.showError(String(error.message || error));
          });
        });
    }

    // diagram-js caches the canvas size taken at creation, often before the
    // host layout has settled (the canvas was measured 246×372 in the demo
    // page): `fit-viewport` then zoomed for that stale size. Tell it about
    // every size change of its container.
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => {
        this._viewer.get('canvas').resized();
      });
      this._resizeObserver.observe(this._canvasHost);
    }

    const eventBus = this._viewer.get('eventBus');

    eventBus.on('selection.changed', (event: any) => {
      const selected = (event.newSelection && event.newSelection[ 0 ]) || null;

      if (!selected) {
        this._grid?.clear();
        this._emit('selection', { cle: undefined, viewElementId: undefined, kind: null });
        return;
      }

      const businessObject = selected.businessObject || {};

      this._showSelectionInGrid(businessObject.hostKey);

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
    this._snapshot = snapshotOf(model);
    this._currentVue = (model.vues && model.vues[ 0 ]) || null;
    this._newRelationships = [];

    this._updateViewTabs();
    await this._refreshToolbox();

    this._emit('import.done', { warnings });

    return { warnings };
  }

  /** The view currently displayed. */
  get currentVue(): ModelView | null {
    return this._currentVue;
  }

  private _updateViewTabs(): void {
    this._viewTabs?.update(
      (this._hydrated && this._hydrated.vues) || [],
      this._currentVue ? this._currentVue.id : null);
  }

  /** Switches to another view of the model. */
  async setCurrentVue(vueId: string): Promise<void> {
    if (!this._hydrated || !this._built) {
      throw new Error('aucun modèle chargé');
    }

    const vue = (this._hydrated.vues || []).find((v) => v.id === vueId);
    const view = this._built.viewsByVueId.get(vueId);

    if (!vue || !view) {
      throw new Error(`vue inconnue : ${ vueId }`);
    }

    this._importing = true;
    try {
      await this._viewer.openView(view);
    } finally {
      this._importing = false;
    }

    this._currentVue = vue;
    this._grid?.clear();
    this._updateViewTabs();

    // the toolbox of this view is asked to the host, with its viewpoint
    await this._refreshToolbox();

    this._emit('vue.changed', { vueId });
  }

  /** Adds a view (name, optional ArchiMate viewpoint) and opens it. */
  async addVue(nom: string, pointDeVue?: string): Promise<ModelView> {
    if (!this._hydrated || !this._built) {
      throw new Error('aucun modèle chargé');
    }

    const vues = this._hydrated.vues || (this._hydrated.vues = []);

    let base = 'VUE-' + nom
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (base === 'VUE-') {
      base = 'VUE-SANS-NOM';
    }

    let id = base;
    let suffix = 2;
    while (vues.some((v) => v.id === id)) {
      id = `${ base }-${ suffix++ }`;
    }

    const vue: ModelView = { id, nom };

    if (pointDeVue) {
      vue.point_de_vue = pointDeVue;
    }

    vues.push(vue);

    // its moddle view joins the model's diagrams
    const moddle = this._viewer._moddle;
    const view = moddle.create('archimate:View', { id: `v-${ id }`, name: nom });
    view.hostVueId = id;

    if (pointDeVue) {
      view.hostViewpoint = pointDeVue;
    }

    const diagrams = this._built.model.views.diagrams;
    diagrams.get('viewsList').push(view);
    view.$parent = diagrams;

    this._built.viewsByVueId.set(id, view);

    this._emit('changed', { scope: 'views' });

    await this.setCurrentVue(id);

    return vue;
  }

  /** Renames a view. */
  renameVue(vueId: string, nom: string): void {
    if (!this._hydrated || !this._built) {
      throw new Error('aucun modèle chargé');
    }

    const vue = (this._hydrated.vues || []).find((v) => v.id === vueId);
    const view = this._built.viewsByVueId.get(vueId);

    if (!vue || !view) {
      throw new Error(`vue inconnue : ${ vueId }`);
    }

    vue.nom = nom;
    view.name = nom;

    this._updateViewTabs();
    this._emit('changed', { scope: 'views' });
  }

  /**
   * Deletes a view: its nodes and connections disappear with it, and
   * an object that no longer appears in any view leaves the retained
   * elements at save time. Its graphics entry disappears too.
   */
  async deleteVue(vueId: string): Promise<void> {
    if (!this._hydrated || !this._built) {
      throw new Error('aucun modèle chargé');
    }

    const vues = this._hydrated.vues || [];
    const index = vues.findIndex((v) => v.id === vueId);

    if (index === -1) {
      throw new Error(`vue inconnue : ${ vueId }`);
    }

    vues.splice(index, 1);

    const view = this._built.viewsByVueId.get(vueId);
    this._built.viewsByVueId.delete(vueId);

    const viewsList = this._built.model.views.diagrams.get('viewsList');
    const viewIndex = viewsList.indexOf(view);
    if (viewIndex !== -1) {
      viewsList.splice(viewIndex, 1);
    }

    this._emit('changed', { scope: 'views' });

    if (this._currentVue && this._currentVue.id === vueId) {
      if (vues.length) {
        await this.setCurrentVue(vues[ 0 ].id);
      } else {
        this._currentVue = null;
        this._viewer.clear();
        this._grid?.clear();
        this._updateViewTabs();
        await this._refreshToolbox();
      }
    } else {
      this._updateViewTabs();
    }
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

  /** Shows the selected object, read-only, in the property grid. */
  private _showSelectionInGrid(cle: string | undefined): void {
    if (!this._grid) {
      return;
    }

    if (!cle || !this._hydrated) {
      this._grid.clear();
      return;
    }

    const document_ = (this._hydrated.documents || []).find(
      (doc) => doc.data.cle === cle);

    const objet = document_
      ? document_.data
      : this._newRelationships.find((relation) => relation.cle === cle);

    if (!objet) {
      this._grid.clear();
      return;
    }

    const schemas = schemasOf(this._hydrated);
    const schema = schemas.get(objet.type);

    const archimateType = schema
      ? schema[ 'x-archimate' ]
      : objet.type;

    this._grid.showReadOnly(objet, schema, archimateType);
  }

  /**
   * Connects two placed nodes with a NEW relation: asks the host,
   * once, which relation types are allowed between the two objects;
   * refuses the link (naming both objects) when the host returns
   * none; otherwise the relation is filled in the property grid and
   * only added once the grid is valid. It goes to the
   * `nouvellesRelations` output — the host creates the file.
   */
  async connectNodes(source: any, target: any): Promise<void> {
    if (!this._hydrated || !this._currentVue || !this._built) {
      throw new Error('aucun modèle chargé');
    }

    const registry = this._viewer.get('elementRegistry');

    const sourceShape = typeof source === 'string' ? registry.get(source) : source;
    const targetShape = typeof target === 'string' ? registry.get(target) : target;

    const cleSource = sourceShape?.businessObject?.hostKey;
    const cleCible = targetShape?.businessObject?.hostKey;

    if (!cleSource || !cleCible) {
      this._toolbox?.showError(
        'seuls des objets de l\'hôte peuvent être reliés');
      return;
    }

    if (!this._delegates.allowedRelations) {
      this._toolbox?.showError(
        'aucun délégué des relations permises n\'est fourni par l\'hôte');
      return;
    }

    const typesPermis = await this._delegates.allowedRelations(cleSource, cleCible);

    const nomSource = sourceShape.name || cleSource;
    const nomCible = targetShape.name || cleCible;

    if (!typesPermis || !typesPermis.length) {
      this._toolbox?.showError(
        `aucune relation n'est autorisée entre « ${ nomSource } » et « ${ nomCible } »`);
      return;
    }

    return new Promise((resolve) => {
      this._grid!.openNewRelation({
        cleSource,
        cleCible,
        nomSource,
        nomCible,
        typesPermis,
        onValidate: (objet) => {
          this._addNewRelation(objet, typesPermis, sourceShape, targetShape);
          resolve();
        },
        onCancel: () => resolve()
      });
    });
  }

  private _addNewRelation(
      objet: CartographyObject,
      typesPermis: { type: string, archimate: string }[],
      sourceShape: any,
      targetShape: any
  ): void {

    const allowed = typesPermis.find((type) => type.type === objet.type)!;

    const moddle = this._viewer._moddle;

    // ArchiMate translation of the drawn relation: base attributes are
    // stored with their ArchiMate values, nothing to convert
    const attributes: Record<string, string> = {};
    const proprietes = objet.proprietes || {};

    if (allowed.archimate === 'Access' && proprietes.acces) {
      attributes.accessType = String(proprietes.acces);
    }
    if (allowed.archimate === 'Influence' && proprietes.modificateur) {
      attributes.modifier = String(proprietes.modificateur);
    }
    if (allowed.archimate === 'Association' && proprietes.dirigee) {
      attributes.isDirected = String(proprietes.dirigee);
    }

    const relationship = moddle.create('archimate:Relationship', {
      id: archimateIdOf(objet.cle),
      type: allowed.archimate,
      name: objet.nom,
      source: sourceShape.businessObject.elementRef,
      target: targetShape.businessObject.elementRef,
      ...attributes
    });

    if (this._viewer._elementsById) {
      this._viewer._elementsById[ relationship.id ] = relationship;
    }

    // drawn in the view, derived as retained at save time — but NOT
    // in the documents: the host has not created the file yet
    const hostConnexionId = `C-${ objet.cle }`;

    const modeling = this._viewer.get('modeling');

    const connection = modeling.connect(sourceShape, targetShape, {
      type: allowed.archimate,
      relationshipRef: relationship
    });

    connection.businessObject.hostConnexionId = hostConnexionId;
    connection.businessObject.hostKey = objet.cle;

    relationship.name = objet.nom;
    Object.assign(relationship, attributes);

    this._newRelationships.push(objet);
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

  private _diagramPositionOf(
      event: { clientX: number, clientY: number }
  ): { x: number, y: number } {
    const canvas = this._viewer.get('canvas');
    const viewbox = canvas.viewbox();
    const rect = this._canvasHost.getBoundingClientRect();

    return {
      x: viewbox.x + (event.clientX - rect.left) / viewbox.scale,
      y: viewbox.y + (event.clientY - rect.top) / viewbox.scale
    };
  }

  private async _onCanvasClick(event: MouseEvent): Promise<void> {
    if (!this._armedTool) {
      return;
    }

    await this._placeTool(this._armedTool, event);
  }

  private async _placeTool(
      tool: ArmedTool,
      point: { clientX: number, clientY: number }
  ): Promise<void> {

    if (this._placing || !this._hydrated) {
      return;
    }

    const position = this._diagramPositionOf(point);
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
    if (!this._hydrated || !this._built || !this._snapshot) {
      throw new Error('aucun modèle chargé');
    }

    // the saved document form is derived from the live diagram, so
    // that posing, drawing, removing, undo and redo stay exact
    const derived = deriveViews(this._hydrated, this._built.viewsByVueId);

    return {
      modele: deriveModel(this._hydrated, this._snapshot, derived),
      graphique: saveGraphics(
        this._hydrated.graphique.data, this._built.viewsByVueId),

      // a drawn relation only leaves with the save while its
      // connection still exists (an undone or removed one does not)
      nouvellesRelations: this._newRelationships
        .filter((relation) => derived.placedRelationships.has(relation.cle))
        .map((relation) => ({ ...relation }))
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
    if (this._onEscape) {
      window.removeEventListener('keydown', this._onEscape);
      this._onEscape = null;
    }
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._viewer.destroy();
    this._toolbox?.destroy();
    this._grid?.destroy();
    this._viewTabs?.destroy();
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


/** Default font of the diagram labels when no theme is reachable. */
export const DIAGRAM_FONT_DEFAULT = '\'IBM Plex Sans\', system-ui, sans-serif';

/**
 * Font of the labels drawn in the diagram: the `--ua-police-diagramme`
 * token as resolved on the canvas (the host may override it), else the
 * component default.
 */
function diagramFont(element: HTMLElement): string {
  const value = element.isConnected
    ? getComputedStyle(element).getPropertyValue('--ua-police-diagramme').trim()
    : '';

  return value || DIAGRAM_FONT_DEFAULT;
}

/** Keys of the notation palette, read from `--ua-notation-<key>`. */
export const NOTATION_KEYS = [
  'strategie', 'metier', 'application', 'technologie', 'physique',
  'implementation', 'motivation', 'autre', 'element', 'note',
  'trait', 'relation', 'texte', 'fond'
] as const;

/**
 * The notation palette as set by the theme: every `--ua-notation-*` token
 * resolved on the canvas. Unset tokens are left out (the renderer falls
 * back to its defaults, identical to the component stylesheet).
 */
function notationTokens(element: HTMLElement): Record<string, string> {
  const palette: Record<string, string> = {};

  if (!element.isConnected) {
    return palette;
  }

  const computed = getComputedStyle(element);

  for (const key of NOTATION_KEYS) {
    const value = computed.getPropertyValue(`--ua-notation-${ key }`).trim();

    if (value) {
      palette[key] = value;
    }
  }

  return palette;
}

