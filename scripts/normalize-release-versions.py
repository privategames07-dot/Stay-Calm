"""Normalize published pre-release metadata and package display versions."""
import json
import os
import pathlib
import plistlib
import re
import struct
import subprocess
import tempfile
import zipfile


def run(*args):
    return subprocess.check_output(args, text=True)


def read_length(data, offset, utf8):
    if utf8:
        first = data[offset]
        return (((first & 127) << 8) | data[offset + 1], offset + 2) if first & 128 else (first, offset + 1)
    first = struct.unpack_from("<H", data, offset)[0]
    return (((first & 32767) << 16) | struct.unpack_from("<H", data, offset + 2)[0], offset + 4) if first & 32768 else (first, offset + 2)


def length_bytes(value, utf8):
    if utf8:
        return bytes([128 | (value >> 8), value & 255]) if value > 127 else bytes([value])
    return struct.pack("<HH", 32768 | (value >> 16), value & 65535) if value > 32767 else struct.pack("<H", value)


def patch_manifest(data, previous, version):
    # Keep string indices and resource IDs stable while rebuilding the string pool.
    header_size = struct.unpack_from("<H", data, 2)[0]
    chunks = []
    offset = header_size
    changed = False
    while offset < len(data):
        kind, size_header, size = struct.unpack_from("<HHI", data, offset)
        assert size >= size_header and offset + size <= len(data)
        chunk = data[offset:offset + size]
        offset += size
        if kind == 1:
            count, styles, flags, start, style_start = struct.unpack_from("<5I", chunk, 8)
            utf8 = bool(flags & 256)
            values = []
            for i in range(count):
                pos = start + struct.unpack_from("<I", chunk, size_header + i * 4)[0]
                chars, pos = read_length(chunk, pos, utf8)
                if utf8:
                    length, pos = read_length(chunk, pos, True)
                    value = chunk[pos:pos + length].decode("utf-8")
                else:
                    value = chunk[pos:pos + chars * 2].decode("utf-16-le")
                if value == previous:
                    value = version
                    changed = True
                values.append(value)
            prefix = bytearray(chunk[:start])
            encoded = bytearray()
            for i, value in enumerate(values):
                struct.pack_into("<I", prefix, size_header + i * 4, len(encoded))
                chars = len(value.encode("utf-16-le")) // 2
                raw = value.encode("utf-8" if utf8 else "utf-16-le")
                encoded += length_bytes(chars, utf8)
                if utf8:
                    encoded += length_bytes(len(raw), True)
                encoded += raw + (b"\0" if utf8 else b"\0\0")
            encoded += b"\0" * (-len(encoded) % 4)
            tail = chunk[style_start:] if style_start else b""
            struct.pack_into("<I", prefix, 24, start + len(encoded) if style_start else 0)
            chunk = prefix + encoded + tail
            struct.pack_into("<I", chunk, 4, len(chunk))
        chunks.append(chunk)
    assert changed, "Manifest version string was not found"
    output = bytearray(data[:header_size]) + b"".join(chunks)
    struct.pack_into("<I", output, 4, len(output))
    return bytes(output)


def display_js(data, build):
    text = data.decode("utf-8")
    return re.sub(r"stay calm! · [0-9]+\.[0-9]+ \([0-9]+\)",
                  f"stay calm! · 0.{build} ({build})", text).encode("utf-8")


def rewrite_package(path, build, apk=False, previous=None):
    output = path.with_suffix(".rewritten")
    with zipfile.ZipFile(path) as original, zipfile.ZipFile(output, "w") as revised:
        for item in original.infolist():
            if apk and item.filename.startswith("META-INF/") and (item.filename.upper().endswith((".SF", ".RSA", ".DSA", ".EC")) or item.filename == "META-INF/MANIFEST.MF"):
                continue
            value = original.read(item.filename)
            if item.filename.endswith("/Info.plist") and not apk:
                info = plistlib.loads(value)
                info["CFBundleShortVersionString"] = f"0.{build}"
                assert str(info["CFBundleVersion"]) == str(build)
                value = plistlib.dumps(info, sort_keys=False)
            if item.filename.endswith("/web/app.js"):
                value = display_js(value, build)
            if item.filename.endswith("/web/version.js"):
                value = f"const CalmVersion=Object.freeze({{build:{build},name:'0.{build}'}});".encode()
            if apk and item.filename == "AndroidManifest.xml":
                value = patch_manifest(value, previous, f"0.{build}")
            revised.writestr(item, value)
    output.replace(path)


def apk_version(aapt, path):
    text = run(str(aapt), "dump", "badging", str(path))
    return re.search(r"versionName='([^']*)'", text).group(1)


def main():
    repo = os.environ["GITHUB_REPOSITORY"]
    with open("ios/Info.plist", "rb") as stream:
        current = int(plistlib.load(stream)["CFBundleVersion"])
    tools = pathlib.Path(os.environ["ANDROID_HOME"]) / "build-tools/35.0.0"
    signing = pathlib.Path.home() / ".android/debug.keystore"
    releases = json.loads(run("gh", "api", f"repos/{repo}/releases?per_page=100"))
    for release in sorted(releases, key=lambda r: r["created_at"]):
        match = re.fullmatch(r"build-(\d+)", release["tag_name"])
        if not match or int(match[1]) >= current:
            continue
        build = int(match[1])
        tag = release["tag_name"]
        if release["name"] == f"stay calm! 0.{build}":
            continue
        with tempfile.TemporaryDirectory() as directory:
            directory = pathlib.Path(directory)
            run("gh", "release", "download", tag, "--dir", str(directory), "--pattern", "*.ipa", "--pattern", "*.apk", "--pattern", "source.json")
            ipa = directory / f"stay-calm-{build}.ipa"
            if ipa.exists():
                rewrite_package(ipa, build)
                with zipfile.ZipFile(ipa) as archive:
                    assert archive.testzip() is None
                    assert plistlib.loads(archive.read("Payload/StayCalm.app/Info.plist"))["CFBundleShortVersionString"] == f"0.{build}"
            apk = directory / f"stay-calm-{build}.apk"
            if apk.exists():
                previous = apk_version(tools / "aapt", apk)
                rewrite_package(apk, build, apk=True, previous=previous)
                aligned = directory / "aligned.apk"
                run(str(tools / "zipalign"), "-P", "16", "-f", "4", str(apk), str(aligned))
                run(str(tools / "apksigner"), "sign", "--ks", str(signing),
                    "--ks-key-alias", "androiddebugkey", "--ks-pass", "pass:android",
                    "--out", str(apk), str(aligned))
                aligned.unlink()
                run(str(tools / "apksigner"), "verify", str(apk))
                assert apk_version(tools / "aapt", apk) == f"0.{build}"
            source = directory / "source.json"
            if source.exists():
                data = json.loads(source.read_text())
                app = data["apps"][0]
                app["version"] = f"0.{build}"
                if ipa.exists():
                    app["size"] = ipa.stat().st_size
                for version in app.get("versions", []):
                    number = int(version.get("buildVersion", build))
                    version["version"] = f"0.{number}"
                    if number == build and ipa.exists():
                        version["size"] = ipa.stat().st_size
                source.write_text(json.dumps(data, ensure_ascii=False, indent=2))
            files = [str(p) for p in directory.iterdir() if p.suffix in (".ipa", ".apk", ".json")]
            if files:
                run("gh", "release", "upload", tag, *files, "--clobber")
            run("gh", "api", "--method", "PATCH", f"repos/{repo}/releases/{release['id']}", "-f", f"name=stay calm! 0.{build}")
            print(f"Verified {tag}: 0.{build}", flush=True)


if __name__ == "__main__":
    main()
