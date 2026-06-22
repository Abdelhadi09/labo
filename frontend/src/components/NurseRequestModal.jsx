import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { nurseAPI, profileAPI } from '../services/api';
import MapPicker from './MapPicker';
import Stepper, { Step } from './Stepper';
import { X, Phone, MapPin, CheckCircle, AlertCircle, User, FlaskConical } from 'lucide-react';

export default function NurseRequestModal({ demand, onClose, onSuccess }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [phone, setPhone] = useState('');
  const [useProfileAddress, setUseProfileAddress] = useState(true);
  const [mapAddress, setMapAddress] = useState(null);
  const [profileAddress, setProfileAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  useEffect(() => {
    profileAPI.get().then(res => {
      if (res.data?.address) setProfileAddress(res.data.address);
    }).catch(() => {});
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const finalAddress = useProfileAddress ? profileAddress : mapAddress?.address;

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

  const modalContent = (
    <div style={styles.overlay}>
      <div
        style={{
          ...styles.modal,
          // On mobile: act as bottom sheet; on desktop center inside overlay
          position: isMobile ? 'fixed' : 'relative',
          bottom: isMobile ? 0 : 'auto',
          left: isMobile ? 0 : 'auto',
          right: isMobile ? 0 : 'auto',
          // On mobile keep rounded top corners, on desktop use full radius
          borderRadius: isMobile ? '20px 20px 0 0' : 'var(--radius-lg)',
          maxHeight: isMobile ? '90dvh' : '92vh',
          width: '100%',
          maxWidth: isMobile ? '100%' : 520,
        }}
      >
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h3 style={{ margin: 0, fontSize: isMobile ? '0.98rem' : '1.05rem' }}>
              Demander une infirmière à domicile
            </h3>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3 }}>
              Un professionnel se déplacera chez vous pour le prélèvement
            </p>
          </div>
          <button style={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ margin: '10px 16px 0' }}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} />{error}
          </div>
        )}

        <Stepper
          onFinalStepCompleted={handleSubmit}
          backButtonText="Précédent"
          nextButtonText="Suivant"
          stepCircleContainerClassName="nurse-stepper-container"
          footerClassName="nurse-stepper-footer"
          disableStepIndicators={false}
        >

          {/* ── Step 1 : Résumé ── */}
          <Step>
            <div style={styles.stepBody}>
              <div style={{ display: 'flex', alignItems: 'center' , gap: 8, marginBottom: 6 }}>
              <div style={styles.stepIcon}>
                <FlaskConical size={20} color="var(--teal)" />
                 
              </div>
              <h4 style={styles.stepTitle}>Analyses concernées</h4>
             </div>
              <div style={styles.demandSummary}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={styles.summaryLabel}>Votre demande</span>
                  {demand.total_price && (
                    <span style={styles.priceTag}>
                      {Number(demand.total_price).toLocaleString('fr-DZ')} DA
                    </span>
                  )}
                </div>
                {demand.items?.length > 0 && (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--navy)', lineHeight: 1.5 }}>
                    {demand.items.map(i => i.name).join(' · ')}
                  </p>
                )}
              </div>
              <p style={styles.stepHint}>
                Vérifiez que vos analyses sont correctes avant de continuer.
              </p>
            </div>
          </Step>

          {/* ── Step 2 : Téléphone ── */}
          <Step>
            <div style={styles.stepBody}>
              <div style={styles.stepIcon}>
                <Phone size={20} color="var(--teal)" />
              </div>
              <h4 style={styles.stepTitle}>Numéro de téléphone</h4>
              <p style={styles.stepHint}>
                L'infirmière vous contactera sur ce numéro pour confirmer le rendez-vous.
              </p>
              <div className="form-group" style={{ marginTop: 14 }}>
                <label>Téléphone *</label>
                <input
                  type="tel"
                  placeholder="Ex: 0555 123 456"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  // prevents zoom-in on iOS (font-size must be >= 16px)
                  style={{ fontSize: '16px' }}
                />
              </div>
            </div>
          </Step>

          {/* ── Step 3 : Adresse ── */}
          <Step>
            <div style={styles.stepBody}>
              <div style={styles.stepIcon}>
                <MapPin size={20} color="var(--teal)" />
              </div>
              <h4 style={styles.stepTitle}>Adresse de visite</h4>
              <p style={styles.stepHint}>Où souhaitez-vous recevoir l'infirmière ?</p>

              <div style={{ ...styles.addressToggle, flexDirection: isMobile ? 'column' : 'row' }}>
                <button
                  style={{ ...styles.toggleBtn, ...(useProfileAddress ? styles.toggleActive : {}), width: isMobile ? '100%' : 'auto' }}
                  onClick={() => setUseProfileAddress(true)}
                >
                  <User size={14} /> Mon adresse de profil
                </button>
                <button
                  style={{ ...styles.toggleBtn, ...(!useProfileAddress ? styles.toggleActive : {}), width: isMobile ? '100%' : 'auto' }}
                  onClick={() => setUseProfileAddress(false)}
                >
                  <MapPin size={14} /> Choisir sur la carte
                </button>
              </div>

              {useProfileAddress ? (
                profileAddress ? (
                  <div style={styles.profileAddrBox}>
                    <MapPin size={14} color="var(--teal)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: '0.85rem' }}>{profileAddress}</span>
                  </div>
                ) : (
                  <div className="alert alert-warning" style={{ marginTop: 10 }}>
                    <AlertCircle size={13} style={{ flexShrink: 0 }} />
                    Aucune adresse dans votre profil. Choisissez une adresse sur la carte.
                  </div>
                )
              ) : (
                <div style={{ marginTop: 12 }}>
                  <MapPicker value={mapAddress} onChange={setMapAddress} />
                </div>
              )}
            </div>
          </Step>

        </Stepper>

        {loading && (
          <div style={styles.loadingOverlay}>
            <span className="spinner" style={{ width: 28, height: 28 }} />
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
 
 
  modal: {
    background: 'white', overflow: 'auto', boxShadow: 'var(--shadow-lg)',
    maxHeight: '90dvh',
    borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 520,
    display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '14px 16px', borderBottom: '1px solid var(--border)',
    position: 'sticky', top: 0, background: 'white', zIndex: 1, gap: 12,
  },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted)', padding: 6, borderRadius: 4,
    display: 'flex', alignItems: 'center', flexShrink: 0,
    minWidth: 44, minHeight: 44, justifyContent: 'center', // tap target
  },
  stepBody: {
    display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 8,
  },
  stepIcon: {
    width: 42, height: 42, borderRadius: '50%',
    background: 'rgba(10,147,150,0.1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  stepTitle: {
    margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--navy)',
  },
  stepHint: {
    margin: 0, fontSize: '0.83rem', color: 'var(--text-muted)', lineHeight: 1.5,
  },
  demandSummary: {
    padding: '12px 14px', background: 'var(--cream)',
    borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginTop: 4,
  },
  summaryLabel: {
    fontSize: '0.75rem', color: 'var(--text-muted)',
    fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  priceTag: {
    fontWeight: 700, fontSize: '0.85rem', color: 'var(--teal-dark)',
    background: 'rgba(10,147,150,0.08)', padding: '3px 10px', borderRadius: 20,
  },
  addressToggle: { display: 'flex', gap: 8, marginTop: 10 },
  toggleBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '10px 14px', borderRadius: 'var(--radius-sm)',
    border: '1.5px solid var(--border)', background: 'white',
    cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.83rem',
    fontWeight: 500, color: 'var(--text-muted)', transition: 'all 0.15s',
    WebkitTapHighlightColor: 'transparent',
    minHeight: 44, // tap target
  },
  toggleActive: {
    borderColor: 'var(--teal)', background: 'rgba(10,147,150,0.07)', color: 'var(--teal-dark)',
  },
  profileAddrBox: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    padding: '10px 12px', background: 'rgba(10,147,150,0.06)',
    borderRadius: 'var(--radius-sm)', border: '1px solid rgba(10,147,150,0.2)',
    marginTop: 10, lineHeight: 1.5,
  },
  loadingOverlay: {
    position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 'inherit', zIndex: 10,
  },
};