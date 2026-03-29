import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/store';
import api from '../utils/api';

export default function Register() {
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', phone: '', orgName: '', manualCity: '', role: 'recipient'
  });
  const [location, setLocation] = useState({ lat: null, lng: null });
  const [error, setError] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  
  // Validation States
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});
  
  // Custom UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [locDenied, setLocDenied] = useState(false);
  const [impactData, setImpactData] = useState(null);

  const setAuth = useAuthStore(s => s.setAuth);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/impact')
      .then(res => res.json())
      .then(data => setImpactData(data))
      .catch(() => {});
  }, []);

  const validate = () => {
    const errors = {};
    if (!formData.name || formData.name.trim().length < 2)
      errors.name = 'Name must be at least 2 characters';
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      errors.email = 'Please enter a valid email address';
    if (!formData.password || formData.password.length < 8)
      errors.password = 'Password must be at least 8 characters';
    if (!formData.phone || !/^\d{10}$/.test(formData.phone))
      errors.phone = 'Please enter a valid 10-digit number';
    return errors;
  };

  useEffect(() => {
    setFieldErrors(validate());
  }, [formData]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setTouched({ ...touched, [e.target.name]: true });
  };

  const hasErrors = Object.keys(fieldErrors).length > 0;

  const handleGetLocation = () => {
    setLocLoading(true);
    setLocDenied(false);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocLoading(false);
        },
        (err) => {
          console.log('Location access denied or failed');
          setLocDenied(true);
          setLocLoading(false);
        }
      );
    } else {
      setLocDenied(true);
      setLocLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (hasErrors) return;
    
    setError('');
    setIsSubmitting(true);
    try {
      // Pass manualCity as well in case geolocation was denied, the backend can choose how to use it
      const payload = { ...formData, ...location };
      const res = await api.post('/api/auth/register', payload);
      setAuth(res.data.user, res.data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, text: '', color: '' };
    if (pwd.length < 4) return { score: 0, text: 'Weak', color: 'text-gray-500' };
    if (pwd.length < 8) return { score: 1, text: 'Weak', color: 'text-red-500' };
    
    const hasNum = /\d/.test(pwd);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd);
    
    if (pwd.length >= 8 && hasNum && hasSpecial) return { score: 4, text: 'Strong', color: 'text-green-600' };
    if (pwd.length >= 8 && hasNum) return { score: 3, text: 'Good', color: 'text-amber-500' };
    return { score: 2, text: 'Fair', color: 'text-amber-500' };
  };

  const pwdStrength = getPasswordStrength(formData.password);

  const getFieldClass = (name) => {
    const base = "w-full pl-10 pr-3 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none bg-white";
    if (touched[name] && fieldErrors[name]) return `${base} border-red-400 bg-red-50`;
    if (touched[name] && !fieldErrors[name]) return `${base} border-green-400`;
    return `${base} border-gray-200`;
  };

  return (
    <div className="flex min-h-screen bg-[#fafaf7] font-sans selection:bg-green-200 font-sans">
      
      {/* Left Panel - Hidden on Mobile */}
      <div className="hidden md:flex flex-col w-[45%] bg-[#14532d] relative p-12 overflow-hidden justify-between">
        {/* Decor */}
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-green-800/40 rounded-full blur-3xl point-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[300px] h-[300px] bg-green-900/40 rounded-full blur-2xl point-events-none"></div>

        <div className="relative z-10">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-white text-2xl font-bold hover:opacity-80 transition cursor-pointer">
            🌱 FoodBridge
          </button>
        </div>

        <div className="flex flex-col items-center justify-center relative z-10 flex-1 my-12">
           <div className="text-8xl mb-6 drop-shadow-lg">🍱</div>
           <h1 className="text-3xl font-bold text-white text-center tracking-tight leading-tight">Join the movement</h1>
           <p className="text-green-200 text-sm text-center max-w-xs mt-3 leading-relaxed">
             Help reduce food waste in your community. Connect surplus food with people who need it.
           </p>

           <div className="flex gap-3 mt-12 flex-wrap justify-center">
             <div className="bg-white/10 text-white text-xs rounded-full px-3 py-1 font-medium border border-white/5 backdrop-blur-sm shadow-sm">
               🍽️ {impactData?.totalMealsSaved || 127}+ Meals Saved
             </div>
             <div className="bg-white/10 text-white text-xs rounded-full px-3 py-1 font-medium border border-white/5 backdrop-blur-sm shadow-sm">
               📦 {impactData?.totalKgFoodSaved || 42}kg Food Rescued
             </div>
             <div className="bg-white/10 text-white text-xs rounded-full px-3 py-1 font-medium border border-white/5 backdrop-blur-sm shadow-sm">
               ✅ {impactData?.totalDeliveries || 14} Deliveries
             </div>
           </div>
        </div>

        <div className="relative z-10 text-center">
           <span className="text-green-200 text-sm">Already have an account? </span>
           <button onClick={() => navigate('/login')} className="text-white font-semibold hover:underline transition">Sign in here →</button>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full md:w-[55%] flex items-center justify-center p-8 md:p-12 relative">
         <div className="w-full max-w-md mx-auto relative z-10">
            
            {/* Mobile Logo */}
            <div className="md:hidden flex flex-col items-start mb-8">
               <button onClick={() => navigate('/')} className="text-[#16a34a] text-xl font-bold flex items-center gap-2 mb-4">
                 🌱 FoodBridge
               </button>
               <button onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-600 font-bold text-sm bg-white border border-gray-200 shadow-sm px-4 py-2.5 rounded-full hover:bg-gray-50 hover:text-gray-900 hover:shadow-md transition-all">
                 ← Back to home
               </button>
            </div>

            {/* Desktop Back button */}
            <div className="hidden md:block absolute top-[-60px] left-0">
               <button onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-600 font-bold text-sm bg-white border border-gray-200 shadow-sm px-4 py-2 rounded-full hover:bg-gray-50 hover:text-gray-900 hover:shadow-md transition-all">
                 ← Back to home
               </button>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mt-6 tracking-tight">Create your account</h2>
            <p className="text-gray-500 text-sm mt-1 mb-8 font-medium">Start sharing or finding food in minutes</p>

            {error && (
               <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-6 flex items-center gap-3">
                  <span className="text-red-500">⚠️</span>
                  <p className="text-red-700 text-sm font-medium">{error}</p>
               </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
               {/* Full Name */}
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <div className="relative">
                     <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">👤</span>
                     <input type="text" name="name" placeholder="e.g. Priya Sharma" className={getFieldClass('name')} onChange={handleChange} required />
                     {touched.name && !fieldErrors.name && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 font-bold">✓</span>}
                  </div>
                  {touched.name && fieldErrors.name && <p className="text-red-500 text-xs mt-1 font-medium">{fieldErrors.name}</p>}
               </div>

               {/* Email Address */}
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                  <div className="relative">
                     <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">✉️</span>
                     <input type="email" name="email" placeholder="you@example.com" className={getFieldClass('email')} onChange={handleChange} onBlur={() => setTouched({ ...touched, email: true })} required />
                     {touched.email && !fieldErrors.email && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 font-bold">✓</span>}
                  </div>
                  {touched.email && fieldErrors.email && <p className="text-red-500 text-xs mt-1 font-medium">{fieldErrors.email}</p>}
               </div>

               {/* Password */}
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                  <div className="relative">
                     <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔒</span>
                     <input type={showPwd ? "text" : "password"} name="password" placeholder="Min. 8 characters" className={getFieldClass('password')} onChange={handleChange} required />
                     <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition" tabIndex="-1">
                        {showPwd ? '🙈' : '👁️'}
                     </button>
                  </div>
                  {touched.password && fieldErrors.password ? (
                     <p className="text-red-500 text-xs mt-1 font-medium">{fieldErrors.password}</p>
                  ) : (
                     formData.password.length > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                           <div className="flex gap-1 flex-1 h-1">
                              <div className={`flex-1 rounded-full ${pwdStrength.score >= 1 ? (pwdStrength.score >= 3 ? 'bg-green-500' : (pwdStrength.score >= 2 ? 'bg-amber-500' : 'bg-red-500')) : 'bg-gray-200'}`}></div>
                              <div className={`flex-1 rounded-full ${pwdStrength.score >= 2 ? (pwdStrength.score >= 3 ? 'bg-green-500' : 'bg-amber-500') : 'bg-gray-200'}`}></div>
                              <div className={`flex-1 rounded-full ${pwdStrength.score >= 3 ? (pwdStrength.score >= 4 ? 'bg-green-500' : 'bg-green-400') : 'bg-gray-200'}`}></div>
                              <div className={`flex-1 rounded-full ${pwdStrength.score >= 4 ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                           </div>
                           <span className={`text-[10px] font-bold uppercase tracking-wider ${pwdStrength.color}`}>{pwdStrength.text}</span>
                        </div>
                     )
                  )}
               </div>

               {/* Phone Number */}
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                  <div className="relative flex items-center">
                     <span className="absolute left-3 text-gray-400 z-10">📱</span>
                     <div className="absolute left-9 text-gray-400 font-medium text-sm flex items-center z-10 w-12 border-r border-gray-200 py-1">
                        +91 
                     </div>
                     <input type="text" name="phone" placeholder="10-digit mobile number" className={getFieldClass('phone').replace('pl-10', 'pl-[5.5rem]')} onChange={handleChange} maxLength={10} required />
                     {touched.phone && !fieldErrors.phone && <span className="absolute right-3 text-green-500 font-bold z-10">✓</span>}
                  </div>
                  {touched.phone && fieldErrors.phone && <p className="text-red-500 text-xs mt-1 font-medium">Please enter a valid 10-digit number</p>}
               </div>

               {/* Role Selection */}
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">I want to join as</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'donor', emoji: '🍳', label: 'Donor', desc: 'Share surplus food' },
                      { value: 'recipient', emoji: '🙏', label: 'Recipient', desc: 'Claim free food' },
                      { value: 'volunteer', emoji: '🚴', label: 'Volunteer', desc: 'Deliver food' },
                    ].map(r => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => { setFormData(f => ({ ...f, role: r.value })); }}
                        className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 text-center transition-all ${
                          formData.role === r.value
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-green-300'
                        }`}
                      >
                        <span className="text-2xl">{r.emoji}</span>
                        <span className="text-xs font-bold">{r.label}</span>
                        <span className="text-[10px] text-gray-400 leading-tight">{r.desc}</span>
                      </button>
                    ))}
                  </div>
               </div>

               {/* Organization Name */}
               <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                     Organization Name <span className="text-[10px] bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 ml-2 font-bold tracking-wide uppercase">Optional</span>
                  </label>
                  <div className="relative">
                     <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🏢</span>
                     <input type="text" name="orgName" placeholder="Restaurant, NGO, or leave blank" className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none bg-white" onChange={handleChange} />
                  </div>
               </div>

               {/* Location Capture */}
               <div>
                  {location.lat && location.lng ? (
                     <div className="bg-green-50 border border-green-200 py-3 px-4 rounded-xl flex items-center justify-between">
                        <div>
                           <div className="text-green-700 font-medium flex items-center gap-2">📍 Location captured</div>
                           <div className="text-[11px] text-green-600/80 font-semibold mt-0.5">Ready for precision routing</div>
                        </div>
                        <button type="button" onClick={() => setLocation({ lat: null, lng: null })} className="text-xs font-bold text-green-700 hover:text-green-800 underline">Change</button>
                     </div>
                  ) : locDenied ? (
                     <div className="space-y-2">
                        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium py-2 px-3 rounded-lg flex items-center gap-2">
                           ⚠️ Location denied. Enter city manually
                        </div>
                        <div className="relative">
                           <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">📍</span>
                           <input type="text" name="manualCity" placeholder="Your City Area (e.g. Bandra, Mumbai)" className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none bg-white" onChange={handleChange} />
                        </div>
                     </div>
                  ) : (
                     <button type="button" onClick={handleGetLocation} disabled={locLoading} className="w-full border-2 border-dashed border-gray-300 rounded-xl py-3 text-gray-500 text-sm font-medium hover:border-green-400 hover:text-green-600 hover:bg-green-50/30 transition-all flex items-center justify-center gap-2">
                        {locLoading ? (
                           <>
                              <svg className="animate-spin h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              Getting your location...
                           </>
                        ) : (
                           <>📍 Allow Location Access</>
                        )}
                     </button>
                  )}
               </div>
               
               {/* Submit Button */}
               <button type="submit" disabled={hasErrors || isSubmitting} className="w-full bg-[#16a34a] text-white py-3 mt-4 rounded-xl font-semibold text-base shadow-sm hover:bg-[#15803d] hover:shadow-lg focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex justify-center items-center gap-2">
                  {isSubmitting ? (
                     <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Creating account...
                     </>
                  ) : (
                     <>Create Account →</>
                  )}
               </button>
            </form>

            <p className="text-xs text-gray-400 text-center mt-6 leading-relaxed max-w-xs mx-auto">
               By creating an account, you agree to use FoodBridge responsibly and not misuse donated food.
            </p>
         </div>
      </div>

    </div>
  );
}
