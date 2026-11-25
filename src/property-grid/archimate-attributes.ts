/**
 * Base ArchiMate attributes per relationship type: how they are
 * stored in the host object (`proprietes.<nom>`), with ArchiMate
 * values and their French display labels. Shared convention with
 * Ossie-studio ("les attributs propres à ArchiMate sont stockés avec
 * les valeurs ArchiMate, l'écran affichant les libellés français").
 */

export interface ArchimateAttributeSpec {

  /** Property name in the host object (`proprietes.<propriete>`). */
  propriete: string;

  /** Display label. */
  libelle: string;

  /** 'enum' | 'text' | 'boolean'. */
  kind: string;

  /** For enums: ArchiMate value -> French label ('' = unspecified). */
  options?: { valeur: string, libelle: string }[];
}

const ACCESS: ArchimateAttributeSpec = {
  propriete: 'acces',
  libelle: 'Sens de l\'accès',
  kind: 'enum',
  options: [
    { valeur: '', libelle: 'non précisé' },
    { valeur: 'Read', libelle: 'lecture' },
    { valeur: 'Write', libelle: 'écriture' },
    { valeur: 'ReadWrite', libelle: 'lecture-écriture' }
  ]
};

const INFLUENCE: ArchimateAttributeSpec = {
  propriete: 'modificateur',
  libelle: 'Modificateur',
  kind: 'text'
};

const ASSOCIATION: ArchimateAttributeSpec = {
  propriete: 'dirigee',
  libelle: 'Dirigée',
  kind: 'boolean'
};

/** Attributes per concrete ArchiMate relationship type. */
export function archimateAttributesOf(archimateType: string): ArchimateAttributeSpec[] {
  switch (archimateType) {
    case 'Access':
      return [ ACCESS ];
    case 'Influence':
      return [ INFLUENCE ];
    case 'Association':
      return [ ASSOCIATION ];
    default:
      return [];
  }
}

/** French label of a stored ArchiMate value, for read-only display. */
export function archimateValueLabel(
    archimateType: string,
    propriete: string,
    valeur: unknown
): string | undefined {

  for (const spec of archimateAttributesOf(archimateType)) {
    if (spec.propriete !== propriete || !spec.options) {
      continue;
    }

    const option = spec.options.find((o) => o.valeur === String(valeur));

    if (option) {
      return option.libelle;
    }
  }

  return undefined;
}
