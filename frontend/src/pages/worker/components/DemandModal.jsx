import React, { useState, useEffect, useRef } from 'react';
import { servicesAPI, demandsAPI } from '../../../services/api';
import StatusBadge from '../../../components/StatusBadge';
import { Search, AlertCircle, CheckCircle, DollarSign, X, Scan, ListChecks, PenLine } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { matchesQuery, highlight } from '../../../utils/search';

export default function DemandModal({ demand, onClose, isMobile }) {
  const [services, setServices] = useState([]);
  const [selected, setSelected] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [detail, setDetail] = useState(demand);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    servicesAPI.list().then(r => setServices(r.data)).catch(() => {});
    demandsAPI.get(demand.id).then(r => setDetail(r.data)).catch(() => {});
  }, [demand.id]);

  const needsProcessing = demand.status === 'pending' || demand.status === 'ocr_no_match';
  const totalPreview = selected.reduce((sum, id) => {
    const s = services.find(s => s.id === id);
    return sum + (s ? parseFloat(s.price) : 0);
  }, 0);
  const toggle = (id) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const handleProcess = async () => {
    if (selected.length === 0) { setError('Sélectionnez au moins une analyse'); return; }
    setLoading(true); setError('');
    try {
      await demandsAPI.process(demand.id, { service_ids: selected, notes });
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (e) {
      setError(e.response?.data?.error || 'Erreur lors du traitement');
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(13,27,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 },
  modal: { background: 'white', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 620, maxHeight: '90vh', overflow: 'auto', boxShadow: 'var(--shadow-lg)' },
  modalMobile: { maxHeight: '95vh', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: '100%' },
  modalHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'white', zIndex: 1, gap: 12 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center', flexShrink: 0, WebkitTapHighlightColor: 'transparent' },
  modalBody: { padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 18 },
  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: 12, background: 'var(--cream)', borderRadius: 'var(--radius-md)' },
  infoLabel: { fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' },
  sectionLabel: { fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 },
  ocrBox: { background: 'var(--cream-dark)', borderRadius: 'var(--radius-sm)', padding: 12, fontSize: '0.78rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 150, overflow: 'auto', border: '1px solid var(--border)' },
  servicesList: { border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' },
  serviceRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border)' },
  totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', background: 'var(--navy)', color: 'white', fontSize: '0.9rem', fontWeight: 700 },
  };

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...styles.modal, ...(isMobile ? styles.modalMobile : {}) }}>
        <div style={styles.modalHeader}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {detail.first_name || detail.username} {detail.last_name || ''}
            </h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {format(new Date(detail.created_at), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
            </p>
          </div>
          <button style={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div style={styles.modalBody}>
          <div style={styles.infoGrid}>
           {[['Type', detail.ordonnance_type === 'ocr' ? '🖨️ Imprimée' : detail.ordonnance_type === 'manual' ? '📋 Manuelle' : '✍️ Manuscrite'], ['Statut', <StatusBadge status={detail.status} />], detail.birthday && ['Naissance', format(new Date(detail.birthday), 'dd/MM/yyyy')], detail.address && ['Adresse', detail.address]].filter(Boolean).map(([label, val], i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3, gridColumn: label === 'Adresse' ? '1 / -1' : 'auto' }}>
                <span style={styles.infoLabel}>{label}</span>
                <span style={{ fontSize: '0.85rem' }}>{val}</span>
              </div>
            ))}
          </div>

          {detail.ordonnance_url && detail.ordonnance_url !== 'manual' && (
            <div>
              <p style={styles.sectionLabel}>Ordonnance (cliquez pour agrandir)</p>
              <a href={detail.ordonnance_url} target="_blank" rel="noopener noreferrer">
                <img src={detail.ordonnance_url} alt="Ordonnance" style={{ width: '100%', maxHeight: 360, objectFit: 'contain', borderRadius: 8, border: '1.5px solid var(--border)', display: 'block', background: '#f5f5f5', cursor: 'zoom-in' }}
                  onError={e => { e.target.style.display = 'none'; }} />
              </a>
            </div>
          )}

          {detail.ocr_text && (
            <div>
              <p style={styles.sectionLabel}>Texte OCR</p>
              <pre style={styles.ocrBox}>{detail.ocr_text}</pre>
            </div>
          )}

          {!needsProcessing && detail.items?.length > 0 && (
            <div>
              <p style={styles.sectionLabel}>Analyses prescrites</p>
              <div style={styles.servicesList}>
                {detail.items.map(item => (
                  <div key={item.id} style={styles.serviceRow}>
                    <span style={{ fontSize: '0.88rem' }}>{item.name}</span>
                    <span style={{ fontWeight: 600, color: 'var(--teal-dark)', fontSize: '0.88rem' }}>{Number(item.price).toLocaleString('fr-DZ')} DA</span>
                  </div>
                ))}
                <div style={styles.totalRow}><span>Total</span><span>{Number(detail.total_price).toLocaleString('fr-DZ')} DA</span></div>
              </div>
            </div>
          )}

          {needsProcessing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ ...styles.sectionLabel, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={13} color="var(--coral)" /> Sélectionnez les analyses
              </p>
              {error && <div className="alert alert-error"><AlertCircle size={14} />{error}</div>}
              {success && <div className="alert alert-success"><CheckCircle size={14} />Traité avec succès !</div>}

              <div style={styles.workerSearchWrap}>
                <Search size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Rechercher… (ex : glycémie, NFS, TSH)"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={styles.workerSearchInput}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} style={styles.workerClearBtn} title="Effacer">
                    <X size={12} />
                  </button>
                )}
              </div>

              {searchQuery && (() => {
                const n = services.filter(s => matchesQuery(s, searchQuery)).length;
                return <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{n === 0 ? 'Aucun résultat' : `${n} analyse${n > 1 ? 's' : ''} trouvée${n > 1 ? 's' : ''}`}</p>;
              })()}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto', paddingRight: 2 }}>
                {services.filter(s => matchesQuery(s, searchQuery)).length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 0', color: 'var(--text-muted)' }}>
                    <Search size={24} style={{ opacity: 0.35 }} />
                    <p style={{ margin: 0, fontSize: '0.82rem' }}>Aucune analyse ne correspond à cette recherche.</p>
                  </div>
                )}
                {services.filter(s => matchesQuery(s, searchQuery)).map(s => (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderRadius: 'var(--radius-sm)', border: '1.5px solid', borderColor: selected.includes(s.id) ? 'var(--teal)' : 'var(--border)', background: selected.includes(s.id) ? 'rgba(10,147,150,0.07)' : 'white', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} style={{ width: 'auto', accentColor: 'var(--teal)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 500, fontSize: '0.88rem' }}>{highlight(s.name, searchQuery)}</p>
                      <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>{s.code}</p>
                    </div>
                    <span style={{ fontWeight: 700, color: 'var(--teal-dark)', fontSize: '0.88rem', flexShrink: 0 }}>{Number(s.price).toLocaleString('fr-DZ')} DA</span>
                  </label>
                ))}
              </div>

              {selected.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--teal)', color: 'white', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: '0.92rem' }}>
                  <DollarSign size={15} /> Total : {totalPreview.toLocaleString('fr-DZ')} DA
                  <span style={{ marginLeft: 'auto', fontSize: '0.78rem', background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '2px 10px' }}>
                    {selected.length} analyse{selected.length > 1 ? 's' : ''}
                  </span>
                </div>
              )}
              <div className="form-group">
                <label>Notes (optionnel)</label>
                <textarea rows={2} placeholder="Instructions pour le client…" value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'vertical' }} />
              </div>
              <button className="btn btn-primary btn-block" onClick={handleProcess} disabled={loading || success}>
                {loading ? <span className="spinner" /> : <><CheckCircle size={15} /> Confirmer et envoyer</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



