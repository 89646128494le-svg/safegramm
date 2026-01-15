
import React, { useState, useEffect, useRef } from 'react';

interface LocationPickerProps {
  onSelect: (lat: number, lng: number, address?: string) => void;
  onClose: () => void;
}

export default function LocationPicker({ onSelect, onClose }: LocationPickerProps) {
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [address, setAddress] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLat(position.coords.latitude);
          setLng(position.coords.longitude);
          reverseGeocode(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  }, []);

  const reverseGeocode = async (latitude: number, longitude: number) => {
    try {
      setLoading(true);
      // Используем Nominatim (OpenStreetMap) для обратного геокодинга
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
      );
      const data = await response.json();
      setAddress(data.display_name || '');
    } catch (e) {
      console.error('Reverse geocoding error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Простая карта - в реальности используйте Leaflet или Google Maps
    const clickedLat = lat! + (0.5 - y / rect.height) * 0.01;
    const clickedLng = lng! + (x / rect.width - 0.5) * 0.01;
    
    setLat(clickedLat);
    setLng(clickedLng);
    reverseGeocode(clickedLat, clickedLng);
  };

  const handleSend = () => {
    if (lat !== null && lng !== null) {
      onSelect(lat, lng, address || undefined);
      onClose();
    }
  };

  return (
    <div className="location-picker">
      <div className="location-picker-header">
        <h4>Выберите местоположение</h4>
        <button onClick={onClose}>✕</button>
      </div>

      <div className="location-picker-content">
        {lat !== null && lng !== null ? (
          <>
            <div 
              ref={mapRef}
              className="location-map"
              onClick={handleMapClick}
              style={{
                width: '100%',
                height: '300px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                position: 'relative',
                cursor: 'crosshair'
              }}
            >
              <div className="location-marker" style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '24px'
              }}>
                📍
              </div>
            </div>
            <div className="location-coords">
              <div>Широта: {lat.toFixed(6)}</div>
              <div>Долгота: {lng.toFixed(6)}</div>
              {address && <div className="location-address">{address}</div>}
            </div>
          </>
        ) : (
          <div className="location-loading">Получение местоположения...</div>
        )}
      </div>

      <div className="location-picker-actions">
        <button onClick={onClose}>Отмена</button>
        <button onClick={handleSend} disabled={lat === null || lng === null || loading}>
          Отправить
        </button>
      </div>
    </div>
  );
}




