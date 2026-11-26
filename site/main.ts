/**
 * The demonstration page: a static host (online shop domain) for the
 * `<urban-archimate>` component. It hydrates a model, provides the
 * toolbox, answers the drop delegate, and shows what the component
 * returns at save time (model without data, graphics, new relations).
 */

import { dump } from 'js-yaml';

import { register, type UrbanArchimateElement } from '../src/index.ts';

register();

import { MODELES, hydrate, delegates } from './hote.ts';

const editeur = document.getElementById('editeur') as UrbanArchimateElement;
const choixModele = document.getElementById('choix-modele') as HTMLSelectElement;
const lectureSeule = document.getElementById('lecture-seule') as HTMLInputElement;
const boutonEnregistrer = document.getElementById('bouton-enregistrer')!;
const boutonExport = document.getElementById('bouton-export')!;
const sorties = document.getElementById('sorties')!;
const sortieModele = document.getElementById('sortie-modele')!;
const sortieGraphique = document.getElementById('sortie-graphique')!;
const sortieRelations = document.getElementById('sortie-relations')!;

for (const chemin of MODELES) {
  const option = document.createElement('option');
  option.value = chemin;
  option.textContent = hydrate(chemin).nom || chemin;
  choixModele.appendChild(option);
}

async function charger(): Promise<void> {
  sorties.classList.remove('visible');

  editeur.delegates = delegates();

  const hydrated = hydrate(choixModele.value);
  await editeur.loadModel(hydrated);

  editeur.editor?.getDiagram().get('canvas').zoom('fit-viewport');
}

function montrerEnregistrement(): void {
  const { modele, graphique, nouvellesRelations } = editeur.save();

  sortieModele.textContent = dump(modele, { lineWidth: 90, noRefs: true });
  sortieGraphique.textContent = dump(graphique, { lineWidth: 90, noRefs: true });
  sortieRelations.textContent = nouvellesRelations.length
    ? dump(nouvellesRelations, { lineWidth: 90, noRefs: true })
    : '(aucune — tracez une relation entre deux objets)';

  sorties.classList.add('visible');
}

choixModele.addEventListener('change', () => {
  charger().catch(afficherErreur);
});

lectureSeule.addEventListener('change', () => {
  editeur.readOnly = lectureSeule.checked;
  charger().catch(afficherErreur);
});

boutonEnregistrer.addEventListener('click', () => {
  try {
    montrerEnregistrement();
  } catch (error) {
    afficherErreur(error as Error);
  }
});

boutonExport.addEventListener('click', () => {
  try {
    const xml = editeur.exportExchange();
    const blob = new Blob([ xml ], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'modele-archimate.xml';
    link.click();

    URL.revokeObjectURL(url);
  } catch (error) {
    afficherErreur(error as Error);
  }
});

editeur.addEventListener('changed', () => {
  // l'indicateur « modifié » de l'hôte
  document.title = '● urban-archimate — démonstration';
});

function afficherErreur(error: Error): void {
  sortieModele.textContent = String(error.message || error);
  sorties.classList.add('visible');
}

charger().catch(afficherErreur);
