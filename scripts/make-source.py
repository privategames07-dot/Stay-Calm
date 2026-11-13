"""Build the Feather/AltStore source next to the versioned release IPA."""
import datetime
import json
import os
import pathlib
import plistlib

root = pathlib.Path(__file__).resolve().parents[1]
with (root / "ios/Info.plist").open("rb") as stream:
    info = plistlib.load(stream)
build = info["CFBundleVersion"]
version = info["CFBundleShortVersionString"]
repo = os.environ["GITHUB_REPOSITORY"]
release = f"https://github.com/{repo}/releases/download/build-{build}"
ipa = root / "dist" / f"stay-calm-{build}.ipa"
updated = dict(version=version, buildVersion=build,
               date=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
               downloadURL=f"{release}/{ipa.name}", size=ipa.stat().st_size)
app = dict(name=info["CFBundleDisplayName"], bundleIdentifier=info["CFBundleIdentifier"],
           developerName=repo.split("/")[0], localizedDescription="시간표에 맞춰 인내 기록을 쌓고 펫을 키워요.",
           iconURL=f"{release}/logo.jpg", versions=[updated], versionDate=updated["date"], **updated)
source = dict(name="stay calm!", identifier=info["CFBundleIdentifier"]+".source", apps=[app])
(root / "dist/source.json").write_text(json.dumps(source, ensure_ascii=False, indent=2))
