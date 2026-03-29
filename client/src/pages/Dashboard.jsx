import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import {
  Leaf,
  Scale,
  Truck,
  UtensilsCrossed,
  PlusCircle,
  Map,
  ClipboardList,
  Bike,
  ChevronRight,
  BarChart2,
  Info
} from 'lucide-react';
import api from '../utils/api';
import { useAuthStore } from '../store/store';
import { useNotificationStore } from '../store/notifications';

// FIX 3 — Safe Chart.js registration at module level
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// FIX 1 — Add NotificationBellInline before ErrorBoundary
function NotificationBellInline() {
  const { notifications } = useNotificationStore();
  const unread = notifications ? notifications.length : 0;
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
      >
        <span className="text-xl">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-gray-800 text-sm">Notifications</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {unread === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">🎉 All caught up!</div>
            ) : (
              notifications.map((n, i) => (
                <div key={i} className="px-4 py-3 border-b border-gray-50 hover:bg-gray-50">
                  <p className="text-sm text-gray-700">{n.message || n.text || JSON.stringify(n)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{n.time || 'Just now'}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// FIX 1 — Wrap entire component in ErrorBoundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#fafaf7]">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-lg text-center">
            <p className="text-red-600 font-semibold text-lg mb-2">Dashboard crashed</p>
            <p className="text-red-400 text-sm font-mono">{String(this.state.error)}</p>
            <button onClick={() => window.location.reload()} className="mt-4 bg-green-600 text-white px-4 py-2 rounded-xl text-sm">Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// FIX 5 — Safe useCountUp hook
function useCountUp(target, duration = 2000) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const numTarget = Number(target) || 0;
    if (numTarget === 0) { setCount(0); return; }
    let start = 0;
    const step = numTarget / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= numTarget) { setCount(numTarget); clearInterval(timer); }
      else { setCount(Math.floor(start)); }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // FIX 6 — Add console.log to confirm render
  console.log('[Dashboard] rendering, user:', user);

  const [loading, setLoading] = useState(true);
  const [impactData, setImpactData] = useState({ 
    totalMealsSaved: 0, 
    totalKgFoodSaved: 0, 
    totalCO2Saved: 0, 
    totalDeliveries: 0 
  });
  const [myListings, setMyListings] = useState({ donated: [], claimed: [], volunteer: [] });
  const [surplusData, setSurplusData] = useState([]);
  const [liveListings, setLiveListings] = useState([]);
  const [errorToast, setErrorToast] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return; // Wait for user to be available
      try {
        // 1. Fetch global impact stats
        const impactRes = await api.get('/impact');
        setImpactData(impactRes.data || { 
          totalMealsSaved: 0, 
          totalKgFoodSaved: 0, 
          totalCO2Saved: 0, 
          totalDeliveries: 0 
        });

        // 2. Fetch my listings (donated + claimed + volunteer)
        const myRes = await api.get('/listings/my');
        const donated = Array.isArray(myRes.data?.donated) ? myRes.data.donated : [];
        const claimed = Array.isArray(myRes.data?.claimed) ? myRes.data.claimed : [];
        const volunteer = Array.isArray(myRes.data?.volunteer) ? myRes.data.volunteer : [];
        setMyListings({ donated, claimed, volunteer });

        // 3. Fetch surplus prediction
        const surplusRes = await api.get('/analytics/surplus-prediction');
        setSurplusData(Array.isArray(surplusRes.data) ? surplusRes.data : []);

        const feedRes = await api.get('/listings?radius=20');
        const feedItems = Array.isArray(feedRes.data) ? feedRes.data : [];
        setLiveListings(feedItems);

      } catch (err) {
        console.error('Dashboard data fetch error:', err);
        setImpactData({ totalMealsSaved: 0, totalKgFoodSaved: 0, totalCO2Saved: 0, totalDeliveries: 0 });
        setMyListings({ donated: [], claimed: [], volunteer: [] });
        setSurplusData([]);
        setLiveListings([]);
        
        setErrorToast(true);
        setTimeout(() => setErrorToast(false), 4000);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Data for Marquee Loop
  const stripItems = liveListings.length > 0
    ? liveListings.map(l => `🍱 ${l.title}`)
    : ['🌿 No listings nearby yet — be the first to share food!'];
  
  const marqueeItems = [...stripItems, ...stripItems];

  // Helper function
  const formatStatus = (status) => {
    switch(status) {
      case 'available': return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">available</span>;
      case 'claimed': return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">claimed</span>;
      case 'delivered': return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">delivered</span>;
      case 'expired': return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">expired</span>;
      default: return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  // Chart config
  const chartData = {
    labels: surplusData.map(d => `${d.hour}:00`),
    datasets: [{
      label: 'Listings',
      data: surplusData.map(d => d.count),
      backgroundColor: surplusData.map(d => d.isPeak ? '#f59e0b' : '#86efac'),
      borderRadius: 6,
      borderSkipped: false
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
       legend: { display: false },
       tooltip: {
         callbacks: {
             label: (context) => ` ${context.raw} listings expected`
         }
       }
    },
    scales: {
       x: { 
          grid: { display: false },
          ticks: { color: '#9ca3af', font: { family: 'Inter', weight: '600' } }
       },
       y: {
          grid: { color: '#f3f4f6' },
          beginAtZero: true,
          ticks: { color: '#9ca3af', font: { family: 'Inter', weight: '600' } }
       }
    }
  };

  // FIX: Hooks must be called unconditionally at the top level!
  const mealsCount = useCountUp(impactData.totalMealsSaved);
  const kgCount = useCountUp(impactData.totalKgFoodSaved);
  const co2Count = useCountUp(impactData.totalCO2Saved);
  const deliveriesCount = useCountUp(impactData.totalDeliveries);

  // FIX 7 — Ensure root div is always visible. Loading logic must exist inside.
  return (
    <div className="min-h-screen bg-[#fafaf7]">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.45s ease-out forwards;
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 28s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slideInRight {
          animation: slideInRight 0.3s ease-out forwards;
        }
      `}</style>

      {/* DASHBOARD NAVBAR FIX */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm h-16 flex items-center px-6 md:px-10">
        
        {/* LEFT — Branding */}
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          <span className="text-2xl">🌿</span>
          <span className="text-xl font-bold text-green-700 tracking-tight">Food<span className="text-gray-900">Bridge</span></span>
        </Link>

        {/* CENTER — Nav Links (hidden on mobile) */}
        <div className="hidden md:flex items-center gap-1 mx-auto">
          {[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Browse Food', path: '/feed' },
            { label: 'Post Food', path: '/post-listing' },
            { label: 'My Activity', path: '/my-listings' },
            { label: 'Volunteer', path: '/volunteer' },
          ].map(link => (
            <Link
              key={link.path}
              to={link.path}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                window.location.pathname === link.path
                  ? 'text-green-700 bg-green-50'
                  : 'text-gray-600 hover:text-green-700 hover:bg-green-50'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* RIGHT — Notification Bell + Profile */}
        <div className="flex items-center gap-3 ml-auto">
          
          {/* Notification Bell */}
          <NotificationBellInline />

          {/* Profile Avatar Button */}
          <button
            onClick={() => setShowProfile(true)}
            className="w-9 h-9 rounded-full bg-green-600 text-white font-bold text-sm flex items-center justify-center hover:bg-green-700 transition-all shadow-sm flex-shrink-0"
            title={user?.name}
          >
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </button>

          {/* Logout */}
          <button
            onClick={() => { useAuthStore.getState().logout(); navigate('/login'); }}
            className="hidden md:flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
          >
            <span>↩</span> Logout
          </button>
        </div>
      </nav>

      {/* FIX 2 — Guard against missing user */}
      {!user || loading ? (
        <div className="flex flex-col items-center justify-center min-h-[500px]">
          <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-gray-400 text-sm mt-4 font-medium">Loading your dashboard...</div>
        </div>
      ) : (
        <>
          {/* ERROR TOAST */}
          {errorToast && (
            <div className="fixed top-20 right-4 z-50 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm font-medium shadow-md">
              Could not load some data. Please refresh.
            </div>
          )}

          {/* SECTION [A] HERO WELCOME BANNER */}
          <section className="mt-16 w-full relative overflow-hidden" style={{
            background: `
              linear-gradient(135deg, rgba(15,60,30,0.82) 0%, rgba(20,83,45,0.75) 40%, rgba(21,128,61,0.65) 100%),
              url("https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1600&q=80&fit=crop")
            `,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundBlendMode: 'multiply',
            minHeight: '280px'
          }}>
            <div className="absolute inset-0 pointer-events-none">
              {/* Radial glow top-right */}
              <div className="absolute -top-20 -right-20 w-96 h-96 bg-green-400 rounded-full opacity-10 blur-3xl" />
              {/* Radial glow bottom-left */}
              <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-emerald-300 rounded-full opacity-10 blur-2xl" />
              {/* Subtle grid overlay */}
              <div className="absolute inset-0 opacity-5" style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                backgroundSize: '40px 40px'
              }} />
            </div>

            <div className="relative z-10 px-6 py-10 md:px-16 md:py-14 flex flex-col md:flex-row items-center justify-between gap-8 h-full min-h-[200px]">
               <div className="flex flex-col text-center md:text-left">
                  <span className="self-center md:self-start rounded-full bg-green-400/20 border border-green-400/30 text-green-200 text-xs font-bold px-3 py-1 uppercase tracking-wide">
                    🌱 FoodBridge Dashboard
                  </span>
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mt-4">
                    Welcome back, {user.name}! 👋
                  </h1>
                  <p className="text-green-200 text-base mt-2 font-medium">
                    Here's your impact at a glance.
                  </p>
               </div>

               <div className="hidden md:flex flex-col bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 w-64 shadow-lg shrink-0">
                 <div className="font-bold text-white text-sm mb-1">{user.name}</div>
                 <div className="text-xs text-green-100 mb-4 opacity-80 truncate">{user.email}</div>
                 
                 <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center bg-black/10 rounded-lg px-2 py-1">
                      <span className="text-green-200 text-xs font-medium">Donated</span>
                      <span className="text-white font-bold text-sm tracking-wide">{myListings.donated.length} items</span>
                    </div>
                    <div className="flex justify-between items-center bg-black/10 rounded-lg px-2 py-1">
                      <span className="text-green-200 text-xs font-medium">Claimed</span>
                      <span className="text-white font-bold text-sm tracking-wide">{myListings.claimed.length} items</span>
                    </div>
                    <div className="flex justify-between items-center bg-black/10 rounded-lg px-2 py-1">
                      <span className="text-green-200 text-xs font-medium">Deliveries</span>
                      <span className="text-white font-bold text-sm tracking-wide">{myListings.volunteer.length}</span>
                    </div>
                 </div>
               </div>
            </div>
          </section>

          {/* SECTION [B] SCROLLING FOOD STRIP */}
          <section className="bg-[#16a34a] py-3 overflow-hidden whitespace-nowrap border-y border-green-800/30">
             <div className="inline-flex items-center animate-marquee font-sans">
                {marqueeItems.map((item, i) => (
                   <React.Fragment key={i}>
                     <span className="text-white text-sm font-medium px-6 opacity-90">{item}</span>
                     {i < marqueeItems.length - 1 && <span className="text-green-300 px-2">•</span>}
                   </React.Fragment>
                ))}
             </div>
          </section>

          {/* FULL WIDTH ROW: Quick Actions */}
          <section className="px-6 md:px-16 mt-10">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-6">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div onClick={() => navigate('/post-listing')} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer group">
                  <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center shrink-0">
                     <PlusCircle size={28} className="text-green-600 stroke-[2.5]" />
                  </div>
                  <div className="flex-1">
                     <div className="text-xl font-bold tracking-tight text-gray-900">Post Food</div>
                     <div className="text-sm font-medium text-gray-500 mt-1 leading-relaxed">Donate surplus food to people near you. Every meal counts.</div>
                  </div>
                  <ChevronRight size={24} className="text-gray-300 shrink-0 group-hover:text-green-500 transition-colors ml-auto" />
              </div>

              <div onClick={() => navigate('/feed')} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer group">
                  <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center shrink-0">
                     <Map size={28} className="text-blue-600 stroke-[2.5]" />
                  </div>
                  <div className="flex-1">
                     <div className="text-xl font-bold tracking-tight text-gray-900">Browse Food</div>
                     <div className="text-sm font-medium text-gray-500 mt-1 leading-relaxed">Find free food available near you on the live map.</div>
                  </div>
                  <ChevronRight size={24} className="text-gray-300 shrink-0 group-hover:text-blue-500 transition-colors ml-auto" />
              </div>

              <div onClick={() => navigate('/my-listings')} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer group">
                  <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                     <ClipboardList size={28} className="text-amber-600 stroke-[2.5]" />
                  </div>
                  <div className="flex-1">
                     <div className="text-xl font-bold tracking-tight text-gray-900">My Activity</div>
                     <div className="text-sm font-medium text-gray-500 mt-1 leading-relaxed">Track all your donations, claims, and delivery history.</div>
                  </div>
                  <ChevronRight size={24} className="text-gray-300 shrink-0 group-hover:text-amber-500 transition-colors ml-auto" />
              </div>

              <div onClick={() => navigate('/volunteer')} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer group">
                  <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center shrink-0">
                     <Bike size={28} className="text-purple-600 stroke-[2.5]" />
                  </div>
                  <div className="flex-1">
                     <div className="text-xl font-bold tracking-tight text-gray-900">Volunteer</div>
                     <div className="text-sm font-medium text-gray-500 mt-1 leading-relaxed">Pick up and deliver food to those who need it most.</div>
                  </div>
                  <ChevronRight size={24} className="text-gray-300 shrink-0 group-hover:text-purple-500 transition-colors ml-auto" />
              </div>
            </div>
            <p className="text-center text-sm font-medium text-gray-400 mt-6 mb-2">
              💡 Your role updates automatically — post food to become a donor, claim to become a recipient, deliver to become a volunteer.
            </p>
          </section>

          {/* SECTION [D] TWO-COLUMN SECTION */}
          <section className="flex flex-col lg:flex-row gap-6 px-6 md:px-16 mt-8">
             
             {/* LEFT: Surplus Forecast Chart */}
             <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex-1 flex flex-col">
                <h3 className="text-xl font-bold tracking-tight text-gray-900">Surplus Forecast</h3>
                <p className="text-sm text-gray-400 mt-0.5 mb-6 font-medium">Predicted food availability by hour of day</p>

                {/* FIX 4 — Safe surplus chart render */}
                {Array.isArray(surplusData) && surplusData.length > 0 ? (
                  <div className="w-full flex-1 min-h-[260px] flex flex-col">
                    <div style={{ height: '260px' }}>
                      <Bar data={chartData} options={chartOptions} />
                    </div>
                    <div className="flex items-center gap-4 mt-6 border-t border-gray-100 pt-4">
                       <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded bg-[#86efac]"></div>
                          <span className="text-xs text-gray-500 font-bold uppercase tracking-wide">Normal Hour</span>
                       </div>
                       <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded bg-[#f59e0b]"></div>
                          <span className="text-xs text-gray-500 font-bold tracking-wide"><span className="uppercase">Peak Hour</span> (post early!)</span>
                       </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 bg-gray-50/50 rounded-xl border border-gray-100/50 text-center">
                    <span className="text-5xl">📊</span>
                    <p className="text-gray-400 text-sm mt-3 font-medium">No prediction data yet.<br/>Post some food listings to see trends!</p>
                  </div>
                )}
             </div>

             {/* RIGHT: Our Collective Impact */}
             <div className="flex flex-col gap-4 w-full lg:w-80 xl:w-96">
                <h3 className="text-xl font-bold tracking-tight text-gray-900 mb-1">Our Collective Impact</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-5 flex flex-col items-start hover:shadow-md hover:-translate-y-1 transition-all duration-200">
                       <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4 bg-green-100 text-green-600">
                          <UtensilsCrossed size={20} className="stroke-[2.5]" />
                       </div>
                       <div className="text-2xl font-black text-gray-900 tabular-nums tracking-tight">{mealsCount}</div>
                       <div className="text-xs text-gray-500 font-bold mt-1 tracking-wide uppercase leading-tight">Meals Saved</div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-5 flex flex-col items-start hover:shadow-md hover:-translate-y-1 transition-all duration-200">
                       <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4 bg-amber-100 text-amber-600">
                          <Scale size={20} className="stroke-[2.5]" />
                       </div>
                       <div className="text-2xl font-black text-gray-900 tabular-nums tracking-tight">{kgCount}<span className="text-sm font-bold text-gray-400">kg</span></div>
                       <div className="text-xs text-gray-500 font-bold mt-1 tracking-wide uppercase leading-tight">Food Rescued</div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-5 flex flex-col items-start hover:shadow-md hover:-translate-y-1 transition-all duration-200">
                       <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4 bg-emerald-100 text-emerald-600">
                          <Leaf size={20} className="stroke-[2.5]" />
                       </div>
                       <div className="text-2xl font-black text-gray-900 tabular-nums tracking-tight">{co2Count}<span className="text-sm font-bold text-gray-400">kg</span></div>
                       <div className="text-xs text-gray-500 font-bold mt-1 tracking-wide uppercase leading-tight">CO₂ Avoided</div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-5 flex flex-col items-start hover:shadow-md hover:-translate-y-1 transition-all duration-200">
                       <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4 bg-blue-100 text-blue-600">
                          <Truck size={20} className="stroke-[2.5]" />
                       </div>
                       <div className="text-2xl font-black text-gray-900 tabular-nums tracking-tight">{deliveriesCount}</div>
                       <div className="text-xs text-gray-500 font-bold mt-1 tracking-wide uppercase leading-tight">Deliveries</div>
                    </div>
                </div>
             </div>
          </section>

          {/* SECTION [E] RECENT ACTIVITY */}
          <section className="px-6 md:px-16 mt-12">
             <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-6">Recent Activity</h2>
             
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Sub-section 1 — Donated */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col">
                   <div className="flex items-center gap-2 mb-4">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                      <h3 className="font-bold text-gray-800 text-lg">Donated</h3>
                      <span className="text-xs font-bold font-mono bg-gray-100 text-gray-500 rounded-full px-2.5 py-1 ml-auto">{myListings.donated.length}</span>
                   </div>
                   <div className="flex-1 flex flex-col gap-3">
                      {myListings.donated.length === 0 ? (
                         <div className="flex-1 flex items-center justify-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200 p-6 text-center">
                            <span className="text-sm text-gray-400 font-medium italic">No food posted yet.</span>
                         </div>
                      ) : (
                         myListings.donated.slice(-3).reverse().map(item => (
                            <div key={item._id} className="bg-gray-50 border border-gray-100 rounded-xl p-3.5 hover:bg-gray-100 transition-colors cursor-default">
                               <div className="text-sm font-black text-gray-800 truncate mb-2">{item.title}</div>
                               <div className="flex justify-between items-center">
                                  {formatStatus(item.status)}
                                  <span className="text-[11px] font-bold text-gray-400 leading-none">{new Date(item.createdAt).toLocaleDateString()}</span>
                               </div>
                            </div>
                         ))
                      )}
                   </div>
                   <div className="mt-4 pt-4 border-t border-gray-50 px-1">
                      <Link to="/my-listings" className="text-sm font-bold text-green-600 hover:text-green-700 hover:underline transition flex items-center justify-between group">
                         View all <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                      </Link>
                   </div>
                </div>

                {/* Sub-section 2 — Claimed */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col">
                   <div className="flex items-center gap-2 mb-4">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                      <h3 className="font-bold text-gray-800 text-lg">Claimed</h3>
                      <span className="text-xs font-bold font-mono bg-gray-100 text-gray-500 rounded-full px-2.5 py-1 ml-auto">{myListings.claimed.length}</span>
                   </div>
                   <div className="flex-1 flex flex-col gap-3">
                      {myListings.claimed.length === 0 ? (
                         <div className="flex-1 flex items-center justify-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200 p-6 text-center">
                            <span className="text-sm text-gray-400 font-medium italic">Nothing claimed yet.</span>
                         </div>
                      ) : (
                         myListings.claimed.slice(-3).reverse().map(item => (
                            <div key={item._id} className="bg-gray-50 border border-gray-100 rounded-xl p-3.5 hover:bg-gray-100 transition-colors cursor-default">
                               <div className="text-sm font-black text-gray-800 truncate mb-2">{item.title}</div>
                               <div className="flex justify-between items-center">
                                  {formatStatus(item.status)}
                                  <span className="text-[11px] font-bold text-gray-400 leading-none">{new Date(item.createdAt).toLocaleDateString()}</span>
                               </div>
                            </div>
                         ))
                      )}
                   </div>
                   <div className="mt-4 pt-4 border-t border-gray-50 px-1">
                      <Link to="/my-listings" className="text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline transition flex items-center justify-between group">
                         View all <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                      </Link>
                   </div>
                </div>

                {/* Sub-section 3 — Deliveries */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col">
                   <div className="flex items-center gap-2 mb-4">
                      <div className="w-2.5 h-2.5 rounded-full bg-purple-500"></div>
                      <h3 className="font-bold text-gray-800 text-lg">Deliveries</h3>
                      <span className="text-xs font-bold font-mono bg-gray-100 text-gray-500 rounded-full px-2.5 py-1 ml-auto">{myListings.volunteer.length}</span>
                   </div>
                   <div className="flex-1 flex flex-col gap-3">
                      {myListings.volunteer.length === 0 ? (
                         <div className="flex-1 flex items-center justify-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200 p-6 text-center">
                            <span className="text-sm text-gray-400 font-medium italic">No deliveries yet. Consider volunteering!</span>
                         </div>
                      ) : (
                         myListings.volunteer.slice(-3).reverse().map(item => (
                            <div key={item._id} className="bg-gray-50 border border-gray-100 rounded-xl p-3.5 hover:bg-gray-100 transition-colors cursor-default">
                               <div className="text-sm font-black text-gray-800 truncate mb-2">{item.title}</div>
                               <div className="flex justify-between items-center">
                                  {formatStatus(item.status)}
                                  <span className="text-[11px] font-bold text-gray-400 leading-none">{new Date(item.createdAt).toLocaleDateString()}</span>
                               </div>
                            </div>
                         ))
                      )}
                   </div>
                   <div className="mt-4 pt-4 border-t border-gray-50 px-1">
                      <Link to="/volunteer" className="text-sm font-bold text-purple-600 hover:text-purple-700 hover:underline transition flex items-center justify-between group">
                         View pickups <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                      </Link>
                   </div>
                </div>

             </div>
          </section>

          {/* SECTION [F] MOTIVATIONAL FOOTER BANNER */}
          <section className="w-full mb-0 px-8 py-12 md:px-16 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden" 
             style={{ background: 'linear-gradient(135deg, #14532d 0%, #16a34a 100%)' }}
          >
             <div className="absolute inset-0 opacity-10 mix-blend-overlay" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
             
             <div className="relative z-10 flex items-center gap-6 text-center md:text-left flex-col md:flex-row">
                <div className="text-5xl md:text-6xl drop-shadow-md bg-white/10 w-20 h-20 flex items-center justify-center rounded-2xl border border-white/20 transform -rotate-6">🌍</div>
                <div>
                   <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Every meal shared is a life changed.</h2>
                   <p className="text-green-100 text-sm md:text-base mt-2 font-medium max-w-lg">
                      Join thousands making a difference, one dish at a time.
                   </p>
                </div>
             </div>

             <div className="relative z-10 flex flex-col sm:flex-row gap-4 w-full md:w-auto mt-4 md:mt-0">
                <button 
                   onClick={() => navigate('/post-listing')} 
                   className="bg-white text-green-700 rounded-xl px-8 py-4 font-bold shadow-lg hover:bg-green-50 hover:-translate-y-0.5 transition-all text-sm uppercase tracking-wide whitespace-nowrap"
                >
                   Share Food Now
                </button>
                <button 
                   onClick={() => navigate('/feed')} 
                   className="border-2 border-white/40 text-white bg-white/5 backdrop-blur-sm rounded-xl px-8 py-4 font-bold hover:bg-white/10 hover:border-white transition-all text-sm uppercase tracking-wide whitespace-nowrap"
                >
                   Browse Listings
                </button>
             </div>
          </section>
        </>
      )}

      {showProfile && (
        <div className="fixed inset-0 z-[100] flex">
          {/* Backdrop */}
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setShowProfile(false)} />
          
          {/* Slide-in Panel */}
          <div className="w-80 bg-white h-full shadow-2xl flex flex-col animate-slideInRight">
            <div className="bg-green-700 px-6 py-8 text-white">
              <button onClick={() => setShowProfile(false)} className="absolute top-4 right-4 text-white/70 hover:text-white text-xl">✕</button>
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold mb-3">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <h2 className="text-xl font-bold">{user?.name || 'User'}</h2>
              <p className="text-green-200 text-sm mt-0.5">{user?.email || ''}</p>
              <span className="mt-2 inline-block bg-white/20 text-white text-xs px-3 py-1 rounded-full capitalize">{user?.role || 'member'}</span>
            </div>

            <div className="flex-1 px-6 py-5 space-y-3 overflow-y-auto">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Your Stats</h3>
              {[
                { label: 'Food Donated', value: myListings.donated.length + ' items', icon: '🍱' },
                { label: 'Food Claimed', value: myListings.claimed.length + ' items', icon: '✋' },
                { label: 'Deliveries', value: myListings.volunteer.length, icon: '🚴' },
              ].map(stat => (
                <div key={stat.label} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span>{stat.icon}</span>
                    <span className="text-sm text-gray-600">{stat.label}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{stat.value}</span>
                </div>
              ))}

              <div className="pt-4 space-y-2">
                <Link to="/my-listings" onClick={() => setShowProfile(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-green-50 text-green-700 font-medium text-sm transition-colors">
                  📋 My Activity
                </Link>
                <Link to="/volunteer" onClick={() => setShowProfile(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-green-50 text-green-700 font-medium text-sm transition-colors">
                  🚴 Volunteer
                </Link>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => { useAuthStore.getState().logout(); navigate('/login'); }}
                className="w-full bg-red-50 text-red-600 font-semibold py-2.5 rounded-xl hover:bg-red-100 transition-colors text-sm"
              >
                ↩ Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Export the boundary-wrapped component
export default function DashboardWithBoundary() {
  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  );
}
