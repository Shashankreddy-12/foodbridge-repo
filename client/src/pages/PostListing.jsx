import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuthStore } from '../store/store';
import { useNotificationStore } from '../store/notifications';
import SafetyBadge from '../components/SafetyBadge';



export default function PostListing() {
    const [formData, setFormData] = useState({
        title: '',
        foodType: 'cooked',
        quantity: '',
        expiresAt: '',
        condition: '',
        address: '',
        hoursSinceCooked: '',
        storageMethod: 'Fridge'
    });
    const [location, setLocation] = useState({ lat: null, lng: null });
    const [locStatus, setLocStatus] = useState('Capturing location...');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    
    const [safetyPrecheck, setSafetyPrecheck] = useState(null);
    const [checkingSafety, setCheckingSafety] = useState(false);

    const [autoFilled, setAutoFilled] = useState(false);
    const [images, setImages] = useState([]);
    const [showProfile, setShowProfile] = useState(false);

    const navigate = useNavigate();
    const token = useAuthStore(s => s.token);
    const setAuth = useAuthStore(s => s.setAuth);
    const user = useAuthStore(s => s.user);

    const captureLocation = () => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    setLocation({ lat, lng });
                    setLocStatus('Location captured ✓');
                    
                    try {
                        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lng=${lng}&format=json`);
                        const data = await response.json();
                        if (data.display_name) {
                            setFormData(prev => ({ ...prev, address: data.display_name }));
                            setAutoFilled(true);
                        }
                    } catch (err) {
                        console.error("Geocoding failed", err);
                    }
                },
                (err) => setLocStatus('Location access denied or failed ✗')
            );
        } else {
            setLocStatus('Geolocation not supported');
        }
    };

    useEffect(() => {
        captureLocation();
    }, []);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleImageUpload = (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;
      const remaining = 3 - images.length;
      const toProcess = files.slice(0, remaining);
      toProcess.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImages(prev => {
            if (prev.length >= 3) return prev;
            return [...prev, reader.result];
          });
        };
        reader.readAsDataURL(file);
      });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!images || images.length === 0) {
            setError('Please upload at least one photo of the food item.');
            return;
        }
        
        if (safetyPrecheck?.blocked) {
            setError('This listing cannot be posted due to food safety concerns.');
            return;
        }

        setError('');
        setSubmitting(true);

        try {
            const payload = {
              title: formData.title,
              foodType: formData.foodType,
              quantity: formData.quantity,
              kgFood: parseFloat(formData.quantity) || 0,
              expiresAt: formData.expiresAt,
              address: formData.address,
              condition: formData.condition,
              storageMethod: formData.storageMethod || 'Fridge',
              hoursSinceCooked: formData.hoursSinceCooked ? Number(formData.hoursSinceCooked) : 1,
              images: images, 
              location: {
                type: 'Point',
                coordinates: location.lng && location.lat ? [location.lng, location.lat] : [0, 0]
              }
            };

            const res = await api.post('/api/listings', payload, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (user && user.role !== 'donor') {
                const updatedUser = { ...user, role: 'donor' };
                setAuth(updatedUser, token);
            }

            if (res.status === 201 || res.status === 200) {
                navigate('/feed');
            }
        } catch (err) {
            console.error('Post listing error:', err);
            setError(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to post listing. Please try again.');
            setSubmitting(false);
            return; 
        }
    };

    const handleSafetyCheck = async () => {
        if (!formData.title || !formData.condition) {
            setError('Please describe the food and condition first.');
            return;
        }
        setCheckingSafety(true);
        setError('');
        try {
            const res = await api.post('/api/listings/safety-check', {
                description: formData.title,
                condition: formData.condition,
                foodType: formData.foodType
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSafetyPrecheck(res.data.badge);
        } catch (err) {
            setSafetyPrecheck({ color: 'amber', label: 'Use caution', icon: 'warning', blocked: false, reason: 'AI Check unavailable' });
        } finally {
            setCheckingSafety(false);
        }
    };

    return (
      <div className="bg-gray-50 min-h-screen pt-24 pb-12">
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          .animate-slideInRight {
            animation: slideInRight 0.3s ease-out forwards;
          }
        `}</style>
        
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Post Surplus Food 🍱</h1>
            <Link to="/feed" className="text-sm font-medium text-green-600 hover:text-green-700">← Back</Link>
          </div>

          <div className="space-y-6">

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Food Name *</label>
                <input type="text" name="title" className="w-full border border-gray-200 rounded-xl h-11 px-4 focus:ring-2 ring-green-500 border-transparent outline-none text-gray-900" placeholder="e.g. Chicken Biryani, Fresh Vegetables..." onChange={handleChange} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Food Type *</label>
                  <div className="flex flex-wrap gap-2">
                    {['cooked', 'raw', 'packaged', 'bakery'].map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({ ...formData, foodType: type })}
                        className={formData.foodType === type 
                          ? 'bg-green-600 text-white rounded-full px-4 py-1.5 text-sm' 
                          : 'border border-gray-200 rounded-full px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50'
                        }
                      >
                        {type === 'cooked' ? '🍛 Cooked' : type === 'raw' ? '🥦 Raw' : type === 'packaged' ? '📦 Packaged' : '🍞 Baked'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                  <input type="text" name="quantity" placeholder="e.g. 5kg or 20 meals" className="w-full border border-gray-200 rounded-xl h-11 px-4 focus:ring-2 ring-green-500 border-transparent outline-none text-gray-900" onChange={handleChange} required />
                </div>
              </div>

              <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Best Before *</label>
                 <input type="datetime-local" name="expiresAt" className="w-full border border-gray-200 rounded-xl h-11 px-4 focus:ring-2 ring-green-500 border-transparent outline-none text-gray-900" onChange={handleChange} required />
              </div>

              <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Address *</label>
                 <input type="text" name="address" placeholder="Street address, area, city" className="w-full border border-gray-200 rounded-xl h-11 px-4 focus:ring-2 ring-green-500 border-transparent outline-none text-gray-900" onChange={handleChange} value={formData.address || ''} required />
                 {autoFilled ? (
                   <span className="text-xs text-green-600 mt-1 flex items-center gap-1">✓ GPS location captured</span>
                 ) : (
                   <button type="button" onClick={captureLocation} className="mt-2 text-sm text-green-600 font-medium hover:underline">📍 Use My Location</button>
                 )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">📸 Food Photo * (required)</label>
                <div className="flex gap-3 flex-wrap">
                  <label className="flex items-center gap-2 cursor-pointer bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all">
                    📷 Take Photo
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer border-2 border-green-600 text-green-700 hover:bg-green-50 text-sm font-medium px-4 py-2.5 rounded-xl transition-all">
                    🖼️ Upload from Gallery
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                  </label>
                </div>

                {images.length > 0 && (
                  <div className="flex gap-3 flex-wrap mt-3">
                    {images.map((img, i) => (
                      <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-green-300 shadow-sm group">
                        <img src={img} alt={`food-${i}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {images.length === 0 && (
                   <p className="text-xs text-amber-600 mt-1">⚠️ Photo required — listings with photos get claimed 3× faster</p>
                )}
              </div>

              <div>
                 <div className="flex justify-between items-end mb-1">
                   <label className="block text-sm font-medium text-gray-700">Food Condition *</label>
                 </div>
                 <div className="flex flex-col gap-2">
                   <textarea name="condition" rows="3" placeholder="Describe freshness, packaging, any relevant details..." className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 ring-green-500 border-transparent outline-none text-gray-900" onChange={handleChange} required></textarea>
                   
                   <div className="flex justify-end">
                     <button type="button" disabled={checkingSafety} onClick={handleSafetyCheck} 
                       className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-2 text-sm font-medium hover:bg-green-100 transition-colors disabled:opacity-50">
                       {checkingSafety ? 'Checking...' : '🛡️ Check Food Safety'}
                     </button>
                   </div>
                 </div>

                 {safetyPrecheck && (
                   <div className={`mt-3 p-4 rounded-xl border ${safetyPrecheck.blocked ? 'bg-red-50 border-red-200' : safetyPrecheck.verdict === 'Caution' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                     <div className="flex items-center gap-2 mb-1">
                       <SafetyBadge score={safetyPrecheck.score || safetyPrecheck.verdict === 'Safe' ? 85 : (safetyPrecheck.verdict === 'Caution' ? 50 : 10)} />
                       {safetyPrecheck.blocked && <span className="text-sm text-red-600 font-bold">Listing blocked</span>}
                     </div>
                     {safetyPrecheck.suggestedAction && !safetyPrecheck.blocked && (
                         <p className="text-sm text-gray-700 mt-2"><strong>AI Advice:</strong> {safetyPrecheck.suggestedAction}</p>
                     )}
                     {safetyPrecheck.blocked && safetyPrecheck.reason && (
                         <p className="text-sm text-red-600 mt-1"><strong>Reason:</strong> {safetyPrecheck.reason}</p>
                     )}
                   </div>
                 )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hours Since Cooked</label>
                  <input type="number" name="hoursSinceCooked" placeholder="e.g. 2" className="w-full border border-gray-200 rounded-xl h-11 px-4 focus:ring-2 ring-green-500 border-transparent outline-none text-gray-900" onChange={handleChange} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Storage Method</label>
                  <select name="storageMethod" className="w-full border border-gray-200 rounded-xl h-11 px-4 focus:ring-2 ring-green-500 border-transparent outline-none text-gray-900 bg-white" onChange={handleChange}>
                    <option value="Fridge">Fridge</option>
                    <option value="Freezer">Freezer</option>
                    <option value="Room Temperature">Room Temperature</option>
                    <option value="Insulated">Insulated</option>
                  </select>
                </div>
              </div>

              <div className="pt-4">
                 {error && (
                   <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm mb-4">
                     ⚠️ {error}
                   </div>
                 )}
                 <button type="submit" disabled={submitting || safetyPrecheck?.blocked || images.length === 0} 
                   className="w-full bg-green-600 text-white rounded-xl h-12 font-semibold hover:bg-green-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                   {submitting && <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                   {submitting ? 'Posting...' : '🚀 Post Food'}
                 </button>
                 <p className="text-xs text-center text-gray-400 mt-3">Your listing goes live instantly and nearby recipients are notified</p>
              </div>

            </form>
          </div>
        </div>

      </div>
    );
}
