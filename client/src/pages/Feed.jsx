import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../utils/api';
import { useAuthStore } from '../store/store';
import { useNotificationStore } from '../store/notifications';
import { useSocket } from '../hooks/useSocket';
import SpoilageRiskBadge from '../components/SpoilageRiskBadge';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const createColorIcon = (color) => L.divIcon({
  className: '',
  html: `<div style="
    width: 18px; height: 18px;
    background: ${color};
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0,0,0,0.35);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -12],
});

const greenIcon  = createColorIcon('#16a34a');
const orangeIcon = createColorIcon('#f59e0b');
const redIcon    = createColorIcon('#dc2626');



class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#fafaf7]">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-lg text-center">
            <p className="text-red-600 font-semibold text-lg mb-2">Feed crashed</p>
            <p className="text-red-400 text-sm font-mono">{String(this.state.error)}</p>
            <button onClick={() => window.location.reload()} className="mt-4 bg-green-600 text-white px-4 py-2 rounded-xl text-sm">Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Feed() {
  const { user, token } = useAuthStore();
  const navigate = useNavigate();
  const socket = useSocket();

  const [listings, setListings]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selected, setSelected]         = useState(null); 
  const [claiming, setClaiming]         = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimError, setClaimError]     = useState('');
  const [radius, setRadius]             = useState(20);
  const [sortBy, setSortBy]             = useState('expiry');
  const [filterType, setFilterType]     = useState('all');
  const [userLocation, setUserLocation] = useState([13.0827, 80.2707]);
  const [mapCenter, setMapCenter]       = useState([13.0827, 80.2707]);
  const [errorToast, setErrorToast]     = useState('');
  const [showProfile, setShowProfile]   = useState(false);

  const listingUpdate = useNotificationStore(s => s.listingUpdate);

  useEffect(() => {
    if (listingUpdate) {
      setListings(prev => prev.map(l => 
        l._id === listingUpdate.listingId 
          ? { ...l, safetyScore: listingUpdate.safetyScore }
          : l
      ));
    }
  }, [listingUpdate]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const loc = [pos.coords.latitude, pos.coords.longitude];
          setUserLocation(loc);
          setMapCenter(loc);
        },
        () => {} // silently fall back
      );
    }
  }, []);

  const fetchListings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/listings?lat=${userLocation[0]}&lng=${userLocation[1]}&radius=${radius * 1000}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = Array.isArray(res.data) ? res.data : [];
      setListings(data);
    } catch (err) {
      console.error('Feed fetch error:', err);
      setErrorToast('Could not load listings. Please refresh.');
      setTimeout(() => setErrorToast(''), 4000);
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [userLocation, radius, token]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  useEffect(() => {
    if (!socket) return;
    const handleNew = (data) => {
      const newListing = data.listing || data;
      if (newListing.location?.coordinates) {
        setListings(prev => {
          const exists = prev.find(l => l._id === newListing._id);
          if (exists) return prev;
          return [...prev, newListing].sort(
            (a,b) => new Date(a.expiresAt) - new Date(b.expiresAt)
          );
        });
      }
    };
    const handleUpdated = (listing) => {
      setListings(prev => prev.map(l => l._id === listing._id ? { ...l, ...listing } : l));
      if (selected?._id === listing._id) setSelected(s => ({ ...s, ...listing }));
    };
    const handleClaimed = (data) => {
      setListings(prev => prev.filter(l => l._id !== data.listingId));
    };
    socket.on('feed_update', handleNew);
    socket.on('new_listing', handleNew);
    socket.on('listing_updated', handleUpdated);
    socket.on('listing_claimed', handleClaimed);
    return () => {
      socket.off('feed_update', handleNew);
      socket.off('new_listing', handleNew);
      socket.off('listing_updated', handleUpdated);
      socket.off('listing_claimed', handleClaimed);
    };
  }, [socket, selected]);

  const processed = listings
    .filter(l => {
      if (filterType === 'all') return true;
      return l.foodType === filterType;
    })
    .sort((a, b) => {
      if (sortBy === 'expiry') return new Date(a.expiresAt) - new Date(b.expiresAt);
      if (sortBy === 'safety') return (b.safetyScore || 0) - (a.safetyScore || 0);
      return 0;
    });

  const handleClaim = async () => {
    if (!selected) return;
    setClaiming(true);
    setClaimError('');
    try {
      await api.post(`/api/listings/${selected._id}/claim`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClaimSuccess(true);
      setListings(prev => prev.map(l => l._id === selected._id ? { ...l, status: 'claimed' } : l));
      setSelected(s => ({ ...s, status: 'claimed' }));
    } catch (err) {
      setClaimError(err.response?.data?.message || 'Could not claim. Try again.');
    } finally {
      setClaiming(false);
    }
  };

  const getIcon = (listing) => {
    const minsLeft = (new Date(listing.expiresAt) - Date.now()) / 60000;
    if (minsLeft < 30) return redIcon;
    if (listing.urgent) return orangeIcon;
    return greenIcon;
  };

  const SafetyBadge = ({ score }) => {
    if (score === null || score === undefined) return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium">AI Pending</span>;
    if (score >= 75) return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">✓ Safe {score}/100</span>;
    if (score >= 35) return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">⚠ Caution {score}/100</span>;
    return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">✕ Unsafe {score}/100</span>;
  };

  const timeLeft = (expiresAt) => {
    const diff = new Date(expiresAt) - Date.now();
    if (diff <= 0) return { text: 'Expired', urgent: true };
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const urgent = diff < 7200000;
    return { text: h > 0 ? `${h}h ${m}m left` : `${m}m left`, urgent };
  };

  return (
    <div className="min-h-screen bg-[#fafaf7] flex flex-col">
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slideInRight {
          animation: slideInRight 0.3s ease-out forwards;
        }
        .leaflet-container { z-index: 1; }
        .leaflet-pane { z-index: 1; }
        .leaflet-control { z-index: 2; }
      `}</style>


      <div className="flex flex-col flex-1 mt-16">
        <div className="bg-white border-b border-gray-100 px-6 md:px-10 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🗺️ Live Food Feed</h1>
            <p className="text-sm text-gray-400 mt-0.5">Real-time surplus food available near you</p>
          </div>
          <div className="flex gap-2 flex-wrap sm:ml-auto">
            <select value={radius} onChange={e => setRadius(Number(e.target.value))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none">
              <option value={2}>📍 2 km</option>
              <option value={5}>📍 5 km</option>
              <option value={10}>📍 10 km</option>
              <option value={20}>📍 20 km</option>
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none">
              <option value="expiry">⏰ Sort: Expiry</option>
              <option value="safety">🛡️ Sort: Safety</option>
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none">
              <option value="all">🍽️ All Types</option>
              <option value="cooked">🍛 Cooked</option>
              <option value="raw">🥦 Raw</option>
              <option value="packaged">📦 Packaged</option>
              <option value="bakery">🍞 Baked</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden" style={{ height: 'calc(100vh - 140px)' }}>

          <div className="w-full lg:w-2/5 overflow-y-auto bg-[#fafaf7] border-r border-gray-100">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-400 text-sm">Finding food near you...</p>
              </div>
            ) : processed.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-6">
                <span className="text-5xl mb-3">🍽️</span>
                <p className="text-gray-600 font-semibold">No food listings nearby</p>
                <p className="text-gray-400 text-sm mt-1">Try increasing the radius or be the first to share food!</p>
                <button onClick={() => navigate('/post-listing')}
                  className="mt-4 bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors">
                  + Post Food
                </button>
              </div>
            ) : (
              <>
                <div className="px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {processed.length} listing{processed.length !== 1 ? 's' : ''} found
                  </span>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1"/>Safe</span>
                    <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1"/>Urgent</span>
                    <span><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1"/>Expiring</span>
                  </div>
                </div>

                {processed.map(l => {
                  const tl = timeLeft(l.expiresAt);
                  const isSelected = selected?._id === l._id;
                  return (
                    <div key={l._id}
                      onClick={() => { setSelected(l); setClaimSuccess(false); setClaimError(''); }}
                      className={`mx-3 mb-3 rounded-2xl border cursor-pointer transition-all duration-200 overflow-hidden
                        ${isSelected
                          ? 'border-green-500 shadow-lg ring-2 ring-green-200 bg-white'
                          : 'border-gray-100 bg-white hover:shadow-md hover:-translate-y-0.5'
                        }`}
                    >
                      {Array.isArray(l.images) && l.images.length > 0 && (
                        <div className="w-full h-36 overflow-hidden">
                          <img
                            src={l.images[0]}
                            alt={l.title}
                            className="w-full h-full object-cover"
                            onError={e => { e.target.style.display = 'none'; }}
                          />
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-900 text-base truncate">{l.title}</h3>
                            <p className="text-xs text-gray-400 mt-0.5">by {l.donor?.name || 'Anonymous'}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-lg font-medium flex-shrink-0
                            ${l.foodType === 'cooked' ? 'bg-orange-50 text-orange-600' :
                              l.foodType === 'raw' ? 'bg-green-50 text-green-600' :
                              l.foodType === 'bakery' ? 'bg-amber-50 text-amber-600' :
                              'bg-blue-50 text-blue-600'}`}>
                            {l.foodType ? l.foodType.charAt(0).toUpperCase() + l.foodType.slice(1) : 'Food'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-3 flex-wrap">
                          <span className="text-sm font-semibold text-gray-700">⚖️ {l.quantity || l.kgFood ? `${l.kgFood || '?'}kg` : '?'}</span>
                          <span className="text-xs text-gray-400">📍 {l.address ? l.address.split(',').slice(-2).join(',') : 'Location unavailable'}</span>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <span className={`text-xs font-medium flex items-center gap-1 ${tl.urgent ? 'text-red-500' : 'text-gray-500'}`}>
                            {tl.urgent ? '🔴' : '🟢'} {tl.text}
                          </span>
                          <SafetyBadge score={l.safetyScore} />
                        </div>
                        {l.status === 'claimed' && (
                          <div className="mt-2 text-center text-xs text-blue-600 bg-blue-50 rounded-lg py-1 font-medium">
                            ✓ Already Claimed
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          <div className="w-full lg:w-3/5 relative">
            <MapContainer center={mapCenter} zoom={12} className="w-full h-full" style={{ minHeight: '400px' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
              <Circle center={userLocation} radius={radius * 1000} pathOptions={{ color: '#16a34a', fillColor: '#16a34a', fillOpacity: 0.06, weight: 1.5, dashArray: '6 4' }} />
              {processed.map(l => {
                if (!l.location?.coordinates || l.location.coordinates.length < 2) return null;
                const pos = [l.location.coordinates[1], l.location.coordinates[0]];
                return (
                  <Marker key={l._id} position={pos} icon={getIcon(l)}
                    eventHandlers={{ click: () => { setSelected(l); setClaimSuccess(false); setClaimError(''); } }}>
                    <Popup>
                      <div className="text-sm font-semibold">{l.title}</div>
                      <div className="text-xs text-gray-500">{l.kgFood}kg · {l.foodType}</div>
                      <div className="text-xs text-gray-400">{l.address}</div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
            <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur rounded-xl shadow px-3 py-2 text-xs text-gray-600 space-y-1 z-[999]">
              <div className="font-semibold text-gray-700 mb-1">Map Legend</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500 inline-block"/>Safe / Available</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block"/>Urgent</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"/>Expiring &lt;30min</div>
            </div>
          </div>
        </div>
      </div>

      {selected !== null && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl z-[1000] flex flex-col" style={{ top: '64px', animation: 'slideInRight 0.28s ease-out forwards' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 truncate flex-1">{selected.title}</h2>
            <button onClick={() => { setSelected(null); setClaimSuccess(false); setClaimError(''); }} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors ml-2">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {Array.isArray(selected.images) && selected.images.length > 0 && (
              <div className="w-full h-48 overflow-hidden">
                <img src={selected.images[0]} alt={selected.title} className="w-full h-full object-cover" onError={e => { e.target.style.display='none'; }} />
              </div>
            )}
            {Array.isArray(selected.images) && selected.images.length > 1 && (
              <div className="flex gap-2 px-5 py-2 overflow-x-auto">
                {selected.images.slice(1).map((img, i) => (
                  <img key={i} src={img} alt={`food-${i}`} className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-gray-200" onError={e => { e.target.style.display='none'; }} />
                ))}
              </div>
            )}
            <div className="flex gap-2 flex-wrap px-5 pt-4 pb-2">
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${selected.foodType === 'cooked' ? 'bg-orange-100 text-orange-700' : selected.foodType === 'raw' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                {selected.foodType ? selected.foodType.charAt(0).toUpperCase() + selected.foodType.slice(1) : 'Food'}
              </span>
              <SafetyBadge score={selected.safetyScore} />
              <SpoilageRiskBadge listing={selected} />
              {selected.urgent && <span className="text-xs px-3 py-1 rounded-full bg-red-100 text-red-600 font-medium">🔴 Urgent</span>}
            </div>
            <div className="px-5 pb-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 uppercase font-semibold tracking-wider">Donor</p>
                  <p className="text-sm font-bold text-gray-800 mt-1">{selected.donor?.name || 'Anonymous'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 uppercase font-semibold tracking-wider">Quantity</p>
                  <p className="text-sm font-bold text-gray-800 mt-1">{selected.kgFood || selected.quantity || '?'} kg</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 uppercase font-semibold tracking-wider">Condition</p>
                  <p className="text-sm font-bold text-gray-800 mt-1">{selected.condition || '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 uppercase font-semibold tracking-wider">Storage</p>
                  <p className="text-sm font-bold text-gray-800 mt-1">{selected.storageMethod || '—'}</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 uppercase font-semibold tracking-wider">📍 Address</p>
                <p className="text-sm text-gray-800 mt-1">{selected.address || 'Not specified'}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 uppercase font-semibold tracking-wider">⏰ Expires</p>
                <p className={`text-sm font-bold mt-1 ${timeLeft(selected.expiresAt).urgent ? 'text-red-500' : 'text-gray-800'}`}>
                  {new Date(selected.expiresAt).toLocaleString('en-IN', { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{timeLeft(selected.expiresAt).text}</p>
              </div>
              {selected.safetyScore !== null && selected.safetyScore !== undefined && (
                <div className={`rounded-xl p-3 ${selected.safetyScore >= 75 ? 'bg-green-50 border border-green-200' : selected.safetyScore >= 35 ? 'bg-amber-50 border border-amber-200' : 'bg-red-50 border border-red-200'}`}>
                  <p className="text-xs font-semibold text-gray-600">🤖 AI Safety Score: {selected.safetyScore}/100</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {selected.safetyScore >= 75 ? 'This food has been assessed as safe to consume.' : selected.safetyScore >= 35 ? 'Exercise caution — check condition before consuming.' : 'This food may not be safe. Claim with caution.'}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="px-5 py-4 border-t border-gray-100 bg-white">
            {claimSuccess ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                <p className="text-green-700 font-semibold text-lg">🎉 Claimed Successfully!</p>
                <p className="text-green-500 text-sm mt-1">The donor has been notified. Check My Activity for updates.</p>
                <button onClick={() => navigate('/my-listings')} className="mt-3 text-sm text-green-700 underline hover:no-underline">View My Activity →</button>
              </div>
            ) : selected.status === 'claimed' ? (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-center">
                <p className="text-blue-600 font-semibold text-sm">✓ This food has already been claimed</p>
              </div>
            ) : (
              <>
                {claimError && <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-red-600 text-sm">{claimError}</div>}
                <button onClick={handleClaim} disabled={claiming} className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold py-3.5 rounded-2xl transition-all text-base shadow-md hover:shadow-lg disabled:cursor-not-allowed">
                  {claiming ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Claiming...
                    </span>
                  ) : '🤝 Claim This Food'}
                </button>
                <p className="text-xs text-center text-gray-400 mt-2">A volunteer will be notified to arrange pickup</p>
              </>
            )}
          </div>
        </div>
      )}
      


      {errorToast && (
        <div className="fixed top-20 right-4 z-[9999] bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm shadow-md">
          {errorToast}
        </div>
      )}
    </div>
  );
}

export default function FeedWithBoundary() {
  return (
    <ErrorBoundary>
      <Feed />
    </ErrorBoundary>
  );
}
