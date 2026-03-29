import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-[#14532d] text-white py-6 border-t border-green-900 mt-auto shrink-0 z-50">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 text-center md:text-left">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 md:gap-4">
          
          {/* Left: Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
             <span className="text-2xl">🌿</span>
             <span className="text-xl font-bold text-white tracking-tight">Food<span className="text-green-300 border-b-2 border-transparent">Bridge</span></span>
          </Link>

          {/* Center: Quick Links horizontally */}
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap justify-center">
            <Link to="/" className="text-green-100 hover:text-white transition font-medium text-sm">Home</Link>
            <Link to="/feed" className="text-green-100 hover:text-white transition font-medium text-sm">Browse Food</Link>
            <Link to="/post-listing" className="text-green-100 hover:text-white transition font-medium text-sm">Post Food</Link>
            <Link to="/my-listings" className="text-green-100 hover:text-white transition font-medium text-sm">My Activity</Link>
            <Link to="/volunteer" className="text-green-100 hover:text-white transition font-medium text-sm">Volunteer</Link>
          </div>

          {/* Right: Copyright */}
          <p className="text-green-100/60 text-sm font-medium">
            © 2026 FoodBridge.
          </p>

        </div>
      </div>
    </footer>
  );
}
