import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FlaskConical, AlertCircle, Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export default function RegisterPage() {
  const { signUpEmail, sendEmailOTP, verifyEmailOTP, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const [method, setMethod] = useState('email'); // 'email' | 'emailotp'
  const [step, setStep]     = useState(1);
  const [email, setEmail]   = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [otp, setOtp]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [info, setInfo]     = useState('');
  const [done, setDone]     = useState(false);

  const reset = (m) => { setMethod(m); setStep(1); setError(''); setInfo(''); setOtp(''); };

  // Email + password sign-up — Supabase sends a confirmation email
  const handleEmailSignUp = async (e) => {
    e.preventDefault(); setError('');
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas'); return; }
    if (password.length < 8)  { setError('Mot de passe trop court (8 caractères min)'); return; }
    setLoading(true);
    try {
      await signUpEmail(email, password);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Passwordless OTP — step 1: send code
  const handleSendEmailOTP = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await sendEmailOTP(email);
      setStep(2);
      setInfo(`Code envoyé à ${email}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Passwordless OTP — step 2: verify and log in immediately
  const handleVerifyEmailOTP = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await verifyEmailOTP(email, otp);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Code invalide');
    } finally {
      setLoading(false);
    }
  };

  // Confirmation screen shown after email + password sign-up
  if (done) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '48px 36px', maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(10,147,150,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <CheckCircle size={32} color="var(--teal)" />
        </div>
        <h2 style={{ marginBottom: 12 }}>Vérifiez votre e-mail</h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Un lien de confirmation a été envoyé à <strong>{email}</strong>.<br />
          Cliquez sur ce lien pour activer votre compte.
        </p>
        <Link to="/login" className="btn btn-primary" style={{ display: 'inline-flex', marginTop: 24 }}>
          Retour à la connexion
        </Link>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {!isMobile && (
        <div style={{ flex: 1, background: 'linear-gradient(145deg, var(--teal-dark) 0%, var(--navy) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 48px' }}>
          <div style={{ maxWidth: 400 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
              <FlaskConical size={32} color="white" />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'white' }}>BioLin Analyse</span>
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.6rem', color: 'white', lineHeight: 1.15, marginBottom: 24 }}>Rejoignez<br /><em>notre réseau.</em></h1>
            {['Inscription rapide et sécurisée', 'Vérification par e-mail ou Google', 'Accès à vos analyses en ligne'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <CheckCircle size={16} color="var(--teal-light)" />
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.92rem' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ flex: isMobile ? '1 1 auto' : '0 0 480px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: isMobile ? 'flex-start' : 'center', padding: isMobile ? '40px 20px 32px' : '40px 36px', background: 'var(--cream)', overflowY: 'auto' }}>
        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 44, alignSelf: 'flex-start', width: '100%' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,var(--teal),var(--teal-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FlaskConical size={22} color="white" />
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--navy)' }}>BioLin Analyse</span>
          </div>
        )}

        <div style={{ width: '100%', maxWidth: 420 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', marginBottom: 40, textAlign: isMobile ? 'center' : 'left' }}>Créer un compte</h2>

          {error && <div className="alert alert-error" style={{ marginBottom: 16 }}><AlertCircle size={14} style={{ flexShrink: 0 }} />{error}</div>}
          {info  && <div className="alert alert-info"  style={{ marginBottom: 16 }}>{info}</div>}

          {/* Method tabs 
          , { id: 'emailotp', label: '🔑 Code email' }
          */}
         

          {/* Email + password */}
          {method === 'email' && (
            <form onSubmit={handleEmailSignUp} style={S.form}>
              <div className="form-group">
                <label>Adresse e-mail</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@exemple.com" required />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label>Mot de passe</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 caractères" required />
                </div>
                <div className="form-group">
                  <label>Confirmer</label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Répétez" required />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Créer mon compte'}
              </button>
            </form>
          )}

          {/* Email OTP — step 1 */}
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

          {/* Email OTP — step 2 */}
          {method === 'emailotp' && step === 2 && (
            <form onSubmit={handleVerifyEmailOTP} style={S.form}>
              <div className="form-group">
                <label>Code reçu par e-mail</label>
                <input type="text" inputMode="numeric" value={otp} onChange={e => setOtp(e.target.value)} placeholder="123456" maxLength={15} style={{ letterSpacing: '0.3em', fontSize: '1.3rem', textAlign: 'center' }} required />
              </div>
              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Vérifier et créer mon compte'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setStep(1); setOtp(''); setInfo(''); }}>
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

          <p style={{ textAlign: 'center', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Déjà inscrit ?{' '}
            <Link to="/login" style={{ color: 'var(--teal)', fontWeight: 600 }}>Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const S = {
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  methodTabs: { display: 'flex', background: 'var(--cream-dark)', borderRadius: 'var(--radius-sm)', padding: 4, gap: 3, marginBottom: 20 },
  methodTab: { flex: 1, padding: '8px 4px', border: 'none', background: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)', transition: 'all 0.15s', WebkitTapHighlightColor: 'transparent' },
  methodTabActive: { background: 'white', color: 'var(--navy)', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  divider: { display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' },
  divLine: { flex: 1, height: 1, background: 'var(--border)', display: 'block' },
  divText: { color: 'var(--text-muted)', fontSize: '0.82rem', flexShrink: 0 },
};
