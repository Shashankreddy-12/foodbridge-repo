/**
 * client/src/pages/RouteBatch.jsx
 *
 * Multi-stop Route Batching UI — volunteer plans and executes a batched pickup trip.
 *
 * Features:
 *  - Auto-detect volunteer GPS position
 *  - Fetch optimised multi-stop route from /api/route/batch
 *  - Show turn-by-turn stop list with donor name + address
 *  - Mark each stop ✓ complete as volunteer arrives
 *  - Live metrics: distance, ETA, CO₂ saved
 *  - Deep-link to Google Maps for navigation
 *
 * ADD to App.jsx:
 *   import RouteBatch from './pages/RouteBatch';
 *   <Route path="/route-batch" element={<PrivateRoute roles={['volunteer']}><RouteBatch /></PrivateRoute>} />
 *
 * ADD to Navbar for volunteers:
 *   { user.role === 'volunteer' && <Link to="/route-batch">🗺️ Batch Route</Link> }
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuthStore } from '../store/store';
import Navbar from '../components/Navbar';

// ─── Status badge colours ─────────────────────────────────────
const STATUS_STYLE = {
  pending:   'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-700 line-through opacity-60',
};

// ─── Compact metric card ──────────────────────────────────────
function MetricPill({ emoji, label, value }) {
  return (
    <div className="flex flex-col items-center bg-white border border-gray-200 rounded-xl px-4 py-3 min-w-[90px]">
      <span className="text-xl">{emoji}</span>
      <span className="text-sm font-bold text-gray-800 mt-0.5">{value}</span>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}

// ─── Single stop card ─────────────────────────────────────────
function StopCard({ stop, onComplete, completing }) {
  const done = stop.status === 'completed';
  return (
    <div className={`bg-white border rounded-2xl p-4 shadow-sm transition-all ${done ? 'opacity-50' : 'border-gray-200'}`}>
      <div className="flex items-start gap-3">
        {/* Step number */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${done ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700'}`}>
          {done ? '✓' : stop.stopNumber}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <h3 className={`font-semibold text-gray-900 truncate ${done ? 'line-through' : ''}`}>
              {stop.title}
            </h3>
            {stop.urgent && (
              <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full font-semibold">⚡ Urgent</span>
            )}
          </div>

          <p className="text-xs text-gray-500 mt-0.5 truncate">{stop.address}</p>

          <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
            {stop.donor?.name && <span>👤 {stop.donor.name}</span>}
            {stop.donor?.phone && (
              <a href={`tel:${stop.donor.phone}`} className="text-blue-600 hover:underline">
                📞 {stop.donor.phone}
              </a>
            )}
            {stop.distFromPrev > 0 && <span>📍 +{stop.distFromPrev} km</span>}
            {stop.servings && <span>🍽️ {stop.servings} servings</span>}
          </div>

          {stop.safetyScore !== null && stop.safetyScore !== undefined && (
            <div className="mt-1 text-xs">
              <span className={`px-1.5 py-0.5 rounded ${stop.safetyScore >= 70 ? 'bg-green-100 text-green-700' : stop.safetyScore >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                Safety {stop.safetyScore}/100
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        {!done && (
          <div className="flex flex-col gap-1.5 shrink-0">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}&travelmode=driving`}
              target="_blank"
              rel="noreferrer"
              className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-lg font-medium hover:bg-blue-100 transition-colors text-center"
            >
              🗺️ Nav
            </a>
            <button
              onClick={() => onComplete(stop.listingId)}
              disabled={completing === stop.listingId}
              className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {completing === stop.listingId ? '...' : '✓ Done'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────
export default function RouteBatch() {
  const { user } = useAuthStore();

  const [gps, setGps]           = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const [route, setRoute]       = useState(null);   // full response from /api/route/batch
  const [stops, setStops]       = useState([]);
  const [completing, setCompleting] = useState(null);

  // Config panel state
  const [radiusKm, setRadiusKm]   = useState(10);
  const [maxStops, setMaxStops]   = useState(5);
  const [travelMode, setTravelMode] = useState('driving');
  const [showConfig, setShowConfig] = useState(false);

  // ── Get GPS on mount ──
  useEffect(() => {
    if (!navigator.geolocation) { setGpsError('Geolocation not supported.'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGpsError('Could not get your location. Please enable GPS.'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  // ── Plan batch ──
  const planRoute = useCallback(async () => {
    if (!gps) return;
    setLoading(true);
    setError(null);
    setRoute(null);
    setStops([]);

    try {
      const res = await api.post('/api/route/batch', {
        volunteerLat: gps.lat,
        volunteerLng: gps.lng,
        radiusKm,
        maxStops,
        travelMode,
      });

      const data = res.data;
      if (data.stops?.length === 0) {
        setError(data.message || 'No claimed listings found nearby to batch.');
        setLoading(false);
        return;
      }

      setRoute(data);
      setStops((data.stops || []).map(s => ({ ...s, status: 'pending' })));
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to plan route. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [gps, radiusKm, maxStops, travelMode]);

  // ── Mark stop done ──
  async function completeStop(listingId) {
    setCompleting(listingId);
    try {
      await api.post('/api/route/complete-stop', { listingId });
      setStops(prev => prev.map(s => s.listingId.toString() === listingId.toString()
        ? { ...s, status: 'completed' }
        : s
      ));
    } catch (err) {
      alert(err?.response?.data?.error || 'Could not mark as complete. Try again.');
    } finally {
      setCompleting(null);
    }
  }

  const completedCount = stops.filter(s => s.status === 'completed').length;
  const allDone        = stops.length > 0 && completedCount === stops.length;

  // ── Not volunteer ──
  if (user?.role !== 'volunteer') {
    return (
      <>
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <p className="text-gray-500">Batch routing is available for volunteers only.</p>
          <Link to="/" className="mt-4 text-green-600 underline">Go home</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">🗺️ Batch Route Planner</h1>
          <p className="text-gray-500 text-sm mt-1">
            Pick up from multiple donors in one optimised trip.
          </p>
        </div>

        {/* GPS status */}
        <div className={`rounded-xl px-4 py-2 text-sm mb-4 ${gps ? 'bg-green-50 text-green-700' : gpsError ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'}`}>
          {gps
            ? `📍 Your location: ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`
            : gpsError || 'Getting your location...'}
        </div>

        {/* Config panel */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
          <button
            onClick={() => setShowConfig(v => !v)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 w-full"
          >
            ⚙️ Route settings
            <span className="ml-auto text-gray-400">{showConfig ? '▲' : '▼'}</span>
          </button>

          {showConfig && (
            <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Radius (km)</label>
                <select
                  value={radiusKm}
                  onChange={e => setRadiusKm(Number(e.target.value))}
                  className="w-full border rounded-lg px-2 py-1 text-sm"
                >
                  {[2, 5, 10, 15, 20].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Max stops</label>
                <select
                  value={maxStops}
                  onChange={e => setMaxStops(Number(e.target.value))}
                  className="w-full border rounded-lg px-2 py-1 text-sm"
                >
                  {[2, 3, 4, 5, 6].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Travel mode</label>
                <select
                  value={travelMode}
                  onChange={e => setTravelMode(e.target.value)}
                  className="w-full border rounded-lg px-2 py-1 text-sm"
                >
                  <option value="driving">🚗 Driving</option>
                  <option value="bicycling">🚲 Cycling</option>
                  <option value="walking">🚶 Walking</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Plan button */}
        <button
          onClick={planRoute}
          disabled={!gps || loading}
          className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 mb-6"
        >
          {loading ? '⏳ Planning route...' : '🗺️ Plan Batch Route'}
        </button>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Route results */}
        {route && stops.length > 0 && (
          <>
            {/* Metrics bar */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
              <MetricPill emoji="📍" label="stops" value={route.metrics.totalStops} />
              <MetricPill emoji="📏" label="km" value={route.metrics.totalDistanceKm} />
              <MetricPill emoji="⏱️" label="est. min" value={route.metrics.estimatedMinutes} />
              <MetricPill emoji="🌱" label="CO₂ saved" value={`${route.metrics.co2SavedKg}kg`} />
              <MetricPill emoji="✅" label="done" value={`${completedCount}/${stops.length}`} />
            </div>

            {/* Google Maps full route link */}
            {route.googleMapsUrl && (
              <a
                href={route.googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 mb-4 border border-blue-300 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-100 transition-colors"
              >
                🗺️ Open full route in Google Maps
              </a>
            )}

            {/* All done! */}
            {allDone && (
              <div className="bg-green-50 border border-green-300 rounded-2xl p-5 text-center mb-4">
                <div className="text-3xl mb-2">🎉</div>
                <div className="font-bold text-green-800 text-lg">All stops completed!</div>
                <p className="text-green-700 text-sm mt-1">
                  You saved {route.metrics.co2SavedKg} kg CO₂ and delivered {stops.length} food batches. Amazing work!
                </p>
                <button
                  onClick={() => { setRoute(null); setStops([]); }}
                  className="mt-3 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700"
                >
                  Plan another batch
                </button>
              </div>
            )}

            {/* Stop list */}
            <div className="flex flex-col gap-3">
              {stops.map(stop => (
                <StopCard
                  key={stop.listingId}
                  stop={stop}
                  onComplete={completeStop}
                  completing={completing}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
