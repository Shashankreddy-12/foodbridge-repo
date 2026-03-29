import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuthStore } from '../store/store';

export default function ProfilePanel({ isOpen, onClose }) {
  const { user, token, updateUser } = useAuthStore();
  const [profileData, setProfileData] = useState(null);
  const [stats, setStats] = useState({ donated: 0, claimed: 0, volunteer: 0 });
  const [loading, setLoading] = useState(true);
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', orgName: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (isOpen && token) {
      setLoading(true);
      
      // Fetch user profile and stats in parallel
      Promise.all([
        api.get('/api/users/profile', { headers: { Authorization: `Bearer ${token}` } }),
        api.get('/api/listings/my', { headers: { Authorization: `Bearer ${token}` } })
      ]).then(([profileRes, statsRes]) => {
        setProfileData(profileRes.data.user);
        setFormData({
          name: profileRes.data.user.name || '',
          phone: profileRes.data.user.phone || '',
          orgName: profileRes.data.user.orgName || ''
        });
        setStats({
          donated: statsRes.data.donated.length,
          claimed: statsRes.data.claimed.length,
          volunteer: statsRes.data.volunteer.length
        });
        setLoading(false);
      }).catch(err => {
        console.error('Error fetching profile:', err);
        setLoading(false);
      });
    } else {
      setIsEditMode(false);
      setError('');
    }
  }, [isOpen, token]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name) return setError('Name is required');
    if (formData.phone && !/^\d{10}$/.test(formData.phone)) return setError('Invalid 10-digit phone number');

    setSaving(true);
    setError('');
    
    try {
      const res = await api.put('/api/users/profile', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Update global user store
      updateUser(res.data.user);
      setProfileData(res.data.user);
      
      setToast('Profile updated ✓');
      setTimeout(() => setToast(''), 3000);
      setIsEditMode(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/50 z-[9990] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose}
      />
      <div 
        className={`fixed top-0 right-0 h-full w-full sm:w-[380px] bg-white shadow-2xl z-[9999] transform transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex justify-between items-center p-6 border-b shrink-0 bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">Your Profile</h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-200 rounded-full">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 relative">
          {toast && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-green-100 text-green-800 px-4 py-2 rounded shadow-sm text-sm font-bold z-10 w-[90%] text-center">
              {toast}
            </div>
          )}
          
          {loading || !profileData ? (
            <div className="animate-pulse space-y-6">
              <div className="w-24 h-24 bg-gray-200 rounded-full mx-auto"></div>
              <div className="h-6 bg-gray-200 w-1/2 mx-auto rounded"></div>
              <div className="h-4 bg-gray-200 w-1/3 mx-auto rounded"></div>
              <div className="h-32 bg-gray-100 mt-6 rounded"></div>
            </div>
          ) : (
            <>
              {/* Section 1 - Header */}
              <div className="text-center mb-8 pt-4">
                <div className="w-24 h-24 bg-green-100 text-green-700 font-bold text-4xl rounded-full flex items-center justify-center mx-auto mb-4 border border-green-200 shadow-sm">
                  {profileData.name.charAt(0).toUpperCase()}
                </div>
                <h3 className="text-2xl font-bold text-gray-900">{profileData.name}</h3>
                <p className="text-gray-500 text-sm">{profileData.email}</p>
                <div className="mt-3 inline-flex items-center space-x-2">
                  <span className="px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full uppercase tracking-wider">{profileData.role}</span>
                </div>
                <p className="text-gray-400 text-xs mt-3">Member since {new Date(profileData.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric'})}</p>
              </div>

              {/* Section 2 - Stats */}
              <div className="grid grid-cols-3 gap-2 mb-8 border-t border-b py-6 border-gray-100">
                <div className="text-center">
                  <div className="text-2xl mb-1">🍱</div>
                  <div className="font-bold text-gray-900">{stats.donated}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mt-1">Donated</div>
                </div>
                <div className="text-center border-l border-r border-gray-100">
                  <div className="text-2xl mb-1">🙏</div>
                  <div className="font-bold text-gray-900">{stats.claimed}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mt-1">Claimed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl mb-1">🚴</div>
                  <div className="font-bold text-gray-900">{stats.volunteer}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mt-1">Deliveries</div>
                </div>
              </div>

              {/* Section 3 - Edit Form */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-gray-800">Personal Details</h4>
                  {!isEditMode && (
                    <button onClick={() => setIsEditMode(true)} className="text-green-600 hover:text-green-700 text-sm font-semibold">
                      Edit Profile
                    </button>
                  )}
                </div>

                {!isEditMode ? (
                  <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Phone</p>
                      <p className="font-medium text-gray-800">{profileData.phone || 'Not provided'}</p>
                    </div>
                    {profileData.orgName && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Organization</p>
                        <p className="font-medium text-gray-800">{profileData.orgName}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleSave} className="space-y-4">
                    {error && <div className="text-red-600 bg-red-50 p-2 rounded text-sm text-center border border-red-200">{error}</div>}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Name</label>
                      <input 
                        type="text" 
                        value={formData.name} 
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full border rounded px-3 py-2 text-sm focus:ring-green-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Phone <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        value={formData.phone} 
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="w-full border rounded px-3 py-2 text-sm focus:ring-green-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Organization Name (Optional)</label>
                      <input 
                        type="text" 
                        value={formData.orgName} 
                        onChange={(e) => setFormData({...formData, orgName: e.target.value})}
                        className="w-full border rounded px-3 py-2 text-sm focus:ring-green-500"
                      />
                    </div>
                    <div className="flex space-x-3 pt-4 border-t border-gray-100">
                      <button 
                        type="submit" 
                        disabled={saving}
                        className="flex-1 bg-green-600 text-white font-bold py-2 rounded shadow-sm hover:bg-green-700 disabled:opacity-50 transition"
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button 
                        type="button" 
                        onClick={() => { setIsEditMode(false); setError(''); }}
                        className="flex-1 bg-gray-100 text-gray-700 font-bold py-2 rounded border border-gray-200 hover:bg-gray-200 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
