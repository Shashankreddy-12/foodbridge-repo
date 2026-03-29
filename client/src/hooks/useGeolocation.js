import { useState, useEffect } from 'react';

const useGeolocation = () => {
    const [location, setLocation] = useState({
        coordinates: { lat: 0, lng: 0 },
        loaded: false,
        error: null,
    });

    useEffect(() => {
        if (!("geolocation" in navigator)) {
            setLocation((state) => ({ ...state, loaded: true, error: "Geolocation not supported" }));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocation({
                    loaded: true,
                    coordinates: {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                    },
                });
            },
            (err) => {
                setLocation((state) => ({ ...state, loaded: true, error: err.message }));
            }
        );
    }, []);

    return location;
};

export default useGeolocation;
