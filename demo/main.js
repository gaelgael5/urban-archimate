import Modeler from '../lib/Modeler.js';
import { UrbanArchimateEditor } from '../src/editor/UrbanArchimateEditor.ts';

import '../assets/archimate-js.css';

const params = new URLSearchParams(window.location.search);
const exemple = params.get('exemple');
const readOnly = params.get('lecture-seule') === '1';

const container = document.querySelector('#canvas');

async function start() {

  if (!exemple) {
    // free modeling playground on an empty model
    const modeler = new Modeler({ container });
    await modeler.createNewModel();
    window.modeler = modeler;
    return;
  }

  // host-of-demonstration mode: load a hydrated model example
  const response = await fetch(`../examples/${ exemple }/modele-hydrate.yaml`);

  if (!response.ok) {
    throw new Error(`exemple introuvable : ${ exemple }`);
  }

  const yaml = await response.text();

  const editor = new UrbanArchimateEditor({ container, readOnly });

  editor.on('selection', (event) => console.log('selection', event));
  editor.on('changed', (event) => console.log('changed', event));

  await editor.load(yaml);

  editor.getDiagram().get('canvas').zoom('fit-viewport');

  window.editor = editor;
}

start().catch((err) => {
  console.error(err);
  const message = document.createElement('pre');
  message.textContent = String(err.message || err);
  message.style.color = 'red';
  message.style.padding = '12px';
  document.body.prepend(message);
});
