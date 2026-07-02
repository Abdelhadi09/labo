import React, { useState } from 'react';
import { Phone, MapPin, FlaskConical, CheckCircle, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { nurseAPI } from '../../../services/api';

const NURSE_STATUS = {
  pending:   { label: 'En attente', color: '#92400e', bg: '#fef3c7', border: '#fcd34d' },
  confirmed: { label: 'Confirmée',  color: '#065f46', bg: '#d1fae5', border: '#6ee7b7' },
  done:      { label: 'Effectuée',  color: '#1e40af', bg: '#dbeafe', border: '#93c5fd' },
};

export default function NurseTab({ requests, loading, onRefresh, isMobile, page, totalPages, total, limit, onPageChange, hasFilters, filterBarProps, onClearFilters }) {
  const [updatingId, setUpdatingId] = useState(null);

  const handleStatus = async (id, status) => {
    setUpdatingId(id);
    try {
      await nurseAPI.updateStatus(id, status);
      onRefresh();
    } catch (e) {
      alert('Erreur lors de la mise à jour');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? '1.1rem' : '1.4rem' }}>
          🩺 Demandes d'infirmière à domicile
        </h2>
        <button className="btn btn-secondary btn-sm" onClick={onRefresh}><span style={{display:'inline-block', transform:'translateY(1px)'}}>⟳</span> Actualiser</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-dark" /></div>
      ) : requests.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 24px', color: 'var(--text-muted)' }}>
          <FlaskConical size={32} color="var(--text-muted)" />
          <p>{hasFilters ? 'Aucun résultat pour ces filtres' : "Aucune demande d'infirmière pour l'instant"}</p>
          {hasFilters && (
            <button className="btn btn-secondary btn-sm" onClick={onClearFilters}>
              <X size={12} /> Effacer les filtres
            </button>
          )}
        </div>
      ) : (
        <>
          {hasFilters && (
            <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {requests.length} résultat{requests.length > 1 ? 's' : ''} affiché{requests.length > 1 ? 's' : ''}
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {requests.map(r => {
              const s = NURSE_STATUS[r.status] || NURSE_STATUS.pending;
              return (
                <div key={r.id} style={{ background: 'white', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', borderLeft: `4px solid ${r.status === 'pending' ? 'var(--coral)' : r.status === 'confirmed' ? 'var(--teal)' : 'var(--border)'}` }}>
                  <div style={{ padding: '14px 18px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 14 }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy)' }}>
                          {r.first_name && r.last_name ? `${r.first_name} ${r.last_name}` : r.username}
                        </p>
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}`, flexShrink: 0 }}>
                          {s.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                        <Phone size={13} color="var(--teal)" />
                        <a href={`tel:${r.phone}`} style={{ color: 'var(--teal)', fontWeight: 600 }}>{r.phone}</a>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                        <MapPin size={13} color="var(--teal)" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>{r.address}</span>
                      </div>
                      {r.analyses?.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          <FlaskConical size={13} color="var(--teal)" style={{ flexShrink: 0, marginTop: 2 }} />
                          <span>{r.analyses.join(' · ')}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {r.demand_total && <span style={{ fontWeight: 600, color: 'var(--teal-dark)' }}>{Number(r.demand_total).toLocaleString('fr-DZ')} DA</span>}
                        <span>{format(new Date(r.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: 8, flexShrink: 0, justifyContent: isMobile ? 'flex-end' : 'center' }}>
                      {r.status === 'pending' && (
                        <button className="btn btn-primary btn-sm" disabled={updatingId === r.id} onClick={() => handleStatus(r.id, 'confirmed')}>
                          {updatingId === r.id ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <><CheckCircle size={13} /> Confirmer</>}
                        </button>
                      )}
                      {r.status === 'confirmed' && (
                        <button className="btn btn-sm" style={{ background: 'var(--navy)', color: 'white' }} disabled={updatingId === r.id} onClick={() => handleStatus(r.id, 'done')}>
                          {updatingId === r.id ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <><CheckCircle size={13} /> Marquer effectuée</>}
                        </button>
                      )}
                      {r.status === 'done' && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--teal)', fontWeight: 600 }}>✓ Effectuée</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
