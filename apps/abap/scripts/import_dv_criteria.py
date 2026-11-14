"""Convert the data-visualization quality criteria CSV into a versioned JSON fixture.

Usage: python3 -I scripts/import_dv_criteria.py <criteria.csv> <out.json>
"""
import csv
import hashlib
import json
import sys


def main(src, out):
    raw = open(src, "rb").read()
    rows = list(csv.DictReader(open(src, encoding="utf-8-sig")))
    criteria = []
    for r in rows:
        criteria.append({
            "id": r["criterio_id"],
            "dimension": r["dimensao"],
            "criterion": r["criterio_qualidade"],
            "obligation": r["obrigacao"],
            "nature": r["natureza"],
            "rationale": r["justificativa"],
            "applicability": r["condicao_aplicabilidade"],
            "verification": r["metodo_verificacao"],
            "given": r["given"],
            "when": r["when"],
            "then": r["then"],
            "passRule": r["regra_aprovacao"],
            "failure": r["falha"],
            "severity": r["severidade"],
            "weight": int(r["peso"]),
            "automation": r["automacao"],
            "requiredEvidence": r["evidencia_obrigatoria"],
            "exceptions": r["excecoes"],
            "extractionConfidence": r["confianca_extracao"],
            "sourcePages": r["paginas_fonte"],
        })
    fixture = {
        "version": 1,
        "source": {"file": src, "sha256": hashlib.sha256(raw).hexdigest()},
        "criteria": criteria,
    }
    with open(out, "w", encoding="utf-8") as f:
        json.dump(fixture, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"wrote {out}: {len(criteria)} criteria")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
