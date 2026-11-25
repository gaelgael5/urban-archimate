"""`pip install urban-archimate` puis `mount(app, chemin)` :
le JS (et les types) sont servis à ce chemin."""

from starlette.applications import Starlette
from starlette.testclient import TestClient

import urban_archimate


def test_mount_serves_the_component():
    app = Starlette()
    urban_archimate.mount(app, "/api/archimate")

    client = TestClient(app)

    response = client.get("/api/archimate/urban-archimate.js")
    assert response.status_code == 200
    assert "urban-archimate" in response.text

    types = client.get("/api/archimate/types/contract/types.d.ts")
    assert types.status_code == 200
    assert "HydratedModel" in types.text

    schema = client.get("/api/archimate/hydrated-model.schema.json")
    assert schema.status_code == 200


def test_version_is_pinnable():
    assert urban_archimate.__version__
