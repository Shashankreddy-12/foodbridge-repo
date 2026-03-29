import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/store';
import NotificationBell from './NotificationBell';
import ProfilePanel from './ProfilePanel';

export default function Navbar() {
  const { token, user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = () => {
      logout();
      setMobileOpen(false);
      navigate('/login');
  };

  if (!token || !user) return null;
  if (['/login', '/register', '/'].includes(location.pathname)) return null;

  const navLinks = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Browse Food', path: '/feed' },
    { name: 'Post Food', path: '/post-listing' },
    { name: 'My Activity', path: '/my-listings' },
    { name: 'Volunteer', path: '/volunteer' },
    ...(user.role === 'volunteer' ? [{ name: '🗺️ Batch Route', path: '/route-batch' }] : []),
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-[50] bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm h-16 flex items-center px-4 md:px-10">
        
        {/* LEFT — Branding */}
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          <span className="text-2xl">🌿</span>
          <span className="text-xl font-bold text-green-700 tracking-tight">Food<span className="text-gray-900">Bridge</span></span>
        </Link>
        
        {/* CENTER — Nav Links (hidden on mobile) */}
        <div className="hidden md:flex items-center gap-1 mx-auto">
          {navLinks.map(link => (
            <Link
              key={link.path}
              to={link.path}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive(link.path)
                  ? 'text-green-700 bg-green-50'
                  : 'text-gray-600 hover:text-green-700 hover:bg-green-50'
              }`}
            >
              {link.name}
            </Link>
          ))}
        </div>

        {/* Right Side: Icons */}
        <div className="flex items-center gap-3 ml-auto">
          <NotificationBell />

          {/* Profile Avatar Button */}
          <button
            onClick={() => setProfileOpen(true)}
            className="w-9 h-9 rounded-full bg-green-600 text-white font-bold text-sm flex items-center justify-center hover:bg-green-700 transition-all shadow-sm flex-shrink-0 cursor-pointer"
            title={user?.name}
          >
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </button>

          {/* Logout (Desktop) */}
          <button
            onClick={handleLogout}
            className="hidden md:flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
          >
            <span>↩</span> Logout
          </button>

          {/* Mobile Hamburger Toggle */}
          <button 
            className="md:hidden text-gray-500 w-8 h-8 flex items-center justify-center p-1 rounded hover:bg-gray-100 focus:outline-none"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               {mobileOpen ? (
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
               ) : (
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path>
               )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {mobileOpen && (
          <div className="fixed top-16 left-0 right-0 bg-white border-b border-gray-100 shadow-md z-[89000] flex flex-col py-2 px-4 md:hidden">
             {navLinks.map(link => (
                 <Link 
                     key={link.path}
                     to={link.path}
                     onClick={() => setMobileOpen(false)}
                     className={`py-3 px-2 text-base font-bold border-b border-gray-50 ${isActive(link.path) ? 'text-green-600' : 'text-gray-600'}`}
                 >
                     {link.name}
                 </Link>
             ))}
             <button
                 onClick={handleLogout}
                 className="py-3 px-2 text-base font-bold text-left text-red-500 hover:text-red-700 transition border-b border-gray-50"
             >
                 Logout
             </button>
          </div>
      )}

      {/* Profile Panel Overlay */}
      <ProfilePanel isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}
