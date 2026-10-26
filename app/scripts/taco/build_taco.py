"""Builds src/lib/nutrition/taco.json from the official TACO spreadsheet.

Source: Tabela Brasileira de Composição de Alimentos (TACO), 4ª edição
revisada e ampliada, NEPA/UNICAMP, 2011 ("Taco_4a_edicao_2011.xls").
Values are per 100 g of edible portion.

    pip install xlrd==2.0.1
    python scripts/taco/build_taco.py <path-to-xls> src/lib/nutrition/taco.json

Rules, from the table's own legend: "Tr" (trace) and "NA" (não aplicável,
e.g. protein in oil) become 0. "*" (analysis under re-evaluation) has no
value, so a food with "*" in energy, protein, lipids or carbohydrate is left
out instead of guessed; fibre "*" becomes null. Energy is rounded to whole
kcal and the rest to 0.1 g, as in the printed table.
"""

import json
import sys

import xlrd

COLUMNS = {"kcal": 3, "protein": 5, "fat": 6, "carbs": 8, "fiber": 9}


def value(raw):
    if isinstance(raw, (int, float)):
        return float(raw)
    text = str(raw).strip()
    if text.lower().startswith("tr") or text.upper() == "NA":
        return 0.0
    try:
        return float(text.replace(",", "."))
    except ValueError:
        return None  # "*" (under re-evaluation) or blank


def main(xls_path, out_path):
    sheet = xlrd.open_workbook(xls_path).sheet_by_index(0)
    foods, skipped, category = [], [], None
    for r in range(sheet.nrows):
        first, name = sheet.cell_value(r, 0), str(sheet.cell_value(r, 1)).strip()
        if isinstance(first, str) and first.strip() and not name and not str(sheet.cell_value(r, 2)).strip():
            if not first.strip().startswith(("Número", "Alimento")):
                category = first.strip()
            continue
        if not isinstance(first, float) or not name:
            continue
        item = int(first)
        v = {key: value(sheet.cell_value(r, col)) for key, col in COLUMNS.items()}
        if any(v[k] is None for k in ("kcal", "protein", "fat", "carbs")):
            skipped.append(f"{item} {name}")
            continue
        food = {
            "item": item,
            "name": " ".join(name.split()),
            "category": category,
            "kcal": round(v["kcal"]),
            "protein": round(v["protein"], 1),
            "carbs": round(v["carbs"], 1),
            "fat": round(v["fat"], 1),
            "fiber": None if v["fiber"] is None else round(v["fiber"], 1),
        }
        if food["protein"] + food["carbs"] + food["fat"] > 100:
            skipped.append(f"{item} {name} (macros > 100 g after rounding)")
            continue
        foods.append(food)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"source": "TACO 4ª edição revisada e ampliada (NEPA/UNICAMP, 2011)", "foods": foods}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(foods)} foods written, {len(skipped)} skipped")
    for s in skipped:
        print("  skipped:", s)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
