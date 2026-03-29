import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import PostListing from './pages/PostListing';
import Feed from './pages/Feed';
import MyListings from './pages/MyListings';
import Volunteer from './pages/Volunteer';
import RouteBatch from './pages/RouteBatch';
import ProtectedRoute from './components/ProtectedRoute';
import Footer from './components/Footer';
import Navbar from './components/Navbar';

function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/feed"
            element={
              <ProtectedRoute>
                <Feed />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/post-listing"
            element={
              <ProtectedRoute>
                <PostListing />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-listings"
            element={
              <ProtectedRoute>
                <MyListings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/volunteer"
            element={
              <ProtectedRoute>
                <Volunteer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/route-batch"
            element={
              <ProtectedRoute>
                <RouteBatch />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
