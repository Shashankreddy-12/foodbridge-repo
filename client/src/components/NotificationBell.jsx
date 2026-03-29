import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../store/notifications';

function timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    const interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    if (seconds / 2592000 > 1) return Math.floor(seconds / 2592000) + " months ago";
    if (seconds / 86400 > 1) return Math.floor(seconds / 86400) + " days ago";
    if (seconds / 3600 > 1) return Math.floor(seconds / 3600) + " hours ago";
    if (seconds / 60 > 1) return Math.floor(seconds / 60) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
}

export default function NotificationBell() {
    const [isOpen, setIsOpen] = useState(false);
    const setMarkAllRead = useNotificationStore(s => s.markAllRead);
    const notifications = useNotificationStore(s => s.notifications);
    const navigate = useNavigate();
    const dropdownRef = useRef(null);

    const unreadCount = notifications.filter(n => !n.read).length;

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleNavigate = (id) => {
        setIsOpen(false);
        navigate(`/feed?listing=${id}`);
    };

    return (
        <div className="relative inline-block text-left z-[9999]" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-gray-600 hover:text-green-600 focus:outline-none transition rounded-full hover:bg-gray-100"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center w-5 h-5 text-xs font-bold leading-none text-white bg-red-600 rounded-full border-2 border-white">
                        {unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-80 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 divide-y divide-gray-100">
                    <div className="px-4 py-3 flex justify-between items-center text-sm font-semibold text-gray-800">
                        <span>Notifications</span>
                        <span className="text-xs text-gray-500 font-normal">{notifications.length} total</span>
                    </div>
                    
                    <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <p className="text-gray-500 text-sm py-4 px-4 text-center">No notifications yet.</p>
                        ) : (
                            notifications.slice(0, 5).map(n => (
                                <div 
                                    key={n._id || Math.random()} 
                                    className={`px-4 py-3 hover:bg-gray-50 cursor-pointer block text-sm ${!n.read ? 'bg-blue-50/40' : ''}`}
                                    onClick={() => handleNavigate(n._id)}
                                >
                                    <div className="flex justify-between items-baseline mb-1">
                                        <p className="text-gray-800 font-medium truncate pr-2">{n.title}</p>
                                        {n.isUrgent && <span className="text-[10px] font-bold text-white bg-orange-500 px-1.5 py-0.5 rounded leading-none shrink-0">URGENT</span>}
                                    </div>
                                    <p className="text-xs text-gray-500">{timeAgo(n.seenAt || Date.now())}</p>
                                </div>
                            ))
                        )}
                    </div>
                    
                    <div className="px-4 py-2 bg-gray-50 rounded-b-md text-center">
                        <button onClick={setMarkAllRead} className="text-sm font-semibold text-green-600 hover:text-green-800 focus:outline-none">
                            Mark all read
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
