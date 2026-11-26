import type {
  GraphicsFile,
  HydratedModel,
  ModelView,
  ViewNode
} from '../contract/types.ts';

import {
  applyRules,
  archimateIdOf,
  type ArchimateModelIR
} from '../rules/engine.ts';

import { resolveViewGeometry } from '../model/geometry.ts';

const NS = 'http://www.opengroup.org/xsd/archimate/3.0/';
const NS_XSI = 'http://www.w3.org/2001/XMLSchema-instance';

/**
 * Exports the hydrated model as an Open Group ArchiMate Model Exchange
 * File (XSD 3.1): the official, tool-neutral XML format. The result is
 * what the rules produce, valid against the official schema.
 */
export function exportExchange(model: HydratedModel): string {
  const ir = applyRules(model);

  const out: string[] = [];
  const write = (line: string) => out.push(line);

  write('<?xml version="1.0" encoding="UTF-8"?>');
  write(
    `<model xmlns="${ NS }" xmlns:xsi="${ NS_XSI }" ` +
    `identifier="${ escapeAttr(ir.id) }">`);

  write(`  <name xml:lang="${ escapeAttr(ir.lang) }">${
    escapeText(ir.name || ir.id) }</name>`);

  if (ir.documentation) {
    write(`  <documentation xml:lang="${ escapeAttr(ir.lang) }">${
      escapeText(ir.documentation) }</documentation>`);
  }

  writeElements(write, ir);
  writeRelationships(write, ir);
  writePropertyDefinitions(write, ir);
  writeViews(write, ir, model);

  write('</model>');

  return out.join('\n') + '\n';
}

function writeElements(write: (line: string) => void, ir: ArchimateModelIR): void {
  if (!ir.elements.length) {
    return;
  }

  write('  <elements>');

  for (const element of ir.elements) {
    write(
      `    <element identifier="${ escapeAttr(element.id) }" ` +
      `xsi:type="${ escapeAttr(element.archimateType) }">`);

    write(`      <name xml:lang="${ escapeAttr(ir.lang) }">${
      escapeText(element.name || element.cle) }</name>`);

    if (element.documentation) {
      write(`      <documentation xml:lang="${ escapeAttr(ir.lang) }">${
        escapeText(element.documentation) }</documentation>`);
    }

    writeProperties(write, ir, element.properties, '      ');

    write('    </element>');
  }

  write('  </elements>');
}

function writeRelationships(write: (line: string) => void, ir: ArchimateModelIR): void {
  if (!ir.relationships.length) {
    return;
  }

  write('  <relationships>');

  for (const relationship of ir.relationships) {
    const attributes = Object.entries(relationship.attributes)
      .map(([ key, value ]) => ` ${ key }="${ escapeAttr(value) }"`)
      .join('');

    write(
      `    <relationship identifier="${ escapeAttr(relationship.id) }" ` +
      `source="${ escapeAttr(relationship.source) }" ` +
      `target="${ escapeAttr(relationship.target) }" ` +
      `xsi:type="${ escapeAttr(relationship.archimateType) }"${ attributes }>`);

    write(`      <name xml:lang="${ escapeAttr(ir.lang) }">${
      escapeText(relationship.name || relationship.cle) }</name>`);

    if (relationship.documentation) {
      write(`      <documentation xml:lang="${ escapeAttr(ir.lang) }">${
        escapeText(relationship.documentation) }</documentation>`);
    }

    writeProperties(write, ir, relationship.properties, '      ');

    write('    </relationship>');
  }

  write('  </relationships>');
}

function writeProperties(
    write: (line: string) => void,
    ir: ArchimateModelIR,
    properties: { definition: string, value: string }[],
    indent: string
): void {

  if (!properties.length) {
    return;
  }

  write(`${ indent }<properties>`);

  for (const property of properties) {
    write(
      `${ indent }  <property propertyDefinitionRef="${ escapeAttr(property.definition) }">`);
    write(`${ indent }    <value xml:lang="${ escapeAttr(ir.lang) }">${
      escapeText(property.value) }</value>`);
    write(`${ indent }  </property>`);
  }

  write(`${ indent }</properties>`);
}

function writePropertyDefinitions(
    write: (line: string) => void,
    ir: ArchimateModelIR
): void {

  if (!ir.propertyDefinitions.length) {
    return;
  }

  write('  <propertyDefinitions>');

  for (const definition of ir.propertyDefinitions) {
    write(
      `    <propertyDefinition identifier="${ escapeAttr(definition.id) }" ` +
      `type="${ escapeAttr(definition.type) }">`);
    write(`      <name xml:lang="${ escapeAttr(ir.lang) }">${
      escapeText(definition.name) }</name>`);
    write('    </propertyDefinition>');
  }

  write('  </propertyDefinitions>');
}

function writeViews(
    write: (line: string) => void,
    ir: ArchimateModelIR,
    model: HydratedModel
): void {

  const vues = model.vues || [];

  if (!vues.length) {
    return;
  }

  write('  <views>');
  write('    <diagrams>');

  for (const vue of vues) {
    writeView(write, ir, vue, model.graphique.data);
  }

  write('    </diagrams>');
  write('  </views>');
}

function nodeIdentifier(vue: ModelView, nodeId: string): string {
  return `id-view-${ vue.id.toLowerCase() }-${ nodeId.toLowerCase() }`;
}

function writeView(
    write: (line: string) => void,
    ir: ArchimateModelIR,
    vue: ModelView,
    graphics: GraphicsFile
): void {

  const geometry = resolveViewGeometry(vue, graphics);

  const viewpoint = vue.point_de_vue
    ? ` viewpoint="${ escapeAttr(vue.point_de_vue) }"`
    : '';

  write(
    `      <view identifier="id-view-${ escapeAttr(vue.id.toLowerCase()) }" ` +
    `xsi:type="Diagram"${ viewpoint }>`);

  write(`        <name xml:lang="${ escapeAttr(ir.lang) }">${
    escapeText(vue.nom || vue.id) }</name>`);

  const writeNode = (noeud: ViewNode, indent: string) => {
    const resolved = geometry.get(noeud.id);

    const x = Math.max(0, Math.round(resolved ? resolved.x : 0));
    const y = Math.max(0, Math.round(resolved ? resolved.y : 0));
    const w = Math.max(1, Math.round(resolved ? resolved.width : 120));
    const h = Math.max(1, Math.round(resolved ? resolved.height : 55));

    const bounds = `x="${ x }" y="${ y }" w="${ w }" h="${ h }"`;
    const identifier = nodeIdentifier(vue, noeud.id);

    if (noeud.element) {
      write(
        `${ indent }<node identifier="${ escapeAttr(identifier) }" ` +
        `elementRef="${ escapeAttr(archimateIdOf(noeud.element)) }" ` +
        `xsi:type="Element" ${ bounds }>`);
    } else if (noeud.note !== undefined) {
      write(
        `${ indent }<node identifier="${ escapeAttr(identifier) }" ` +
        `xsi:type="Label" ${ bounds }>`);
      write(`${ indent }  <label xml:lang="${ escapeAttr(ir.lang) }">${
        escapeText(noeud.note) }</label>`);
    } else {
      write(
        `${ indent }<node identifier="${ escapeAttr(identifier) }" ` +
        `xsi:type="Container" ${ bounds }>`);
      write(`${ indent }  <label xml:lang="${ escapeAttr(ir.lang) }">${
        escapeText(noeud.cadre || '') }</label>`);
    }

    for (const enfant of noeud.enfants || []) {
      writeNode(enfant, indent + '  ');
    }

    write(`${ indent }</node>`);
  };

  for (const noeud of vue.noeuds || []) {
    writeNode(noeud, '        ');
  }

  const connectionGeometries = (graphics.vues &&
    graphics.vues[ vue.id ] &&
    graphics.vues[ vue.id ].connexions) || {};

  for (const connexion of vue.connexions || []) {
    const identifier = nodeIdentifier(vue, connexion.id);

    write(
      `        <connection identifier="${ escapeAttr(identifier) }" ` +
      `relationshipRef="${ escapeAttr(archimateIdOf(connexion.relationship)) }" ` +
      `xsi:type="Relationship" ` +
      `source="${ escapeAttr(nodeIdentifier(vue, connexion.de)) }" ` +
      `target="${ escapeAttr(nodeIdentifier(vue, connexion.vers)) }">`);

    const connectionGeometry = connectionGeometries[ connexion.id ];

    for (const point of (connectionGeometry && connectionGeometry.points) || []) {
      write(
        `          <bendpoint x="${ Math.max(0, Math.round(point.x)) }" ` +
        `y="${ Math.max(0, Math.round(point.y)) }" />`);
    }

    write('        </connection>');
  }

  write('      </view>');
}

function escapeText(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return escapeText(value)
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '&#10;');
}
