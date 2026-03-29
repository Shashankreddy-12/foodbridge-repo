import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';

export default function ResetPassword() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="bg-white p-8 rounded shadow text-center max-w-md border border-gray-100">
           <h2 className="text-2xl font-bold text-red-600 mb-2">Invalid Reset Link</h2>
           <p className="text-gray-600 mb-6 font-medium">Missing security token parameter in the URL.</p>
           <Link to="/login" className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-bold transition">Back to Login</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return setError('Passwords do not match');
    }
    
    setLoading(true);
    setError('');
    
    try {
      await api.post('/api/auth/reset-password', { token, newPassword });
      setMessage('Password reset! Redirecting...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      if (err.response?.status === 400) {
          setError('This link has expired. Please request a new one.');
      } else {
          setError(err.response?.data?.error || 'Failed to reset password');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 py-12 px-4">
      <div className="w-full max-w-md p-8 bg-white rounded shadow-md border border-gray-100">
        <h2 className="text-3xl font-bold text-center text-green-600 mb-6">Set New Password</h2>
        
        {message && <div className="mb-4 p-3 bg-green-50 text-green-700 border border-green-200 rounded text-sm text-center font-bold">{message}</div>}
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm text-center font-medium">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">New Password</label>
            <input 
              type="password" 
              className="w-full px-3 py-2 mt-1 border rounded focus:ring-green-500" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
            <input 
              type="password" 
              className="w-full px-3 py-2 mt-1 border rounded focus:ring-green-500" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required 
            />
          </div>
          <button 
            type="submit" 
            disabled={loading || !!message}
            className="w-full py-2 px-4 mt-6 text-white font-bold bg-green-600 shadow-sm rounded hover:bg-green-700 disabled:opacity-50 transition"
          >
            {loading ? 'Saving...' : 'Save Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
