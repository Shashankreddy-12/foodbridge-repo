import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/store';
import api from '../utils/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const setAuth = useAuthStore(s => s.setAuth);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const res = await api.post('/api/auth/login', { email, password });
      setAuth(res.data.user, res.data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInputClass = () => "w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none bg-white";

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#fafaf7] font-sans">
      
      {/* Left Panel */}
      <div className="hidden md:flex flex-col w-[45%] bg-[#14532d] relative p-12 overflow-hidden justify-between h-screen">
        {/* Decor */}
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-green-800/40 rounded-full blur-3xl point-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[300px] h-[300px] bg-green-900/40 rounded-full blur-2xl point-events-none"></div>

        <div className="relative z-10">
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 hover:opacity-80 transition cursor-pointer">
             <span className="text-2xl">🌿</span>
             <span className="text-2xl font-bold tracking-tight text-white">Food<span className="text-green-300">Bridge</span></span>
          </button>
        </div>

        <div className="flex flex-col items-center justify-center relative z-10 flex-1 my-12">
           <div className="text-8xl mb-6 drop-shadow-lg">🤝</div>
           <h1 className="text-3xl font-bold text-white text-center tracking-tight leading-tight">Welcome back!</h1>
           <p className="text-green-200 text-sm text-center max-w-xs mt-3 leading-relaxed">
             The community has been busy while you were away.
           </p>

           <div className="flex flex-col gap-2 mt-12 w-full max-w-xs">
             <div className="bg-white/10 text-white text-xs rounded-xl p-3 font-medium border border-white/5 shadow-sm transform hover:scale-105 transition">
               🍱 Upma posted in Chennai — 2 min ago
             </div>
             <div className="bg-white/10 text-white text-xs rounded-xl p-3 font-medium border border-white/5 shadow-sm transform hover:scale-105 transition">
               ✅ Salad claimed by Ravi — 5 min ago
             </div>
             <div className="bg-white/10 text-white text-xs rounded-xl p-3 font-medium border border-white/5 shadow-sm transform hover:scale-105 transition">
               🚴 Delivery completed — 8 min ago
             </div>
           </div>
        </div>

        <div className="relative z-10 text-center">
           <span className="text-green-200 text-sm">New to FoodBridge? </span>
           <button onClick={() => navigate('/register')} className="text-white font-semibold hover:underline transition">Create a free account →</button>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full md:w-[55%] flex items-center justify-center p-8 md:p-12 relative h-screen">
        <div className="w-full max-w-md mx-auto relative z-10">
          
          {/* Mobile Logo */}
          <div className="md:hidden flex flex-col items-start mb-8">
             <button onClick={() => navigate('/')} className="flex items-center gap-1.5 mb-4">
               <span className="text-2xl">🌿</span>
               <span className="text-xl font-bold text-green-700 tracking-tight">Food<span className="text-gray-900">Bridge</span></span>
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

          <h2 className="text-2xl font-bold text-gray-900 mt-6 tracking-tight">Sign in to FoodBridge</h2>
          <p className="text-gray-500 text-sm mt-1 mb-8 font-medium">Welcome back — food is waiting nearby 🌱</p>

          {error && (
             <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-6 flex items-center gap-3">
                <span className="text-red-500">⚠️</span>
                <p className="text-red-700 text-sm font-medium">{error}</p>
             </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <div className="relative">
                 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">✉️</span>
                 <input 
                   type="email" 
                   placeholder="you@example.com"
                   className={getInputClass()} 
                   value={email} 
                   onChange={e => setEmail(e.target.value)} 
                   required 
                 />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium text-gray-700">Password</label>
                <Link to="/forgot-password" className="text-sm text-green-600 hover:text-green-700 font-medium transition">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔒</span>
                 <input 
                   type={showPwd ? "text" : "password"} 
                   placeholder="Min. 8 characters"
                   className={`${getInputClass()}`} 
                   value={password} 
                   onChange={e => setPassword(e.target.value)} 
                   required 
                 />
                 <button 
                    type="button" 
                    onClick={() => setShowPwd(!showPwd)} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition" 
                    tabIndex="-1"
                 >
                    {showPwd ? '🙈' : '👁️'}
                 </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="w-full bg-[#16a34a] text-white py-3 mt-4 rounded-xl font-semibold text-base shadow-sm hover:bg-[#15803d] hover:shadow-lg focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex justify-center items-center gap-2"
            >
              {isSubmitting ? (
                 <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Signing in...
                 </>
              ) : (
                 <>Sign In →</>
              )}
            </button>
          </form>

          <div className="flex items-center gap-3 mt-6">
            <hr className="flex-1 border-gray-200" />
            <span className="text-xs text-gray-400 uppercase tracking-widest font-semibold">or</span>
            <hr className="flex-1 border-gray-200" />
          </div>

          <p className="mt-4 text-sm text-center text-gray-500 font-medium">
            Don't have an account? <Link to="/register" className="text-green-600 font-semibold hover:underline">Create one free →</Link>
          </p>
          
        </div>
      </div>

    </div>
  );
}
