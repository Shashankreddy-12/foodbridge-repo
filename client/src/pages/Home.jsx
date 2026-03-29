import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Lenis from '@studio-freight/lenis';
import { useAuthStore } from '../store/store';

// A simple hook to animate numbers scrolling up
function useCountUp(target, startCount, duration = 2000) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!startCount || !target) return;
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration, startCount]);

  return count;
}

export default function Home() {
  const navigate = useNavigate();
  const logout = useAuthStore(s => s.logout);
  
  // Navbar Scrolled State
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Impact Counters Data & Intersection
  const [impactData, setImpactData] = useState({
    totalMealsSaved: 0,
    totalKgFoodSaved: 0,
    totalCO2Saved: 0,
    totalDeliveries: 0,
  });
  const [startCount, setStartCount] = useState(false);
  const impactRef = useRef(null);

  // Intersection Observers for Sections
  const [visibleSections, setVisibleSections] = useState({});

  useEffect(() => {
    // 0. Explicitly clear previous session so clicking buttons asks to login
    logout();

    // 1. Initialize Lenis Smooth Scroll
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      direction: 'vertical',
      gestureDirection: 'vertical',
      smooth: true,
      mouseMultiplier: 1,
      smoothTouch: false,
      touchMultiplier: 2,
      infinite: false,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // 2. Navbar Scroll Tracking
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 80);
    };
    window.addEventListener('scroll', handleScroll);

    // 3. Fetch Impact Data
    fetch('/api/impact')
      .then(res => res.json())
      .then(data => setImpactData(data || {}))
      .catch(() => {});

    // 4. Create Intersection Observers for Animations
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setVisibleSections(prev => ({ ...prev, [entry.target.id]: true }));
          if (entry.target.id === 'impact-section') {
            setStartCount(true);
          }
        }
      });
    }, { threshold: 0.2 });

    const animatedElements = document.querySelectorAll('.animate-on-scroll');
    animatedElements.forEach(el => observer.observe(el));

    return () => {
      lenis.destroy();
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, []);

  const meals = useCountUp(impactData.totalMealsSaved, startCount);
  const kgFood = useCountUp(impactData.totalKgFoodSaved, startCount);
  const co2 = useCountUp(impactData.totalCO2Saved, startCount);
  const deliveries = useCountUp(impactData.totalDeliveries, startCount);

  return (
    <div className="font-sans text-gray-800 bg-[#fafaf7] min-h-screen overflow-hidden selection:bg-green-200">
      
      {/* GLOBAL STYLES & ANIMATIONS */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(var(--r)); }
          50% { transform: translateY(-10px) rotate(var(--r)); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(50px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .slide-in { animation: slideInRight 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .delay-1s { animation-delay: 1s; opacity: 0; }
        .delay-1-5s { animation-delay: 1.5s; opacity: 0; }
      `}</style>

      {/* SECTION 1 — Top Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/95 backdrop-blur-md shadow-sm py-4' : 'bg-transparent py-6'
      }`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <span className="text-2xl">🌿</span>
            <span className="text-xl font-bold text-green-700 tracking-tight">Food<span className="text-gray-900">Bridge</span></span>
          </div>

          <div className={`hidden md:flex space-x-8 font-medium text-sm transition-colors ${
             isScrolled ? 'text-gray-600' : 'text-gray-800'
          }`}>
            <a href="#" className="hover:text-[#16a34a] transition">Home</a>
            <a href="#how-it-works" className="hover:text-[#16a34a] transition">How It Works</a>
            <a href="#impact-section" className="hover:text-[#16a34a] transition">Impact</a>
            <button onClick={() => navigate('/feed')} className="hover:text-[#16a34a] transition">Browse Food</button>
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <button 
              onClick={() => navigate('/login')}
              className={`font-semibold text-sm transition-colors ${isScrolled ? 'text-gray-800 hover:text-gray-600' : 'text-gray-800 hover:text-gray-600'}`}
            >
              Log In
            </button>
            <button 
              onClick={() => navigate('/register')}
              className="bg-[#16a34a] text-white px-5 py-2.5 rounded-full font-bold text-sm shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200"
            >
              Get Started →
            </button>
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden">
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2">
              <svg className="w-6 h-6 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-16 bg-white shadow-xl z-40 px-6 py-6 flex flex-col space-y-4 font-medium border-t border-gray-100">
            <a href="#" onClick={()=>setMobileMenuOpen(false)}>Home</a>
            <a href="#how-it-works" onClick={()=>setMobileMenuOpen(false)}>How It Works</a>
            <a href="#impact-section" onClick={()=>setMobileMenuOpen(false)}>Impact</a>
            <button onClick={() => { setMobileMenuOpen(false); navigate('/feed'); }} className="text-left">Browse Food</button>
            <button onClick={() => { setMobileMenuOpen(false); navigate('/login'); }} className="text-left font-bold text-gray-800">Log In</button>
            <button onClick={() => { setMobileMenuOpen(false); navigate('/register'); }} className="bg-[#16a34a] text-white text-center rounded-full py-3 font-bold">Get Started →</button>
        </div>
      )}

      {/* SECTION 2 — Hero Section */}
      <section className="relative min-h-screen flex items-center pt-24 pb-12 overflow-hidden bg-[#fafaf7]">
        {/* Decor Blobs */}
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-[#dcfce7] rounded-full opacity-60 blur-3xl point-events-none"></div>
        <div className="absolute bottom-[10%] left-[-10%] w-[300px] h-[300px] bg-[#fef3c7] rounded-full opacity-40 blur-2xl point-events-none"></div>

        <div className="max-w-7xl mx-auto px-6 w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          
          {/* Left Content (55%) */}
          <div className="col-span-1 lg:col-span-7 flex flex-col items-start pt-10 lg:pt-0">
            <div className="bg-[#16a34a] text-white px-4 py-1.5 rounded-full text-sm font-bold mb-6 shadow-sm inline-flex items-center gap-2">
              🌱 EcoTech Innovation Platform
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-bold leading-[1.1] tracking-tight text-[#111827]">
              Don't waste food.<br />
              <span className="text-[#16a34a] italic">Share it.</span>
            </h1>
            
            <p className="text-xl text-gray-600 mt-6 max-w-lg leading-relaxed">
              FoodBridge connects surplus food donors with people who need it — in real-time, with smart matching and live delivery tracking.
            </p>
            
            <div className="mt-10 flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <button 
                onClick={() => navigate('/register')}
                className="bg-[#16a34a] text-white px-8 py-4 rounded-full text-lg font-bold shadow-[0_10px_25px_-5px_rgba(22,163,74,0.4)] hover:shadow-[0_20px_25px_-5px_rgba(22,163,74,0.4)] hover:-translate-y-1 transition-all duration-300"
              >
                Start Donating →
              </button>
              <button 
                onClick={() => navigate('/feed')}
                className="bg-white text-[#111827] border-2 border-[#16a34a]/20 px-8 py-4 rounded-full text-lg font-bold shadow-sm hover:bg-[#16a34a]/5 transition-all duration-300"
              >
                Find Food Near Me
              </button>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-gray-500">
              <span className="flex items-center gap-1.5"><svg className="w-4 h-4 text-[#16a34a]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg> Free to use</span>
              <span className="flex items-center gap-1.5"><svg className="w-4 h-4 text-[#16a34a]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg> Real-time updates</span>
              <span className="flex items-center gap-1.5"><svg className="w-4 h-4 text-[#16a34a]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg> AI-powered safety</span>
            </div>
          </div>

          {/* Right Content (45%) */}
          <div className="hidden lg:block col-span-5 relative h-[500px] perspective-1000 pl-8">
            {/* Card 3 (Back) */}
            <div 
              className="absolute top-16 right-4 w-[280px] bg-white rounded-2xl p-5 shadow-sm border border-gray-100 will-change-transform"
              style={{ '--r': '-5deg', transform: 'rotate(-5deg) scale(0.9) translateX(30px) translateY(20px)', zIndex: 10, animation: 'float 3.4s ease-in-out infinite' }}
            >
              <div className="h-20 bg-yellow-100 rounded-xl mb-3 flex items-center justify-center text-3xl">🥖</div>
              <h3 className="font-bold text-gray-800 mb-1 leading-tight">Sourdough Bread — 30 loaves</h3>
              <p className="text-[10px] text-gray-400 font-medium mb-3">by Priya Restaurant</p>
              
              <div className="flex items-center gap-2 mb-2">
                 <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full uppercase">Safe 98/100</span>
                 <span className="text-[10px] font-bold text-gray-500">1.2 km away</span>
              </div>
              <div className="text-xs text-amber-500 font-bold mb-1">Expires in 12h</div>
            </div>

            {/* Card 2 (Middle) */}
            <div 
              className="absolute top-10 right-10 w-[280px] bg-white rounded-2xl p-5 shadow-lg border border-gray-100 will-change-transform"
              style={{ '--r': '3deg', transform: 'rotate(3deg) scale(0.95) translateX(15px) translateY(10px)', zIndex: 20, animation: 'float 3.2s ease-in-out infinite' }}
            >
              <div className="h-20 bg-green-100 rounded-xl mb-3 flex items-center justify-center text-3xl">🥗</div>
              <h3 className="text-lg font-bold text-gray-800 mb-1 leading-tight">Garden Fresh Salad — 15 portions</h3>
              <p className="text-[10px] text-gray-400 font-medium mb-3">by Priya Restaurant</p>

              <div className="flex items-center gap-2 mb-2">
                 <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full uppercase">Safe 95/100</span>
                 <span className="text-[10px] font-bold text-gray-500">800m away</span>
              </div>
              <div className="text-xs text-amber-500 font-bold mb-1">Expires in 4h</div>
            </div>

            {/* Card 1 (Front) */}
            <div 
              className="absolute top-4 left-4 w-[280px] bg-white rounded-2xl p-5 shadow-2xl border border-gray-50 will-change-transform"
              style={{ '--r': '0deg', zIndex: 30, animation: 'float 3s ease-in-out infinite' }}
            >
              <div className="h-20 bg-orange-100 rounded-xl mb-3 flex items-center justify-center text-3xl">🍱</div>
              <h3 className="text-xl font-black text-gray-900 mb-1 leading-tight">Chicken Biryani — 20 portions</h3>
              <p className="text-[10px] text-gray-400 font-medium mb-3">by Priya Restaurant</p>
              
              <div className="flex items-center gap-2 mb-3">
                 <span className="text-[10px] font-bold text-[#14532d] bg-[#dcfce7] px-2 py-0.5 rounded-full border border-[#16a34a]/20">✓ Safe 92/100</span>
                 <span className="text-[10px] font-bold text-gray-500">📍 2.3 km away</span>
              </div>
              <p className="text-xs font-bold text-amber-500">Expires in 2h 30m</p>
            </div>

            {/* Notification Popup */}
            <div className="absolute top-[-20px] right-[-30px] z-50 slide-in delay-1-5s">
               <div className="bg-white shadow-xl rounded-2xl p-4 w-56 border border-green-100 flex items-center gap-3 will-change-transform" style={{ animation: 'float 4s ease-in-out infinite', animationDelay: '0.2s' }}>
                  <div className="bg-green-100 w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xl">🔔</div>
                  <div>
                     <div className="text-xs font-black text-gray-800">New listing nearby!</div>
                     <div className="text-[11px] font-medium text-gray-800 mt-0.5 leading-tight">Chicken Biryani — 500m away</div>
                     <div className="text-[10px] font-medium text-gray-400 mt-0.5">Posted 2 mins ago</div>
                  </div>
               </div>
            </div>

          </div>
        </div>
      </section>

      {/* SECTION 3 — Live Impact Counter Strip */}
      <section id="impact-section" ref={impactRef} className="w-full bg-[#14532d] py-16 animate-on-scroll transition-all duration-700 select-none overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
           <h2 className="text-center text-3xl md:text-4xl font-black text-white mb-12 tracking-tight">
             Our Real-Time Impact 🌍
           </h2>
           
           <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0 divide-transparent md:divide-x divide-green-800/50">
              {/* Counter 1 */}
              <div className="flex flex-col items-center justify-center text-center px-4">
                 <div className="text-4xl md:text-5xl font-black text-white tabular-nums drop-shadow-md">{meals.toLocaleString()}</div>
                 <div className="text-sm md:text-base font-bold text-[#16a34a] mt-3 uppercase tracking-wider">🍽️ Meals Saved</div>
              </div>
              
              {/* Counter 2 */}
              <div className="flex flex-col items-center justify-center text-center px-4">
                 <div className="text-4xl md:text-5xl font-black text-white tabular-nums drop-shadow-md">{kgFood.toLocaleString()}</div>
                 <div className="text-sm md:text-base font-bold text-[#16a34a] mt-3 uppercase tracking-wider">📦 kg Food Rescued</div>
              </div>

              {/* Counter 3 */}
              <div className="flex flex-col items-center justify-center text-center px-4">
                 <div className="text-4xl md:text-5xl font-black text-white tabular-nums drop-shadow-md">{co2.toLocaleString()}</div>
                 <div className="text-sm md:text-base font-bold text-[#16a34a] mt-3 uppercase tracking-wider">🌱 kg CO₂ Prevented</div>
              </div>

              {/* Counter 4 */}
              <div className="flex flex-col items-center justify-center text-center px-4">
                 <div className="text-4xl md:text-5xl font-black text-white tabular-nums drop-shadow-md">{deliveries.toLocaleString()}</div>
                 <div className="text-sm md:text-base font-bold text-[#16a34a] mt-3 uppercase tracking-wider">✅ Deliveries Done</div>
              </div>
           </div>
        </div>
      </section>

      {/* SECTION 4 — How It Works */}
      <section id="how-it-works" className="bg-white py-24 animate-on-scroll relative">
         <div className={`max-w-7xl mx-auto px-6 transition-all duration-700 transform ${visibleSections['how-it-works'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
            
            <div className="text-center max-w-2xl mx-auto mb-16">
               <span className="inline-block bg-[#dcfce7] text-[#14532d] px-4 py-1.5 rounded-full text-sm font-bold mb-4 tracking-wide uppercase">Simple & Fast</span>
               <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4 tracking-tight">From surplus to someone's plate</h2>
               <p className="text-xl text-gray-500 font-medium tracking-wide">Three simple steps to fight waste.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative items-stretch">
               
               {/* Arrow Connector 1 */}
               <div className="hidden md:block absolute top-[40%] left-[30%] w-[10%] border-t-2 border-dashed border-gray-200 z-0"></div>
               {/* Arrow Connector 2 */}
               <div className="hidden md:block absolute top-[40%] right-[30%] w-[10%] border-t-2 border-dashed border-gray-200 z-0"></div>

               {/* Step 1 */}
               <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 relative z-10 flex flex-col items-start min-h-[300px]" style={{ borderTopWidth: '4px', borderTopColor: '#16a34a' }}>
                  <div className="text-7xl font-black text-[#dcfce7] absolute top-6 right-6 select-none -z-10 tracking-tighter">01</div>
                  <div className="text-5xl mb-6 shadow-sm bg-white rounded-2xl w-16 h-16 flex items-center justify-center border border-gray-50">📸</div>
                  <h3 className="text-xl font-extrabold text-gray-900 mb-3">Post Your Surplus</h3>
                  <p className="text-gray-500 font-medium leading-relaxed">Take a photo, describe the food, set expiry time. Our system instantly scores its safety.</p>
               </div>

               {/* Step 2 */}
               <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 relative z-10 flex flex-col items-start min-h-[300px]" style={{ borderTopWidth: '4px', borderTopColor: '#f59e0b' }}>
                  <div className="text-7xl font-black text-[#fef3c7] absolute top-6 right-6 select-none -z-10 tracking-tighter">02</div>
                  <div className="text-5xl mb-6 shadow-sm bg-white rounded-2xl w-16 h-16 flex items-center justify-center border border-gray-50">🤖</div>
                  <h3 className="text-xl font-extrabold text-gray-900 mb-3">Smart Matching</h3>
                  <p className="text-gray-500 font-medium leading-relaxed">Our matching engine finds the best nearby recipients based on dietary needs and location.</p>
               </div>

               {/* Step 3 */}
               <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 relative z-10 flex flex-col items-start min-h-[300px]" style={{ borderTopWidth: '4px', borderTopColor: '#3b82f6' }}>
                  <div className="text-7xl font-black text-blue-50 absolute top-6 right-6 select-none -z-10 tracking-tighter">03</div>
                  <div className="text-5xl mb-6 shadow-sm bg-white rounded-2xl w-16 h-16 flex items-center justify-center border border-gray-50">🚴</div>
                  <h3 className="text-xl font-extrabold text-gray-900 mb-3">Volunteer Delivers</h3>
                  <p className="text-gray-500 font-medium leading-relaxed">A volunteer picks up and delivers via optimized route. Track in real-time on the map.</p>
               </div>

            </div>
         </div>
      </section>

      {/* SECTION 5 — Feature Highlights */}
      <section id="features" className="bg-[#fafaf7] py-24 overflow-hidden border-t border-gray-100/50">
        <div className="max-w-7xl mx-auto px-6 space-y-32">
          
          {/* Feature 1 */}
          <div id="feat-1" className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center animate-on-scroll">
             <div className="order-2 md:order-1 relative h-64 md:h-96 w-full flex items-center justify-center">
                <div className="absolute inset-0 bg-[#dcfce7]/50 rounded-[3rem] transform -rotate-3 transition-transform hover:rotate-0 duration-500"></div>
                <div className="relative bg-white w-48 h-48 md:w-64 md:h-64 rounded-[2rem] shadow-xl flex items-center justify-center text-7xl md:text-9xl border border-green-50 z-10">🗺️</div>
                <div className="absolute top-10 md:top-20 right-10 md:right-20 bg-white p-3 rounded-xl shadow-lg font-bold text-xs flex items-center gap-2 z-20 animate-[float_4s_ease-in-out_infinite]"><span className="text-[#16a34a]">📍</span> 3 min away</div>
                <div className="absolute bottom-10 md:bottom-20 left-10 md:left-20 bg-white p-3 rounded-xl shadow-lg font-bold text-xs flex items-center gap-2 z-20 animate-[float_3s_ease-in-out_infinite_reverse]"><span className="text-[#16a34a]">📍</span> 1.2 km away</div>
             </div>
             <div className="order-1 md:order-2">
                <span className="text-[#16a34a] font-extrabold tracking-widest text-xs uppercase mb-3 block">Real-Time Discovery</span>
                <h3 className="text-3xl md:text-4xl font-black text-gray-900 mb-5 leading-tight">See surplus food appear on the map — live</h3>
                <p className="text-gray-500 font-medium text-lg leading-relaxed mb-6">The moment someone donates food nearby, you'll see it appear on the map and get an instant notification — no refreshing, no delays.</p>
                <div className="flex flex-wrap gap-2">
                   <span className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">Live Map</span>
                   <span className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">Push Alerts</span>
                </div>
             </div>
          </div>

          {/* Feature 2 */}
          <div id="feat-2" className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center animate-on-scroll">
             <div>
                <span className="text-[#f59e0b] font-extrabold tracking-widest text-xs uppercase mb-3 block">AI Safety Scoring</span>
                <h3 className="text-3xl md:text-4xl font-black text-gray-900 mb-5 leading-tight">Every listing is safety-checked by AI</h3>
                <p className="text-gray-500 font-medium text-lg leading-relaxed mb-6">Every food listing is automatically checked for safety before it goes live. You'll always see a clear safety rating so you know exactly what you're claiming.</p>
             </div>
             <div className="relative h-64 md:h-96 w-full flex items-center justify-center">
                <div className="absolute inset-0 bg-[#fef3c7]/50 rounded-[3rem] transform rotate-3 transition-transform hover:rotate-0 duration-500"></div>
                <div className="relative bg-white w-48 h-48 md:w-64 md:h-64 rounded-[2rem] shadow-xl flex items-center justify-center text-7xl md:text-9xl border border-amber-50 z-10">🛡️</div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 mt-20 md:mt-28 bg-[#dcfce7] border-2 border-white px-5 py-2 rounded-full shadow-lg font-black text-[#14532d] z-20 whitespace-nowrap">✓ Safe: 98/100</div>
             </div>
          </div>

          {/* Feature 3 */}
          <div id="feat-3" className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center animate-on-scroll">
             <div className="order-2 md:order-1 relative h-64 md:h-96 w-full flex items-center justify-center">
                <div className="absolute inset-0 bg-blue-50/50 rounded-[3rem] transform -rotate-3 transition-transform hover:rotate-0 duration-500"></div>
                <div className="relative bg-white w-48 h-48 md:w-64 md:h-64 rounded-[2rem] shadow-xl flex items-center justify-center border border-blue-50 z-10 overflow-hidden p-4">
                   {/* Mock path using simple SVG */}
                   <svg viewBox="0 0 100 100" className="w-full h-full stroke-blue-400 stroke-[3] fill-none" strokeDasharray="4 4">
                      <path d="M 20,80 Q 50,20 80,20" className="animate-[dash_2s_linear_infinite]" />
                      <circle cx="20" cy="80" r="6" className="fill-blue-500 stroke-none" />
                      <circle cx="80" cy="20" r="6" className="fill-green-500 stroke-none" />
                   </svg>
                </div>
                <div className="absolute top-10 md:top-20 right-5 md:right-10 bg-white p-3 rounded-xl shadow-lg font-bold text-xs flex items-center gap-2 z-20"><span className="text-blue-500">🚴</span> En Route</div>
             </div>
             <div className="order-1 md:order-2">
                <span className="text-blue-500 font-extrabold tracking-widest text-xs uppercase mb-3 block">Smart Routing</span>
                <h3 className="text-3xl md:text-4xl font-black text-gray-900 mb-5 leading-tight">Volunteers get optimized routes</h3>
                <p className="text-gray-500 font-medium text-lg leading-relaxed mb-6">Volunteers get a smart route on their phone showing the fastest way to pick up and deliver food. Less time driving, more food delivered.</p>
             </div>
          </div>

        </div>
      </section>

      {/* SECTION 6 — Who Is It For? */}
      <section className="bg-white py-24 animate-on-scroll">
         <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-center text-3xl md:text-4xl font-black text-gray-900 mb-16 tracking-tight">Built for everyone in the food ecosystem</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
               {/* Card 1 */}
               <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 flex flex-col items-center text-center" style={{ borderTopWidth: '4px', borderTopColor: '#16a34a' }}>
                  <div className="text-6xl mb-6 bg-gray-50 p-4 rounded-full">🍳</div>
                  <h3 className="text-2xl font-black text-gray-900 mb-4">Donors</h3>
                  <p className="text-gray-500 font-medium leading-relaxed mb-8 flex-grow">Restaurants, caterers, home cooks — anyone with surplus food. Post in 60 seconds.</p>
                  <button onClick={()=>navigate('/register')} className="text-[#16a34a] font-black uppercase text-sm tracking-wide self-center w-full py-3 bg-[#dcfce7]/30 rounded-xl hover:bg-[#dcfce7] transition-colors">Start Donating →</button>
               </div>

               {/* Card 2 */}
               <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 flex flex-col items-center text-center" style={{ borderTopWidth: '4px', borderTopColor: '#3b82f6' }}>
                  <div className="text-6xl mb-6 bg-gray-50 p-4 rounded-full">🙏</div>
                  <h3 className="text-2xl font-black text-gray-900 mb-4">Recipients</h3>
                  <p className="text-gray-500 font-medium leading-relaxed mb-8 flex-grow">Individuals, shelters, community kitchens. Browse and claim food near you for free.</p>
                  <button onClick={()=>navigate('/feed')} className="text-blue-600 font-black uppercase text-sm tracking-wide self-center w-full py-3 bg-blue-50/50 rounded-xl hover:bg-blue-100 transition-colors">Find Food →</button>
               </div>

               {/* Card 3 */}
               <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 flex flex-col items-center text-center" style={{ borderTopWidth: '4px', borderTopColor: '#f97316' }}>
                  <div className="text-6xl mb-6 bg-gray-50 p-4 rounded-full">🚴</div>
                  <h3 className="text-2xl font-black text-gray-900 mb-4">Volunteers</h3>
                  <p className="text-gray-500 font-medium leading-relaxed mb-8 flex-grow">Help bridge the gap. Accept pickup requests and deliver food with an optimized route.</p>
                  <button onClick={()=>navigate('/register')} className="text-orange-600 font-black uppercase text-sm tracking-wide self-center w-full py-3 bg-orange-50/50 rounded-xl hover:bg-orange-100 transition-colors">Volunteer Now →</button>
               </div>
            </div>
         </div>
      </section>

      {/* SECTION 7 — CTA Banner */}
      <section className="w-full py-24 px-6 relative overflow-hidden text-center" style={{ background: 'linear-gradient(135deg, #14532d 0%, #16a34a 100%)' }}>
         {/* Subtle background texture */}
         <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
         
         <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
            <div className="text-6xl md:text-7xl mb-6 drop-shadow-lg">🌱</div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight mb-4 tracking-tight">Ready to make an impact?</h2>
            <p className="text-xl md:text-2xl text-[#dcfce7] font-medium opacity-90 mb-10 max-w-2xl text-center">Join FoodBridge today and help us build a zero-waste community.</p>
            
            <div className="flex flex-col sm:flex-row gap-5 w-full sm:w-auto">
               <button 
                  onClick={() => navigate('/register')}
                  className="bg-white text-[#14532d] px-10 py-4.5 rounded-full text-lg lg:text-xl font-black shadow-xl hover:bg-[#dcfce7] hover:scale-105 transition-all duration-300 border-none"
               >
                  Get Started Free →
               </button>
               <button 
                  onClick={() => {
                     document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="bg-transparent text-white border-2 border-white/30 px-10 py-4.5 rounded-full text-lg lg:text-xl font-bold hover:bg-white/10 hover:border-white transition-all duration-300"
               >
                  See How It Works
               </button>
            </div>
         </div>
      </section>

    </div>
  );
}
