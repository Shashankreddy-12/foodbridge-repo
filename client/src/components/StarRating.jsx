import React, { useState } from 'react';
import api from '../utils/api';
import { useAuthStore } from '../store/store';

export default function StarRating({ deliveryId, ratedUserId }) {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  
  const token = useAuthStore(s => s.token);

  const handleRate = async (star) => {
    setSelected(star);
    setLoading(true);
    try {
      await api.post(`/api/deliveries/${deliveryId}/rate`, {
        rating: star,
        ratedUserId,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setSubmitted(true);
    } catch (err) {
      if (err.response?.status === 409) {
        setSubmitted(true); // already rated
      } else {
         setToast("Rating failed, try again");
         setTimeout(() => setToast(''), 3000);
      }
    } finally {
      setLoading(false);
    }
  };

  if (submitted) return (
    <p className="text-sm text-green-600 mt-2 font-bold">✓ Thanks for rating!</p>
  );

  return (
    <div className="flex flex-col mt-2">
      {toast && <p className="text-xs text-red-500 mb-1 font-semibold">{toast}</p>}
      <div className="flex items-center gap-1">
        {[1,2,3,4,5].map(star => (
          <button
            key={star}
            onClick={() => handleRate(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            disabled={loading}
            className={`text-2xl transition-colors ${
              star <= (hovered || selected) 
                ? 'text-yellow-400' 
                : 'text-gray-300'
            }`}
          >★</button>
        ))}
      </div>
    </div>
  );
}
