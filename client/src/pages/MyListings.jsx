import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/store';
import SafetyBadge from '../components/SafetyBadge';
import StarRating from '../components/StarRating';
import ConfirmationDialog from '../components/ConfirmationDialog';
import api from '../utils/api';

class ErrorBoundary extends React.Component {
  state = { error: null };
  componentDidCatch(err) { this.setState({ error: err.message }); }
  render() {
    if (this.state.error) return (
      <div className="p-8 text-red-500">
        Error: {this.state.error} — please refresh
      </div>
    );
    return this.props.children;
  }
}

function StatusBadge({ status, urgent }) {
  if (urgent && status === 'available') {
    return <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 animate-pulse border border-red-200 uppercase">Urgent</span>;
  }
  const colors = {
    available: 'bg-green-100 text-green-700',
    claimed: 'bg-blue-100 text-blue-700',
    delivered: 'bg-purple-100 text-purple-700',
    expired: 'bg-gray-100 text-gray-500'
  };
  const color = colors[status] || 'bg-gray-100 text-gray-500';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${color}`}>{status}</span>;
}

function SearchItemCard({ l, cancelClaim, user, ratingMode = null }) {
  let donorId = l.donor?._id || l.donor;
  let recipientId = l.claimedBy?._id || l.claimedBy;
  if (typeof donorId === 'object' && donorId._id) donorId = donorId._id;
  if (typeof recipientId === 'object' && recipientId._id) recipientId = recipientId._id;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all flex flex-col sm:flex-row justify-between sm:items-start mb-4">
      <div className="mb-4 sm:mb-0">
        <div className="flex items-center space-x-3 mb-2">
          <h3 className="font-bold text-gray-800 text-lg">{l.title}</h3>
          <StatusBadge status={l.status} urgent={l.urgent} />
          {l.safetyScore !== undefined && <SafetyBadge score={l.safetyScore} />}
        </div>
        <p className="text-sm text-gray-600 mb-1 font-medium">{l.quantity} <span className="text-gray-300 mx-1">|</span> {l.foodType} <span className="text-gray-300 mx-1">|</span> Donor: {l.donor?.name || 'Unknown'}</p>
        <p className="text-xs text-gray-400">Listed: {new Date(l.createdAt).toLocaleDateString()}</p>
        
        {ratingMode === 'rate-donor' && l.status === 'delivered' && (
           <div className="mt-4 pt-3 border-t border-gray-100">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">Rate your experience with {l.donor?.name || 'the donor'}</p>
              <StarRating deliveryId={l._id} ratedUserId={donorId} />
           </div>
        )}

        {ratingMode === 'rate-recipient' && l.status === 'delivered' && (
           <div className="mt-4 pt-3 border-t border-gray-100">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">Rate the recipient</p>
              <StarRating deliveryId={l._id} ratedUserId={recipientId} />
           </div>
        )}

      </div>
      
      {user.role === 'recipient' && l.status === 'claimed' && (
        <button 
          onClick={() => cancelClaim(l._id)}
          className="self-start sm:self-auto px-4 py-2 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 rounded font-semibold text-sm transition"
        >
          Cancel Claim
        </button>
      )}
    </div>
  );
}

export default function MyListings() {
  const [data, setData] = useState({ donated: [], claimed: [], volunteer: [] });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [activeTab, setActiveTab] = useState('donated');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [claimToCancel, setClaimToCancel] = useState(null);
  
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    setLoading(true);
    api.get('/api/listings/my', {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
        setData(res.data);
        if (res.data.donated.length > 0) setActiveTab('donated');
        else if (res.data.claimed.length > 0) setActiveTab('claimed');
        else if (res.data.volunteer.length > 0) setActiveTab('volunteer');
    })
    .catch(err => {
        console.error(err);
    })
    .finally(() => setLoading(false));
  }, [token, navigate]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const donated = Array.isArray(data?.donated) ? data.donated : [];
  const claimed = Array.isArray(data?.claimed) ? data.claimed : [];
  const volunteer = Array.isArray(data?.volunteer) ? data.volunteer : [];

  const isEmptyState =
    donated.length === 0 &&
    claimed.length === 0 &&
    volunteer.length === 0;

  const confirmCancel = (id) => {
    setClaimToCancel(id);
    setDialogOpen(true);
  };

  const executeCancelClaim = async () => {
    if (!claimToCancel) return;
    try {
      await api.delete(`/api/listings/${claimToCancel}/claim`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(prev => ({
          ...prev,
          claimed: prev.claimed.filter(l => l._id !== claimToCancel)
      }));
      showToast('Claim cancelled successfully');
    } catch (err) {
      if (err.response?.status === 403) {
        showToast("You didn't claim this", 'error');
      } else {
        showToast(err.response?.data?.error || 'Failed to cancel claim', 'error');
      }
    } finally {
      setDialogOpen(false);
      setClaimToCancel(null);
    }
  };

  if (!user) return null;
  if (!data) return <div className="p-8 text-center font-bold text-gray-500">Loading...</div>;

  return (
    <ErrorBoundary>
    <>
    <div className="bg-gray-50 min-h-screen pt-24 px-6 flex flex-col items-center pb-20">
      {toast && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded shadow-lg z-[9999] text-white font-medium ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.msg}
        </div>
      )}

      <div className="w-full max-w-3xl mb-6 flex justify-between items-center mt-4">
        <div>
           <h1 className="text-3xl font-bold text-gray-900">My Activity</h1>
           <p className="text-gray-500 mt-1 text-sm font-medium">Your donations, claims and pickups</p>
        </div>
        <button onClick={() => navigate('/dashboard')} className="text-gray-500 hover:text-green-700 transition flex items-center text-sm font-bold gap-1 bg-white px-4 py-2 rounded-xl border border-gray-200 hover:border-green-300 hover:bg-green-50">← Back</button>
      </div>

      <div className="w-full max-w-3xl">
        {loading ? (
          <div className="space-y-4 w-full">
             <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm animate-pulse h-32"></div>
             <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm animate-pulse h-32"></div>
             <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm animate-pulse h-32"></div>
          </div>
        ) : isEmptyState ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm mt-4">
            <span className="text-5xl mb-4 block">📋</span>
            <p className="text-lg text-gray-800 font-bold mb-2">Nothing here yet</p>
            <p className="text-sm text-gray-500 mb-6 font-medium mt-1">Get started by sharing or claiming food.</p>
            <div className="flex justify-center flex-wrap gap-3">
              <button onClick={() => navigate('/post-listing')} className="bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors">Post Food Now</button>
              <button onClick={() => navigate('/feed')} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">Browse Food</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-1 inline-flex gap-1 mb-6 shadow-sm border border-gray-100 w-full overflow-x-auto hide-scrollbar">
               <button onClick={() => setActiveTab('donated')} className={`whitespace-nowrap outline-none transition-all ${activeTab === 'donated' ? 'bg-green-600 text-white rounded-xl px-5 py-2 text-sm font-semibold' : 'text-gray-500 px-5 py-2 text-sm font-medium hover:bg-gray-50 rounded-xl'}`}>🍱 Donated ({donated.length})</button>
               <button onClick={() => setActiveTab('claimed')} className={`whitespace-nowrap outline-none transition-all ${activeTab === 'claimed' ? 'bg-green-600 text-white rounded-xl px-5 py-2 text-sm font-semibold' : 'text-gray-500 px-5 py-2 text-sm font-medium hover:bg-gray-50 rounded-xl'}`}>🙏 Claimed ({claimed.length})</button>
               <button onClick={() => setActiveTab('volunteer')} className={`whitespace-nowrap outline-none transition-all ${activeTab === 'volunteer' ? 'bg-green-600 text-white rounded-xl px-5 py-2 text-sm font-semibold' : 'text-gray-500 px-5 py-2 text-sm font-medium hover:bg-gray-50 rounded-xl'}`}>🚴 Deliveries ({volunteer.length})</button>
            </div>
            
            <div className="space-y-4">
               {activeTab === 'donated' && donated.length === 0 && (
                 <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
                   <span className="text-4xl block mb-3">🍱</span>
                   <p className="text-gray-800 font-bold text-lg">No donations yet</p>
                   <p className="text-sm text-gray-500 mb-5 font-medium mt-1">Share your surplus food with the community.</p>
                   <button onClick={() => navigate('/post-listing')} className="bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-green-700">Post Food Now</button>
                 </div>
               )}
               {activeTab === 'donated' && donated.map(l => <SearchItemCard key={l._id} l={l} user={user} cancelClaim={confirmCancel} ratingMode="rate-recipient" />)}
               
               {activeTab === 'claimed' && claimed.length === 0 && (
                 <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
                   <span className="text-4xl block mb-3">🙏</span>
                   <p className="text-gray-800 font-bold text-lg">No claims yet</p>
                   <p className="text-sm text-gray-500 mb-5 font-medium mt-1">Find meals available near you.</p>
                   <button onClick={() => navigate('/feed')} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700">Browse Food</button>
                 </div>
               )}
               {activeTab === 'claimed' && claimed.map(l => <SearchItemCard key={l._id} l={l} user={user} cancelClaim={confirmCancel} ratingMode="rate-donor" />)}
               
               {activeTab === 'volunteer' && volunteer.length === 0 && (
                 <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
                   <span className="text-4xl block mb-3">🚴</span>
                   <p className="text-gray-800 font-bold text-lg">No deliveries yet</p>
                   <p className="text-sm text-gray-500 mb-5 font-medium mt-1">Help transport food safely to recipients.</p>
                   <button onClick={() => navigate('/volunteer')} className="bg-purple-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-purple-700">View Pickups</button>
                 </div>
               )}
               {activeTab === 'volunteer' && volunteer.map(l => <SearchItemCard key={l._id} l={l} user={user} cancelClaim={confirmCancel} />)}
            </div>
          </div>
        )}
      </div>

      <ConfirmationDialog 
        isOpen={dialogOpen}
        title="Cancel Claim"
        message="Cancel this claim? The food will become available for others."
        confirmText="Yes, Cancel Claim"
        cancelText="Keep Claim"
        onConfirm={executeCancelClaim}
        onCancel={() => setDialogOpen(false)}
      />
    </div>
    </>
    </ErrorBoundary>
  );
}
