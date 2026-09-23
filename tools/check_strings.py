#!/usr/bin/env python3
"""Assert the shipped strings match GDD-07 byte for byte.

QA item 1 of GDD-07 §13 is "string parity: every `STR_*`/`UI_*` in §5.11 + area
strings matches shipped text byte-for-byte". This script automates it for
everything the menu build ships, by parsing the spec document itself:

  §5.11 shell string master table   -> data/strings.json   ("spec" block)
  §5.9  the 16 loading tips         -> data/shell_content.json
  §5.1  sublock, fan disclaimer,
        abridged menu disclaimer    -> data/strings.json   ("build" block)
  §14.2 SRD 5.2.1 attribution block -> data/strings.json   ("build" block)

Run:  python3 tools/check_strings.py
Exit code 0 = perfect parity; 1 = at least one string drifted.
"""

from __future__ import annotations

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, "web")
REPO = ROOT
SPEC = os.path.join(REPO, "07_PIXEL_PROLOGUE_YARD_AND_MENU_BUILD_SPEC.md")

problems: list[str] = []
checked = 0


def compare(label: str, shipped: str, spec: str) -> None:
    global checked
    checked += 1
    if shipped != spec:
        problems.append(
            "%s\n     spec:   %r\n     shipped: %r" % (label, spec, shipped)
        )


def load(rel: str) -> dict:
    return json.load(open(os.path.join(WEB, rel), encoding="utf-8"))


def section(doc: str, start: str, end: str) -> str:
    if start not in doc:
        problems.append("spec anchor not found: %r" % start)
        return ""
    return doc.split(start, 1)[1].split(end, 1)[0]


def main() -> int:
    if not os.path.exists(SPEC):
        print("spec document not found at %s" % SPEC)
        return 2
    doc = open(SPEC, encoding="utf-8").read()
    strings = load("data/strings.json")
    content = load("data/shell_content.json")

    # --- §5.11 string master ------------------------------------------
    table = section(doc, "### 5.11 Shell string master table", "### 5.12")
    rows = re.findall(r"^\| (STR_[A-Z0-9_]+) \| `(.*)` \|$", table, re.M)
    if len(rows) != 34:
        problems.append("expected 34 rows in §5.11, parsed %d" % len(rows))
    for key, value in rows:
        if key not in strings["spec"]:
            problems.append("strings.json is missing %s" % key)
            continue
        compare(key, strings["spec"][key], value)

    # --- §5.9 loading tips --------------------------------------------
    tips_section = section(doc, "**The 16 tips (verbatim, rotate in order):**", "- **Complete →**")
    tips: list[str] = []
    for line in tips_section.strip().splitlines():
        match = re.match(r"^\s*\d+\.\s+`(.*?)`\s*(.*)$", line)
        if match is None:
            continue
        body, tail = match.group(1), match.group(2)
        replacement = re.search(r"pixel replacement tip:\*\* `(.*?)`", tail)
        tips.append(replacement.group(1) if replacement else body)
    shipped_tips = content["loading_tips"]
    if len(tips) != len(shipped_tips):
        problems.append("spec has %d tips, shipped %d" % (len(tips), len(shipped_tips)))
    for index, tip in enumerate(tips):
        if index < len(shipped_tips):
            compare("loading tip %d" % (index + 1), shipped_tips[index], tip)

    # --- §5.1 brand strings -------------------------------------------
    sublock = section(doc, "**Sublock (splash, 5 px, letterspaced, two lines):**", "- **Fan-work disclaimer")
    compare("STR_SUBLOCK_1", strings["build"]["STR_SUBLOCK_1"], sublock.split("`")[1])
    compare("STR_SUBLOCK_2", strings["build"]["STR_SUBLOCK_2"], sublock.split("`")[3])

    disclaimer = section(doc, "**Fan-work disclaimer (verbatim, ships on legal screen", "At 5 px on 480-wide")
    full = re.search(r"^\s*`(.+?)`\s*$", disclaimer, re.M)
    if full is None:
        problems.append("could not parse the §5.1 fan-work disclaimer")
    else:
        compare("STR_DISCLAIMER_FULL", strings["build"]["STR_DISCLAIMER_FULL"], full.group(1))
    abridged = re.search(r"abridge to `(.+?)` \(tooltip", doc)
    if abridged is None:
        problems.append("could not parse the abridged menu disclaimer")
    else:
        compare("STR_DISCLAIMER_ABRIDGED",
                strings["build"]["STR_DISCLAIMER_ABRIDGED"], abridged.group(1))

    # --- §14.2 SRD attribution ----------------------------------------
    srd = section(doc, "2. **SRD 5.2.1 attribution block**", "3. **All R1–R13")
    quoted = re.search(r"^> (.+)$", srd, re.M)
    if quoted is None:
        problems.append("could not parse the §14.2 SRD attribution block")
    else:
        compare("STR_SRD_ATTRIBUTION", strings["build"]["STR_SRD_ATTRIBUTION"], quoted.group(1))

    print("checked %d strings against the spec" % checked)
    if problems:
        print("\n%d mismatch(es):\n" % len(problems))
        for problem in problems:
            print("  - %s" % problem)
        return 1
    print("string parity clean")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
