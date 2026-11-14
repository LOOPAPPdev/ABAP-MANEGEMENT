"""One-time import: Full_Stack_Governance_Workbook.xlsx -> versioned JSON fixture.

Usage: python3 -I scripts/import_workbook.py <workbook.xlsx> <out.json>

Reads only. Never writes the workbook. Area is derived from Phase via
DATA_Lists (same rule as the workbook formula in DATA_Activities!C).
"""
import hashlib
import json
import sys
import warnings
from datetime import date, datetime

import openpyxl

warnings.filterwarnings("ignore", category=UserWarning)

STATIC = ["ID", "Phase", "Activity", "Objective", "Tutorial", "Knowledge", "Tool",
          "Deliverable", "Dependency", "Acceptance", "Reference"]
INPUT = ["Status", "Priority", "Owner", "Due", "Evidence", "Notes"]
HEADER_ROW = 4


def cell(v):
    if v is None:
        return ""
    if isinstance(v, (datetime, date)):
        return v.strftime("%Y-%m-%d")
    return str(v).strip()


def main(src, out):
    raw = open(src, "rb").read()
    wb = openpyxl.load_workbook(src, data_only=False, read_only=True)

    lists = wb["DATA_Lists"]
    statuses, status_defs, priorities, phase_area, areas = [], {}, [], {}, []
    header_seen = False
    for row in lists.iter_rows(values_only=True):
        _, st, st_def, _, prio, _, phase, area, _, area_order = (list(row) + [None] * 10)[:10]
        if not header_seen:
            # Skip title rows until the header row ("Status", ..., "Phase", "Area").
            header_seen = cell(st) == "Status" and cell(phase) == "Phase"
            continue
        if st:
            statuses.append(cell(st))
            status_defs[cell(st)] = cell(st_def)
        if prio:
            priorities.append(cell(prio))
        if phase:
            phase_area[cell(phase)] = cell(area)
        if area_order:
            areas.append(cell(area_order))

    ws = wb["DATA_Activities"]
    rows = list(ws.iter_rows(min_row=HEADER_ROW, values_only=True))
    head = [cell(h) for h in rows[0]]
    col = {name: head.index(name) for name in STATIC + INPUT}

    activities = []
    for r in rows[1:]:
        if not cell(r[col["ID"]]):
            continue
        a = {name: cell(r[col[name]]) for name in STATIC + INPUT}
        a["Area"] = phase_area.get(a["Phase"], "A DEFINIR")
        activities.append(a)

    fixture = {
        "version": 1,
        "source": {
            "file": "data/source/Full_Stack_Governance_Workbook.xlsx",
            "sha256": hashlib.sha256(raw).hexdigest(),
            "sheet": "DATA_Activities",
        },
        "statuses": statuses,
        "statusDefinitions": status_defs,
        "priorities": priorities,
        "areas": areas,
        "phaseArea": phase_area,
        "activities": activities,
    }
    with open(out, "w", encoding="utf-8") as f:
        json.dump(fixture, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"wrote {out}: {len(activities)} activities, {len(statuses)} statuses")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
