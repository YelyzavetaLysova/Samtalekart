"""Small end-to-end API check that does not require external services."""

from fastapi.testclient import TestClient

from app.main import app


def run() -> None:
    client = TestClient(app)

    created = client.post(
        "/api/activities",
        json={
            "topic": "Planlegg en aktivitet i Bergen",
            "language_level": "A2",
            "grouping_mode": "automatic",
            "target_group_size": 3,
        },
    ).json()
    code = created["activity"]["join_code"]
    host_token = created["host_token"]

    sessions = []
    for nickname in ["Anna", "Omar", "Lina"]:
        response = client.post(f"/api/activities/{code}/join", json={"nickname": nickname})
        assert response.status_code == 200
        sessions.append(response.json()["participant"])

    grouped = client.post(
        f"/api/activities/{code}/groups/automatic",
        headers={"X-Host-Token": host_token},
    )
    assert grouped.status_code == 200
    assert len(grouped.json()["groups"]) == 1

    for participant in sessions:
        response = client.post(
            f"/api/activities/{code}/participants/{participant['id']}/confirm",
            headers={"X-Participant-Token": participant["token"]},
        )
        assert response.status_code == 200

    started = client.post(f"/api/activities/{code}/start", headers={"X-Host-Token": host_token})
    assert started.status_code == 200
    group = started.json()["groups"][0]

    help_response = client.post(
        f"/api/groups/{group['id']}/help/say",
        json={"participant_id": sessions[0]["id"], "node_id": "ideas", "level": 1},
    )
    assert help_response.status_code == 200
    assert help_response.json()["text"]

    map_response = client.post(
        f"/api/groups/{group['id']}/map/suggest",
        json={"transcript_excerpt": "Vi kan ta buss og snakke om transport"},
    )
    assert map_response.status_code == 200
    assert any(node["id"] == "transport" for node in map_response.json()["nodes"])

    ended = client.post(f"/api/activities/{code}/end", headers={"X-Host-Token": host_token})
    assert ended.status_code == 200

    feedback = client.get(
        f"/api/activities/{code}/participants/{sessions[0]['id']}/feedback",
        headers={"X-Participant-Token": sessions[0]["token"]},
    )
    assert feedback.status_code == 200
    assert len(feedback.json()["items"]) >= 3


if __name__ == "__main__":
    run()
    print("Smoke flow passed")

