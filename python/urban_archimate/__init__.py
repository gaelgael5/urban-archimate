"""urban-archimate — ArchiMate diagram editor web component.

The package embeds the built JS (and its TypeScript types) of the
``<urban-archimate>`` custom element, and serves them from a FastAPI /
Starlette application::

    import urban_archimate
    urban_archimate.mount(app, "/api/archimate")

The page then loads ``<path>/urban-archimate.js`` (ES module) and uses
the ``<urban-archimate>`` element.
"""

from pathlib import Path

__version__ = "0.1.0"

STATIC_DIR = Path(__file__).parent / "static"


def mount(app, path: str = "/api/archimate") -> None:
    """Serves the component's built assets at ``path``.

    ``app`` is a FastAPI or Starlette application. The JS module is
    then available at ``{path}/urban-archimate.js`` and the TypeScript
    types under ``{path}/types/``.
    """

    from starlette.staticfiles import StaticFiles

    app.mount(path, StaticFiles(directory=STATIC_DIR), name="urban-archimate")
