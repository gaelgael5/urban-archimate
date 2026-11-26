import { describe, it, expect, afterEach } from 'vitest';

import '../../src/index.ts';

import exampleYaml from '../../examples/boutique/modele-hydrate.yaml?raw';

function createElement(attributes = {}) {
  const element = document.createElement('urban-archimate');
  element.style.display = 'block';
  element.style.width = '1200px';
  element.style.height = '700px';

  for (const [ name, value ] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }

  document.body.appendChild(element);
  return element;
}

describe('<urban-archimate> (composant web)', () => {

  let element;

  afterEach(() => {
    element?.remove();
    element = null;
  });

  it('se charge sans framework et rend le modèle dans son shadow DOM', async () => {
    element = createElement();

    expect(customElements.get('urban-archimate')).toBeTruthy();
    expect(element.shadowRoot).toBeTruthy();

    const { warnings } = await element.loadModel(exampleYaml);
    expect(warnings).toEqual([]);

    // le diagramme est rendu dans le shadow DOM, pas dans la page
    expect(element.shadowRoot.querySelector('svg')).toBeTruthy();
    expect(document.querySelector('body > svg')).toBeFalsy();

    const registry = element.editor.getDiagram().get('elementRegistry');
    expect(registry.get('n-VUE-COOPERATION-N1')).toBeTruthy();
  });

  it('reçoit les événements du contrat (selection, changed)', async () => {
    element = createElement();

    const selections = [];
    const changes = [];
    element.addEventListener('selection', (e) => selections.push(e.detail));
    element.addEventListener('changed', (e) => changes.push(e.detail));

    await element.loadModel(exampleYaml);

    const diagram = element.editor.getDiagram();
    const registry = diagram.get('elementRegistry');

    diagram.get('selection').select(registry.get('n-VUE-COOPERATION-N1'));
    expect(selections.pop()).toMatchObject({ cle: 'APP-BOUTIQUE' });

    diagram.get('modeling').moveShape(
      registry.get('n-VUE-COOPERATION-N3'), { x: 10, y: 10 });
    expect(changes.length).toBeGreaterThan(0);

    // l'enregistrement passe par la méthode du composant
    const { modele } = element.save();
    expect(modele.id).toBe('MOD-BOUTIQUE-APPLICATIF');
  });

  it('isole ses styles de la page et suit le thème par variables CSS (critère 4)', async () => {
    // une règle agressive de la page hôte ne doit pas toucher le composant
    const hostileStyle = document.createElement('style');
    hostileStyle.textContent =
      '.ua-toolbox { background: rgb(255, 0, 0) !important; display: none; }';
    document.head.appendChild(hostileStyle);

    element = createElement();
    element.style.setProperty('--ua-fond-panneau', 'rgb(1, 2, 3)');

    await element.loadModel(exampleYaml);

    const toolbox = element.shadowRoot.querySelector('.ua-toolbox');
    const computed = getComputedStyle(toolbox);

    // la règle hostile n'a pas traversé le shadow DOM…
    expect(computed.display).not.toBe('none');
    // …mais la variable CSS du thème, si
    expect(computed.backgroundColor).toBe('rgb(1, 2, 3)');

    // la notation suit la palette « Cartographe » : couche application en
    // bleu glacier (#D3E8F4) au lieu du cyan des figures de la spécification
    const registry = element.editor.getDiagram().get('elementRegistry');
    const gfx = registry.getGraphics(registry.get('n-VUE-COOPERATION-N1'));
    const rect = gfx.querySelector('.djs-visual rect');

    expect(rect.style.fill).toBe('rgb(211, 232, 244)');
    // contour ardoise (#4F626E), libellé nuit (#0D1C26)
    expect(rect.style.stroke).toBe('rgb(79, 98, 110)');
    expect(gfx.querySelector('.djs-visual text').style.fill).toBe('rgb(13, 28, 38)');

    hostileStyle.remove();
  });

  it('est dans le ton d\'Ossie sans réglage de l\'hôte (valeurs par défaut sur :host)', async () => {
    element = createElement();
    await element.loadModel(exampleYaml);

    const shadow = element.shadowRoot;

    // panneau blanc, filet --ua-bordure-forte : les tokens sont bien définis
    // dans le shadow root (déclarés sur `:root` seul, ils ne l'étaient pas)
    const toolbox = getComputedStyle(shadow.querySelector('.ua-toolbox'));
    expect(toolbox.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(toolbox.borderRightColor).toBe('rgb(180, 195, 204)');

    // l'onglet actif est dans la couleur de ligne (sarcelle) et porte sa station
    const active = shadow.querySelector('.ua-vue-active');
    expect(getComputedStyle(active).color).toBe('rgb(11, 110, 106)');
    expect(getComputedStyle(active, '::after').borderTopColor).toBe('rgb(11, 110, 106)');

    // étiquette de panneau en chasse fixe
    expect(getComputedStyle(shadow.querySelector('.ua-toolbox-groupe-titre')).fontFamily)
      .toContain('IBM Plex Mono');

    // libellés du diagramme dans la police du thème, plus « Quicksand »
    const label = shadow.querySelector('.djs-visual text');
    expect(label.style.fontFamily).toContain('IBM Plex Sans');
  });

  it('suit les tokens posés par l\'hôte (raccord Ossie)', async () => {
    const hostStyle = document.createElement('style');
    hostStyle.textContent =
      'urban-archimate { --ua-accent: rgb(1, 2, 3); --ua-police-diagramme: "Courier New", monospace;'
      + ' --ua-notation-application: rgb(4, 5, 6); --ua-notation-relation: rgb(7, 8, 9); }';
    document.head.appendChild(hostStyle);

    element = createElement();
    await element.loadModel(exampleYaml);

    const shadow = element.shadowRoot;
    expect(getComputedStyle(shadow.querySelector('.ua-vue-active')).color).toBe('rgb(1, 2, 3)');
    expect(shadow.querySelector('.djs-visual text').style.fontFamily).toContain('Courier New');

    // palette de notation de l'hôte : fond de couche et trait des relations
    const registry = element.editor.getDiagram().get('elementRegistry');
    const shape = registry.getGraphics(registry.get('n-VUE-COOPERATION-N1'));
    expect(shape.querySelector('.djs-visual rect').style.fill).toBe('rgb(4, 5, 6)');

    const connection = registry.filter((e) => e.waypoints)[ 0 ];
    expect(registry.getGraphics(connection).querySelector('.djs-visual path').style.stroke)
      .toBe('rgb(7, 8, 9)');

    hostStyle.remove();
  });

  it('suit la taille de son conteneur (fit-viewport sur la taille réelle)', async () => {
    // créé petit, agrandi ensuite par la mise en page de l'hôte : c'est ce qui
    // rendait le diagramme minuscule sur le site de démonstration
    element = createElement();
    element.style.width = '600px';
    element.style.height = '300px';
    await element.loadModel(exampleYaml);

    element.style.width = '1200px';
    element.style.height = '700px';
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const canvas = element.editor.getDiagram().get('canvas');
    canvas.zoom('fit-viewport');

    const host = element.shadowRoot.querySelector('.ua-canvas');
    expect(canvas.viewbox().outer.width).toBe(host.clientWidth);
    expect(canvas.viewbox().outer.height).toBe(host.clientHeight);
  });

  it('mode lecture seule par attribut', async () => {
    element = createElement({ 'read-only': '' });

    await element.loadModel(exampleYaml);

    expect(element.readOnly).toBe(true);
    expect(() => element.editor.getDiagram().get('move')).toThrow();
    expect(element.shadowRoot.querySelector('.ua-toolbox')).toBeFalsy();
  });

  it('s\'utilise de la même façon depuis React (critère 3)', async () => {
    const React = (await import('react')).default;
    const { createRoot } = await import('react-dom/client');

    const host = document.createElement('div');
    document.body.appendChild(host);

    let reference = null;
    const events = [];

    const root = createRoot(host);

    await new Promise((resolve) => {
      root.render(React.createElement('urban-archimate', {
        ref: (node) => {
          reference = node;
          if (node) {
            resolve();
          }
        },
        'read-only': undefined,
        style: { display: 'block', width: '1000px', height: '600px' },
        onSelection: undefined
      }));
    });

    reference.addEventListener('import-done', (e) => events.push(e.detail));
    reference.delegates = {};

    await reference.loadModel(exampleYaml);

    expect(events.length).toBe(1);
    expect(reference.shadowRoot.querySelector('svg')).toBeTruthy();

    const { modele } = reference.save();
    expect(modele.elements).toContain('APP-BOUTIQUE');

    root.unmount();
    host.remove();
  });
});
