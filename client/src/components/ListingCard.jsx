import React from 'react';
import SafetyBadge from './SafetyBadge';

const formatTimeLeft = (expiresAt) => {
    const minsLeft = Math.floor((new Date(expiresAt) - Date.now()) / 60000);
    if (minsLeft <= 0) return 'Expired';
    if (minsLeft < 60) return `${minsLeft}m left`;
    const hrs = Math.floor(minsLeft / 60);
    const m = minsLeft % 60;
    return `${hrs}h ${m}m left`;
};

export default function ListingCard({ listing, onSelect }) {
    const minsLeft = (new Date(listing.expiresAt) - Date.now()) / 60000;
    
    let borderColor = 'border-green-500';
    let timeColor = 'text-green-600';
    
    if (minsLeft <= 30) {
        borderColor = 'border-red-500';
        timeColor = 'text-red-600 font-semibold';
    } else if (listing.urgent) {
        borderColor = 'border-orange-500';
        timeColor = 'text-orange-600 font-semibold';
    }

    const safetyBadge = <SafetyBadge score={listing.safetyScore} />;

    return (
        <div className={`bg-white rounded-lg shadow-sm border border-gray-200 border-l-4 ${borderColor} p-4 flex flex-col hover:shadow-md transition-shadow`}>
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h3 className="font-bold text-gray-800">{listing.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Donated by {listing.donor.name} {listing.donor.orgName && `(${listing.donor.orgName})`}</p>
                </div>
                <div className="inline-block px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded capitalize">
                    {listing.foodType}
                </div>
            </div>

            <div className="mb-3">
                <p className="text-sm font-semibold text-gray-700">{listing.quantity}</p>
                <p className="text-xs text-gray-600 truncate mt-1">{listing.address}</p>
            </div>

            <div className="mt-auto flex items-center justify-between border-t border-gray-50 pt-3">
                <div className="flex flex-col space-y-1">
                    <span className={`text-xs flex items-center ${timeColor}`}>
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        {formatTimeLeft(listing.expiresAt)}
                    </span>
                    {safetyBadge}
                </div>
                <button 
                    onClick={() => onSelect(listing)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 transition font-medium"
                >
                    View Details
                </button>
            </div>
        </div>
    );
}
