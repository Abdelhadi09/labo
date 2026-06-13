import React, { useState, useEffect } from 'react';
import { nurseAPI, profileAPI } from '../services/api';
import MapPicker from './MapPicker';
import { X, Phone, MapPin, CheckCircle, AlertCircle, User } from 'lucide-react';

export default function NurseRequestModal({ demand, onClose, onSuccess }) {
  const [phone, setPhone] = useState('');
  const [useProfileAddress, setUseProfileAddress] = useState(true);
  const [mapAddress, setMapAddress] = useState(null);
  const [profileAddress, setProfileAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    profileAPI.get().then(res => {
      if (res.data?.address) setProfileAddress(res.data.address);
    }).catch(() => {});
    // Lock body scroll
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const finalAddress = useProfileAddress
    ? profileAddress
    : mapAddress?.address;

  const handleSubmit = async () => {
    if (!phone.trim()) { setError('Veuillez entrer votre numéro de téléphone'); return; }
    if (!finalAddress) { setError('Veuillez sélectionner une adresse'); return; }

    setLoading(true);
    setError('');
    try {
      await nurseAPI.request({
        demand_id: demand.id,
        phone: phone.trim(),
        address: finalAddress,
        address_lat: useProfileAddress ? null : mapAddress?.lat,
        address_lng: useProfileAddress ? null : mapAddress?.lng,
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la soumission');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}> Demander une infirmière à domicile</h3>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3 }}>
              Un professionnel se déplacera chez vous pour le prélèvement
            </p>
          </div>
          <button style={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div style={styles.body}>
          {/* Demand summary */}
          <div style={styles.demandSummary}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.05em' }}>Analyses concernées</span>
              {demand.total_price && (
                <span style={styles.priceTag}>{Number(demand.total_price).toLocaleString('fr-DZ')} DA</span>
              )}
            </div>
            {demand.items?.length > 0 && (
              <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: 'var(--navy)' }}>
                {demand.items.map(i => i.name).join(' · ')}
              </p>
            )}
          </div>

          {error && (
            <div className="alert alert-error">
              <AlertCircle size={14} style={{ flexShrink: 0 }} />{error}
            </div>
          )}

          {/* Phone */}
          <div className="form-group">
            <label><Phone size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Numéro de téléphone *</label>
            <input
              type="tel"
              placeholder="Ex: 0555 123 456"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>

          {/* Address choice */}
          <div className="form-group">
            <label><MapPin size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Adresse de visite *</label>

            <div style={styles.addressToggle}>
              <button
                style={{ ...styles.toggleBtn, ...(useProfileAddress ? styles.toggleActive : {}) }}
                onClick={() => setUseProfileAddress(true)}
              >
                <User size={14} /> Utiliser mon adresse de profil
              </button>
              <button
                style={{ ...styles.toggleBtn, ...(!useProfileAddress ? styles.toggleActive : {}) }}
                onClick={() => setUseProfileAddress(false)}
              >
                <MapPin size={14} /> Choisir une autre adresse
              </button>
            </div>

            {useProfileAddress ? (
              profileAddress ? (
                <div style={styles.profileAddrBox}>
                  <MapPin size={14} color="var(--teal)" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '0.85rem' }}>{profileAddress}</span>
                </div>
              ) : (
                <div className="alert alert-warning" style={{ marginTop: 8 }}>
                  <AlertCircle size={13} style={{ flexShrink: 0 }} />
                  Aucune adresse dans votre profil. Choisissez une adresse sur la carte.
                </div>
              )
            ) : (
              <div style={{ marginTop: 10 }}>
                <MapPicker value={mapAddress} onChange={setMapAddress} />
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            className="btn btn-primary btn-block"
            onClick={handleSubmit}
            disabled={loading || !finalAddress}
            style={{ marginTop: 4 }}
          >
            {loading
              ? <span className="spinner" />
              : <><CheckCircle size={15} /> Confirmer la demande</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(13,27,42,0.55)', backdropFilter: 'blur(4px)',
    display: 'flex', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  modal: {
    background: 'white', borderRadius: 'var(--radius-lg)',
    width: '100%', maxWidth: 520,
    maxHeight: '92vh', overflow: 'auto',
    boxShadow: 'var(--shadow-lg)',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: '1px solid var(--border)',
    position: 'sticky', top: 0, background: 'white', zIndex: 1, gap: 12,
  },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted)', padding: 4, borderRadius: 4,
    display: 'flex', alignItems: 'center', flexShrink: 0,
  },
  body: { padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 18 },
  demandSummary: {
    padding: '12px 14px', background: 'var(--cream)',
    borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
  },
  priceTag: {
    fontWeight: 700, fontSize: '0.88rem', color: 'var(--teal-dark)',
    background: 'rgba(10,147,150,0.08)', padding: '3px 10px', borderRadius: 20,
  },
  addressToggle: { display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  toggleBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', borderRadius: 'var(--radius-sm)',
    border: '1.5px solid var(--border)', background: 'white',
    cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.83rem',
    fontWeight: 500, color: 'var(--text-muted)', transition: 'all 0.15s',
    WebkitTapHighlightColor: 'transparent',
  },
  toggleActive: {
    borderColor: 'var(--teal)', background: 'rgba(10,147,150,0.07)', color: 'var(--teal-dark)',
  },
  profileAddrBox: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    padding: '10px 12px', background: 'rgba(10,147,150,0.06)',
    borderRadius: 'var(--radius-sm)', border: '1px solid rgba(10,147,150,0.2)',
    marginTop: 8, lineHeight: 1.5,
  },
};