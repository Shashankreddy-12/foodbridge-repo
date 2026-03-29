import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import api from '../utils/api';
import { useAuthStore } from '../store/store';
import { useSocket } from '../hooks/useSocket';
import SafetyBadge from '../components/SafetyBadge';
import StarRating from '../components/StarRating';
import { io } from 'socket.io-client';
import Navbar from '../components/Navbar';

const volunteerIcon = new L.divIcon({ 
    className: 'volunteer-icon', 
    html: `<div style="background-color: #3b82f6; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; font-size: 12px;">🚴</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
});

const donorIcon = new L.divIcon({
    className: 'donor-icon',
    html: `<div style="background-color: #22c55e; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
});

const recipientIcon = new L.divIcon({
    className: 'recipient-icon',
    html: `<div style="background-color: #ef4444; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
});

export default function Volunteer() {
    const token = useAuthStore(s => s.token);
    const navigate = useNavigate();

    const [userLoc, setUserLoc] = useState(null);
    const [locError, setLocError] = useState('');
    
    const [pickups, setPickups] = useState([]);
    const [deliveries, setDeliveries] = useState([]);
    const [loading, setLoading] = useState(true);

    const [activeRoute, setActiveRoute] = useState(null);
    const [activeListing, setActiveListing] = useState(null);

    const [processingId, setProcessingId] = useState(null);
    const [travelModes, setTravelModes] = useState({});

    const [socket, setSocket] = useState(null);
    const [toast, setToast] = useState('');

    useSocket(token);

    useEffect(() => {
        if (!token) return;
        const newSocket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
            auth: { token }
        });
        setSocket(newSocket);
        return () => newSocket.disconnect();
    }, [token]);

    const requestLocation = () => {
        setLocError('');
        if (!("geolocation" in navigator)) {
            setLocError("Location access denied. Please enable it in browser settings.");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => setLocError("Enable location to see nearby pickups")
        );
    };

    useEffect(() => {
        requestLocation();
    }, []);

    const fetchData = async () => {
        try {
            const pRes = await api.get('/api/volunteer/pickups', { headers: { Authorization: `Bearer ${token}` } });
            setPickups(pRes.data);
            const dRes = await api.get('/api/volunteer/my-deliveries', { headers: { Authorization: `Bearer ${token}` } });
            setDeliveries(dRes.data);

            const travelState = {};
            pRes.data.forEach(p => travelState[p._id] = '2-wheeler');
            setTravelModes(travelState);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token && userLoc) fetchData();
        else if (locError) setLoading(false);
    }, [token, userLoc, locError]);

    const activeDelivery = deliveries.find(d => d.status === 'claimed');

    useEffect(() => {
        if (!activeDelivery || !socket) return;
        
        const pingLocation = () => {
            navigator.geolocation.getCurrentPosition(pos => {
                socket.emit('location_update', {
                    deliveryId: activeDelivery._id,
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                });
            });
        };
        
        pingLocation();
        const interval = setInterval(pingLocation, 10000);
        return () => clearInterval(interval);
    }, [activeDelivery, socket]);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const handleAccept = async (listingId) => {
        setProcessingId(listingId);
        try {
            const mode = travelModes[listingId] || '2-wheeler';
            const res = await api.post(`/api/volunteer/accept/${listingId}`, { travelMode: mode }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setPickups(prev => prev.filter(p => p._id !== listingId));
            const newListing = res.data.listing;
            setDeliveries(prev => [newListing, ...prev]);
            
            if (res.data.route) {
                setActiveRoute(res.data.route);
                setActiveListing(newListing);
            } else {
                setActiveRoute(null);
                setActiveListing(newListing);
                showToast("Pickup Accepted. Route unavailable.");
            }
            
            fetchData(); 
        } catch (err) {
            if (err.response?.status === 409) {
                showToast("Already taken by another volunteer");
                setPickups(prev => prev.filter(p => p._id !== listingId));
            } else {
                showToast("Failed to accept pickup");
            }
        } finally {
            setProcessingId(null);
        }
    };

    const handleComplete = async (listingId) => {
        try {
            await api.post(`/api/volunteer/complete/${listingId}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDeliveries(prev => prev.map(d => d._id === listingId ? { ...d, status: 'delivered' } : d));
            showToast("🎉 Delivery complete! Thank you for helping!");
            setActiveListing(null);
            setActiveRoute(null);
        } catch (err) {
            showToast("Failed to mark delivered. Try again.");
        }
    };

    const routeCoords = activeRoute?.geometry?.coordinates 
        ? activeRoute.geometry.coordinates.map(c => [c[1], c[0]]) 
        : [];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col pt-24 md:pt-24 pb-12 px-4 sm:px-6 relative">
            <Navbar />
            {toast && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-2xl z-[99999] font-medium text-sm">
                    {toast}
                </div>
            )}

            <div className="w-full max-w-5xl mx-auto space-y-12">
                
                {/* Available Pickups Section */}
                <section>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Nearby Pickup Requests 🚴</h2>
                        {locError && <button onClick={requestLocation} className="text-sm bg-orange-100 text-orange-800 px-3 py-1 rounded font-bold border border-orange-200">Retry Location</button>}
                    </div>

                    {locError ? (
                        <div className="bg-orange-50 p-6 rounded-2xl border border-orange-200 text-center">
                            <p className="text-orange-800 font-medium">{locError}</p>
                        </div>
                    ) : loading ? (
                        <div className="animate-pulse bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-48"></div>
                    ) : pickups.length === 0 ? (
                        <div className="bg-white p-10 rounded-2xl border border-gray-100 shadow-sm text-center">
                            <p className="text-gray-500 font-medium">No pickups available nearby. Check back soon! 🌱</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {pickups.map(p => (
                                <div key={p._id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition">
                                    <div className="flex justify-between items-start mb-3">
                                        <h3 className="font-bold text-gray-900 text-lg truncate pr-2">{p.title}</h3>
                                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full uppercase tracking-widest font-bold">
                                            {p.foodType}
                                        </span>
                                    </div>
                                    
                                    <div className="text-sm text-gray-600 space-y-2 mb-4">
                                        <p><span className="font-semibold text-gray-400 uppercase text-[10px] tracking-wider block">Donor</span> {p.donor?.name} ({p.address})</p>
                                        <p><span className="font-semibold text-gray-400 uppercase text-[10px] tracking-wider block">Recipient</span> {p.claimedBy?.name}</p>
                                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                                            <span className={`font-bold text-xs ${p.urgent ? 'text-red-500' : 'text-gray-500'}`}>
                                                {Math.ceil((new Date(p.expiresAt) - Date.now())/60000)}m left
                                            </span>
                                            <SafetyBadge score={p.safetyScore} />
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 p-1.5 rounded-lg flex justify-between space-x-1 mb-4">
                                        {['walking','2-wheeler','4-wheeler'].map(m => (
                                            <button 
                                                key={m}
                                                onClick={() => setTravelModes({...travelModes, [p._id]: m})}
                                                className={`flex-1 py-1.5 text-xs font-bold rounded capitalize ${travelModes[p._id] === m ? 'bg-white shadow text-green-700 border border-green-200' : 'text-gray-500 hover:bg-gray-100'}`}
                                            >
                                                {m === 'walking' ? '🚶' : m === '2-wheeler' ? '🛵' : '🚗'} {m.split('-')[0]}
                                            </button>
                                        ))}
                                    </div>

                                    <button 
                                        disabled={processingId === p._id}
                                        onClick={() => handleAccept(p._id)}
                                        className="w-full bg-green-600 text-white font-bold py-2.5 rounded-xl hover:bg-green-700 shadow-sm disabled:opacity-50 transition"
                                    >
                                        {processingId === p._id ? 'Accepting...' : 'Accept Pickup'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Route Map Section */}
                {activeListing && userLoc && (
                    <section>
                        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-4">Your Optimized Route 🗺️</h2>
                        <div className="bg-white p-2 rounded-3xl shadow-sm border border-gray-200">
                            <div className="bg-blue-50 text-blue-800 text-sm font-bold text-center py-2.5 rounded-t-2xl px-4 flex flex-col md:flex-row justify-center items-center md:space-x-4">
                                {activeRoute ? (
                                    <>
                                        <span>📍 {activeRoute.distanceKm.toFixed(1)} km</span>
                                        <span className="hidden md:inline">•</span>
                                        <span>⏱ {activeRoute.durationMin.toFixed(0)} min estimated</span>
                                    </>
                                ) : (
                                    <span>Route visualization unavailable</span>
                                )}
                            </div>
                            <div className="h-[400px] w-full rounded-b-2xl overflow-hidden relative z-0">
                                <MapContainer center={[userLoc.lat, userLoc.lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
                                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
                                    
                                    <Marker position={[userLoc.lat, userLoc.lng]} icon={volunteerIcon}>
                                        <Popup><strong>You are here</strong></Popup>
                                    </Marker>
                                    
                                    {activeListing.location?.coordinates && (
                                        <Marker position={[activeListing.location.coordinates[1], activeListing.location.coordinates[0]]} icon={donorIcon}>
                                            <Popup><strong>Pickup:</strong> {activeListing.donor?.name}</Popup>
                                        </Marker>
                                    )}

                                    {activeListing.claimedBy?.location?.coordinates && (
                                        <Marker position={[activeListing.claimedBy.location.coordinates[1], activeListing.claimedBy.location.coordinates[0]]} icon={recipientIcon}>
                                            <Popup><strong>Delivery:</strong> {activeListing.claimedBy?.name}</Popup>
                                        </Marker>
                                    )}

                                    {routeCoords.length > 0 && (
                                        <Polyline positions={routeCoords} color="#3b82f6" weight={5} opacity={0.7} dashArray="10, 10" />
                                    )}
                                </MapContainer>
                            </div>
                        </div>
                    </section>
                )}

                {/* My Deliveries Section */}
                <section>
                    <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight mb-6 mt-12">My Deliveries</h2>
                    {deliveries.length === 0 ? (
                        <div className="bg-gray-50 border border-gray-100 p-8 rounded-2xl text-center">
                            <p className="text-gray-500 font-medium">You haven't accepted any deliveries yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {deliveries.map(d => (
                                <div key={d._id} className="bg-white border text-left border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3 mb-1">
                                            <h3 className="font-bold text-gray-900 text-lg">{d.title}</h3>
                                            <span className={`text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full ${d.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {d.status === 'delivered' ? 'Completed' : 'In Progress'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-500 font-medium">From {d.donor?.name || 'Unknown'} → To {d.claimedBy?.name || 'Unknown'}</p>
                                        
                                        {d.status === 'delivered' && (
                                            <div className="mt-3 pt-3 border-t border-gray-100">
                                                <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">Rate the recipient</p>
                                                <StarRating deliveryId={d._id} ratedUserId={d.claimedBy?._id || d.claimedBy} />
                                            </div>
                                        )}
                                    </div>
                                    
                                    {d.status === 'claimed' && (
                                        <button 
                                            onClick={() => handleComplete(d._id)}
                                            className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow hover:bg-blue-700 transition shrink-0"
                                        >
                                            Mark as Delivered
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>

            </div>
        </div>
    );
}
