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
      <nav className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 shadow-sm z-[99000] px-4 sm:px-6 flex items-center justify-between">
        
        {/* Left Side: Logo */}
        <Link to="/dashboard" className="flex items-center space-x-2 shrink-0 hover:opacity-80 transition">
          <span className="text-2xl font-black text-green-600 tracking-tight">🌱 FoodBridge</span>
        </Link>
        
        {/* Center: Desktop Links */}
        <div className="hidden md:flex space-x-6">
          {navLinks.map(link => (
            <Link 
              key={link.path} 
              to={link.path}
              className={`text-sm font-bold transition flex items-center ${isActive(link.path) ? 'text-green-600 border-b-2 border-green-600 pt-1' : 'text-gray-500 hover:text-gray-800'}`}
              style={isActive(link.path) ? { marginBottom: '-2px' } : {}}
            >
              {link.name}
            </Link>
          ))}
        </div>

        {/* Right Side: Icons */}
        <div className="flex items-center space-x-3 sm:space-x-5 shrink-0">
          <NotificationBell />

          <button 
            onClick={handleLogout}
            className="hidden sm:block text-xs font-bold text-red-500 hover:text-red-700 transition"
          >
            Logout
          </button>
          
          <button 
            onClick={() => setProfileOpen(true)}
            className="w-10 h-10 bg-green-100 text-green-700 font-extrabold text-lg flex items-center justify-center rounded-full border border-green-200 shadow-sm hover:shadow hover:-translate-y-0.5 transition transform cursor-pointer"
          >
            {user.name.charAt(0).toUpperCase()}
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
