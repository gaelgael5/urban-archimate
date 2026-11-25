# urban-archimate (paquet Python)

Éditeur de diagrammes ArchiMate® en composant web (`<urban-archimate>`),
embarqué dans un paquet Python et servi depuis FastAPI / Starlette :

```python
import urban_archimate

urban_archimate.mount(app, "/api/archimate")
```

```html
<script type="module" src="/api/archimate/urban-archimate.js"></script>
<urban-archimate></urban-archimate>
```

Les types TypeScript du contrat sont servis sous `/api/archimate/types/`.

Dépôt, documentation et contrat :
<https://github.com/gaelgael5/urban-archimate>.
