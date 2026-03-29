import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import SafetyBadge from './SafetyBadge';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix typical Vite + Leaflet icon resolution error
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ 
    iconUrl: markerIcon, 
    iconRetinaUrl: markerIcon2x, 
    shadowUrl: markerShadow 
});

const createIcon = (color) => new L.divIcon({ 
    className: 'custom-icon', 
    html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
});

const greenIcon = createIcon('#22c55e');
const orangeIcon = createIcon('#f97316');
const redIcon = createIcon('#ef4444');

const volunteerIcon = new L.divIcon({ 
    className: 'volunteer-icon', 
    html: `<div style="background-color: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; font-size: 10px;">🚴</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
});

const getIcon = (listing) => {
    const minsLeft = (new Date(listing.expiresAt) - Date.now()) / 60000;
    if (minsLeft <= 30) return redIcon;
    if (listing.urgent) return orangeIcon;
    return greenIcon;
};

const formatTimeLeft = (expiresAt) => {
    const minsLeft = Math.floor((new Date(expiresAt) - Date.now()) / 60000);
    if (minsLeft <= 0) return 'Expired';
    if (minsLeft < 60) return `${minsLeft}m left`;
    const hrs = Math.floor(minsLeft / 60);
    const m = minsLeft % 60;
    return `${hrs}h ${m}m left`;
};

export default function FoodMap({ listings, userLocation, onSelectListing, volunteerLocation }) {
    if (!userLocation) {
        return (
            <div className="flex items-center justify-center h-[500px] bg-gray-100 rounded-lg shadow-inner">
                <div className="flex flex-col items-center">
                    <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-4 text-gray-600">Locating nearby food...</p>
                </div>
            </div>
        );
    }

    const { lat, lng } = userLocation;

    return (
        <div className="relative w-full h-[500px] rounded-lg overflow-hidden shadow-md border border-gray-200 z-0">
            {listings.length === 0 && (
                <div className="absolute top-4 left-[50%] transform -translate-x-[50%] z-[1000] bg-white px-4 py-2 shadow rounded-full text-sm text-gray-700">
                    No active listings nearby
                </div>
            )}
            <MapContainer center={[lat, lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                />
                
                {/* 10km radius circle tracking user domain */}
                <Circle 
                    center={[lat, lng]} 
                    radius={10000} 
                    pathOptions={{ color: '#0D9488', fillColor: '#0D9488', fillOpacity: 0.1, weight: 1 }} 
                />

                {listings.map(listing => (
                    <Marker 
                        key={listing._id} 
                        position={[listing.location.coordinates[1], listing.location.coordinates[0]]}
                        icon={getIcon(listing)}
                    >
                        <Popup>
                            <div className="w-48">
                                <h3 className="font-bold text-gray-800 text-base mb-1">{listing.title}</h3>
                                <div className="inline-block px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded mb-2 capitalize">
                                    {listing.foodType}
                                </div>
                                <p className="text-sm text-gray-700 mb-1 font-semibold">{listing.quantity}</p>
                                <p className="text-sm text-gray-600 mb-2 truncate">{listing.condition}</p>
                                
                                <div className="flex justify-between items-center text-xs mb-3 border-t pt-2 mt-2 border-gray-100">
                                    <span className="font-medium text-gray-500">Exp: {formatTimeLeft(listing.expiresAt)}</span>
                                    <SafetyBadge score={listing.safetyScore} />
                                </div>
                                
                                <p className="text-xs text-gray-500 mb-3 truncate">{listing.address}</p>
                                
                                <button 
                                    onClick={() => onSelectListing(listing)}
                                    className="w-full py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition"
                                >
                                    View Details
                                </button>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {volunteerLocation && (
                    <Marker 
                        position={[volunteerLocation.lat, volunteerLocation.lng]}
                        icon={volunteerIcon}
                    >
                        <Popup>
                            <strong>🚴 Volunteer en route</strong>
                        </Popup>
                    </Marker>
                )}
            </MapContainer>
        </div>
    );
}
