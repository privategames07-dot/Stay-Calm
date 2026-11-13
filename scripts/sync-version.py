"""Derive every displayed version from the monotonically increasing build number."""
import pathlib
import plistlib

root = pathlib.Path(__file__).resolve().parents[1]
path = root / "ios/Info.plist"
info = plistlib.loads(path.read_bytes())
build = int(info["CFBundleVersion"])
assert build > 0
name = f"0.{build}"
info["CFBundleShortVersionString"] = name
path.write_bytes(plistlib.dumps(info, sort_keys=False))
(root / "web/version.js").write_text(
    f"'use strict';\nconst CalmVersion = Object.freeze({{build:{build},name:'{name}'}});\n"
)
print(name)
