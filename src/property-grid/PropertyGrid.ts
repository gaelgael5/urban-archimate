import type {
  AllowedRelationType,
  CartographyObject,
  TypeSchema
} from '../contract/types.ts';

import { OBJECT_KEY_PATTERN } from '../contract/types.ts';

import {
  archimateAttributesOf,
  archimateValueLabel
} from './archimate-attributes.ts';

export interface NewRelationRequest {

  /** Keys of the two objects being connected. */
  cleSource: string;
  cleCible: string;

  /** Display names of the two objects (for the panel title). */
  nomSource?: string;
  nomCible?: string;

  /** Relation types allowed by the host. */
  typesPermis: AllowedRelationType[];

  onValidate: (objet: CartographyObject) => void;
  onCancel: () => void;
}

interface SchemaProperty {
  nom: string;
  schema: Record<string, unknown>;
  requis: boolean;
}

/**
 * Generic property grid, driven by the JSON Schema of the type
 * provided by the host and by the ArchiMate attributes of the type.
 *
 * - a NEW relation is filled in the grid (key, name, ArchiMate
 *   attributes, added properties) and only added once valid;
 * - an EXISTING object or relation shows its values read-only: they
 *   are modified in the host, not in the diagram.
 */
export interface PropertyGridOptions {

  /** Called when the panel is collapsed (true) or reopened (false). */
  onCollapse?: (repliee: boolean) => void;
}

export class PropertyGrid {

  private _container: HTMLElement;
  private _body: HTMLElement;
  private _onCollapse: PropertyGridOptions['onCollapse'];

  constructor(container: HTMLElement, options: PropertyGridOptions = {}) {
    this._container = container;
    this._onCollapse = options.onCollapse;
    this._container.classList.add('ua-grille');

    const header = document.createElement('div');
    header.className = 'ua-grille-entete';

    const title = document.createElement('div');
    title.className = 'ua-grille-titre';
    title.textContent = 'Propriétés';
    header.appendChild(title);

    const collapse = document.createElement('button');
    collapse.type = 'button';
    collapse.className = 'ua-grille-replier';
    collapse.title = 'Masquer le panneau des propriétés';
    collapse.textContent = '›';
    collapse.addEventListener('click', () => this.setCollapsed(true));
    header.appendChild(collapse);

    this._container.appendChild(header);

    this._body = document.createElement('div');
    this._body.className = 'ua-grille-corps';
    this._container.appendChild(this._body);

    this.clear();
  }

  /** Collapses the panel entirely, or brings it back. */
  setCollapsed(repliee: boolean): void {
    this._container.classList.toggle('ua-grille-repliee', repliee);
    this._onCollapse?.(repliee);
  }

  /** Whether the panel is currently collapsed. */
  isCollapsed(): boolean {
    return this._container.classList.contains('ua-grille-repliee');
  }

  clear(): void {
    this._body.innerHTML = '';

    const empty = document.createElement('div');
    empty.className = 'ua-grille-vide';
    empty.textContent = 'Aucune sélection.';
    this._body.appendChild(empty);
  }

  destroy(): void {
    this._container.classList.remove('ua-grille', 'ua-grille-repliee');
    this._container.innerHTML = '';
  }

  /** Shows an existing object or relation, read-only. */
  showReadOnly(
      objet: CartographyObject,
      schema: TypeSchema | undefined,
      archimateType: string | undefined
  ): void {

    this._body.innerHTML = '';

    const rows = document.createElement('dl');
    rows.className = 'ua-grille-lignes ua-grille-lecture';

    const addRow = (libelle: string, valeur: unknown) => {
      if (valeur === undefined || valeur === null || valeur === '') {
        return;
      }

      const dt = document.createElement('dt');
      dt.textContent = libelle;
      const dd = document.createElement('dd');
      dd.textContent = String(valeur);
      rows.appendChild(dt);
      rows.appendChild(dd);
    };

    addRow('Clé', objet.cle);
    addRow('Type', (schema && schema.title) || objet.type);
    addRow('Nom', objet.nom);

    if (objet.source) {
      addRow('Source', objet.source);
      addRow('Cible', objet.cible);
    }

    for (const [ nom, valeur ] of Object.entries(objet.proprietes || {})) {
      const label = archimateType &&
        archimateValueLabel(archimateType, nom, valeur);

      addRow(propertyTitle(schema, nom), label || valeur);
    }

    addRow('Documentation', objet.documentation);

    this._body.appendChild(rows);
  }

  /**
   * Opens the form of a new relation. The relation is only added
   * once the grid is valid: key well formed, required properties
   * filled. Empty optional values are not sent.
   */
  openNewRelation(request: NewRelationRequest): void {
    this._body.innerHTML = '';

    const form = document.createElement('form');
    form.className = 'ua-grille-formulaire';
    form.noValidate = true;

    const intro = document.createElement('div');
    intro.className = 'ua-grille-intro';
    intro.textContent =
      `Nouvelle relation : ${ request.nomSource || request.cleSource } → ${
        request.nomCible || request.cleCible }`;
    form.appendChild(intro);

    // --- relation type -----------------------------------------------------

    const typeSelect = document.createElement('select');
    typeSelect.className = 'ua-grille-champ';
    typeSelect.name = 'type';

    for (const type of request.typesPermis) {
      const option = document.createElement('option');
      option.value = type.type;
      option.textContent = type.libelle || type.type;
      typeSelect.appendChild(option);
    }

    form.appendChild(field('Type de relation', typeSelect));

    // --- key and name ------------------------------------------------------

    const cleInput = document.createElement('input');
    cleInput.className = 'ua-grille-champ';
    cleInput.name = 'cle';
    cleInput.placeholder = 'REL-MA-RELATION';
    form.appendChild(field('Clé', cleInput, true));

    const nomInput = document.createElement('input');
    nomInput.className = 'ua-grille-champ';
    nomInput.name = 'nom';
    form.appendChild(field('Nom', nomInput));

    // --- type-dependent part -------------------------------------------------

    const dynamic = document.createElement('div');
    form.appendChild(dynamic);

    // --- buttons -----------------------------------------------------------

    const buttons = document.createElement('div');
    buttons.className = 'ua-grille-boutons';

    const validate = document.createElement('button');
    validate.type = 'submit';
    validate.textContent = 'Valider';
    validate.className = 'ua-bouton-valider';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Annuler';
    cancel.className = 'ua-bouton-annuler';

    buttons.appendChild(validate);
    buttons.appendChild(cancel);
    form.appendChild(buttons);

    const selectedType = () =>
      request.typesPermis.find((t) => t.type === typeSelect.value) ||
      request.typesPermis[ 0 ];

    const renderDynamic = () => {
      dynamic.innerHTML = '';

      const type = selectedType();

      for (const spec of archimateAttributesOf(type.archimate)) {
        if (spec.kind === 'enum') {
          const select = document.createElement('select');
          select.className = 'ua-grille-champ';
          select.dataset.archimate = spec.propriete;

          for (const option of spec.options || []) {
            const element = document.createElement('option');
            element.value = option.valeur;
            element.textContent = option.libelle;
            select.appendChild(element);
          }

          dynamic.appendChild(field(spec.libelle, select));
        } else if (spec.kind === 'boolean') {
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.dataset.archimate = spec.propriete;
          dynamic.appendChild(field(spec.libelle, checkbox));
        } else {
          const input = document.createElement('input');
          input.className = 'ua-grille-champ';
          input.dataset.archimate = spec.propriete;
          dynamic.appendChild(field(spec.libelle, input));
        }
      }

      for (const property of schemaProperties(type.schema)) {
        dynamic.appendChild(schemaField(property));
      }

      updateValidity();
    };

    const updateValidity = () => {
      let valid = OBJECT_KEY_PATTERN.test(cleInput.value);

      for (const element of dynamic.querySelectorAll('[data-requis="1"]')) {
        const input = element as HTMLInputElement;
        if (!input.value) {
          valid = false;
        }
      }

      validate.disabled = !valid;
    };

    typeSelect.addEventListener('change', renderDynamic);
    form.addEventListener('input', updateValidity);

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      if (validate.disabled) {
        return;
      }

      const type = selectedType();
      const proprietes: Record<string, unknown> = {};

      for (const element of dynamic.querySelectorAll('[data-archimate]')) {
        const input = element as HTMLInputElement;
        const nom = input.dataset.archimate!;

        if (input.type === 'checkbox') {
          if (input.checked) {
            proprietes[ nom ] = 'true';
          }
        } else if (input.value !== '') {
          proprietes[ nom ] = input.value;
        }
      }

      for (const element of dynamic.querySelectorAll('[data-propriete]')) {
        const input = element as HTMLInputElement;
        const nom = input.dataset.propriete!;

        if (input.type === 'checkbox') {
          if (input.checked) {
            proprietes[ nom ] = true;
          }
        } else if (input.value !== '') {
          proprietes[ nom ] = input.type === 'number'
            ? Number(input.value)
            : input.value;
        }
      }

      const objet: CartographyObject = {
        cle: cleInput.value,
        type: type.type,
        source: request.cleSource,
        cible: request.cleCible
      };

      if (nomInput.value) {
        objet.nom = nomInput.value;
      }

      if (Object.keys(proprietes).length) {
        objet.proprietes = proprietes;
      }

      this.clear();
      request.onValidate(objet);
    });

    cancel.addEventListener('click', () => {
      this.clear();
      request.onCancel();
    });

    renderDynamic();
    updateValidity();

    this._body.appendChild(form);
    cleInput.focus();
  }
}

// helpers ---------------------------------------------------------------

function field(
    libelle: string,
    input: HTMLElement,
    requis = false
): HTMLElement {

  const wrapper = document.createElement('label');
  wrapper.className = 'ua-grille-ligne';

  const caption = document.createElement('span');
  caption.className = 'ua-grille-libelle';
  caption.textContent = requis ? `${ libelle } *` : libelle;

  wrapper.appendChild(caption);
  wrapper.appendChild(input);

  return wrapper;
}

function schemaProperties(schema: TypeSchema | undefined): SchemaProperty[] {
  if (!schema || !schema.properties) {
    return [];
  }

  const required = new Set(schema.required || []);

  return Object.entries(schema.properties).map(([ nom, definition ]) => ({
    nom,
    schema: (definition || {}) as Record<string, unknown>,
    requis: required.has(nom)
  }));
}

function schemaField(property: SchemaProperty): HTMLElement {
  const definition = property.schema;
  const title = (definition.title as string) || property.nom;

  let input: HTMLElement;

  if (Array.isArray(definition.enum)) {
    const select = document.createElement('select');
    select.className = 'ua-grille-champ';

    if (!property.requis) {
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = '—';
      select.appendChild(empty);
    }

    for (const value of definition.enum) {
      const option = document.createElement('option');
      option.value = String(value);
      option.textContent = String(value);
      select.appendChild(option);
    }

    if (property.requis) {
      // a required enum must still be chosen explicitly
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '— choisir —';
      select.prepend(placeholder);
      select.value = '';
    }

    input = select;
  } else if (definition.type === 'boolean') {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    input = checkbox;
  } else if (definition.type === 'number' || definition.type === 'integer') {
    const number = document.createElement('input');
    number.type = 'number';
    number.className = 'ua-grille-champ';
    input = number;
  } else {
    const text = document.createElement('input');
    text.className = 'ua-grille-champ';
    input = text;
  }

  input.dataset!.propriete = property.nom;

  if (property.requis && definition.type !== 'boolean') {
    (input as HTMLInputElement).dataset.requis = '1';
  }

  return field(title, input, property.requis);
}

function propertyTitle(schema: TypeSchema | undefined, nom: string): string {
  const properties = schema && schema.properties;
  const definition = properties &&
    (properties as Record<string, { title?: string }>)[ nom ];

  return (definition && definition.title) || nom;
}
