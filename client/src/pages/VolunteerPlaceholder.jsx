import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function VolunteerPlaceholder() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
      <div className="bg-white p-10 rounded-2xl shadow-xl max-w-lg w-full border border-gray-100">
        <div className="text-6xl mb-6">🚴</div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-4">Volunteer Features</h1>
        <p className="text-lg text-gray-600 mb-8">
          Volunteer features coming in the next update! Route optimization and active pickup mappings are launching soon.
        </p>
        <button 
          onClick={() => navigate('/dashboard')}
          className="px-8 py-3 bg-gray-900 text-white font-bold rounded-lg hover:bg-gray-800 transition shadow-md w-full"
        >
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
}
