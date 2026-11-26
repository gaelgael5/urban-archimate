# Contrat du composant urban-archimate

Le composant fournit le diagramme et la transformation du document
YAML. **Il ne touche jamais au disque** : l'hôte (Ossie-studio ou la
page de démonstration) lit et écrit les fichiers et reste **la seule
source** des objets, des types, des règles de traduction et des règles
de relation. Le composant ne connaît pas Ossie-studio : il ne connaît
qu'un document et des délégués, et n'embarque aucun catalogue.

Les structures YAML et leurs clés françaises sont définies à
l'identique côté Ossie-studio (ticket « Format du modèle, du fichier de
règles et du fichier graphique » de l'epic « Cartographie — modèles et
vues »). Les noms d'API (méthodes, événements, délégués) sont communs
avec `urban-bpmn`.

Les types TypeScript font foi : [`src/contract/types.ts`](../src/contract/types.ts),
publiés avec le paquet. Le JSON Schema du modèle hydraté :
[`schema/hydrated-model.schema.json`](../schema/hydrated-model.schema.json).

## Entrée — le modèle hydraté

L'hôte passe le document du modèle dont chaque référence est complétée
par son contenu (`data`) :

```yaml
id: MOD-BOUTIQUE-APPLICATIF
nom: Boutique — vue applicative
regles:    { chemin: cartographie/regles/standard.rules.yaml, data: { … } }
graphique: { chemin: …/boutique-applicatif.graphique.yaml,   data: { … } }
types:                        # schémas des types d'objets présents
  - { chemin: cartographie/types/application.schema.yaml, data: { title: Application, x-archimate: ApplicationComponent, … } }
documents:                    # un document = un objet
  - { chemin: cartographie/objets/application/app-boutique.yaml, data: { cle: APP-BOUTIQUE, type: application, nom: …, … } }
elements: [ APP-BOUTIQUE, OBJ-COMMANDE ]        # clés retenues
relationships: [ REL-BOUTIQUE-ECRIT-COMMANDE ]
vues:
  - id: VUE-COOPERATION
    noeuds: [ … ]             # nœuds (id propre, clé de l'objet), imbrication, notes, cadres
    connexions: [ … ]
```

- Le **type** d'un objet est un type de l'hôte ; son schéma (`types`)
  donne le type ArchiMate (`x-archimate`) et les propriétés ajoutées.
- Le fichier de **règles** dit comment un objet devient un élément
  ArchiMate (voir « Appliquer les règles ») ; la règle `defaut` est
  fournie par l'hôte comme les autres blocs.
- Le **graphique** ne contient que le dessin : positions absolues ou
  relatives à un autre nœud (`relatif`/`dx`/`dy`), tailles (`l`/`h`),
  ancres, coudes (`points`), position des textes (`libelle`).
- Les **relations sont des objets** : mêmes documents, avec `source`
  et `cible` en plus.
- L'exemple complet du dépôt :
  [`examples/boutique/modele-hydrate.yaml`](../examples/boutique/modele-hydrate.yaml).

Un modèle invalide est **refusé** avec une `ModelValidationError` dont
chaque entrée nomme l'élément en cause. Contrôles à la lecture :

1. une clé de `elements` ou `relationships` absente des `documents` ;
2. une relation retenue dont la source ou la cible n'est pas retenue ;
3. un nœud ou une connexion qui désigne une clé non retenue, ou un
   nœud inconnu ;
4. un document dont aucun objet n'est retenu ;
5. une entrée du graphique sans nœud ou connexion correspondant
   (**ignorée et signalée** en avertissement, sans refus).

## Délégués (fonctions fournies par l'hôte)

```ts
interface Delegates {
  toolbox?(context: { pointDeVue?, vueId? }): ToolGroup[] | Promise<ToolGroup[]>;
  drop?(cle: string): DropResult | Promise<DropResult>;
  allowedRelations?(cleSource, cleCible): AllowedRelationType[] | Promise<AllowedRelationType[]>;
}
```

- **`toolbox`** : le contenu de la boîte à outils pour la vue courante
  (groupes ; pour chaque outil : `libelle`, `icone` — URL ou SVG en
  ligne —, `cle`). Appelé à chaque changement de vue, avec le point de
  vue : c'est l'hôte qui filtre.
- **`drop`** : appelé **une fois**, avec la clé, quand un outil est
  posé. L'hôte rend l'objet (`chemin` + `data`), le schéma de son type
  s'il n'est pas déjà connu, et le bloc de règles de ce type.
- **`allowedRelations`** : appelé **une fois**, avec les deux clés,
  avant de relier deux nœuds. L'hôte rend les types de relation
  autorisés (chacun avec son type ArchiMate et le schéma qui pilote la
  grille de propriétés). S'il n'en rend aucun, la liaison est refusée
  avec un message nommant les deux objets.

Le composant n'invente jamais ce qu'un délégué aurait dû répondre : un
délégué absent désactive l'interaction correspondante.

## Sortie — l'enregistrement

```ts
const { modele, graphique, nouvellesRelations } = editor.save();
```

- **`modele`** : le modèle **sans les `data`** (chemins seuls), prêt à
  écrire — la liste `types`, artefact d'hydratation, disparaît.
- **`graphique`** : le contenu du fichier graphique.
- **`nouvellesRelations`** : les relations tracées sur le dessin qui
  n'existent pas encore côté hôte (objets complets, avec `source`,
  `cible`, `proprietes`) ; c'est l'hôte qui crée les fichiers et
  contrôle l'unicité des clés. Elles ne rentrent dans `documents`
  qu'une fois réhydratées par l'hôte.

Le composant garde le modèle **propre** : il ne rend pas un document
dont aucun objet n'est retenu, ni un nœud qui désigne une clé non
retenue.

## Attributs ArchiMate de base des relations

Convention partagée avec Ossie-studio (« les attributs propres à
ArchiMate sont stockés avec les valeurs ArchiMate, l'écran affichant
les libellés français ») :

| Type ArchiMate | Propriété de l'objet | Valeurs | Libellés affichés |
|---|---|---|---|
| `Access` | `proprietes.acces` | `Read`, `Write`, `ReadWrite` (absente = non précisé) | lecture, écriture, lecture-écriture |
| `Influence` | `proprietes.modificateur` | texte libre (`+`, `++`, `-`, …) | — |
| `Association` | `proprietes.dirigee` | `true` (absente = non dirigée) | dirigée |

La grille de propriétés d'une nouvelle relation est construite à
partir du schéma du type rendu par le délégué `allowedRelations`
(chaînes, nombres, énumérations, booléens, obligatoires) et de ces
attributs de base. Une valeur facultative vide n'est pas envoyée.

## Autres

- **Lecture seule** : option `readOnly` ; aucune modification possible
  et aucun événement de modification émis.
- **Événements** : `changed` à chaque modification (indicateur
  « modifié » de l'hôte) ; `selection` quand un élément ou une
  connexion est sélectionné, avec la clé de l'objet.
- **Thème** : voir ci-dessous.

## Thème

L'interface du composant (boîte à outils, grille de propriétés,
onglets des vues, surface de dessin, marques de sélection) suit
l'identité d'Ossie Studio, « Cartographe » (`docs/identite-visuelle.md`
d'ossie-studio) : IBM Plex Sans / Mono, lettrage en chasse fixe pour
les étiquettes courtes et les identifiants, angles vifs et traits d'un
pixel, pas d'ombre sauf sur ce qui flotte, trame de points sur la
surface de dessin, onglet actif en « station » sur sa ligne, une seule
couleur de ligne (sarcelle). **Les valeurs par défaut sont celles de
cette identité** : sans aucun réglage, le composant est dans le ton.

La **notation** est dans le même ton. La spécification ArchiMate ne
normalise pas les couleurs : les teintes habituelles (jaune métier,
cyan application, vert technologie…) ne sont qu'une convention de ses
figures. Le composant garde la **famille de teinte** de chaque couche,
pour qu'un lecteur la reconnaisse, mais à une luminosité égale,
refroidie vers la palette nuit / sarcelle ; les traits sont des filets
ardoise nets au lieu d'un noir à 40 %. Ces couleurs sont des tokens
`--ua-notation-*`, lus **à la création de l'éditeur** (ils deviennent
le style par défaut des éléments dessinés) : un changement de token
prend effet au prochain chargement du composant. Elles ne sont écrites
ni dans le graphique enregistré ni dans l'export Open Group.

Toute couleur de l'interface est un token `--ua-*` ; l'hôte les pose
sur l'élément (les propriétés personnalisées traversent le shadow DOM,
et une règle de l'hôte sur `urban-archimate { … }` l'emporte sur les
valeurs par défaut). `test/unit/theme.spec.js` refuse une couleur en
dur, un token non déclaré ou non documenté ici, et un couple
texte / fond sous le seuil WCAG AA.

| Token | Rôle | Token Ossie |
|---|---|---|
| `--ua-police` | police de l'interface | `--font-ui` |
| `--ua-police-mono` | chasse fixe : étiquettes, identifiants | `--mono` |
| `--ua-police-diagramme` | libellés dessinés dans le diagramme (lu à la création de l'éditeur) ; défaut : `--ua-police` | — |
| `--ua-texte` | texte | `--text` |
| `--ua-texte-secondaire` | texte secondaire, étiquettes | `--muted` |
| `--ua-fond` | fond de la surface de dessin, survol neutre | `--bg` |
| `--ua-trame-point` | points de la trame (`transparent` : sans trame) | `--grid-dot` |
| `--ua-fond-panneau` | panneaux, champs | `--panel` |
| `--ua-fond-discret` | puces (point de vue) | `--surface-muted` |
| `--ua-bordure` | filets, ligne des onglets | `--border` |
| `--ua-bordure-forte` | bordures de panneaux, de champs, de boutons | `--border-strong` |
| `--ua-accent` | couleur de ligne : bouton principal, sélection, onglet actif | `--primary` |
| `--ua-accent-survol` | survol du bouton principal | `--primary-hover` |
| `--ua-accent-texte` | texte sur l'accent | `--primary-fg` |
| `--ua-accent-fond` | fond d'une entrée sélectionnée (outil armé) | `--chip-bg` |
| `--ua-accent-fond-texte` | texte sur ce fond | `--chip-fg` |
| `--ua-erreur` | texte d'erreur | `--danger-fg` |
| `--ua-erreur-fond` | fond teinté d'erreur | `--danger-bg` |
| `--ua-focus` | anneau de focus clavier ; défaut : `--ua-accent` | — |
| `--ua-rayon` | rayon des panneaux | `--radius` |
| `--ua-rayon-sm` | rayon des boutons, champs, puces | `--radius-sm` |
| `--ua-ombre` | ombre de ce qui flotte (pad contextuel, menus) | `--shadow` |
| `--ua-notation-strategie` | fond des éléments Stratégie (sable) | — |
| `--ua-notation-metier` | fond des éléments Métier (paille) | — |
| `--ua-notation-application` | fond des éléments Application (bleu glacier) | — |
| `--ua-notation-technologie` | fond des éléments Technologie (sauge) | — |
| `--ua-notation-physique` | fond des éléments Physique (sauge) | — |
| `--ua-notation-implementation` | fond des éléments Implémentation et migration (rose poudré) | — |
| `--ua-notation-motivation` | fond des éléments Motivation (lavande) | — |
| `--ua-notation-autre` | fond des autres éléments (lieu, regroupement) | `--surface-muted` |
| `--ua-notation-note` | fond des notes | `--panel` |
| `--ua-notation-trait` | contour des formes, des cadres, des jonctions | `--muted` |
| `--ua-notation-relation` | relations et leurs pointes | — |
| `--ua-notation-texte` | libellés du diagramme | `--text` |
| `--ua-notation-pictogramme` | pictogramme au coin des formes | — |
| `--ua-notation-fond` | marques creuses (pointes ouvertes, losange vide, jonction Ou) | `--panel` |

Raccord à poser dans Ossie Studio (`frontend/src/styles.css`), pour
qu'un changement de la palette d'Ossie se propage au composant :

```css
urban-archimate {
  --ua-police: var(--font-ui);
  --ua-police-mono: var(--mono);
  --ua-texte: var(--text);
  --ua-texte-secondaire: var(--muted);
  --ua-fond: var(--bg);
  --ua-trame-point: var(--grid-dot);
  --ua-fond-panneau: var(--panel);
  --ua-fond-discret: var(--surface-muted);
  --ua-bordure: var(--border);
  --ua-bordure-forte: var(--border-strong);
  --ua-accent: var(--primary);
  --ua-accent-survol: var(--primary-hover);
  --ua-accent-texte: var(--primary-fg);
  --ua-accent-fond: var(--chip-bg);
  --ua-accent-fond-texte: var(--chip-fg);
  --ua-erreur: var(--danger-fg);
  --ua-erreur-fond: var(--danger-bg);
  --ua-rayon: var(--radius);
  --ua-rayon-sm: var(--radius-sm);
  --ua-ombre: var(--shadow);
  /* notation : les teintes de couche gardent leurs valeurs par défaut */
  --ua-notation-autre: var(--surface-muted);
  --ua-notation-note: var(--panel);
  --ua-notation-trait: var(--muted);
  --ua-notation-texte: var(--text);
  --ua-notation-fond: var(--panel);
}
```

Les polices ne sont pas embarquées dans le composant : il emploie
celles que la page a chargées (Ossie charge IBM Plex Sans 400/500/600/700
et Mono 400/500/600 par `@fontsource`, ce qui couvre les graisses
utilisées ici). Le site de démonstration (`site/`) est habillé comme un
écran d'Ossie et pose exactement ce raccord.
