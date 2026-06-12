#!/usr/bin/env python3
"""P1-1：离线评估 policy-v001 的整行 Top1 命中率。"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from feature_encoder import encode_row_candidate, load_rows, vectorize, _play_signature
from sklearn.linear_model import LogisticRegression
import numpy as np


def load_model(path: Path) -> tuple[LogisticRegression, list[str]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    names = data["featureNames"]
    model = LogisticRegression()
    model.classes_ = np.array([0, 1])
    model.coef_ = np.array([data["weights"]], dtype=np.float64)
    model.intercept_ = np.array([data["bias"]], dtype=np.float64)
    return model, names


def eval_rows(rows_path: Path, model, names: list[str]) -> dict:
    hits = 0
    total = 0
    by_tier = {}
    for row in load_rows(rows_path):
        candidates = row.get("candidates") or []
        if len(candidates) < 2:
            continue
        label_sig = _play_signature(row.get("label", {}).get("play"))
        if not label_sig:
            continue
        scores = []
        for cand in candidates:
            vec = vectorize(encode_row_candidate(row, cand), names)
            prob = model.predict_proba([vec])[0][1]
            scores.append((prob, cand))
        best = max(scores, key=lambda item: item[0])[1]
        ok = _play_signature(best.get("play")) == label_sig
        tier = row.get("tier") or "unknown"
        bucket = by_tier.setdefault(tier, {"hits": 0, "total": 0})
        bucket["total"] += 1
        if ok:
            hits += 1
            bucket["hits"] += 1
        total += 1

    return {
        "top1Accuracy": hits / total if total else 0.0,
        "evaluatedRows": total,
        "byTier": {
            tier: {
                "top1": val["hits"] / val["total"] if val["total"] else 0.0,
                "rows": val["total"],
            }
            for tier, val in by_tier.items()
        },
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--rows", default="datasets/v1/rows.jsonl")
    parser.add_argument("--model", default="models/policy-v001/model.json")
    args = parser.parse_args()

    root = Path(__file__).resolve().parent.parent
    rows_path = root / args.rows
    model_path = root / args.model

    model, names = load_model(model_path)
    result = eval_rows(rows_path, model, names)
    print(json.dumps({"ok": True, "model": str(model_path), **result}, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
