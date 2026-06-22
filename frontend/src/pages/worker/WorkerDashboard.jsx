import React, { useState, useEffect, useRef } from 'react';
import Navbar from '../../components/Navbar';
import StatusBadge from '../../components/StatusBadge';
import Pagination from '../../components/Pagination';
import { demandsAPI, servicesAPI, nurseAPI } from '../../services/api';
import { supabase } from '../../services/supabaseClient';
import {
  FileText, RefreshCw, CheckCircle, Clock,
  ChevronRight, X, DollarSign, Scan, PenLine,
  AlertCircle, FlaskConical, FileImage, ListChecks, Stethoscope, MapPin, Phone, Search
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

/* ── Search helpers (accent-insensitive, keyword-aware) ── */
function normalize(str = '') {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '');
}
function matchesQuery(service, query) {
  if (!query.trim()) return true;
  const q = normalize(query);
  const haystack = normalize([service.name, service.code, service.keywords || ''].join(' '));
  return q.split(/\s+/).every(w => haystack.includes(w));
}
function highlight(text, query) {
  if (!query.trim()) return text;
  const word = query.trim().split(/\s+/)[0];
  const idx = normalize(text).indexOf(normalize(word));
  if (idx === -1) return text;
  return <>{text.slice(0, idx)}<mark style={{ background: 'rgba(10,147,150,0.18)', color: 'inherit', borderRadius: 2, padding: '0 2px' }}>{text.slice(idx, idx + word.length)}</mark>{text.slice(idx + word.length)}</>;
}

function useIsMobile() {
  const [v, setV] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const fn = () => setV(window.innerWidth <= 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return v;
}

function typeLabel(type) {
  if (type === 'ocr') return '🖨️ Imprimée';
  if (type === 'manual') return '📋 Manuelle';
  return '✍️ Manuscrite';
}

const NURSE_STATUS = {
  pending:   { label: 'En attente', color: '#92400e', bg: '#fef3c7', border: '#fcd34d' },
  confirmed: { label: 'Confirmée',  color: '#065f46', bg: '#d1fae5', border: '#6ee7b7' },
  done:      { label: 'Effectuée', color: '#1e40af', bg: '#dbeafe', border: '#93c5fd' },
};

export default function WorkerDashboard() {
  const PAGE_LIMIT = 10;

  const [tab, setTab] = useState('all');
  const [demands, setDemands] = useState([]);
  const [demandsTotal, setDemandsTotal] = useState(0);
  const [demandsPage, setDemandsPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [nurseRequests, setNurseRequests] = useState([]);
  const [nurseTotal, setNurseTotal] = useState(0);
  const [nursePage, setNursePage] = useState(1);
  const [nurseLoading, setNurseLoading] = useState(false);
  const isMobile = useIsMobile();

  const load = (page = demandsPage) => {
    setLoading(true);
    demandsAPI.list(page, PAGE_LIMIT)
      .then(r => {
        setDemands(r.data.data);
        setDemandsTotal(r.data.total);
        setDemandsPage(r.data.page);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const loadNurse = (page = nursePage) => {
    setNurseLoading(true);
    nurseAPI.list(page, PAGE_LIMIT)
      .then(r => {
        setNurseRequests(r.data.data);
        setNurseTotal(r.data.total);
        setNursePage(r.data.page);
      })
      .catch(() => {})
      .finally(() => setNurseLoading(false));
  };

  useEffect(() => { load(1); }, []);
  useEffect(() => { if (tab === 'nurse') loadNurse(1); }, [tab]);
  useEffect(() => {
    document.body.style.overflow = selected ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selected]);

  // Refs so realtime callbacks always read the current page without re-subscribing
  const demandsPageRef = useRef(demandsPage);
  useEffect(() => { demandsPageRef.current = demandsPage; }, [demandsPage]);
  const nursePageRef = useRef(nursePage);
  useEffect(() => { nursePageRef.current = nursePage; }, [nursePage]);

  useEffect(() => {
    const channel = supabase
      .channel('worker-demands')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'demands' }, () => load(demandsPageRef.current))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (tab !== 'nurse') return;
    const channel = supabase
      .channel('worker-nurse-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nurse_requests' }, () => loadNurse(nursePageRef.current))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tab]);

  const pending   = demands.filter(d => d.status === 'pending' || d.status === 'ocr_no_match');
  const processed = demands.filter(d => ['ocr_processed','processed'].includes(d.status));
  const nurseCount = nurseRequests.filter(r => r.status === 'pending').length;

  const demandsTotalPages = Math.ceil(demandsTotal / PAGE_LIMIT);
  const nurseTotalPages   = Math.ceil(nurseTotal   / PAGE_LIMIT);

  const tabs = [
    { id: 'all',       label: 'Toutes',    count: demandsTotal },
    { id: 'pending',   label: 'À traiter', count: pending.length,   urgent: true },
    { id: 'processed', label: 'Traitées',  count: processed.length },
    { id: 'nurse',     label: 'Infirmière', count: nurseCount, urgent: nurseCount > 0, icon: <Stethoscope size={14} /> },
  ];

  const list = tab === 'pending' ? pending : tab === 'processed' ? processed : demands;
const activeIndex = tabs.findIndex(t => t.id === tab);
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: isMobile ? 72 : 0 }}>
      <Navbar role="worker" />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '14px 12px' : '24px 20px', display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {!isMobile && (
          <aside style={styles.sidebar}>
            <p style={styles.sidebarTitle}><FlaskConical size={14} color="var(--teal)" /> Technicien</p>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {tabs.map(({ id, label, count, urgent, icon }) => (
                <button key={id}
                  style={{ ...styles.navItem, ...(tab === id ? styles.navActive : {}) }}
                  onClick={() => setTab(id)}>
                  {icon || null}
                  <span style={{ flex: 1 }}>{label}</span>
                  {count > 0 && (
                    <span style={{ ...styles.countBadge, background: urgent ? 'var(--coral)' : 'var(--teal)' }}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            <div style={styles.statsBox}>
              {[['Total', demandsTotal, 'var(--text-dark)'],
                ['À traiter', pending.length, 'var(--coral)'],
                ['Traitées', processed.length, 'var(--teal)'],
                ['Infirmières', nurseCount, 'var(--gold)']].map(([label, val, color]) => (
                <div key={label} style={styles.statRow}>
                  <span style={{ fontSize: '0.84rem' }}>{label}</span>
                  <strong style={{ color }}>{val}</strong>
                </div>
              ))}
            </div>
          </aside>
        )}

        <main style={{ flex: 1, minWidth: 0 }} className="page-enter">
          {/* {isMobile && (
            <div style={{ display: 'flex', background: 'white', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: 4, marginBottom: 14, gap: 3, overflowX: 'auto' }}>
              {tabs.map(({ id, label, count, urgent }) => (
                <button key={id}
                  style={{ ...styles.mobileTab, ...(tab === id ? styles.mobileTabActive : {}), flexShrink: 0 }}
                  onClick={() => setTab(id)}>
                  {label}
                  {count > 0 && (
                    <span style={{ ...styles.countBadge, background: urgent ? 'var(--coral)' : tab === id ? 'white' : 'var(--teal)', color: tab === id && !urgent ? 'var(--teal)' : 'white', marginLeft: 4 }}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )} */}

          {tab !== 'nurse' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2 style={{ margin: 0, fontSize: isMobile ? '1.1rem' : '1.4rem' }}>
                  {tab === 'pending' ? 'À traiter' : tab === 'processed' ? 'Traitées' : 'Toutes les demandes'}
                </h2>
                <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={13} /> Actualiser</button>
              </div>

              {tab === 'pending' && pending.length > 0 && (
                <div className="alert alert-warning" style={{ marginBottom: 14 }}>
                  <Clock size={14} style={{ flexShrink: 0 }} />
                  {pending.length} demande(s) en attente de traitement manuel
                </div>
              )}

              {loading ? (
                <div style={styles.center}><div className="spinner spinner-dark" /></div>
              ) : list.length === 0 ? (
                <div style={styles.empty}><FileText size={32} color="var(--text-muted)" /><p>Aucune demande</p></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {list.map(d => (
                    <DemandCard key={d.id} demand={d} onSelect={() => setSelected(d)} isMobile={isMobile} />
                  ))}
                </div>
              )}
              {tab === 'all' && demandsTotalPages > 1 && (
                <Pagination
                  page={demandsPage}
                  totalPages={demandsTotalPages}
                  total={demandsTotal}
                  limit={PAGE_LIMIT}
                  onPageChange={p => load(p)}
                />
              )}
            </>
          )}

          {tab === 'nurse' && (
            <NurseTab
              requests={nurseRequests}
              loading={nurseLoading}
              onRefresh={loadNurse}
              isMobile={isMobile}
              page={nursePage}
              totalPages={nurseTotalPages}
              total={nurseTotal}
              limit={PAGE_LIMIT}
              onPageChange={p => loadNurse(p)}
            />
          )}
        </main>
      </div>

      {isMobile && (
        <nav style={styles.bottomNav}>
        <div style={styles.glassShine} />
         <div
    style={{
      ...styles.activePill,
     width: `calc((100% - 12px) / ${tabs.length})`,
  transform: `translateX(calc(${activeIndex} * 100%))`,
    }}
  />
          {tabs.map(({ id, label, count, urgent }) => (
            <button key={id}
              style={{ ...styles.bottomItem, ...(tab === id ? styles.bottomActive : {}) }}
              onClick={() => setTab(id)}>
              {id === 'nurse' ? <Stethoscope size={19} /> : <FileText size={19} />}
              <span style={{ fontSize: '0.6rem', fontWeight: 600 }}>{label}</span>
              {count > 0 && (
                <span style={{ position: 'absolute', top: 6, right: 'calc(50% - 18px)', width: 16, height: 16, borderRadius: '50%', background: urgent ? 'var(--coral)' : 'var(--teal)', color: 'white', fontSize: '0.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{count}</span>
              )}
            </button>
          ))}
        </nav>
      )}

      {selected && (
        <DemandModal demand={selected} isMobile={isMobile} onClose={() => { setSelected(null); load(); }} />
      )}
    </div>
  );
}

function NurseTab({ requests, loading, onRefresh, isMobile, page, totalPages, total, limit, onPageChange }) {
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
        <button className="btn btn-secondary btn-sm" onClick={onRefresh}><RefreshCw size={13} /> Actualiser</button>
      </div>

      {loading ? (
        <div style={styles.center}><div className="spinner spinner-dark" /></div>
      ) : requests.length === 0 ? (
        <div style={{ ...styles.empty, background: 'white', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
          <Stethoscope size={32} color="var(--text-muted)" />
          <p>Aucune demande d'infirmière pour l'instant</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {requests.map(r => {
            const s = NURSE_STATUS[r.status] || NURSE_STATUS.pending;
            return (
              <div key={r.id} style={{ background: 'white', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', borderLeft: `4px solid ${r.status === 'pending' ? 'var(--coral)' : r.status === 'confirmed' ? 'var(--teal)' : 'var(--border)'}` }}>
                <div style={{ padding: '14px 18px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 14 }}>
                  {/* Client info */}
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

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: 8, flexShrink: 0, justifyContent: isMobile ? 'flex-end' : 'center' }}>
                    {r.status === 'pending' && (
                      <button className="btn btn-primary btn-sm"
                        disabled={updatingId === r.id}
                        onClick={() => handleStatus(r.id, 'confirmed')}>
                        {updatingId === r.id ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <><CheckCircle size={13} /> Confirmer</>}
                      </button>
                    )}
                    {r.status === 'confirmed' && (
                      <button className="btn btn-sm" style={{ background: 'var(--navy)', color: 'white' }}
                        disabled={updatingId === r.id}
                        onClick={() => handleStatus(r.id, 'done')}>
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
      )}
      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}

function DemandCard({ demand: d, onSelect, isMobile }) {
  const needsAction = d.status === 'pending' || d.status === 'ocr_no_match';
  return (
    <div onClick={onSelect} style={{ background: 'white', borderRadius: 'var(--radius-md)', padding: isMobile ? '12px 14px' : '14px 18px', boxShadow: 'var(--shadow-sm)', cursor: 'pointer', borderLeft: `3px solid ${needsAction ? 'var(--coral)' : 'transparent'}`, display: 'flex', flexDirection: 'column', gap: 8, WebkitTapHighlightColor: 'transparent' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {d.ordonnance_type === 'ocr' ? <Scan size={14} color="var(--teal)" /> : d.ordonnance_type === 'manual' ? <ListChecks size={14} color="var(--gold)" /> : <PenLine size={14} color="var(--coral)" />}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontWeight: 600, fontSize: '0.88rem', margin: 0, color: 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {d.first_name && d.last_name ? `${d.first_name} ${d.last_name}` : d.username}
            </p>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: 0 }}>
              {format(new Date(d.created_at), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <StatusBadge status={d.status} />
          {d.total_price && !isMobile && <span style={styles.priceTag}>{Number(d.total_price).toLocaleString('fr-DZ')} DA</span>}
          <ChevronRight size={15} color="var(--text-muted)" />
        </div>
      </div>
      {d.total_price && isMobile && <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--teal-dark)' }}>{Number(d.total_price).toLocaleString('fr-DZ')} DA</p>}
      {d.items?.length > 0 && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.items.map(i => i.name).join(' · ')}</p>}
    </div>
  );
}

function DemandModal({ demand, onClose, isMobile }) {
  const [services, setServices] = useState([]);
  const [selected, setSelected] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [detail, setDetail] = useState(demand);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = React.useRef(null);

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
            {[['Type', typeLabel(detail.ordonnance_type)], ['Statut', <StatusBadge status={detail.status} />], detail.birthday && ['Naissance', format(new Date(detail.birthday), 'dd/MM/yyyy')], detail.address && ['Adresse', detail.address]].filter(Boolean).map(([label, val], i) => (
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

              {/* ── Search bar ── */}
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

              {/* ── Result count ── */}
              {searchQuery && (() => {
                const n = services.filter(s => matchesQuery(s, searchQuery)).length;
                return <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{n === 0 ? 'Aucun résultat' : `${n} analyse${n > 1 ? 's' : ''} trouvée${n > 1 ? 's' : ''}`}</p>;
              })()}

              {/* ── Checklist ── */}
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

const styles = {
  sidebar: { width: 230, flexShrink: 0, background: 'white', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', padding: 16, position: 'sticky', top: 76 },
  sidebarTitle: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 12 },
  navItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.88rem', fontWeight: 500, transition: 'all 0.15s', textAlign: 'left', width: '100%', WebkitTapHighlightColor: 'transparent' },
  navActive: { background: 'rgba(10,147,150,0.08)', color: 'var(--teal-dark)' },
  countBadge: { minWidth: 20, height: 20, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'white', padding: '0 5px' },
  statsBox: { marginTop: 16, padding: 12, background: 'var(--cream)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 8 },
  statRow: { display: 'flex', justifyContent: 'space-between' },
  priceTag: { fontWeight: 700, fontSize: '0.84rem', color: 'var(--teal-dark)', background: 'rgba(10,147,150,0.08)', padding: '3px 8px', borderRadius: 20 },
  center: { display: 'flex', justifyContent: 'center', padding: 48 },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 24px', color: 'var(--text-muted)' },
  mobileTab: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 6px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontWeight: 500, WebkitTapHighlightColor: 'transparent', transition: 'all 0.15s' },
  mobileTabActive: { background: 'var(--teal)', color: 'white' },
 bottomNav: {
  position: 'fixed',
  bottom: 16,
  left: 16,
  right: 16,

  height: 68,

  background:
    'linear-gradient(180deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.16) 100%)',

  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',

  borderRadius: 999,

  border: '1px solid rgba(255,255,255,0.35)',

  boxShadow: `
    inset 0 1px 0 rgba(255,255,255,0.8),
    inset 0 -1px 0 rgba(255,255,255,0.15),
    0 8px 32px rgba(0,0,0,0.12),
    0 2px 8px rgba(0,0,0,0.08)
  `,

  display: 'flex',
  alignItems: 'center',
  padding: 6,

  overflow: 'hidden',
  zIndex: 200,
},

glassShine: {
  position: 'absolute',
  top: '-50%',
  left: '-20%',
  width: '140%',
  height: '200%',

  background:
    'linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%)',

  transform: 'rotate(-8deg)',
  pointerEvents: 'none',
},
activePill: {
  position: 'absolute',
  top: 6,
  left: 6,                          // anchor here
  height: 'calc(100% - 12px)',   // compute this dynamically in JSX
  borderRadius: 999,
  background: 'rgba(255,255,255,0.30)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.45)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), 0 4px 16px rgba(0,0,0,0.08)',
  transition: 'transform 400ms cubic-bezier(.34,1.56,.64,1)',
  zIndex: 0,
},

bottomItem: {
  flex: 1,
  position: 'relative',
  zIndex: 2,

  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',

  background: 'transparent',
  border: 'none',

  transition: 'color 250ms ease',
},

bottomActive: {
 

  color: 'var(--teal)',



},
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
  workerSearchWrap: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'white' },
  workerSearchInput: { flex: 1, border: 'none', outline: 'none', fontSize: '0.85rem', fontFamily: 'var(--font-body)', background: 'transparent', color: 'var(--navy)', minWidth: 0 },
  workerClearBtn: { display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, flexShrink: 0 },
};