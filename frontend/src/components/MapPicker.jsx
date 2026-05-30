import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search } from 'lucide-react';

export default function MapPicker({ value, onChange }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    if (mapInstanceRef.current) return;

    // Dynamically import leaflet
    import('leaflet').then((L) => {
      const defaultLat = value?.lat || 35.6971;
      const defaultLng = value?.lng || 0.6308; // Oran, Algeria

      const map = L.map(mapRef.current).setView([defaultLat, defaultLng], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      // Custom marker icon
      const icon = L.divIcon({
        html: `<div style="
          width:32px;height:32px;background:var(--teal);border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        className: '',
      });

      if (value?.lat && value?.lng) {
        markerRef.current = L.marker([value.lat, value.lng], { icon }).addTo(map);
      }

      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
        }
        // Reverse geocode
        reverseGeocode(lat, lng, onChange);
      });

      mapInstanceRef.current = map;
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const reverseGeocode = async (lat, lng, callback) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await res.json();
      const address = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      callback({ lat, lng, address });
    } catch {
      callback({ lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError('');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`
      );
      const data = await res.json();
      if (data.length === 0) {
        setSearchError('Adresse non trouvée');
        return;
      }
      const { lat, lon, display_name } = data[0];
      const numLat = parseFloat(lat);
      const numLng = parseFloat(lon);

      if (mapInstanceRef.current) {
        import('leaflet').then((L) => {
          mapInstanceRef.current.setView([numLat, numLng], 15);
          const icon = L.divIcon({
            html: `<div style="
              width:32px;height:32px;background:var(--teal);border-radius:50% 50% 50% 0;
              transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);
            "></div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            className: '',
          });
          if (markerRef.current) {
            markerRef.current.setLatLng([numLat, numLng]);
          } else {
            markerRef.current = L.marker([numLat, numLng], { icon }).addTo(mapInstanceRef.current);
          }
          onChange({ lat: numLat, lng: numLng, address: display_name });
        });
      }
    } catch {
      setSearchError('Erreur de recherche');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div>
      <div style={styles.searchRow}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Rechercher une adresse..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
            style={{ paddingLeft: 34 }}
          />
        </div>
        <button type="button" className="btn btn-primary btn-sm" disabled={searching} onClick={handleSearch}>
          {searching ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Chercher'}
        </button>
      </div>

      {searchError && (
        <p style={{ color: 'var(--coral)', fontSize: '0.82rem', marginBottom: 8 }}>{searchError}</p>
      )}

      <div ref={mapRef} style={styles.map} />

      {value?.address && (
        <div style={styles.selectedAddr}>
          <MapPin size={14} color="var(--teal)" />
          <span>{value.address}</span>
        </div>
      )}
      <p style={styles.hint}>Cliquez sur la carte pour sélectionner votre adresse</p>
    </div>
  );
}

const styles = {
  searchRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-muted)',
    pointerEvents: 'none',
  },
  map: {
    height: 300,
    borderRadius: 'var(--radius-md)',
    border: '1.5px solid var(--border)',
    overflow: 'hidden',
  },
  selectedAddr: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
    padding: '8px 12px',
    background: 'rgba(10,147,150,0.06)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.82rem',
    color: 'var(--navy)',
    lineHeight: 1.5,
  },
  hint: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: 6,
  },
};