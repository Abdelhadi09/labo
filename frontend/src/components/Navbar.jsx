import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../hooks/useIsMobile';
import { FlaskConical, LogOut, User, ChevronDown } from 'lucide-react';

export default function Navbar({ role }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const fn = () => setOpen(false);
    window.addEventListener('click', fn);
    return () => window.removeEventListener('click', fn);
  }, [open]);

  return (
    <header style={styles.navbar}>
      <div style={styles.inner}>
        {/* Brand */}
        <div style={styles.brand}>
          <FlaskConical size={22} color="var(--teal)" />
          <span style={styles.brandText}>BioLin</span>
          <span style={styles.roleTag}>{role === 'worker' ? 'Technicien' : 'Client'}</span>
        </div>

        {/* Desktop actions */}
        {!isMobile && (
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={styles.avatar}><User size={14} color="var(--teal)" /></div>
              <span style={{ fontSize:'0.88rem', fontWeight:500, color:'var(--navy)' }}>{user?.username}</span>
            </div>
            <button onClick={handleLogout} className="btn btn-secondary btn-sm">
              <LogOut size={13} /> Déconnexion
            </button>
          </div>
        )}

        {/* Mobile: user pill + dropdown */}
        {isMobile && (
          <div style={{ position:'relative' }}>
            <button
              style={styles.userPill}
              onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
            >
              <div style={styles.avatarSm}><User size={13} color="var(--teal)" /></div>
              <span style={{ fontSize:'0.8rem', fontWeight:500, color:'var(--navy)', maxWidth:90,
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {user?.username}
              </span>
              <ChevronDown size={13} color="var(--text-muted)"
                style={{ transform: open ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }} />
            </button>

            {open && (
              <div style={styles.dropdown} onClick={e => e.stopPropagation()}>
                <button style={styles.dropdownItem} onClick={handleLogout}>
                  <LogOut size={15} color="var(--coral)" /> Se déconnecter
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

const styles = {
  navbar: {
    background:'white', borderBottom:'1px solid var(--border)',
    position:'sticky', top:0, zIndex:150, boxShadow:'var(--shadow-sm)',
  },
  inner: {
    maxWidth:1200, margin:'0 auto', padding:'0 16px',
    height:'var(--navbar-h)', display:'flex',
    alignItems:'center', justifyContent:'space-between',
  },
  brand: { display:'flex', alignItems:'center', gap:8 },
  brandText: { fontFamily:'var(--font-display)', fontSize:'1.15rem', color:'var(--navy)' },
  roleTag: {
    background:'var(--teal)', color:'white', padding:'2px 8px',
    borderRadius:20, fontSize:'0.66rem', fontWeight:600,
    textTransform:'uppercase', letterSpacing:'0.05em',
  },
  avatar: {
    width:30, height:30, borderRadius:'50%',
    background:'rgba(10,147,150,0.1)',
    display:'flex', alignItems:'center', justifyContent:'center',
  },
  avatarSm: {
    width:24, height:24, borderRadius:'50%',
    background:'rgba(10,147,150,0.1)',
    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
  },
  userPill: {
    display:'flex', alignItems:'center', gap:6,
    padding:'5px 10px', background:'var(--cream)',
    border:'1.5px solid var(--border)', borderRadius:20,
    cursor:'pointer', fontFamily:'var(--font-body)',
    WebkitTapHighlightColor:'transparent',
  },
  dropdown: {
    position:'absolute', right:0, top:'calc(100% + 8px)',
    background:'white', borderRadius:'var(--radius-md)',
    boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)',
    minWidth:180, overflow:'hidden', zIndex:300,
  },
  dropdownItem: {
    display:'flex', alignItems:'center', gap:10,
    width:'100%', padding:'12px 16px',
    background:'none', border:'none', cursor:'pointer',
    fontFamily:'var(--font-body)', fontSize:'0.9rem', color:'var(--text-dark)',
    textAlign:'left', WebkitTapHighlightColor:'transparent',
  },
};