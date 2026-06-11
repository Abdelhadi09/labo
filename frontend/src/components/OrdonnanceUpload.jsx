import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { demandsAPI, servicesAPI } from '../services/api';
import {
  Upload, FileImage, Scan, PenLine, CheckCircle,
  AlertCircle, X, DollarSign, FlaskConical, ListChecks,
  Search, ChevronDown
} from 'lucide-react';

/* ─────────────────────────────────────────────
   Fuzzy / keyword matcher
   Matches against name, code, and keywords field
───────────────────────────────────────────── */
function normalize(str = '') {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9\s]/g, '');
}

function matchesQuery(service, query) {
  if (!query.trim()) return true;
  const q = normalize(query);
  const haystack = normalize(
    [service.name, service.code, service.keywords || ''].join(' ')
  );
  // Every word of the query must appear somewhere
  return q.split(/\s+/).every(word => haystack.includes(word));
}

/* ─────────────────────────────────────────────
   Main component
───────────────────────────────────────────── */
export default function OrdonnanceUpload({ onSuccess }) {
  const [type, setType] = useState(null); // 'ocr' | 'handwritten' | 'manual'
  const [file, setFile] = useState(null);
  const [services, setServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // Search / filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [showSelected, setShowSelected] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    servicesAPI.list().then(res => setServices(res.data)).catch(() => {});
  }, []);

  // Focus search when manual mode is entered
  useEffect(() => {
    if (type === 'manual' && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [type]);

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
    setSearchQuery('');
    setShowSelected(false);
  };

  if (result) return <SubmitResult result={result} onReset={reset} />;

  // Filtered services list
  const visibleServices = showSelected
    ? services.filter(s => selectedServices.includes(s.id))
    : services.filter(s => matchesQuery(s, searchQuery));

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

      {/* ── Manual — service checklist with search ── */}
      {type === 'manual' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Search bar */}
          <div style={styles.searchWrap}>
            <Search size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <input
              ref={searchRef}
              type="text"
              placeholder="Rechercher une analyse… (ex : glycémie, NFS, TSH)"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowSelected(false); }}
              style={styles.searchInput}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={styles.clearBtn}
                title="Effacer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filter chips */}
          <div style={styles.filterRow}>
            <span style={styles.filterLabel}>Afficher :</span>
            <button
              style={{ ...styles.chip, ...((!showSelected && !searchQuery) ? styles.chipActive : {}) }}
              onClick={() => { setShowSelected(false); setSearchQuery(''); }}
            >
              Toutes ({services.length})
            </button>
            <button
              style={{ ...styles.chip, ...(showSelected ? styles.chipActive : {}) }}
              onClick={() => { setShowSelected(true); setSearchQuery(''); }}
            >
              <CheckCircle size={12} />
              Sélectionnées ({selectedServices.length})
            </button>
          </div>

          {/* Results count */}
          {searchQuery && (
            <p style={styles.resultCount}>
              {visibleServices.length === 0
                ? 'Aucun résultat'
                : `${visibleServices.length} analyse${visibleServices.length > 1 ? 's' : ''} trouvée${visibleServices.length > 1 ? 's' : ''}`}
            </p>
          )}

          {/* Checklist */}
          <div style={styles.checkList}>
            {visibleServices.length === 0 && (
              <div style={styles.emptyState}>
                <Search size={28} color="var(--text-muted)" style={{ opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  {showSelected
                    ? 'Aucune analyse sélectionnée.'
                    : 'Aucun résultat pour cette recherche.'}
                </p>
              </div>
            )}

            {visibleServices.map((s) => {
              const isSelected = selectedServices.includes(s.id);
              return (
                <label key={s.id} style={{
                  ...styles.checkItem,
                  background: isSelected ? 'rgba(10,147,150,0.07)' : 'white',
                  borderColor: isSelected ? 'var(--teal)' : 'var(--border)',
                }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleService(s.id)}
                    style={{ width: 'auto', accentColor: 'var(--teal)', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 500, fontSize: '0.9rem' }}>
                      {highlight(s.name, searchQuery)}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      {s.code}
                    </p>
                  </div>

                </label>
              );
            })}
          </div>

          {selectedServices.length > 0 && (
            <div style={styles.selectionCount}>
              <CheckCircle size={14} color="var(--teal)" />
              <span>
                {selectedServices.length} analyse{selectedServices.length > 1 ? 's' : ''} sélectionnée{selectedServices.length > 1 ? 's' : ''}
              </span>
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

/* ─────────────────────────────────────────────
   Highlight matched text in service names
───────────────────────────────────────────── */
function highlight(text, query) {
  if (!query.trim()) return text;
  const word = query.trim().split(/\s+/)[0]; // highlight first word only for simplicity
  const normWord = normalize(word);
  const normText = normalize(text);
  const idx = normText.indexOf(normWord);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(10,147,150,0.18)', color: 'inherit', borderRadius: 2, padding: '0 2px' }}>
        {text.slice(idx, idx + word.length)}
      </mark>
      {text.slice(idx + word.length)}
    </>
  );
}

/* ─────────────────────────────────────────────
   Submit result panel (unchanged logic)
───────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────
   Styles
───────────────────────────────────────────── */
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

  // ── Search ──
  searchWrap: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 14px',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'white',
    transition: 'border-color 0.15s',
  },
  searchInput: {
    flex: 1, border: 'none', outline: 'none',
    fontSize: '0.88rem', fontFamily: 'var(--font-body)',
    background: 'transparent', color: 'var(--navy)',
    minWidth: 0,
  },
  clearBtn: {
    display: 'flex', alignItems: 'center',
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted)', padding: 2, flexShrink: 0,
  },
  filterRow: {
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
  },
  filterLabel: { fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: 2 },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '4px 12px', borderRadius: 20,
    border: '1.5px solid var(--border)',
    background: 'white', cursor: 'pointer',
    fontSize: '0.78rem', color: 'var(--text-muted)',
    fontFamily: 'var(--font-body)', transition: 'all 0.15s',
  },
  chipActive: {
    borderColor: 'var(--teal)', background: 'rgba(10,147,150,0.08)',
    color: 'var(--teal)', fontWeight: 600,
  },
  resultCount: {
    margin: 0, fontSize: '0.78rem',
    color: 'var(--text-muted)', fontStyle: 'italic',
  },

  // ── Checklist ──
  checkList: {
    display: 'flex', flexDirection: 'column', gap: 8,
    maxHeight: 360, overflowY: 'auto',
    paddingRight: 2,
  },
  checkItem: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 14px', borderRadius: 'var(--radius-sm)',
    border: '1.5px solid', cursor: 'pointer', transition: 'all 0.15s',
  },
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 10, padding: '32px 16px', color: 'var(--text-muted)',
  },

  selectionCount: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '9px 14px', borderRadius: 'var(--radius-sm)',
    border: '1.5px solid rgba(10,147,150,0.3)',
    background: 'rgba(10,147,150,0.05)',
    fontSize: '0.85rem', color: 'var(--teal)',fontWeight: 500,
  },

  // ── Upload ──
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

  // ── Result ──
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