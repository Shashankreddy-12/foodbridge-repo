import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-[#14532d] text-white pt-12 pb-6 border-t border-green-900 mt-auto shrink-0 z-50">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          
          {/* Left Column */}
          <div className="flex flex-col space-y-3">
            <h3 className="text-2xl font-black text-white tracking-tight">🌱 FoodBridge</h3>
            <p className="text-green-100 font-medium opacity-90">
              Reducing food waste, one meal at a time.
            </p>
          </div>

          {/* Center Column */}
          <div className="flex flex-col space-y-3">
            <h4 className="text-lg font-bold text-white mb-2">Quick Links</h4>
            <Link to="/" className="text-green-100/80 hover:text-white transition w-fit font-medium text-sm">Home</Link>
            <Link to="/feed" className="text-green-100/80 hover:text-white transition w-fit font-medium text-sm">Browse Food</Link>
            <Link to="/post-listing" className="text-green-100/80 hover:text-white transition w-fit font-medium text-sm">Post Food</Link>
            <Link to="/volunteer" className="text-green-100/80 hover:text-white transition w-fit font-medium text-sm">Volunteer</Link>
            <Link to="/my-listings" className="text-green-100/80 hover:text-white transition w-fit font-medium text-sm">My Activity</Link>
          </div>

          {/* Right Column */}
          <div className="flex flex-col space-y-3">
            <h4 className="text-lg font-bold text-white mb-2">🌍 Our Mission</h4>
            <p className="text-green-100/80 transition w-fit font-medium text-sm leading-relaxed">
              Connecting surplus food with people who need it, reducing waste one meal at a time.
            </p>
            
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="bg-green-800/50 border border-green-700/50 text-green-100 text-xs px-2 py-1 rounded font-bold uppercase tracking-wider">React</span>
              <span className="bg-green-800/50 border border-green-700/50 text-green-100 text-xs px-2 py-1 rounded font-bold uppercase tracking-wider">Node.js</span>
              <span className="bg-green-800/50 border border-green-700/50 text-green-100 text-xs px-2 py-1 rounded font-bold uppercase tracking-wider">MongoDB</span>
              <span className="bg-green-800/50 border border-green-700/50 text-green-100 text-xs px-2 py-1 rounded font-bold uppercase tracking-wider">AI</span>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-green-800/50 text-center">
          <p className="text-green-100/60 text-sm font-medium">
            © 2026 FoodBridge. Made with 💚
          </p>
        </div>
      </div>
    </footer>
  );
}
