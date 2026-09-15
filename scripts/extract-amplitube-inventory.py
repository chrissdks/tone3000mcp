"""Extract a normalized gear-name inventory from an official IK PDF.

Usage:
  python scripts/extract-amplitube-inventory.py <inventory.pdf> <output.json>

The output contains names, categories, source pages, and document metadata only.
It does not reproduce product descriptions, artwork, or manual prose.
"""

from __future__ import annotations

from collections import Counter
import json
from pathlib import Path
import re
import sys
import unicodedata

from pypdf import PdfReader


CATEGORIES = {
    "STOMP": "stomp",
    "AMP": "amp",
    "CAB": "cabinet",
    "SPEAKER": "speaker",
    "MIC": "microphone",
    "RACK": "rack",
    "ROOM": "room",
}


def clean(value: str) -> str:
    return unicodedata.normalize("NFKC", value.replace("ﬁ", "fi")).strip()


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: extract-amplitube-inventory.py <inventory.pdf> <output.json>")

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    reader = PdfReader(input_path)
    first_page = clean(reader.pages[0].extract_text() or "")
    version_match = re.search(r"Document version:\s*([^\n]+)", first_page)
    update_match = re.search(r"Latest Update:\s*([^\n]+)", first_page)
    total_match = re.search(r"TOTAL\s+(\d+)", first_page)
    if not version_match or not update_match or not total_match:
        raise ValueError("The PDF does not contain the expected IK inventory metadata.")

    gear: list[dict[str, object]] = []
    for page_number, page in enumerate(reader.pages[1:], start=2):
        lines = [clean(line) for line in (page.extract_text() or "").splitlines() if clean(line)]
        category_label = next((line for line in lines if line in CATEGORIES), None)
        if category_label is None:
            raise ValueError(f"No gear category found on PDF page {page_number}.")
        category = CATEGORIES[category_label]
        count_index = lines.index(category_label) + 1
        expected_category_count = int(lines[count_index])

        for line in lines:
            if line.startswith("Gear included in AmpliTube 5 MAX"):
                continue
            if line in CATEGORIES or line == str(expected_category_count) or line == str(page_number):
                continue
            gear.append({"category": category, "displayName": line, "inventoryPage": page_number})

    counts = Counter(item["category"] for item in gear)
    expected_counts = {
        CATEGORIES[label]: int(count)
        for label, count in re.findall(r"^(STOMP|AMP|CAB|SPEAKER|MIC|RACK|ROOM)\s+(\d+)$", first_page, re.MULTILINE)
    }
    if counts != Counter(expected_counts):
        raise ValueError(f"Extracted category counts {dict(counts)} do not match {expected_counts}.")
    if len(gear) != int(total_match.group(1)):
        raise ValueError(f"Extracted {len(gear)} records; PDF declares {total_match.group(1)}.")

    payload = {
        "product": "AmpliTube 5 MAX v2",
        "inventoryVersion": version_match.group(1).strip(),
        "inventoryUpdated": update_match.group(1).strip(),
        "inventoryUrl": "https://www.ikmultimedia.com/products/include/at5/gear_list_pdf/AmpliTube_5_MAX_v5.10.4_gear.pdf",
        "categoryCounts": expected_counts,
        "total": len(gear),
        "gear": gear,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Extracted {len(gear)} records to {output_path}")


if __name__ == "__main__":
    main()
