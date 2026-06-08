from fastapi import HTTPException

from backend.app.services.storage import ensure_safe_segment, persona_name_payload


def test_ensure_safe_segment_rejects_path_traversal():
    try:
        ensure_safe_segment("../secret", "sim_code")
    except HTTPException as exc:
        assert exc.status_code == 400
    else:
        raise AssertionError("path traversal should be rejected")


def test_persona_name_payload_matches_frontend_contract():
    payload = persona_name_payload("Isabella Rodriguez")

    assert payload.original == "Isabella Rodriguez"
    assert payload.underscore == "Isabella_Rodriguez"
    assert payload.initial == "IR"
