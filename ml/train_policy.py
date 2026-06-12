#!/usr/bin/env python3
"""P1-1：从 rows.jsonl 训练候选排序模型（LogisticRegression）。"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, roc_auc_score
from sklearn.model_selection import GroupShuffleSplit

from feature_encoder import feature_names, iter_training_examples, load_rows, save_feature_spec


def build_matrix(rows_path: Path):
    X = []
    y = []
    w = []
    groups = []
    row_ids = []
    names = feature_names()

    for ex in iter_training_examples(load_rows(rows_path)):
        X.append(ex["vector"])
        y.append(ex["label"])
        w.append(ex["weight"])
        groups.append(ex["game_id"] or ex["row_id"])
        row_ids.append(ex["row_id"])

    return np.array(X, dtype=np.float64), np.array(y), np.array(w), np.array(groups), names, row_ids


def row_top1_accuracy(rows_path: Path, model, names: list[str]) -> dict:
    from feature_encoder import encode_row_candidate, vectorize, _play_signature

    hits = 0
    total = 0
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
        if _play_signature(best.get("play")) == label_sig:
            hits += 1
        total += 1
    return {"top1": hits / total if total else 0.0, "rows": total}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--rows", default="datasets/v1/rows.jsonl")
    parser.add_argument("--out", default="models/policy-v001")
    args = parser.parse_args()

    root = Path(__file__).resolve().parent.parent
    rows_path = root / args.rows
    out_dir = root / args.out
    out_dir.mkdir(parents=True, exist_ok=True)

    if not rows_path.exists():
        raise SystemExit(f"缺少训练行文件: {rows_path}\n请先运行: node tools/batch-auto-games.mjs 200 && node tools/replay-to-rows.mjs")

    X, y, w, groups, names, _ = build_matrix(rows_path)
    if len(X) < 50:
        raise SystemExit(f"样本过少 ({len(X)} 条候选展开)，请先 batch-auto-games 生成更多数据")

    splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    train_idx, test_idx = next(splitter.split(X, y, groups))

    model = LogisticRegression(
        max_iter=200,
        class_weight="balanced",
        random_state=42,
    )
    model.fit(X[train_idx], y[train_idx], sample_weight=w[train_idx])

    test_prob = model.predict_proba(X[test_idx])[:, 1]
    test_pred = model.predict(X[test_idx])
    metrics = {
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "rowsFile": str(rows_path.relative_to(root)),
        "examples": int(len(X)),
        "positiveRate": float(y.mean()),
        "candidateAccuracy": float(accuracy_score(y[test_idx], test_pred)),
        "candidateAuc": float(roc_auc_score(y[test_idx], test_prob)) if len(set(y[test_idx])) > 1 else None,
        "rowTop1Train": row_top1_accuracy(rows_path, model, names),
    }

    export = {
        "version": 1,
        "modelType": "logistic_regression",
        "featureNames": names,
        "weights": model.coef_[0].tolist(),
        "bias": float(model.intercept_[0]),
    }

    (out_dir / "model.json").write_text(json.dumps(export, indent=2), encoding="utf-8")
    (out_dir / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    save_feature_spec(out_dir / "feature_spec.json")

    print(json.dumps({"ok": True, "out": str(out_dir), "metrics": metrics}, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
