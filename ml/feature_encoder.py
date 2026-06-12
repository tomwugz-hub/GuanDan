"""训练行 → 特征向量（与 Node 侧 policy 推理共用同一套字段名）。"""

from __future__ import annotations

import json
from pathlib import Path

RANKS = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"]
PLAY_TYPES = [
    "Pass",
    "Single",
    "Pair",
    "Triple",
    "TripleWithPair",
    "Straight",
    "ConsecutivePairs",
    "Plane",
    "Bomb",
    "StraightFlush",
    "JokerBomb",
    "Invalid",
]


def rank_power(rank: str, level_rank: str) -> int:
    order = [r for r in RANKS if r != level_rank] + [level_rank]
    if rank in ("SJ", "BJ"):
        order = order + ["SJ", "BJ"]
        return order.index(rank)
    return order.index(rank) if rank in order else 0


def hand_rank_counts(hand: list[dict]) -> dict[str, int]:
    counts = {r: 0 for r in RANKS}
    for card in hand or []:
        rank = card.get("rank")
        if rank in counts:
            counts[rank] += 1
    return counts


def breaks_bomb_material(hand: list[dict], play_cards: list[dict]) -> int:
    counts = hand_rank_counts(hand)
    used = {}
    for card in play_cards or []:
        rank = card.get("rank")
        used[rank] = used.get(rank, 0) + 1
    for rank, used_n in used.items():
        held = counts.get(rank, 0)
        if held >= 4 and 0 < used_n < held and held - used_n < 4:
            return 1
    return 0


def one_hot(index: int, size: int) -> list[float]:
    vec = [0.0] * size
    if 0 <= index < size:
        vec[index] = 1.0
    return vec


def encode_row_candidate(row: dict, candidate: dict) -> dict[str, float]:
    state = row.get("state") or {}
    level = row.get("levelRank") or "2"
    seat = int(row.get("seat") or 0)
    hand = state.get("hand") or []
    hand_counts = state.get("handCounts") or [27, 27, 27, 27]
    must = state.get("mustBeat") or state.get("lastActivePlay")
    play = candidate.get("play") or {}
    play_type = play.get("type") or "Pass"
    play_cards = play.get("cards") or []

    opp_counts = [hand_counts[i] for i in range(4) if i != seat]
    partner = int(state.get("partnerSeat") or (seat + 2) % 4)
    last_active = state.get("lastActivePlayerIndex")

    feats: dict[str, float] = {
        "seat_norm": seat / 3.0,
        "partner_norm": partner / 3.0,
        "hand_count_norm": (state.get("handCount") or len(hand)) / 27.0,
        "opp_min_norm": min(opp_counts) / 27.0 if opp_counts else 1.0,
        "opp_max_norm": max(opp_counts) / 27.0 if opp_counts else 1.0,
        "partner_owns_trick": 1.0 if last_active == partner else 0.0,
        "opponent_owns_trick": 1.0
        if last_active is not None and last_active != seat and last_active != partner
        else 0.0,
        "candidate_length_norm": (play.get("length") or 0) / 10.0,
        "candidate_power_norm": rank_power(play.get("mainRank") or "3", level) / 14.0,
        "engine_score_norm": (candidate.get("score") or 0) / 10000.0,
        "breaks_bomb": float(breaks_bomb_material(hand, play_cards)),
        "tier_weight": float(row.get("weight") or 0.15),
    }

    if must and must.get("type") != "Pass":
        feats["must_beat_power_norm"] = rank_power(must.get("mainRank") or "3", level) / 14.0
    else:
        feats["must_beat_power_norm"] = 0.0

    for i, _ in enumerate(RANKS):
        feats[f"hand_rank_{RANKS[i]}_norm"] = hand_rank_counts(hand)[RANKS[i]] / 8.0

    for i, pt in enumerate(PLAY_TYPES):
        feats[f"play_type_{pt}"] = 1.0 if play_type == pt else 0.0

    if must:
        must_type = must.get("type") or "Pass"
        for i, pt in enumerate(PLAY_TYPES):
            feats[f"must_type_{pt}"] = 1.0 if must_type == pt else 0.0
    else:
        for pt in PLAY_TYPES:
            feats[f"must_type_{pt}"] = 0.0

    return feats


def feature_names() -> list[str]:
    sample_row = {
        "seat": 0,
        "levelRank": "2",
        "weight": 0.15,
        "state": {
            "hand": [],
            "handCount": 27,
            "handCounts": [27, 27, 27, 27],
            "partnerSeat": 2,
            "lastActivePlayerIndex": 1,
            "mustBeat": {"type": "Pair", "mainRank": "9"},
        },
    }
    sample_cand = {
        "score": -100,
        "play": {"type": "Pair", "mainRank": "10", "length": 2, "cards": []},
    }
    return sorted(encode_row_candidate(sample_row, sample_cand).keys())


def vectorize(feats: dict[str, float], names: list[str]) -> list[float]:
    return [float(feats.get(name, 0.0)) for name in names]


def load_rows(path: Path) -> list[dict]:
    rows = []
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return rows
    for line in text.splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def iter_training_examples(rows: list[dict]):
    """每条训练行展开为 (特征, 是否为正样本, 样本权重)。"""
    names = feature_names()
    for row in rows:
        candidates = row.get("candidates") or []
        if len(candidates) < 1:
            continue
        label_sig = _play_signature(row.get("label", {}).get("play"))
        if not label_sig:
            continue
        weight = float(row.get("weight") or 0.15)
        tier = row.get("tier") or "bronze"
        if tier == "gold":
            weight *= 2.0
        any_positive = False
        for cand in candidates:
            sig = _play_signature(cand.get("play"))
            is_positive = sig == label_sig
            if is_positive:
                any_positive = True
            feats = encode_row_candidate(row, cand)
            yield {
                "row_id": row.get("rowId"),
                "game_id": row.get("gameId"),
                "vector": vectorize(feats, names),
                "label": 1 if is_positive else 0,
                "weight": weight,
            }
        if not any_positive:
            # 标签不在候选里：跳过（后续可做负样本挖掘）
            continue


def _play_signature(play: dict | None) -> str:
    if not play or play.get("type") == "Pass":
        return "Pass:"
    cards = play.get("cards") or []
    ids = sorted(
        f"{c.get('suit')}{c.get('rank')}#{c.get('deckIndex', 0)}" for c in cards
    )
    return f"{play.get('type')}:{'|'.join(ids)}"


def save_feature_spec(path: Path) -> None:
    path.write_text(
        json.dumps({"version": 1, "featureNames": feature_names()}, indent=2),
        encoding="utf-8",
    )
