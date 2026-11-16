"""One-off L15 edit (backlog 1.5): fills the three unavailable S3 notice sections.

Usage: python -I apply-l15.py <repo> <LICENSE-2.0.txt> <extracted crates dir>
Inputs are the official Apache text and the Cargo.lock-checksum-matched crate archives' text files.
"""
import hashlib
import sys
from pathlib import Path

repo, apache_path, crates = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
apache_bytes = apache_path.read_bytes()
apache = apache_bytes.decode("utf-8").replace("\r\n", "\n").rstrip("\n")
apache_sha = hashlib.sha256(apache_bytes).hexdigest()
gap = "License text unavailable in the exact local package. Distribution gate remains open.\n"
notices = repo / "packages/s3-native/THIRD_PARTY_NOTICES.md"
text = notices.read_text(encoding="utf-8")


def selection(declaration, archive_sha):
    return (
        f"Selected license: Apache-2.0, one of the options offered by the package declaration `{declaration}`; "
        "the package's own license is unchanged. Declaration source: the crates.io archive `Cargo.toml`, archive "
        f"SHA256 `{archive_sha}` (equal to the `Cargo.lock` checksum). The archive contains no LICENSE or NOTICE file. "
        "The text below is the standard Apache License 2.0 from <https://www.apache.org/licenses/LICENSE-2.0.txt> "
        f"(SHA256 `{apache_sha}`), not a file shipped by the package. The dependency is used unmodified.\n"
        "Presence of these notices in the distributed app's license materials is a release acceptance condition "
        "(20-21 acceptance collection §20), not verified by this file.\n"
    )


def standard():
    return "### Apache-2.0 (standard text)\n\n" + apache + "\n"


readme = (crates / "cesu8-1.1.0/README.md").read_text(encoding="utf-8").replace("\r\n", "\n").split("\n")
start = readme.index("## License")
readme_license = "\n".join(readme[start + 2:start + 9]).rstrip("\n")
rust = (crates / "cesu8-1.1.0/COPYRIGHT-RUST.txt").read_text(encoding="utf-8").replace("\r\n", "\n").split("\n")
end = rust.index("The Rust Project includes packages written by third parties.")
rust_notice = "\n".join(rust[:end]).rstrip("\n")
cesu8 = (
    selection("Apache-2.0/MIT", "6d43a04d8753f35258c91f8ec639f792891f748a1edbd759cf1dcea3382ad83c")
    + "\n### Notices carried by the package\n\n"
    + "From `README.md`, section \"License\" (verbatim):\n\n```text\n" + readme_license + "\n```\n\n"
    + "From `COPYRIGHT-RUST.txt`, Rust Project origin and dual-license notice (verbatim, up to the line before "
    + "\"The Rust Project includes packages written by third parties.\"). The remainder of that file lists third-party "
    + "components of the Rust Project distribution; it is not a cesu8 dependency list.\n\n```text\n"
    + rust_notice + "\n```\n\n" + standard()
)
instant = lambda sha: (
    selection("Apache-2.0 OR MIT", sha)
    + "No package copyright or attribution notice exists to retain; none is supplied here.\n\n" + standard()
)
sections = {
    "## cesu8 1.1.0\n\nSPDX: Apache-2.0/MIT\n\n": cesu8,
    "## instant-xml 0.7.7\n\nSPDX: Apache-2.0 OR MIT\n\n":
        instant("2c32db75b7c16c5051ea7b6605eea01f7b5a25abe84c20473c9e7c7987f5850c"),
    "## instant-xml-macros 0.7.2\n\nSPDX: Apache-2.0 OR MIT\n\n":
        instant("ac3c2e6cbd6e0579ee53a8290fc0015a438cfff0139c8359d5891cae130815d7"),
}
for head, body in sections.items():
    if text.count(head + gap) != 1:
        raise SystemExit(f"expected exactly one gap section: {head!r}")
    text = text.replace(head + gap, head + body)
old_intro = "License-text gaps remain a distribution gate."
if text.count(old_intro) != 1 or gap in text:
    raise SystemExit("unexpected notices header or remaining gap")
text = text.replace(old_intro, "Every package section carries a license text; presence in the distributed app's license "
    "materials remains a release acceptance gate (20-21 acceptance collection §20).")
notices.write_text(text, encoding="utf-8", newline="\r\n")
print("applied", apache_sha)
