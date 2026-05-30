import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { demandsAPI, servicesAPI } from '../services/api';
import {
  Upload, FileImage, Scan, PenLine, CheckCircle,
  AlertCircle, X, DollarSign, FlaskConical, ListChecks
} from 'lucide-react';

export default function OrdonnanceUpload({ onSuccess }) {
  const [type, setType] = useState(null); // 'ocr' | 'handwritten' | 'manual'
  const [file, setFile] = useState(null);
  const [services, setServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    servicesAPI.list().then(res => setServices(res.data)).catch(() => {});
  }, []);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError('');
      setResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [], 'image/tiff': [] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    onDropRejected: (files) => {
      const err = files[0]?.errors[0];
      if (err?.code === 'file-too-large') setError('Le fichier est trop volumineux (max 10 Mo)');
      else if (err?.code === 'file-invalid-type') setError('Format non supporté. Utilisez JPEG, PNG ou WEBP');
      else setError('Fichier invalide');
    },
  });

  const toggleService = (id) => {
    setSelectedServices(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const totalPreview = selectedServices.reduce((sum, id) => {
    const s = services.find(s => s.id === id);
    return sum + (s ? parseFloat(s.price) : 0);
  }, 0);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      if (type === 'manual') {
        if (selectedServices.length === 0) {
          setError('Sélectionnez au moins une analyse');
          setLoading(false);
          return;
        }
        const formData = new FormData();
        formData.append('ordonnance_type', 'manual');
        formData.append('service_ids', JSON.stringify(selectedServices));
        const res = await demandsAPI.submit(formData);
        setResult(res.data);
        if (onSuccess) onSuccess(res.data);
      } else {
        if (!file) return;
        const formData = new FormData();
        formData.append('ordonnance', file);
        formData.append('ordonnance_type', type);
        const res = await demandsAPI.submit(formData);
        setResult(res.data);
        if (onSuccess) onSuccess(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la soumission');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setType(null);
    setResult(null);
    setError('');
    setSelectedServices([]);
  };

  if (result) return <SubmitResult result={result} onReset={reset} />;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Upload size={20} color="var(--teal)" />
        <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Soumettre une demande d'analyse</h3>
      </div>

      {/* Step 1 — type selection */}
      {!type && (
        <div>
          <p style={styles.label}>Comment souhaitez-vous soumettre votre demande ?</p>
          <div style={styles.typeGrid}>
            <button style={styles.typeCard} onClick={() => setType('ocr')}>
              <Scan size={28} color="var(--teal)" />
              <strong>Ordonnance imprimée</strong>
              <span>Scannez l'ordonnance — traitement OCR automatique</span>
            </button>
            <button style={styles.typeCard} onClick={() => setType('handwritten')}>
              <PenLine size={28} color="var(--coral)" />
              <strong>Ordonnance manuscrite</strong>
              <span>Uploadez la photo — un technicien la traitera</span>
            </button>
            <button style={{ ...styles.typeCard, gridColumn: '1 / -1' }} onClick={() => setType('manual')}>
              <ListChecks size={28} color="var(--gold)" />
              <strong>Sélection manuelle</strong>
              <span>Vous connaissez vos analyses — choisissez-les directement sans uploader de fichier</span>
            </button>
          </div>
        </div>
      )}

      {/* Type indicator + change button */}
      {type && (
        <div style={styles.typeIndicator}>
          {type === 'ocr' && <><Scan size={14} color="var(--teal)" /> Ordonnance imprimée (OCR)</>}
          {type === 'handwritten' && <><PenLine size={14} color="var(--coral)" /> Ordonnance manuscrite</>}
          {type === 'manual' && <><ListChecks size={14} color="var(--gold)" /> Sélection manuelle</>}
          <button onClick={reset} style={styles.changeBtn}><X size={12} /> Changer</button>
        </div>
      )}

      {/* Manual — service checklist */}
      {type === 'manual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={styles.label}>Sélectionnez les analyses dont vous avez besoin :</p>
          <div style={styles.checkList}>
            {services.map((s) => (
              <label key={s.id} style={{
                ...styles.checkItem,
                background: selectedServices.includes(s.id) ? 'rgba(10,147,150,0.07)' : 'white',
                borderColor: selectedServices.includes(s.id) ? 'var(--teal)' : 'var(--border)',
              }}>
                <input
                  type="checkbox"
                  checked={selectedServices.includes(s.id)}
                  onChange={() => toggleService(s.id)}
                  style={{ width: 'auto', accentColor: 'var(--teal)', flexShrink: 0 }}
                />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 500, fontSize: '0.9rem' }}>{s.name}</p>
                  <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)' }}>{s.code}</p>
                </div>
               
              </label>
            ))}
          </div>

          {selectedServices.length > 0 && (
            <div style={styles.totalPreview}>
              <DollarSign size={15} />
              <span>Total estimé : <strong>{totalPreview.toLocaleString('fr-DZ')} DA</strong></span>
            </div>
          )}
        </div>
      )}

      {/* OCR / Handwritten — file upload */}
      {(type === 'ocr' || type === 'handwritten') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!file ? (
            <div {...getRootProps()} style={{
              ...styles.dropzone,
              borderColor: isDragActive ? 'var(--teal)' : 'var(--border)',
              background: isDragActive ? 'rgba(10,147,150,0.04)' : 'white',
            }}>
              <input {...getInputProps()} />
              <FileImage size={36} color={isDragActive ? 'var(--teal)' : 'var(--text-muted)'} />
              <p style={styles.dropText}>
                {isDragActive ? 'Déposez ici…' : 'Glissez votre ordonnance ici'}
              </p>
              <p style={styles.dropHint}>ou cliquez pour parcourir — JPEG, PNG, WEBP (max 10 Mo)</p>
            </div>
          ) : (
            <div style={styles.filePreview}>
              <div style={styles.fileInfo}>
                <FileImage size={18} color="var(--teal)" />
                <div>
                  <p style={{ fontWeight: 500, fontSize: '0.9rem', margin: 0 }}>{file.name}</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                    {(file.size / 1024).toFixed(0)} Ko
                  </p>
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setFile(null)}>
                <X size={12} /> Changer
              </button>
            </div>
          )}

          {file && (
            <div style={styles.imgPreview}>
              <img
                src={URL.createObjectURL(file)}
                alt="Ordonnance"
                style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, objectFit: 'contain' }}
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {type && (type === 'manual' ? selectedServices.length > 0 : !!file) && (
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={loading}
          style={{ alignSelf: 'flex-start' }}
        >
          {loading
            ? <><span className="spinner" /> Traitement en cours…</>
            : <><Upload size={15} /> Soumettre la demande</>
          }
        </button>
      )}
    </div>
  );
}

function SubmitResult({ result, onReset }) {
  const isImmediate = ['ocr_processed', 'processed'].includes(result.status);
  const hasServices = result.matched_services?.length > 0;

  return (
    <div style={styles.resultBox}>
      <div style={styles.resultHeader}>
        {isImmediate && hasServices
          ? <CheckCircle size={28} color="var(--teal)" />
          : <FlaskConical size={28} color="var(--gold)" />
        }
        <div>
          <h4 style={{ margin: 0, fontSize: '1.05rem' }}>
            {isImmediate ? 'Demande traitée avec succès' : 'Demande soumise'}
          </h4>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{result.message}</p>
        </div>
      </div>

      {hasServices && (
        <div style={styles.servicesList}>
          <p style={styles.servicesTitle}>Analyses :</p>
          {result.matched_services.map((s) => (
            <div key={s.id} style={styles.serviceItem}>
              <span>{s.name}</span>
              <span style={styles.price}>{Number(s.price).toLocaleString('fr-DZ')} DA</span>
            </div>
          ))}
          <div style={styles.totalRow}>
            <span><DollarSign size={14} /> Total</span>
            <span>{Number(result.total_price).toLocaleString('fr-DZ')} DA</span>
          </div>
        </div>
      )}

      {!isImmediate && (
        <div className="alert alert-info">
          <FlaskConical size={15} />
          Un technicien de laboratoire va analyser votre ordonnance et vous communiquera le prix.
        </div>
      )}

      <button className="btn btn-secondary btn-sm" onClick={onReset}>
        Soumettre une autre demande
      </button>
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: 20 },
  header: {
    display: 'flex', alignItems: 'center', gap: 8,
    paddingBottom: 16, borderBottom: '1px solid var(--border)',
  },
  label: { fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: 4 },
  typeGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  typeCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    padding: '22px 16px', border: '2px dashed var(--border)',
    borderRadius: 'var(--radius-md)', background: 'white',
    cursor: 'pointer', transition: 'all 0.2s ease',
    fontFamily: 'var(--font-body)', textAlign: 'center',
    fontSize: '0.82rem', color: 'var(--text-muted)',
  },
  typeIndicator: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 500,
  },
  changeBtn: {
    display: 'flex', alignItems: 'center', gap: 4,
    background: 'none', border: 'none', color: 'var(--coral)',
    cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'var(--font-body)', marginLeft: 'auto',
  },
  checkList: { display: 'flex', flexDirection: 'column', gap: 8 },
  checkItem: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 14px', borderRadius: 'var(--radius-sm)',
    border: '1.5px solid', cursor: 'pointer', transition: 'all 0.15s',
  },
  totalPreview: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'var(--teal)', color: 'white',
    padding: '10px 16px', borderRadius: 'var(--radius-sm)', fontSize: '0.92rem',
  },
  dropzone: {
    border: '2px dashed', borderRadius: 'var(--radius-md)',
    padding: '40px 24px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 10, cursor: 'pointer', transition: 'all 0.2s ease',
  },
  dropText: { fontWeight: 500, fontSize: '0.95rem', color: 'var(--navy)' },
  dropHint: { fontSize: '0.78rem', color: 'var(--text-muted)' },
  filePreview: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', background: 'rgba(10,147,150,0.05)',
    borderRadius: 'var(--radius-sm)', border: '1.5px solid rgba(10,147,150,0.2)',
  },
  fileInfo: { display: 'flex', alignItems: 'center', gap: 10 },
  imgPreview: {
    display: 'flex', justifyContent: 'center',
    padding: 12, background: 'var(--cream-dark)', borderRadius: 'var(--radius-md)',
  },
  resultBox: { display: 'flex', flexDirection: 'column', gap: 16 },
  resultHeader: {
    display: 'flex', alignItems: 'flex-start', gap: 14, padding: 16,
    background: 'rgba(10,147,150,0.05)', borderRadius: 'var(--radius-md)',
    border: '1.5px solid rgba(10,147,150,0.15)',
  },
  servicesList: { border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' },
  servicesTitle: {
    padding: '10px 16px', background: 'var(--cream-dark)', fontSize: '0.82rem',
    fontWeight: 600, color: 'var(--navy)', borderBottom: '1px solid var(--border)',
    margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  serviceItem: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: '0.88rem',
  },
  price: { fontWeight: 600, color: 'var(--teal-dark)' },
  totalRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 16px', background: 'var(--navy)', color: 'white',
    fontSize: '0.9rem', fontWeight: 700,
  },
};