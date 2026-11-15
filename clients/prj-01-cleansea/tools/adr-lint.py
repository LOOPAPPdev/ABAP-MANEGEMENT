#!/usr/bin/env python3
"""adr-lint: validate the CleanSea ADR control document and its README (stdlib only).

Usage: python3 tools/adr-lint.py <control-doc> [--readme <README.md>]
Version 0.2 (2026-11-15). Changes from 0.1:
- field names may contain digits (0.1 could not read the field 'arc42');
- optional README checks: stack board first, index in sync, stack status in sync.
"""
import hashlib
import re
import sys
from pathlib import Path

STATUS = {"Proposed", "Accepted", "Deprecated", "Superseded", "Rejected"}
AS_BUILT = {"VERIFIED", "UNVERIFIED", "N/A"}
FIELDS = ["id", "status", "date", "deciders", "as_built",
          "nist_process", "arc42", "ssdf", "trace", "evidence"]
SECTIONS = ["Context", "Decision", "Options", "Consequences",
            "Security impact", "Verification", "Revisit when"]
NIST = {"BA", "SN", "SR", "AR", "DE", "IP", "VE"}
KINDS = {"OWNER", "FILE", "CODE", "TEST", "WEB", "NONE"}
ID_RE = re.compile(r"^(BRD|PRD|FRD|SPEC|TEST|NFR)-(\d{3}|TBD)$")
SSDF_RE = re.compile(r"^(PO|PS|PW|RV)\.\d{1,2}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ADR_RE = re.compile(r"ADR-\d{3}")
SECRET_RE = re.compile(
    r"(AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|"
    r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.|sk-[A-Za-z0-9]{20,}|"
    r"(?i:(?:password|passwd|secret|token|api[_-]?key))\s*[:=]\s*['\"]?[A-Za-z0-9/+_.-]{12,})"
)


def split_blocks(text):
    blocks, cur = [], None
    for line in text.splitlines():
        if re.match(r"^## ADR-\d{3} ", line):
            cur = [line]
            blocks.append(cur)
        elif re.match(r"^#{1,2} ", line):
            cur = None
        elif cur is not None:
            cur.append(line)
    return ["\n".join(b) for b in blocks]


def csv(value):
    return [x.strip() for x in value.split(",") if x.strip()]


def check_block(block):
    errors, warnings = [], []
    head = block.splitlines()[0]
    m = re.match(r"^## (ADR-\d{3}) — (.+)$", head)
    if not m:
        return None, None, ["bad heading: " + head], warnings
    adr_id = m.group(1)
    top, *rest = block.split("\n### ")
    fields = dict(re.findall(r"(?m)^- ([a-z0-9_]+): *(.*)$", top))
    sections = {}
    for part in rest:
        name, _, body = part.partition("\n")
        sections[name.strip()] = body.strip()

    def err(msg):
        errors.append(f"{adr_id}: {msg}")

    for f in FIELDS:
        if not fields.get(f, "").strip():
            err(f"missing field '{f}'")
    for s in SECTIONS:
        if not sections.get(s):
            err(f"missing or empty section '{s}'")
    if fields.get("id") and fields["id"] != adr_id:
        err("id does not match heading")
    status = fields.get("status", "")
    if status and status not in STATUS:
        err(f"bad status '{status}'")
    if fields.get("date") and not DATE_RE.match(fields["date"]):
        err("date must be YYYY-MM-DD")
    ab = fields.get("as_built", "")
    if ab and ab not in AS_BUILT:
        err(f"bad as_built '{ab}'")
    for tok in csv(fields.get("nist_process", "")):
        if tok not in NIST:
            err(f"bad nist_process '{tok}'")
    for tok in csv(fields.get("arc42", "")):
        if not (tok.isdigit() and 1 <= int(tok) <= 12):
            err(f"bad arc42 section '{tok}'")
    for tok in csv(fields.get("ssdf", "")):
        if tok != "N/A" and not SSDF_RE.match(tok):
            err(f"bad ssdf tag '{tok}'")
    trace = csv(fields.get("trace", ""))
    for tok in trace:
        if not ID_RE.match(tok):
            err(f"bad trace id '{tok}'")
        elif status == "Accepted" and tok.endswith("TBD") and tok.split("-")[0] in ("BRD", "PRD", "FRD"):
            err(f"Accepted ADR has {tok}")
    evidence = [e.strip() for e in fields.get("evidence", "").split(" ; ") if e.strip()]
    kinds = []
    for e in evidence:
        kind, _, ref = e.partition(":")
        if kind not in KINDS:
            err(f"bad evidence kind '{kind}'")
        kinds.append(kind)
    if status == "Accepted":
        if not any(t.startswith(("BRD-", "PRD-")) and not t.endswith("TBD") for t in trace):
            err("Accepted ADR needs a BRD or PRD id in trace")
        if kinds and all(k == "NONE" for k in kinds):
            err("Accepted ADR has only NONE evidence")
        if ab == "UNVERIFIED":
            warnings.append(f"{adr_id}: Accepted but as_built is UNVERIFIED")
    if ab == "VERIFIED" and not any(k in ("CODE", "TEST") for k in kinds):
        err("as_built VERIFIED needs CODE or TEST evidence")
    if status == "Superseded" and fields.get("superseded_by", "none") == "none":
        err("Superseded ADR needs superseded_by")
    return adr_id, status, errors, warnings


def cells(line):
    return [c.strip() for c in line.strip().strip("|").split("|")]


def check_readme(path, statuses):
    """README contract (control document, section 2.14)."""
    errors = []
    text = Path(path).read_text(encoding="utf-8")
    lines = text.splitlines()
    h2 = [(i, l) for i, l in enumerate(lines) if l.startswith("## ")]
    if not h2 or not h2[0][1].startswith("## Stack"):
        errors.append("README: the first '## ' section must be '## Stack'")
    section, index_rows = None, {}
    for line in lines:
        if line.startswith("## "):
            section = line[3:].strip()
            continue
        if not line.startswith("|") or set(line) <= set("|-: "):
            continue
        row = cells(line)
        ids = ADR_RE.findall(line)
        for i in ids:
            if i not in statuses:
                errors.append(f"README: {i} is not in the register")
        if section and section.startswith("Stack") and len(set(ids)) == 1:
            want = statuses.get(ids[0])
            if want and not any(want in c for c in row):
                errors.append(f"README stack row '{row[0]}': status must show '{want}' ({ids[0]})")
        if section and section.startswith("ADR index") and row and ADR_RE.fullmatch(row[0]):
            index_rows[row[0]] = row
    for adr_id, status in statuses.items():
        row = index_rows.get(adr_id)
        if row is None:
            errors.append(f"README: {adr_id} is not in the 'ADR index' table")
        elif not any(status in c for c in row[1:]):
            errors.append(f"README: {adr_id} index status must show '{status}'")
    stack_ids = set()
    in_stack = False
    for line in lines:
        if line.startswith("## "):
            in_stack = line.startswith("## Stack")
        elif in_stack and line.startswith("|"):
            stack_ids.update(ADR_RE.findall(line))
    if not stack_ids:
        errors.append("README: the stack board cites no ADR")
    for i, line in enumerate(lines, 1):
        if SECRET_RE.search(line):
            errors.append(f"README line {i}: possible secret")
    return errors


def main(argv):
    readme = None
    if "--readme" in argv:
        k = argv.index("--readme")
        readme = argv[k + 1]
        argv = argv[:k] + argv[k + 2:]
    path = argv[0] if argv else "CLAUDE.md"
    text = Path(path).read_text(encoding="utf-8")
    errors, warnings = [], []
    if not text.startswith("---\n"):
        errors.append("front matter missing")
    else:
        fm = text.split("---\n", 2)[1]
        for key in ("name", "description"):
            if not re.search(rf"(?m)^{key}:\s*\S", fm):
                errors.append(f"front matter lacks '{key}'")
    ids, hashes, statuses = [], {}, {}
    for block in split_blocks(text):
        adr_id, status, e, w = check_block(block)
        errors += e
        warnings += w
        if adr_id:
            ids.append(adr_id)
            statuses[adr_id] = status
            hashes[adr_id] = hashlib.sha256(block.encode("utf-8")).hexdigest()[:12]
    dup = {i for i in ids if ids.count(i) > 1}
    for d in sorted(dup):
        errors.append(f"duplicate ADR id {d}")
    indexed = re.findall(r"(?m)^\| (ADR-\d{3}) \|", text)
    for i in sorted(set(ids) - set(indexed)):
        errors.append(f"{i}: not in the index")
    for i in sorted(set(indexed) - set(ids)):
        errors.append(f"{i}: in the index but no ADR block")
    for i, line in enumerate(text.splitlines(), 1):
        if SECRET_RE.search(line):
            errors.append(f"line {i}: possible secret")
    if readme:
        errors += check_readme(readme, statuses)
    for adr_id in ids:
        print(f"{adr_id}  {statuses[adr_id]:<10}  sha256:{hashes[adr_id]}")
    for w in warnings:
        print("WARNING:", w)
    for e in errors:
        print("ERROR:", e)
    print(f"ADRS: {len(ids)}  WARNINGS: {len(warnings)}  ERRORS: {len(errors)}"
          + ("  README: checked" if readme else "  README: not checked"))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
