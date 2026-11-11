"""Share the machine-profile field schema with firmware validation."""

import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
schema = json.loads((root / "web/src/data/machineProfileFields.json").read_text())
target = root / "src/display/webassets/machine_profile_schema.h"
target.parent.mkdir(parents=True, exist_ok=True)
content = (
    '#pragma once\ninline constexpr char MACHINE_PROFILE_FIELDS[] = R"schema('
    + json.dumps(schema, separators=(",", ":"))
    + ')schema";\n'
)
builtins = sorted(
    (json.loads(profile.read_text()) for profile in (root / "web/src/data/machineProfiles").glob("*.json")),
    key=lambda profile: profile["id"],
)
builtin_ids = [profile["id"] for profile in builtins]
content += (
    'inline constexpr char MACHINE_PROFILE_BUILTIN_IDS[] = R"ids('
    + json.dumps(builtin_ids)
    + ')ids";\n'
)
content += (
    'inline constexpr char MACHINE_PROFILE_BUILTINS[] = R"profiles('
    + json.dumps(builtins, separators=(",", ":"))
    + ')profiles";\n'
)
if not target.exists() or target.read_text() != content:
    target.write_text(content)
