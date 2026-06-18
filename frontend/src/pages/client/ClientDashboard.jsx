import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import ProfileForm from '../../components/ProfileForm';
import OrdonnanceUpload from '../../components/OrdonnanceUpload';
import StatusBadge from '../../components/StatusBadge';
import NurseRequestModal from '../../components/NurseRequestModal';
import { demandsAPI, profileAPI } from '../../services/api';
import { LayoutDashboard, User, Upload, FileText, RefreshCw, DollarSign, FlaskConical, Stethoscope } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return isMobile;
}

function typeLabel(type) {
  if (type === 'ocr') return '🖨️ Imprimée';
  if (type === 'manual') return '📋 Manuelle';
  return '✍️ Manuscrite';
}

function isProcessed(status) {
  return ['processed', 'ocr_processed'].includes(status);
}

export default function ClientDashboard() {
  const [tab, setTab] = useState('dashboard');
  const [hasProfile, setHasProfile] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    profileAPI.get()
      .then((res) => {
        const exists = !!res.data;
        setHasProfile(exists);
        if (!exists) setTab('profile');
      })
      .catch(() => setTab('profile'))
      .finally(() => setProfileLoading(false));
  }, []);

  const tabs = [
    { id: 'dashboard', label: 'Accueil',   Icon: LayoutDashboard },
    { id: 'upload',    label: 'Soumettre', Icon: Upload },
    { id: 'history',   label: 'Demandes',  Icon: FileText },
    { id: 'profile',   label: 'Profil',    Icon: User },
  ];

  if (profileLoading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <Navbar role="client" />
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <div className="spinner spinner-dark" />
      </div>
    </div>
  );

  const handleTabChange = (id) => {
    if (!hasProfile && id !== 'profile') return;
    setTab(id);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: isMobile ? 72 : 0 }}>
      <Navbar role="client" />

      <div style={{
        display: 'flex', maxWidth: 1200, margin: '0 auto',
        padding: isMobile ? '16px 12px' : '24px 20px',
        gap: 24, alignItems: 'flex-start',
      }}>
        {!isMobile && (
          <aside style={styles.sidebar}>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {tabs.map(({ id, label, Icon }) => {
                const locked = !hasProfile && id !== 'profile';
                return (
                  <button key={id}
                    style={{ ...styles.navItem, ...(tab === id ? styles.navActive : {}), ...(locked ? styles.navLocked : {}) }}
                    onClick={() => handleTabChange(id)}
                    title={locked ? 'Complétez votre profil d\'abord' : ''}
                  >
                    <Icon size={17} />
                    <span>{label}</span>
                    {locked && <span style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>🔒</span>}
                  </button>
                );
              })}
            </nav>
          </aside>
        )}

        <main style={{ flex: 1, minWidth: 0 }} className="page-enter">
          {!hasProfile && tab !== 'profile' && (
            <div style={styles.blockerCard}>
              <div style={styles.blockerIcon}><User size={32} color="var(--teal)" /></div>
              <h2 style={{ margin: 0, fontSize: '1.3rem' }}>Bienvenue 👋</h2>
              <p style={{ color: 'var(--text-muted)', margin: 0, textAlign: 'center', maxWidth: 360 }}>
                Avant de continuer, veuillez compléter votre profil. C'est obligatoire pour soumettre une demande.
              </p>
              <button className="btn btn-primary btn-lg" onClick={() => setTab('profile')}>
                <User size={16} /> Compléter mon profil
              </button>
            </div>
          )}

          {tab === 'dashboard' && hasProfile &&
            <DashboardTab setTab={setTab} hasProfile={hasProfile} isMobile={isMobile} />}

          {tab === 'upload' && hasProfile && (
            <div className="card">
              <div className="card-header">
                <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Soumettre une ordonnance</h2>
              </div>
              <div className="card-body">
                <OrdonnanceUpload onSuccess={() => setTab('history')} />
              </div>
            </div>
          )}

          {tab === 'history' && hasProfile && <HistoryTab isMobile={isMobile} />}

          {tab === 'profile' && (
            <div className="card">
              <div className="card-header">
                <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Mon profil</h2>
                {!hasProfile && <span style={styles.requiredBadge}>Requis</span>}
              </div>
              <div className="card-body">
                {!hasProfile && (
                  <div className="alert alert-info" style={{ marginBottom: 20 }}>
                    <User size={15} style={{ flexShrink: 0 }} />
                    Remplissez toutes les informations ci-dessous pour accéder à l'application.
                  </div>
                )}
                <ProfileForm onComplete={() => { setHasProfile(true); setTab('dashboard'); }} />
              </div>
            </div>
          )}
        </main>
      </div>

      {isMobile && (
        <nav style={styles.bottomNav}>
          {tabs.map(({ id, label, Icon }) => {
            const locked = !hasProfile && id !== 'profile';
            return (
              <button key={id}
                style={{ ...styles.bottomItem, ...(tab === id ? styles.bottomItemActive : {}), ...(locked ? { opacity: 0.35 } : {}) }}
                onClick={() => handleTabChange(id)}
              >
                <Icon size={21} />
                <span style={{ fontSize: '0.65rem', marginTop: 2 }}>{label}</span>
                {id === 'profile' && !hasProfile && <span style={styles.bottomDot} />}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

function DashboardTab({ setTab, isMobile }) {
  const [demands, setDemands] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    demandsAPI.list().then(r => setDemands(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const stats = {
    total: demands.length,
    pending: demands.filter(d => d.status === 'pending').length,
    processed: demands.filter(d => isProcessed(d.status)).length,
    totalSpend: demands.filter(d => d.total_price).reduce((s, d) => s + parseFloat(d.total_price), 0),
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Total',      value: stats.total,     icon: <FileText size={18} color="var(--teal)" /> },
          { label: 'En attente', value: stats.pending,   icon: <RefreshCw size={18} color="var(--gold)" /> },
          { label: 'Traitées',   value: stats.processed, icon: <FlaskConical size={18} color="var(--teal)" /> },
          { label: 'Dépenses',   value: `${stats.totalSpend.toLocaleString('fr-DZ')} DA`, icon: <DollarSign size={18} color="var(--coral)" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} style={styles.statCard}>
            <div style={styles.statIcon}>{icon}</div>
            <div style={{ minWidth: 0 }}>
              <p style={{ ...styles.statValue, fontSize: isMobile ? '1.1rem' : '1.25rem' }}>{value}</p>
              <p style={styles.statLabel}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Dernières demandes</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => setTab('history')}>Tout voir</button>
        </div>
        {loading ? (
          <div style={styles.center}><div className="spinner spinner-dark" /></div>
        ) : demands.length === 0 ? (
          <div style={styles.empty}>
            <Upload size={28} color="var(--text-muted)" />
            <p>Aucune demande pour l'instant</p>
            <button className="btn btn-primary btn-sm" onClick={() => setTab('upload')}>Soumettre</button>
          </div>
        ) : isMobile ? (
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {demands.slice(0, 5).map(d => <MobileDemandCard key={d.id} d={d} />)}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead><tr>{['Date','Type','Statut','Prix total'].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr></thead>
              <tbody>
                {demands.slice(0, 5).map(d => (
                  <tr key={d.id} style={styles.tr}>
                    <td style={styles.td}>{format(new Date(d.created_at), 'dd MMM yyyy', { locale: fr })}</td>
                    <td style={styles.td}>{typeLabel(d.ordonnance_type)}</td>
                    <td style={styles.td}><StatusBadge status={d.status} /></td>
                    <td style={styles.td}>
                      {d.total_price
                        ? <strong style={{ color: 'var(--teal-dark)' }}>{Number(d.total_price).toLocaleString('fr-DZ')} DA</strong>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryTab({ isMobile }) {
  const [demands, setDemands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nurseModal, setNurseModal] = useState(null); // demand object
  const [nurseSuccess, setNurseSuccess] = useState(null); // demand id
  const [nurseRequested, setNurseRequested] = useState({}); // { demand_id: true }

  const load = () => {
    setLoading(true);
    demandsAPI.list().then(r => setDemands(r.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleNurseSuccess = (demandId) => {
    setNurseModal(null);
    setNurseSuccess(demandId);
    setNurseRequested(prev => ({ ...prev, [demandId]: true }));
    setTimeout(() => setNurseSuccess(null), 4000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {nurseSuccess && (
        <div className="alert alert-success">
          <Stethoscope size={15} style={{ flexShrink: 0 }} />
          Demande d'infirmière envoyée ! Un technicien vous contactera pour confirmer le rendez-vous.
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Mes demandes</h2>
          <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={13} /> Actualiser</button>
        </div>

        {loading ? (
          <div style={styles.center}><div className="spinner spinner-dark" /></div>
        ) : demands.length === 0 ? (
          <div style={styles.empty}><FileText size={28} color="var(--text-muted)" /><p>Aucune demande soumise</p></div>
        ) : isMobile ? (
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {demands.map(d => (
              <MobileDemandCard key={d.id} d={d} showLink
                showNurse={isProcessed(d.status)}
                nurseAlreadyRequested={nurseRequested[d.id]}
                onNurse={() => setNurseModal(d)}
              />
            ))}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>{['Date','Type','Statut','Analyses','Prix total','Fichier','Infirmière'].map(h =>
                  <th key={h} style={styles.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {demands.map(d => (
                  <tr key={d.id} style={styles.tr}>
                    <td style={styles.td}>{format(new Date(d.created_at), 'dd/MM/yyyy HH:mm')}</td>
                    <td style={styles.td}>{typeLabel(d.ordonnance_type)}</td>
                    <td style={styles.td}><StatusBadge status={d.status} /></td>
                    <td style={styles.td}>
                      {d.items?.length > 0
                        ? <span style={{ fontSize: '0.82rem' }}>{d.items.map(i => i.name).join(', ')}</span>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={styles.td}>
                      {d.total_price
                        ? <strong style={{ color: 'var(--teal-dark)' }}>{Number(d.total_price).toLocaleString('fr-DZ')} DA</strong>
                        : <span style={{ color: 'var(--text-muted)' }}>En attente…</span>}
                    </td>
                    <td style={styles.td}>
                      {d.ordonnance_url && d.ordonnance_url !== 'manual'
                        ? <a href={d.ordonnance_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">Voir</a>
                        : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>}
                    </td>
                    <td style={styles.td}>
                      {isProcessed(d.status) ? (
                        nurseRequested[d.id] ? (
                          <span style={{ fontSize: '0.78rem', color: 'var(--teal)', fontWeight: 600 }}>✓ Demandée</span>
                        ) : (
                          <button className="btn btn-sm"
                            style={{ background: 'rgba(233,196,106,0.15)', color: '#92400e', border: '1px solid #fcd34d', gap: 5 }}
                            onClick={() => setNurseModal(d)}>
                            <Stethoscope size={12} /> Infirmière
                          </button>
                        )
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {nurseModal && (
        <NurseRequestModal
          demand={nurseModal}
          onClose={() => setNurseModal(null)}
          onSuccess={() => handleNurseSuccess(nurseModal.id)}
        />
      )}
    </div>
  );
}

function MobileDemandCard({ d, showLink, showNurse, nurseAlreadyRequested, onNurse }) {
  return (
    <div style={{
      background: 'var(--cream)', borderRadius: 'var(--radius-md)', padding: '12px 14px',
      borderLeft: `3px solid ${d.status === 'pending' ? 'var(--gold)' : 'var(--teal)'}`,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {format(new Date(d.created_at), 'dd MMM yyyy', { locale: fr })}
        </span>
        <StatusBadge status={d.status} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.85rem' }}>{typeLabel(d.ordonnance_type)}</span>
        {d.total_price
          ? <strong style={{ color: 'var(--teal-dark)', fontSize: '0.92rem' }}>{Number(d.total_price).toLocaleString('fr-DZ')} DA</strong>
          : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Prix en attente…</span>}
      </div>
      {d.items?.length > 0 && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
          {d.items.map(i => i.name).join(' · ')}
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
        {showLink && d.ordonnance_url && d.ordonnance_url !== 'manual' && (
          <a href={d.ordonnance_url} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: '0.8rem', color: 'var(--teal)', fontWeight: 600 }}>
            Voir l'ordonnance →
          </a>
        )}
        {showNurse && (
          nurseAlreadyRequested ? (
            <span style={{ fontSize: '0.78rem', color: 'var(--teal)', fontWeight: 600 }}>🩺 Infirmière demandée</span>
          ) : (
            <button onClick={onNurse}
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(233,196,106,0.15)',
                color: '#92400e', border: '1px solid #fcd34d', borderRadius: 6,
                padding: '4px 10px', fontSize: '0.78rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-body)',
                WebkitTapHighlightColor: 'transparent' }}>
              <Stethoscope size={12} /> Demander une infirmière
            </button>
          )
        )}
      </div>
    </div>
  );
}

const styles = {
  sidebar: {
    width: 210, flexShrink: 0, background: 'white',
    borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)',
    padding: '10px 8px', position: 'sticky', top: 76,
  },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
    borderRadius: 'var(--radius-sm)', border: 'none', background: 'none',
    color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-body)',
    fontSize: '0.88rem', fontWeight: 500, transition: 'all 0.15s',
    textAlign: 'left', width: '100%', WebkitTapHighlightColor: 'transparent',
  },
  navActive: { background: 'rgba(10,147,150,0.08)', color: 'var(--teal-dark)' },
  navLocked: { opacity: 0.35, cursor: 'not-allowed' },
  blockerCard: {
    background: 'white', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)',
    padding: '48px 32px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 18, textAlign: 'center',
  },
  blockerIcon: {
    width: 72, height: 72, borderRadius: '50%',
    background: 'rgba(10,147,150,0.1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  requiredBadge: {
    background: 'var(--coral)', color: 'white', padding: '2px 10px',
    borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  statCard: {
    background: 'white', borderRadius: 'var(--radius-md)', padding: '12px 14px',
    display: 'flex', alignItems: 'center', gap: 10, boxShadow: 'var(--shadow-sm)',
  },
  statIcon: {
    width: 36, height: 36, borderRadius: 8, background: 'var(--cream)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  statValue: { fontFamily: 'var(--font-display)', margin: 0, color: 'var(--navy)' },
  statLabel: { fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 },
  center: { display: 'flex', justifyContent: 'center', padding: 40 },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 12, padding: '40px 20px', color: 'var(--text-muted)', fontSize: '0.9rem',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '9px 14px', background: 'var(--cream-dark)', fontSize: '0.7rem',
    fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
    letterSpacing: '0.06em', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
  },
  tr: { borderBottom: '1px solid var(--border)' },
  td: { padding: '10px 14px', fontSize: '0.85rem', verticalAlign: 'middle' },
 bottomNav: {
  position: 'fixed',
  bottom: 16,
  left: 16,
  right: 16,

  height: 64,
  background: 'rgba(255,255,255,0.95)',
  backdropFilter: 'blur(20px)',

  borderRadius: 999,
  border: '1px solid rgba(0,0,0,0.05)',

  boxShadow:
    '0 8px 30px rgba(13,27,42,0.12), 0 2px 8px rgba(13,27,42,0.08)',

  display: 'flex',
  alignItems: 'center',
  padding: 6,

  zIndex: 200,
},

bottomItem: {
  flex: 1,
  height: '100%',

  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,

  background: 'transparent',
  border: 'none',
  borderRadius: 999,

  color: 'var(--text-muted)',
  cursor: 'pointer',
  position: 'relative',

  transition: 'all 0.25s ease',
  WebkitTapHighlightColor: 'transparent',
},

bottomItemActive: {
  background: 'var(--teal)',
  color: '#fff',
  boxShadow: '0 4px 12px rgba(0, 180, 180, 0.25)',
},
  bottomDot: {
    position: 'absolute', top: 8, right: 'calc(50% - 16px)',
    width: 7, height: 7, borderRadius: '50%', background: 'var(--coral)',
  },
};