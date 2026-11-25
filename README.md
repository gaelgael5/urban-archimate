# urban-archimate

ArchiMate® diagram editor, delivered as a web component and built on
[diagram-js](https://github.com/bpmn-io/diagram-js), the diagram engine of the
[bpmn.io](https://bpmn.io) project.

`urban-archimate` is developed for [Ossie-studio] style hosts: the host owns
the objects, the types, the translation rules and the relationship rules; the
component renders and edits ArchiMate views of those objects. The component
never touches the disk — the host reads and writes the files.

## Origin

This repository incorporates and continues
[archimate-js](https://github.com/archimodel/archimate-js) by **Vincent
Boulet** (MIT license, version 0.0.4, last upstream commit November 2024). See
[NOTICE](./NOTICE) for the exact imported commit. What this repository does
with it:

- dependencies (diagram-js 12 → 15, moddle 5 → 8, …) raised to their current
  stable versions, with the breakages fixed;
- a modern build (Vite), linter (ESLint) and test suite (Vitest, running in a
  real Chromium) wired into GitHub Actions;
- the embedded relationship tables are exported to
  [`data/archimate-relationship-tables.json`](./data/archimate-relationship-tables.json)
  for the host's catalogue; the component itself will receive relationship
  rules from the host (see the backlog);
- upcoming: a YAML "hydrated model" contract with host delegates, a
  host-provided toolbox, a schema-driven property grid, a
  `<urban-archimate>` custom element published on PyPI as `urban-archimate`.

ArchiMate® is a registered trademark of The Open Group.

## Development

```bash
npm install
npm run lint     # eslint
npm test         # vitest: unit (node) + browser (chromium)
npm run build    # vite library build to dist/
```

Try the modeler locally:

```bash
npx vite        # then open http://localhost:5173/demo/
```

To regenerate the relationship tables export:

```bash
npx vite-node scripts/export-relationship-tables.mjs
```

## License

MIT — see [LICENSE](./LICENSE). Original archimate-js code
Copyright (c) 2022 Vincent Boulet, also MIT; attribution kept in
[NOTICE](./NOTICE). The bundled ArchiMate symbol font is licensed under the
SIL Open Font License 1.1 (see `vendor/archimate-font/LICENSE`).
