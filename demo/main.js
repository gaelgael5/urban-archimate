import Modeler from '../lib/Modeler.js';

import '../assets/archimate-js.css';

const modeler = new Modeler({
  container: document.querySelector('#canvas')
});

modeler.createNewModel().then(() => {
  console.log('new model ready');
}).catch((err) => {
  console.error('could not create model', err);
});

// expose for manual exploration in the console
window.modeler = modeler;
