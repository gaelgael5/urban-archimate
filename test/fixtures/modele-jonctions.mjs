/** Modèle hydraté d'essai : une jonction « et », une « ou », des déclenchements qui y passent. */
export const SCHEMA_JONCTION = { title: 'Jonction', 'x-archimate': 'Junction' };

export function schemas() {
  return new Map([ [ 'jonction', SCHEMA_JONCTION ] ]);
}

export function modelWithJunctions() {
  return {
    id: 'MOD-JONCTIONS',
    nom: 'Jonctions',
    regles: {
      chemin: 'regles.yaml',
      data: { lang: 'fr', defaut: { name: '$.nom' } }
    },
    graphique: {
      chemin: 'graphique.yaml',
      data: {
        vues: {
          'VUE-J': {
            noeuds: {
              N1: { x: 40, y: 40, l: 150, h: 60 },
              NJ1: { x: 300, y: 62, l: 15, h: 15 },
              NJ2: { x: 300, y: 162, l: 15, h: 15 },
              N2: { x: 460, y: 40, l: 150, h: 60 },
              N3: { x: 460, y: 140, l: 150, h: 60 }
            }
          }
        }
      }
    },
    types: [
      { chemin: 'cartographie/types/jonction.schema.yaml', data: SCHEMA_JONCTION }
    ],
    documents: [
      { chemin: 'objets/evenement/evt-a.yaml',
        data: { cle: 'EVT-A', type: 'BusinessEvent', nom: 'A' } },
      { chemin: 'objets/jonction/jct-et.yaml',
        data: { cle: 'JCT-ET', type: 'jonction', nom: 'Et' } },
      { chemin: 'objets/jonction/jct-ou.yaml',
        data: { cle: 'JCT-OU', type: 'jonction', nom: 'Ou',
          proprietes: { jonction: 'Or' } } },
      { chemin: 'objets/processus/prc-b.yaml',
        data: { cle: 'PRC-B', type: 'BusinessProcess', nom: 'B' } },
      { chemin: 'objets/declenchement/rel-a-et.yaml',
        data: { cle: 'REL-A-ET', type: 'Triggering',
          source: 'EVT-A', cible: 'JCT-ET' } },
      { chemin: 'objets/declenchement/rel-et-b.yaml',
        data: { cle: 'REL-ET-B', type: 'Triggering',
          source: 'JCT-ET', cible: 'PRC-B' } }
    ],
    elements: [ 'EVT-A', 'JCT-ET', 'JCT-OU', 'PRC-B' ],
    relationships: [ 'REL-A-ET', 'REL-ET-B' ],
    vues: [ {
      id: 'VUE-J',
      nom: 'Jonctions',
      noeuds: [
        { id: 'N1', element: 'EVT-A' },
        { id: 'NJ1', element: 'JCT-ET' },
        { id: 'NJ2', element: 'JCT-OU' },
        { id: 'N2', element: 'PRC-B' },
        { id: 'N3', element: 'PRC-B' }
      ],
      connexions: [
        { id: 'C1', relationship: 'REL-A-ET', de: 'N1', vers: 'NJ1' },
        { id: 'C2', relationship: 'REL-ET-B', de: 'NJ1', vers: 'N2' }
      ]
    } ]
  };
}
