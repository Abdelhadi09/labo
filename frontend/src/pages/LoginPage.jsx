import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { FlaskConical, AlertCircle, Mail, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const isMobile = useIsMobile();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {!isMobile && <LeftPanel />}
      <div style={{
        flex: isMobile ? '1 1 auto' : '0 0 480px',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: isMobile ? 'flex-start' : 'center',
        padding: isMobile ? '40px 20px 32px' : '40px 36px',
        background: 'var(--cream)', overflowY: 'auto',
      }}>
        {isMobile && <MobileLogo />}
        <ClientLoginForm isMobile={isMobile} />
      </div>
    </div>
  );
}

function LeftPanel() {
  return (
    <div style={{ flex: 1, background: 'linear-gradient(145deg, var(--navy) 0%, var(--teal-dark) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 48px' }}>
      <div style={{ maxWidth: 420 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
          <FlaskConical size={32} color="white" />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'white' }}>BioLin Analyse</span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem,3vw,3rem)', color: 'white', lineHeight: 1.15, marginBottom: 20 }}>
          Votre santé,<br /><em>notre priorité.</em>
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '1rem', lineHeight: 1.7, marginBottom: 36 }}>
          Plateforme de gestion des analyses médicales — soumettez vos ordonnances, suivez vos résultats.
        </p>
        
      </div>
    </div>
  );
}

function MobileLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, alignSelf: 'flex-start', width: '100%', maxWidth: 420 }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, var(--teal) 0%, var(--teal-dark) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FlaskConical size={26} color="white" />
      </div>
      <div>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--navy)', margin: 0 }}>BioLin Analyse</p>
      </div>
    </div>
  );
}

function ClientLoginForm({ isMobile }) {
  const { signInEmail, sendEmailOTP, verifyEmailOTP, signInWithGoogle, workerLogin } = useAuth();
  const navigate = useNavigate();

  const [method, setMethod] = useState('email'); // 'email' | 'emailotp' | 'worker'
  const [step, setStep] = useState(1);           // 1=input, 2=otp
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [workerUser, setWorkerUser] = useState('');
  const [workerPwd, setWorkerPwd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const reset = (m) => { setMethod(m); setStep(1); setError(''); setInfo(''); setOtpCode(''); };

  // Email + password login
  const handleEmailLogin = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await signInEmail(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  // Send email OTP
  const handleSendEmailOTP = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await sendEmailOTP(email);
      setStep(2);
      setInfo(`Un code a été envoyé à ${email}`);
    } catch (err) {
      setError(err.message || "Erreur d'envoi");
    } finally {
      setLoading(false);
    }
  };

  // Verify email OTP
  const handleVerifyEmailOTP = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await verifyEmailOTP(email, otpCode);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Code invalide');
    } finally {
      setLoading(false);
    }
  };

  // Worker login
  const handleWorkerLogin = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await workerLogin({ username: workerUser, password: workerPwd });
      navigate('/worker');
    } catch (err) {
      setError(err.response?.data?.error || 'Identifiants invalides');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', marginBottom: 4 , textAlign: isMobile ? 'center' : 'left' }}>
        {method === 'worker' ? 'Espace technicien' : 'Connexion'}
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 24 ,  textAlign: isMobile ? 'center' : 'left' }}>
        {method === 'worker' ? 'Accès réservé au personnel du laboratoire' : 'Accédez à votre espace patient'}
      </p>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}><AlertCircle size={14} style={{ flexShrink: 0 }} />{error}</div>}
      {info  && <div className="alert alert-info"  style={{ marginBottom: 16 }}>{info}</div>}

      {/* ── Worker form ── */}
      {method === 'worker' && (
        <form onSubmit={handleWorkerLogin} style={S.form}>
          <div className="form-group">
            <label>Nom d'utilisateur</label>
            <input type="text" value={workerUser} onChange={e => setWorkerUser(e.target.value)} placeholder="Username" autoCapitalize="none" required />
          </div>
          <div className="form-group">
            <label>Mot de passe</label>
            <div style={{ position: 'relative' }}>
              <input type={showPwd ? 'text' : 'password'} value={workerPwd} onChange={e => setWorkerPwd(e.target.value)} placeholder="••••••••" required style={{ paddingRight: 40 }} />
              <button type="button" onClick={() => setShowPwd(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-navy btn-lg btn-block" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Se connecter'}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => reset('email')} style={{ alignSelf: 'flex-start' }}>
            <ArrowLeft size={13} /> Espace client
          </button>
        </form>
      )}

      {/* ── Client forms ── */}
      {method !== 'worker' && (
        <>
          {/* Method tabs */}
          <div style={S.methodTabs}>
            {[
              { id: 'email',    label: ' Email' },
              { id: 'emailotp', label: ' Code email' },
            ].map(m => (
              <button key={m.id}
                style={{ ...S.methodTab, ...(method === m.id ? S.methodTabActive : {}) }}
                onClick={() => reset(m.id)}>
                {m.label}
              </button>
            ))}
          </div>

          {/* Email + password */}
          {method === 'email' && (
            <form onSubmit={handleEmailLogin} style={S.form}>
              <div className="form-group">
                <label>Adresse e-mail</label>
                <input type="email" style={S.input} value={email} onChange={e => setEmail(e.target.value)} placeholder="Adresse e-mail" required />
              </div>
              <div className="form-group">
                <label>Mot de passe</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPwd ? 'text' : 'password'} style={S.input} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
                  <button type="button" onClick={() => setShowPwd(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-lg btn-block" style={S.btnStyle} disabled={loading}>
                {loading ? <span className="spinner" /> : 'Se connecter'}
              </button>
            </form>
          )}

          {/* Email OTP — step 1: enter address */}
          {method === 'emailotp' && step === 1 && (
            <form onSubmit={handleSendEmailOTP} style={S.form}>
              <div className="form-group">
                <label>Adresse e-mail</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@exemple.com" required />
              </div>
              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
                {loading ? <span className="spinner" /> : <><Mail size={15} /> Envoyer le code</>}
              </button>
            </form>
          )}

          {/* Email OTP — step 2: enter code */}
          {method === 'emailotp' && step === 2 && (
            <form onSubmit={handleVerifyEmailOTP} style={S.form}>
              <div className="form-group">
                <label>Code reçu par e-mail</label>
                <input type="text" inputMode="numeric" value={otpCode} onChange={e => setOtpCode(e.target.value)} placeholder="123456" maxLength={15} style={{ letterSpacing: '0.3em', fontSize: '1.3rem', textAlign: 'center' }} required />
              </div>
              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Vérifier le code'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setStep(1); setOtpCode(''); setInfo(''); }}>
                <ArrowLeft size={13} /> Modifier l'adresse
              </button>
            </form>
          )}

          {/* Google */}
          <div style={S.divider}><span style={S.divLine} /><span style={S.divText}>ou</span><span style={S.divLine} /></div>
          <button className="btn btn-block" onClick={signInWithGoogle}
            style={{ background: 'white', border: '1.5px solid var(--border)', color: 'var(--text-dark)', gap: 10, marginBottom: 20 }}>
            <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.706c-.18-.54-.282-1.117-.282-1.706s.102-1.166.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58z"/></svg>
            Continuer avec Google
          </button>

          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
            Pas encore de compte ?{' '}
            <Link to="/register" style={{ color: 'var(--teal)', fontWeight: 600 }}>Créer un compte</Link>
          </p>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, textAlign: 'center' }}>
            <button onClick={() => reset('worker')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--teal)', fontFamily: 'var(--font-body)' }}>
               Accès technicien de laboratoire
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const S = {
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  methodTabs: { display: 'flex', background: 'var(--cream-dark)', borderRadius: 16, padding: 4, gap: 3, marginBottom: 20 },
  methodTab: { flex: 1, padding: '8px 4px', border: 'none', background: 'none', borderRadius: 12, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)', transition: 'all 0.15s', WebkitTapHighlightColor: 'transparent' },
  methodTabActive: { background: 'white', color: 'var(--navy)', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  divider: { display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' },
  divLine: { flex: 1, height: 1, background: 'var(--border)', display: 'block' },
  divText: { color: 'var(--text-muted)', fontSize: '0.82rem', flexShrink: 0 },
  input: { width: '100%', padding: '12px 14px', borderRadius: 24, border: '1.5px solid var(--border)', fontSize: '16px', fontFamily: 'var(--font-body)' , background: 'white', color: 'var(--text-dark)' , transition: 'border-color var(--transition)' , boxShadow : 'var (--transition)' , outline : 'none' },
 btnStyle: {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '14px 30px',
  borderRadius: 24,
  fontFamily: 'var(--font-body)',
  fontSize: '1rem',
  fontWeight: 500,
  border: 'none',
  cursor: 'pointer',
  transition: 'all var(--transition)',
  whiteSpace: 'nowrap',
  WebkitTapHighlightColor: 'transparent',
  touchAction: 'manipulation',
},
};
