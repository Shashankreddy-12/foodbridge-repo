import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useNotificationStore } from '../store/notifications';

export function useSocket(token) {
  useEffect(() => {
    if (!token) return;

    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => console.log('Socket connected'));
    socket.on('connect_error', (err) => console.error('Socket error:', err.message));

    socket.on('new_listing', (data) => {
      const newListing = data.listing || data;
      useNotificationStore.getState().add(newListing);
    });

    socket.on('urgent_listing', (data) => {
      const listing = data.listing || data;
      useNotificationStore.getState().addUrgent(listing);
    });

    // Donor gets notified their food was claimed
    socket.on('listing_claimed', (data) => {
      useNotificationStore.getState().add({
        ...data,
        title: 'Your listing was claimed!',
        isUrgent: false,
      });
    });

    // Listing was unclaimed — update feed
    socket.on('listing_unclaimed', (data) => {
      useNotificationStore.getState().add({
        ...data,
        title: 'A listing is available again',
        isUrgent: false,
      });
    });

    // Background AI mapping completion payload
    socket.on('listing_updated', (data) => {
      useNotificationStore.getState().setListingUpdate(data);
    });

    // Volunteer gets notified of a nearby pickup request
    socket.on('pickup_request', (data) => {
      useNotificationStore.getState().addUrgent({
        ...data.listing,
        title: 'Pickup needed nearby!',
        isUrgent: true,
      });
    });

    socket.on('upcoming_surplus', (data) => {
      useNotificationStore.getState().addUrgent({ 
        ...data, 
        type: 'surplus_alert' 
      });
    });

    // Volunteer assigned — show donor and recipient who's coming
    socket.on('volunteer_assigned', (data) => {
      useNotificationStore.getState().add({
        title: `Volunteer assigned: ${data.volunteerName}`,
        isUrgent: false,
        ...data,
      });
    });

    // Real-time volunteer location update for recipient
    socket.on('volunteer_location', (data) => {
      // Store latest volunteer location in notification store
      // so Feed/map can show moving volunteer pin
      useNotificationStore.getState().setVolunteerLocation(data);
    });

    // Delivery complete notification
    socket.on('delivery_complete', (data) => {
      useNotificationStore.getState().add({
        title: '✅ Your food has been delivered!',
        isUrgent: false,
        ...data,
      });
    });

    socket.on('impact_updated', (data) => {
      useNotificationStore.getState().setImpactStats(data);
    });

    socket.on('disconnect', () => console.log('Socket disconnected'));

    return () => socket.disconnect();
  }, [token]);
}
