/**
 * client/src/components/SpoilageRiskBadge.jsx
 *
 * Spoilage Risk Badge — shows low / medium / high risk on listing cards.
 * Fetches from ML service or uses a cached prop.
 *
 * Usage A — fetch on render (for single listing pages):
 *   <SpoilageRiskBadge listing={listingObject} />
 *
 * Usage B — pre-fetched result (for listing cards in a list):
 *   <SpoilageRiskBadge riskLevel="high" riskFactors={["expiring in 1.2h", "low safety score"]} />
 *
 * Usage C — batch check in your listings feed (recommended for performance):
 *   Call /ml/spoilage-predict with all visible listings in one request,
 *   then pass riskLevel as a prop to each card.
 */

import { useState, useEffect } from 'react';

const ML_SERVICE_URL = import.meta.env.VITE_ML_URL || 'http://localhost:8000';

const RISK_CONFIG = {
  low: {
    label:   'Low Risk',
    emoji:   '🟢',
    bg:      'bg-green-50',
    border:  'border-green-200',
    text:    'text-green-700',
    dot:     'bg-green-500',
  },
  medium: {
    label:   'Medium Risk',
    emoji:   '🟡',
    bg:      'bg-yellow-50',
    border:  'border-yellow-200',
    text:    'text-yellow-700',
    dot:     'bg-yellow-400',
  },
  high: {
    label:   'High Risk',
    emoji:   '🔴',
    bg:      'bg-red-50',
    border:  'border-red-200',
    text:    'text-red-700',
    dot:     'bg-red-500',
  },
};

// ─── Inline compact badge (for listing cards) ─────────────────
export function RiskChip({ riskLevel }) {
  const cfg = RISK_CONFIG[riskLevel];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Full badge with tooltip / expandable factors ─────────────
export default function SpoilageRiskBadge({ listing, riskLevel: propRisk, riskFactors: propFactors, recommendation: propRec }) {
  const [riskLevel,     setRiskLevel]     = useState(propRisk     || null);
  const [riskFactors,   setRiskFactors]   = useState(propFactors  || []);
  const [recommendation, setRecommendation] = useState(propRec   || null);
  const [loading,       setLoading]       = useState(!propRisk && !!listing);
  const [expanded,      setExpanded]      = useState(false);

  useEffect(() => {
    // If riskLevel was passed as prop, use it directly
    if (propRisk) { setRiskLevel(propRisk); setLoading(false); return; }

    // Otherwise fetch from ML service
    if (!listing) return;

    async function fetchRisk() {
      try {
        const res = await fetch(`${ML_SERVICE_URL}/ml/spoilage-predict`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            listings: [{
              listingId:  listing._id,
              foodType:   listing.foodType,
              safetyScore: listing.safetyScore,
              quantityKg:  listing.kgFood,
              urgent:      listing.urgent,
              expiresAt:   listing.expiresAt,
              createdAt:   listing.createdAt,
            }],
          }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        const result = data.results?.[0];
        if (result) {
          setRiskLevel(result.risk_level);
          setRiskFactors(result.risk_factors || []);
          setRecommendation(result.recommendation);
        }
      } catch {
        // ML service offline — silently hide badge
      } finally {
        setLoading(false);
      }
    }

    fetchRisk();
  }, [listing?._id, propRisk]);

  if (loading) {
    return <span className="inline-block w-20 h-5 bg-gray-100 animate-pulse rounded-full" />;
  }

  if (!riskLevel) return null;

  const cfg = RISK_CONFIG[riskLevel];
  if (!cfg) return null;

  return (
    <div className="inline-block">
      <button
        type="button"
        onClick={() => riskFactors.length > 0 && setExpanded(v => !v)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors
          ${cfg.bg} ${cfg.border} ${cfg.text}
          ${riskFactors.length > 0 ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
        title={recommendation || ''}
      >
        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
        {cfg.label}
        {riskFactors.length > 0 && (
          <span className="opacity-60 ml-0.5">{expanded ? '▲' : '▼'}</span>
        )}
      </button>

      {expanded && riskFactors.length > 0 && (
        <div className={`mt-1 rounded-lg border p-2.5 text-xs ${cfg.bg} ${cfg.border} ${cfg.text}`}>
          {recommendation && (
            <p className="font-medium mb-1.5">{recommendation}</p>
          )}
          <ul className="space-y-0.5">
            {riskFactors.map((f, i) => (
              <li key={i} className="flex gap-1.5 items-start opacity-80">
                <span>•</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
