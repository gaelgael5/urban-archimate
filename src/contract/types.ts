/**
 * Public contract of the urban-archimate component.
 *
 * The component receives a HYDRATED model: the model document in which
 * every reference (rules, graphics, type schemas, object documents)
 * carries its content under `data`. The host reads and writes the
 * files and stays the only source of objects, types, translation rules
 * and relationship rules. The component never touches the disk.
 *
 * The YAML structures and their French key names are shared with
 * Ossie-studio (ticket "Format du modèle, du fichier de règles et du
 * fichier graphique"). The API names (methods, events, delegates) are
 * shared with urban-bpmn.
 */

// ---------------------------------------------------------------------------
// Keys and references
// ---------------------------------------------------------------------------

/**
 * Functional key of an object or relation: uppercase letters, digits
 * and dashes, unique in the host space (e.g. `APP-BOUTIQUE`).
 */
export type ObjectKey = string;

/** Pattern every {@link ObjectKey} must match. */
export const OBJECT_KEY_PATTERN = /^[A-Z0-9][A-Z0-9-]*$/;

/**
 * A reference hydrated by the host: the path of the file in the host
 * space, plus its parsed content under `data`.
 */
export interface HydratedRef<T> {

  /** Path of the file in the host space (identification only). */
  chemin: string;

  /** Parsed content of the file. */
  data: T;
}

// ---------------------------------------------------------------------------
// Objects and types (host space)
// ---------------------------------------------------------------------------

/**
 * An object of the host space (one document = one object). Relations
 * are objects too, with `source` and `cible` in addition.
 */
export interface CartographyObject {

  /** Functional key, unique in the host space. */
  cle: ObjectKey;

  /** Slug of a host space type (its schema gives the ArchiMate type). */
  type: string;

  /** Display name. */
  nom?: string;

  /** Markdown documentation. */
  documentation?: string;

  /** Source key (relations only). */
  source?: ObjectKey;

  /** Target key (relations only). A relation may target a relation. */
  cible?: ObjectKey;

  /** Added properties, validated by the schema of the type. */
  proprietes?: Record<string, unknown>;
}

/**
 * Schema of a host space type: a JSON Schema (2020-12) document with
 * the ArchiMate type it is based on under `x-archimate`.
 */
export interface TypeSchema {

  /** Display name of the type. */
  title?: string;

  /** ArchiMate type the host type is based on (e.g. `BusinessProcess`). */
  'x-archimate': string;

  /** Added properties only (JSON Schema property definitions). */
  properties?: Record<string, unknown>;

  /** Required property names. */
  required?: string[];

  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Rules file
// ---------------------------------------------------------------------------

/**
 * A value path into the object (e.g. `$.nom`, `$.proprietes.acces`).
 */
export type ValuePath = string;

/** An ArchiMate property mapping inside a rule block. */
export interface RuleProperty {
  propertyDefinitionRef: string;
  value: ValuePath;
}

/**
 * One translation block: how an object of `type` becomes an ArchiMate
 * element or relationship. Besides `name` / `documentation` /
 * `properties`, a block may set ArchiMate attributes (`accessType`,
 * `isDirected`, `modifier`, ...) whose values are value paths or
 * literals already in ArchiMate form.
 */
export interface RuleBlock {

  /** Host space type slug, or an ArchiMate type as fallback match. */
  type?: string;

  name?: ValuePath;
  documentation?: ValuePath;
  properties?: RuleProperty[];

  [archimateAttribute: string]: unknown;
}

/** The rules file: how host objects become ArchiMate concepts. */
export interface RulesFile {

  /** Language of the produced model (`xml:lang`). */
  lang?: string;

  /** Fallback block, provided by the host like the others. */
  defaut?: RuleBlock;

  elements?: RuleBlock[];
  relationships?: RuleBlock[];
}

// ---------------------------------------------------------------------------
// Model document
// ---------------------------------------------------------------------------

/** A node of a view: places an object, a note or a group frame. */
export interface ViewNode {

  /** Node id, distinct from the object key (an object may appear twice). */
  id: string;

  /** Key of the object placed by this node. */
  element?: ObjectKey;

  /** Text of a note (view-only element). */
  note?: string;

  /** Label of a group frame (view-only element). */
  cadre?: string;

  /** Nested nodes. */
  enfants?: ViewNode[];
}

/** A connection of a view: places a relation between two nodes. */
export interface ViewConnection {

  /** Connection id. */
  id: string;

  /** Key of the relation placed by this connection. */
  relationship: ObjectKey;

  /** Source node id. */
  de: string;

  /** Target node id. */
  vers: string;
}

/** A view of the model. */
export interface ModelView {
  id: string;
  nom?: string;

  /** Optional ArchiMate viewpoint. */
  point_de_vue?: string;

  noeuds?: ViewNode[];
  connexions?: ViewConnection[];
}

/**
 * The model document as stored by the host (no `data` anywhere):
 * what {@link SaveResult.modele} returns.
 */
export interface Model {
  id: string;
  nom?: string;
  description?: string;

  /** Path of the rules file. */
  regles: string;

  /** Path of the graphics file. */
  graphique: string;

  /** Paths of the loaded object documents. */
  documents?: string[];

  /** Keys of the retained elements. */
  elements?: ObjectKey[];

  /** Keys of the retained relationships. */
  relationships?: ObjectKey[];

  vues?: ModelView[];
}

/**
 * The hydrated model the host passes to the component: same document,
 * with every reference carrying its content, plus the schemas of the
 * object types present.
 */
export interface HydratedModel {
  id: string;
  nom?: string;
  description?: string;

  regles: HydratedRef<RulesFile>;
  graphique: HydratedRef<GraphicsFile>;

  /** Schemas of the object types present in the documents. */
  types?: HydratedRef<TypeSchema>[];

  /** One document = one object. */
  documents?: HydratedRef<CartographyObject>[];

  elements?: ObjectKey[];
  relationships?: ObjectKey[];

  vues?: ModelView[];
}

// ---------------------------------------------------------------------------
// Graphics file (drawing only — never any model data)
// ---------------------------------------------------------------------------

/** Absolute or relative geometry of a node. */
export interface NodeGeometry {

  /** Absolute coordinates. */
  x?: number;
  y?: number;

  /** Id of the node this geometry is relative to. */
  relatif?: string;

  /** Offsets when `relatif` is set. */
  dx?: number;
  dy?: number;

  /** Width. */
  l?: number;

  /** Height. */
  h?: number;
}

/** Anchor side of a connection end. */
export type Anchor = 'gauche' | 'droite' | 'haut' | 'bas';

/** Geometry of a connection. */
export interface ConnectionGeometry {
  ancre_source?: Anchor;
  ancre_cible?: Anchor;

  /** Intermediate waypoints. */
  points?: { x: number, y: number }[];

  /** Position of the connection label. */
  libelle?: { position?: number, dx?: number, dy?: number };
}

/** Graphics of one view. */
export interface ViewGraphics {
  noeuds?: Record<string, NodeGeometry>;
  connexions?: Record<string, ConnectionGeometry>;
}

/** The graphics file: one entry per view of the model. */
export interface GraphicsFile {
  vues?: Record<string, ViewGraphics>;
}

// ---------------------------------------------------------------------------
// Delegates (functions provided by the host)
// ---------------------------------------------------------------------------

/** One tool of the toolbox. */
export interface Tool {

  /** Key passed back to the drop delegate. */
  cle: string;

  libelle: string;

  /** Icon provided by the host: an URL or inline SVG markup. */
  icone?: string;
}

/** A group of tools. */
export interface ToolGroup {
  id: string;
  libelle?: string;
  outils: Tool[];
}

/** Context passed to the toolbox delegate. */
export interface ToolboxContext {

  /** Viewpoint of the current view, if any. */
  pointDeVue?: string;

  /** Id of the current view. */
  vueId?: string;
}

/** What the host returns when a tool is dropped. */
export interface DropResult {

  /** The object (path + data). */
  objet: HydratedRef<CartographyObject>;

  /** Schema of its type, if not already known to the component. */
  schemaType?: HydratedRef<TypeSchema>;

  /** Rule block for this type, if not already known to the component. */
  regles?: RuleBlock;
}

/** One relation type allowed between two objects. */
export interface AllowedRelationType {

  /** Host space relation type slug. */
  type: string;

  /** ArchiMate relationship type it is based on. */
  archimate: string;

  /** Display name. */
  libelle?: string;

  /** Schema of the relation type (drives the property grid). */
  schema?: TypeSchema;
}

/**
 * The delegates the host provides. The component never invents what a
 * delegate should have answered: a missing delegate disables the
 * corresponding interaction.
 */
export interface Delegates {

  /** Content of the toolbox for the current view. */
  toolbox?: (context: ToolboxContext) => Promise<ToolGroup[]> | ToolGroup[];

  /** Called once, with the tool key, when a tool is dropped. */
  drop?: (cle: string) => Promise<DropResult> | DropResult;

  /**
   * Called once, with the two object keys, before two nodes are
   * connected; returns the allowed relation types.
   */
  allowedRelations?: (
    cleSource: ObjectKey,
    cleCible: ObjectKey
  ) => Promise<AllowedRelationType[]> | AllowedRelationType[];
}

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

/** What the save method returns; the host writes the files. */
export interface SaveResult {

  /** The model without any `data`, ready to write. */
  modele: Model;

  /** The graphics file content. */
  graphique: GraphicsFile;

  /**
   * Relations drawn on the diagram that do not exist in the host space
   * yet (full object data); the host creates the files. They stay out
   * of `modele.documents` until the host hydrates them back.
   */
  nouvellesRelations: CartographyObject[];
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/** Emitted on every modification (for the host "modified" indicator). */
export interface ChangedEvent {

  /** What changed: 'model' | 'graphics' | 'views'. */
  scope: string;
}

/** Emitted when an element or connection is selected. */
export interface SelectionEvent {

  /** Key of the selected object, if the selection maps to one. */
  cle?: ObjectKey;

  /** Node or connection id in the view. */
  viewElementId?: string;

  /** 'node' | 'connection' | 'note' | 'cadre' | null (cleared). */
  kind?: string | null;
}

/** Event names used by the component. */
export type EventName = 'changed' | 'selection' | 'import.done';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** A model refused at load carries the offending element's name. */
export interface ModelIssue {

  /** Machine-readable code, e.g. 'cle-retenue-sans-document'. */
  code: string;

  /** Human message naming the offending element. */
  message: string;

  /** Key, node id or path of the offending element. */
  element?: string;
}
