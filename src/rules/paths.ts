/**
 * Value paths used by the rules file: `$.nom`, `$.proprietes.acces`, ...
 * A readable dotted path into the object — identical on the
 * Ossie-studio side.
 */

const PATH_PATTERN = /^\$(?:\.[A-Za-z0-9_-]+)+$/;

/** Is the given rule value a path into the object (vs a literal)? */
export function isValuePath(value: unknown): value is string {
  return typeof value === 'string' && PATH_PATTERN.test(value);
}

/**
 * Resolves a value path into the object. Returns `undefined` when a
 * segment is missing.
 */
export function resolveValuePath(objet: unknown, path: string): unknown {
  if (!isValuePath(path)) {
    throw new Error(`chemin de valeur invalide : « ${ path } »`);
  }

  const segments = path.slice(2).split('.');

  let current: unknown = objet;

  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[ segment ];
  }

  return current;
}

/**
 * Resolves a rule value: a path is resolved into the object, anything
 * else is kept as a literal (ArchiMate values arrive as-is, nothing is
 * converted).
 */
export function resolveRuleValue(objet: unknown, value: unknown): unknown {
  if (isValuePath(value)) {
    return resolveValuePath(objet, value);
  }

  return value;
}
