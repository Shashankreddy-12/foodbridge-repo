"""
ml_service/smart_matching.py

Smart Donor–Receiver Matching — GradientBoosting scored by distance, urgency,
capacity, food-type preference, and safety score.

This replaces any partial (~) implementation. Works without pre-trained .pkl files:
the model trains on synthetic data at startup, producing sensible matches from day 0.

Add to ml_service/main.py:
    from smart_matching import router as matching_router
    app.include_router(matching_router, prefix="/ml", tags=["Matching"])

Endpoint:
    POST /ml/match   — rank available listings for a given receiver
"""

import math
import random
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

try:
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.preprocessing import StandardScaler
    import numpy as np
    USE_SKLEARN = True
except ImportError:
    USE_SKLEARN = False


# ─────────────────────────────────────────────────────────────────────────────
# Geo helpers
# ─────────────────────────────────────────────────────────────────────────────

def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km between two GPS points."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi  = math.radians(lat2 - lat1)
    dlam  = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ─────────────────────────────────────────────────────────────────────────────
# Feature engineering
# Features used to score a (listing, receiver) pair:
#   0  distance_km           normalised to 0–1 (cap 20km)
#   1  urgency               0/1
#   2  safety_score          0–1 (normalised from 0–100)
#   3  capacity_match        abs(listing_servings - receiver_capacity) / max
#   4  food_type_affinity    1 if matches receiver's top preference, else 0
#   5  qty_kg_norm           listing quantityKg / 20 (capped)
#   6  hrs_to_expiry_norm    hrs / 168 (1 week cap), inverted so lower=better
#   7  receiver_history_size number of past claims / 50 (normalised)
# ─────────────────────────────────────────────────────────────────────────────

def build_pair_features(listing: dict, receiver: dict) -> list:
    # Distance
    try:
        dist = haversine_km(
            receiver["lat"], receiver["lng"],
            listing["lat"], listing["lng"],
        )
    except Exception:
        dist = 5.0
    dist_norm = min(dist / 20.0, 1.0)

    urgency = 1.0 if listing.get("urgent") else 0.0
    safety  = float(listing.get("safetyScore") or 50) / 100.0
    qty_norm = min(float(listing.get("quantityKg") or 2) / 20.0, 1.0)

    # Hours to expiry — inverted so 0h left = 1.0 (higher = more urgent match needed)
    hrs = float(listing.get("hrsToExpiry") or 12)
    expiry_pressure = max(0.0, 1.0 - hrs / 168.0)

    # Capacity match
    listing_servings  = float(listing.get("servings") or 4)
    receiver_capacity = float(receiver.get("capacityServings") or 4)
    capacity_diff     = abs(listing_servings - receiver_capacity) / max(listing_servings, receiver_capacity, 1)
    capacity_match    = 1.0 - min(capacity_diff, 1.0)

    # Food type affinity
    top_pref    = (receiver.get("preferredFoodType") or "").lower()
    listing_ft  = (listing.get("foodType") or "other").lower()
    affinity    = 1.0 if top_pref and top_pref == listing_ft else 0.3

    # History size (receivers with more history → more reliable)
    history_norm = min(int(receiver.get("historySize") or 0) / 50.0, 1.0)

    return [dist_norm, urgency, safety, capacity_match, affinity, qty_norm, expiry_pressure, history_norm]


# ─────────────────────────────────────────────────────────────────────────────
# Synthetic training data
# Positive label = good match, Negative = bad match
# ─────────────────────────────────────────────────────────────────────────────

def make_synthetic_training():
    rng = random.Random(99)
    X, y = [], []

    for _ in range(800):
        # Good matches: close, safe, good type affinity, capacity ok
        dist_n    = rng.uniform(0, 0.3)
        urgency   = rng.choice([0, 1])
        safety    = rng.uniform(0.6, 1.0)
        cap_match = rng.uniform(0.6, 1.0)
        affinity  = rng.choice([0.7, 1.0])
        qty_n     = rng.uniform(0.05, 0.5)
        exp_press = rng.uniform(0, 0.5)
        hist_n    = rng.uniform(0, 1.0)
        X.append([dist_n, urgency, safety, cap_match, affinity, qty_n, exp_press, hist_n])
        y.append(1)

        # Bad matches: far, low safety, wrong type
        dist_n2   = rng.uniform(0.6, 1.0)
        urgency2  = 0
        safety2   = rng.uniform(0.0, 0.45)
        cap_match2= rng.uniform(0.0, 0.4)
        affinity2 = 0.3
        qty_n2    = rng.uniform(0.5, 1.0)
        exp_press2= rng.uniform(0.7, 1.0)
        hist_n2   = rng.uniform(0, 0.3)
        X.append([dist_n2, urgency2, safety2, cap_match2, affinity2, qty_n2, exp_press2, hist_n2])
        y.append(0)

        # Ambiguous (medium quality)
        if rng.random() < 0.3:
            X.append([
                rng.uniform(0.3, 0.6), rng.choice([0, 1]),
                rng.uniform(0.4, 0.7), rng.uniform(0.3, 0.7),
                rng.choice([0.3, 1.0]), rng.uniform(0.1, 0.4),
                rng.uniform(0.2, 0.7), rng.uniform(0.1, 0.6),
            ])
            y.append(rng.choice([0, 1]))

    return X, y


# ─────────────────────────────────────────────────────────────────────────────
# Model — trained once at import time
# ─────────────────────────────────────────────────────────────────────────────

_match_model  = None
_match_scaler = None

def get_match_model():
    global _match_model, _match_scaler
    if _match_model is not None:
        return _match_model, _match_scaler
    if not USE_SKLEARN:
        return None, None

    X, y = make_synthetic_training()
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(np.array(X))
    clf = GradientBoostingClassifier(
        n_estimators=120,
        learning_rate=0.08,
        max_depth=4,
        subsample=0.8,
        random_state=42,
    )
    clf.fit(X_scaled, np.array(y))
    _match_model  = clf
    _match_scaler = scaler
    return _match_model, _match_scaler


try:
    if USE_SKLEARN:
        get_match_model()
except Exception as e:
    print(f"[smart_matching] Model pre-load failed: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Rule-based fallback scorer
# ─────────────────────────────────────────────────────────────────────────────

def rule_score(features: list) -> float:
    dist_n, urgency, safety, cap_match, affinity, qty_n, exp_press, hist_n = features
    score  =  (1 - dist_n)  * 0.35   # closer = better (35% weight)
    score +=  safety        * 0.20   # safer = better  (20%)
    score +=  cap_match     * 0.15   # capacity fit    (15%)
    score +=  affinity      * 0.15   # food preference (15%)
    score +=  exp_press     * 0.10   # urgency push    (10%)
    score +=  hist_n        * 0.05   # history bonus   (5%)
    return round(score, 4)


# ─────────────────────────────────────────────────────────────────────────────
# API schemas
# ─────────────────────────────────────────────────────────────────────────────

class ReceiverProfile(BaseModel):
    receiverId: str
    lat: float
    lng: float
    preferredFoodType: Optional[str] = None
    capacityServings: Optional[int] = 4      # how many servings they can handle
    historySize: Optional[int] = 0           # number of past claims

class ListingCandidate(BaseModel):
    listingId: str
    foodType: str = "other"
    safetyScore: Optional[float] = None
    quantityKg: Optional[float] = None
    servings: Optional[int] = None
    urgent: bool = False
    lat: float
    lng: float
    hrsToExpiry: Optional[float] = 12.0

class MatchRequest(BaseModel):
    receiver: ReceiverProfile
    listings: list[ListingCandidate]
    top_k: int = 5

class MatchResult(BaseModel):
    listing_id: str
    match_score: float       # 0–1; higher = better fit
    distance_km: float
    rank: int
    food_type: str
    is_urgent: bool
    match_reasons: list      # human-readable explanations

class MatchResponse(BaseModel):
    receiver_id: str
    ranked_matches: list[MatchResult]
    model_type: str


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/match", response_model=MatchResponse)
def smart_match(req: MatchRequest):
    """
    POST /ml/match

    Body: {
      "receiver": {
        "receiverId": "user_abc",
        "lat": 13.08, "lng": 80.27,
        "preferredFoodType": "cooked",
        "capacityServings": 10,
        "historySize": 8
      },
      "listings": [
        { "listingId": "l1", "foodType": "cooked", "safetyScore": 80,
          "quantityKg": 5, "servings": 20, "urgent": false,
          "lat": 13.09, "lng": 80.28, "hrsToExpiry": 6.0 }
      ],
      "top_k": 5
    }

    Returns listings ranked by GradientBoosting match score.

    Typical usage (Node.js):
      1. GET /api/listings?status=available  → available listings
      2. POST /ml/match with receiver profile + listings
      3. Display top_k ranked results on receiver's map / feed
    """
    model, scaler = get_match_model()
    receiver_dict = req.receiver.dict()
    scored = []

    for listing in req.listings:
        ld       = listing.dict()
        features = build_pair_features(ld, receiver_dict)

        if model is not None:
            X_scaled = scaler.transform(np.array([features]))
            proba    = model.predict_proba(X_scaled)[0]
            score    = round(float(proba[1]), 4)  # P(good match)
            method   = "gradient_boosting"
        else:
            score  = rule_score(features)
            method = "rule_based"

        # Distance for display
        try:
            dist_km = round(haversine_km(receiver_dict["lat"], receiver_dict["lng"], ld["lat"], ld["lng"]), 2)
        except Exception:
            dist_km = 0.0

        # Build human-readable match reasons
        reasons = []
        dist_n, urgency, safety_n, cap_match, affinity, qty_n, exp_press, hist_n = features
        if dist_n < 0.15:
            reasons.append(f"Very close ({dist_km} km away)")
        elif dist_n < 0.35:
            reasons.append(f"Nearby ({dist_km} km)")
        if affinity == 1.0:
            reasons.append(f"Matches preferred food type ({ld['foodType']})")
        if safety_n > 0.7:
            reasons.append(f"High safety score ({ld.get('safetyScore', 70):.0f}/100)")
        if cap_match > 0.8:
            reasons.append("Good quantity match for your capacity")
        if urgency:
            reasons.append("Urgent — needs pickup soon")
        if not reasons:
            reasons.append("General availability match")

        scored.append((listing, score, dist_km, reasons, method))

    # Sort descending by match score
    scored.sort(key=lambda x: -x[1])

    ranked = [
        MatchResult(
            listing_id=item.listingId,
            match_score=score,
            distance_km=dist_km,
            rank=i + 1,
            food_type=item.foodType,
            is_urgent=item.urgent,
            match_reasons=reasons,
        )
        for i, (item, score, dist_km, reasons, _) in enumerate(scored[:req.top_k])
    ]

    method_used = scored[0][4] if scored else ("gradient_boosting" if USE_SKLEARN else "rule_based")

    return MatchResponse(
        receiver_id=req.receiver.receiverId,
        ranked_matches=ranked,
        model_type="GradientBoosting" if USE_SKLEARN else "RuleBasedFallback",
    )
