import React from 'react';

export default function SafetyBadge({ score }) {
  if (score === null || score === undefined) 
    return <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full font-semibold border border-gray-200">AI Pending</span>;
  if (score >= 75) 
    return <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full font-bold border border-green-200">✓ Safe {score}/100</span>;
  if (score >= 35) 
    return <span className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded-full font-bold border border-amber-200">⚠ Caution {score}/100</span>;
  return <span className="text-xs text-red-700 bg-red-100 px-2 py-1 rounded-full font-bold border border-red-200">✗ Unsafe {score}/100</span>;
}
