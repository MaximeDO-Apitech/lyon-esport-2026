from __future__ import annotations

import json
from pathlib import Path

import jsonschema
import yaml


ROOT = Path(__file__).resolve().parents[3]
PROFILE = ROOT / "production" / "openmontage-les" / "profile" / "les-playbook.yaml"
SCHEMA = ROOT / "tools" / "OpenMontage" / "schemas" / "styles" / "playbook.schema.json"


def main() -> int:
    profile = yaml.safe_load(PROFILE.read_text(encoding="utf-8"))
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    jsonschema.Draft202012Validator(schema).validate(profile)
    print(json.dumps({
        "valid": True,
        "profile": str(PROFILE),
        "schema": str(SCHEMA),
        "schema_id": schema.get("$id"),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
