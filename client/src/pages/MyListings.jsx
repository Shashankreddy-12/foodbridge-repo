import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/store';
import SafetyBadge from '../components/SafetyBadge';
import StarRating from '../components/StarRating';
import Navbar from '../components/Navbar';
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
    return <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-bold rounded-full animate-pulse border border-orange-200 uppercase">Urgent</span>;
  }
  const colors = {
    available: 'bg-green-100 text-green-800',
    claimed: 'bg-blue-100 text-blue-800',
    delivered: 'bg-purple-100 text-purple-800',
    expired: 'bg-gray-100 text-gray-800'
  };
  const color = colors[status] || 'bg-gray-100 text-gray-800';
  return <span className={`px-2 py-1 ${color} text-xs font-bold rounded-full capitalize`}>{status}</span>;
}

function SearchItemCard({ l, cancelClaim, user, ratingMode = null }) {
  let donorId = l.donor?._id || l.donor;
  let recipientId = l.claimedBy?._id || l.claimedBy;
  if (typeof donorId === 'object' && donorId._id) donorId = donorId._id;
  if (typeof recipientId === 'object' && recipientId._id) recipientId = recipientId._id;

  return (
    <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm hover:shadow transition flex flex-col sm:flex-row justify-between sm:items-start mb-4">
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
    <Navbar />
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4 relative pt-24 md:pt-28">
      {toast && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded shadow-lg z-[9999] text-white font-medium ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.msg}
        </div>
      )}

      <div className="w-full max-w-3xl border-b border-gray-200 pb-4 mb-6 flex justify-between items-center">
        <div>
           <h1 className="text-3xl font-bold text-green-700">My Activity</h1>
           <p className="text-gray-600 mt-1 text-sm">Your donations, claims and pickups</p>
        </div>
        <button onClick={() => navigate('/dashboard')} className="text-blue-600 hover:text-blue-800 text-sm font-medium">← Back to Dashboard</button>
      </div>

      <div className="w-full max-w-3xl">
        {loading ? (
          <div className="space-y-4 w-full">
             <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm animate-pulse h-32"></div>
             <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm animate-pulse h-32"></div>
             <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm animate-pulse h-32"></div>
          </div>
        ) : isEmptyState ? (
          <div className="text-center py-16 bg-white rounded-lg border border-gray-200 shadow-sm mt-4">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            <p className="text-lg text-gray-500 font-medium">Nothing here yet</p>
            <p className="text-sm text-gray-400 mt-1">Check back later when you have activity.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex border-b border-gray-200 hide-scrollbar overflow-x-auto">
               <button onClick={() => setActiveTab('donated')} className={`pb-3 px-4 font-bold text-sm transition-colors whitespace-nowrap outline-none ${activeTab === 'donated' ? 'border-b-2 border-green-600 text-green-700' : 'text-gray-500 hover:text-gray-700'}`}>🍱 Donated ({donated.length})</button>
               <button onClick={() => setActiveTab('claimed')} className={`pb-3 px-4 font-bold text-sm transition-colors whitespace-nowrap outline-none ${activeTab === 'claimed' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>🙏 Claimed ({claimed.length})</button>
               <button onClick={() => setActiveTab('volunteer')} className={`pb-3 px-4 font-bold text-sm transition-colors whitespace-nowrap outline-none ${activeTab === 'volunteer' ? 'border-b-2 border-orange-600 text-orange-700' : 'text-gray-500 hover:text-gray-700'}`}>🚴 Deliveries ({volunteer.length})</button>
            </div>
            
            <div className="space-y-4">
               {activeTab === 'donated' && donated.length === 0 && <p className="text-gray-500 text-sm mt-4 italic text-center w-full py-6">No donations yet.</p>}
               {activeTab === 'donated' && donated.map(l => <SearchItemCard key={l._id} l={l} user={user} cancelClaim={confirmCancel} ratingMode="rate-recipient" />)}
               
               {activeTab === 'claimed' && claimed.length === 0 && <p className="text-gray-500 text-sm mt-4 italic text-center w-full py-6">No claims yet.</p>}
               {activeTab === 'claimed' && claimed.map(l => <SearchItemCard key={l._id} l={l} user={user} cancelClaim={confirmCancel} ratingMode="rate-donor" />)}
               
               {activeTab === 'volunteer' && volunteer.length === 0 && <p className="text-gray-500 text-sm mt-4 italic text-center w-full py-6">No deliveries yet.</p>}
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
