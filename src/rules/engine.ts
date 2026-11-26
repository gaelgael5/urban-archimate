import type {
  CartographyObject,
  HydratedModel,
  RuleBlock,
  RulesFile,
  TypeSchema
} from '../contract/types.ts';

import { resolveRuleValue } from './paths.ts';

/**
 * The ArchiMate model produced by the rules, in memory. Feeds both the
 * renderer (via the moddle tree) and the Open Group exchange export.
 */
export interface ArchimateModelIR {
  lang: string;
  id: string;
  name?: string;
  documentation?: string;
  elements: ArchimateConceptIR[];
  relationships: ArchimateRelationshipIR[];
  propertyDefinitions: PropertyDefinitionIR[];
}

export interface ArchimateConceptIR {

  /** ArchiMate identifier, derived from the key. */
  id: string;

  /** Functional key of the host object. */
  cle: string;

  /** Concrete ArchiMate type (e.g. `BusinessActor`, `Access`). */
  archimateType: string;

  name?: string;
  documentation?: string;

  /** propertyDefinition id -> value. */
  properties: { definition: string, value: string }[];
}

export interface ArchimateRelationshipIR extends ArchimateConceptIR {

  /** ArchiMate id of the source concept. */
  source: string;

  /** ArchiMate id of the target concept. */
  target: string;

  /** ArchiMate attributes (accessType, isDirected, modifier, ...). */
  attributes: Record<string, string>;
}

export interface PropertyDefinitionIR {
  id: string;
  name: string;

  /** Open Group DataType: string | boolean | number | date | time | currency. */
  type: string;
}

/** Thrown when an object has no applicable rule block (and no defaut). */
export class RuleResolutionError extends Error {

  cle: string;

  constructor(objet: CartographyObject) {
    super(
      `aucun bloc de règles ne s'applique à l'objet « ${ objet.cle } » ` +
      `(type « ${ objet.type } ») et aucun bloc « defaut » n'est fourni`);

    this.name = 'RuleResolutionError';
    this.cle = objet.cle;
  }
}

/** Keys of a rule block that are not ArchiMate attributes. */
const BLOCK_META_KEYS = new Set([ 'type', 'name', 'documentation', 'properties' ]);

/** ArchiMate identifier of a concept, derived from its functional key. */
export function archimateIdOf(cle: string): string {
  return `id-${ cle.toLowerCase() }`;
}

/** Identifier of a property definition. */
export function propertyDefinitionIdOf(ref: string): string {
  return `propid-${ ref }`;
}

export interface RuleIndex {
  elementsByType: Map<string, RuleBlock>;
  relationshipsByType: Map<string, RuleBlock>;
  defaut?: RuleBlock;
}

export function indexRules(rules: RulesFile): RuleIndex {
  return {
    elementsByType: new Map(
      (rules.elements || [])
        .filter((bloc) => bloc.type)
        .map((bloc) => [ bloc.type as string, bloc ])),
    relationshipsByType: new Map(
      (rules.relationships || [])
        .filter((bloc) => bloc.type)
        .map((bloc) => [ bloc.type as string, bloc ])),
    defaut: rules.defaut
  };
}

/**
 * Finds the rule block of an object: its host type first, then the
 * ArchiMate type its type is based on (`x-archimate`), then `defaut`.
 * Throws a {@link RuleResolutionError} naming the object when nothing
 * applies.
 */
export function findRuleBlock(
    objet: CartographyObject,
    isRelationship: boolean,
    index: RuleIndex,
    schemasByType: Map<string, TypeSchema>
): RuleBlock {

  const byType = isRelationship ? index.relationshipsByType : index.elementsByType;

  const direct = byType.get(objet.type);
  if (direct) {
    return direct;
  }

  const schema = schemasByType.get(objet.type);
  const archimateType = schema && schema[ 'x-archimate' ];

  if (archimateType) {
    const byArchimate = byType.get(archimateType);
    if (byArchimate) {
      return byArchimate;
    }
  }

  if (index.defaut) {
    return index.defaut;
  }

  throw new RuleResolutionError(objet);
}

/**
 * The ArchiMate type of an object: from the schema of its host type
 * (`x-archimate`), or the object's type itself when it already is an
 * ArchiMate type (a rule block may address ArchiMate types directly).
 */
export function archimateTypeOf(
    objet: CartographyObject,
    schemasByType: Map<string, TypeSchema>
): string {

  const schema = schemasByType.get(objet.type);

  if (schema && typeof schema[ 'x-archimate' ] === 'string') {
    return schema[ 'x-archimate' ];
  }

  // the host may hand objects whose type is directly an ArchiMate type
  return objet.type;
}

/** Index of type schemas by host type slug. */
export function schemasOf(model: HydratedModel): Map<string, TypeSchema> {
  const map = new Map<string, TypeSchema>();

  for (const ref of model.types || []) {
    const slug = slugOfTypePath(ref.chemin);
    map.set(slug, ref.data);
  }

  return map;
}

function slugOfTypePath(chemin: string): string {
  const base = chemin.split('/').pop() || chemin;

  return base.replace(/\.schema\.ya?ml$/, '');
}

function asString(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return String(value);
}

function translateConcept(
    objet: CartographyObject,
    bloc: RuleBlock
): Pick<ArchimateConceptIR, 'name' | 'documentation' | 'properties'> {

  const name = asString(
    bloc.name !== undefined ? resolveRuleValue(objet, bloc.name) : undefined);

  const documentation = asString(
    bloc.documentation !== undefined
      ? resolveRuleValue(objet, bloc.documentation)
      : undefined);

  const properties: { definition: string, value: string }[] = [];

  for (const propriete of bloc.properties || []) {
    const value = asString(resolveRuleValue(objet, propriete.value));

    // a property the block does not resolve to a value does not appear
    if (value !== undefined) {
      properties.push({
        definition: propriete.propertyDefinitionRef,
        value
      });
    }
  }

  return { name, documentation, properties };
}

/** DataType of a property definition, from the schema of the type. */
function dataTypeOf(
    ref: string,
    schemasByType: Map<string, TypeSchema>
): string {

  for (const schema of schemasByType.values()) {
    const properties = schema.properties as
      Record<string, { type?: string }> | undefined;

    const property = properties && properties[ ref ];

    if (property && typeof property.type === 'string') {
      switch (property.type) {
        case 'number':
        case 'integer':
          return 'number';
        case 'boolean':
          return 'boolean';
        default:
          return 'string';
      }
    }
  }

  return 'string';
}

/** Translation of a single object through its rule block. */
export interface TranslatedObject {
  archimateType: string;
  name?: string;
  documentation?: string;

  /** propertyDefinitionRef (raw) -> value. */
  properties: { definition: string, value: string }[];

  /** ArchiMate attributes (relationships only). */
  attributes: Record<string, string>;
}

/**
 * Translates one object through the rules: finds its block (host
 * type, then x-archimate, then defaut — throws naming the object when
 * nothing applies) and resolves the mapped values.
 */
export function translateObject(
    objet: CartographyObject,
    isRelationship: boolean,
    index: RuleIndex,
    schemasByType: Map<string, TypeSchema>
): TranslatedObject {

  const bloc = findRuleBlock(objet, isRelationship, index, schemasByType);
  const translated = translateConcept(objet, bloc);

  const attributes: Record<string, string> = {};

  if (isRelationship) {
    for (const [ key, raw ] of Object.entries(bloc)) {
      if (BLOCK_META_KEYS.has(key)) {
        continue;
      }

      const value = asString(resolveRuleValue(objet, raw));

      if (value !== undefined) {
        attributes[ key ] = value;
      }
    }
  }

  return {
    archimateType: archimateTypeOf(objet, schemasByType),
    name: translated.name,
    documentation: translated.documentation,
    properties: translated.properties,
    attributes
  };
}

/**
 * Applies the rules: translates every retained object of the hydrated
 * model into the ArchiMate model in memory. The component applies the
 * rules it is given, it never invents one: an object without an
 * applicable block is refused with a message naming it.
 */
export function applyRules(model: HydratedModel): ArchimateModelIR {

  const rules = model.regles.data;
  const index = indexRules(rules);
  const schemasByType = schemasOf(model);

  const objectsByKey = new Map(
    (model.documents || []).map((doc) => [ doc.data.cle, doc.data ]));

  const elements: ArchimateConceptIR[] = [];
  const relationships: ArchimateRelationshipIR[] = [];
  const usedDefinitions = new Map<string, PropertyDefinitionIR>();

  const registerProperties = (
      properties: { definition: string, value: string }[]
  ): { definition: string, value: string }[] =>
    properties.map(({ definition, value }) => {
      const id = propertyDefinitionIdOf(definition);

      if (!usedDefinitions.has(id)) {
        usedDefinitions.set(id, {
          id,
          name: definition,
          type: dataTypeOf(definition, schemasByType)
        });
      }

      return { definition: id, value };
    });

  for (const cle of model.elements || []) {
    const objet = objectsByKey.get(cle);

    if (!objet) {
      // the loader refuses such models; defensive here
      continue;
    }

    const translated = translateObject(objet, false, index, schemasByType);

    elements.push({
      id: archimateIdOf(cle),
      cle,
      archimateType: translated.archimateType,
      name: translated.name,
      documentation: translated.documentation,
      properties: registerProperties(translated.properties)
    });
  }

  for (const cle of model.relationships || []) {
    const objet = objectsByKey.get(cle);

    if (!objet || !objet.source || !objet.cible) {
      continue;
    }

    const translated = translateObject(objet, true, index, schemasByType);

    relationships.push({
      id: archimateIdOf(cle),
      cle,
      archimateType: translated.archimateType,
      name: translated.name,
      documentation: translated.documentation,
      properties: registerProperties(translated.properties),
      source: archimateIdOf(objet.source),
      target: archimateIdOf(objet.cible),
      attributes: translated.attributes
    });
  }

  return {
    lang: rules.lang || 'en',
    id: archimateIdOf(model.id),
    name: model.nom,
    documentation: model.description,
    elements,
    relationships,
    propertyDefinitions: [ ...usedDefinitions.values() ]
  };
}
