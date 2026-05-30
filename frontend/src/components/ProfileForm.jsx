import React, { useState, useEffect } from 'react';
import { profileAPI } from '../services/api';
import MapPicker from './MapPicker';
import { CheckCircle, AlertCircle, User } from 'lucide-react';

export default function ProfileForm({ onComplete }) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', birthday: '', address: '',
    address_lat: null, address_lng: null,
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    profileAPI.get()
      .then((res) => {
        if (res.data) {
          setForm({
            first_name: res.data.first_name || '',
            last_name: res.data.last_name || '',
            birthday: res.data.birthday ? res.data.birthday.split('T')[0] : '',
            address: res.data.address || '',
            address_lat: res.data.address_lat || null,
            address_lng: res.data.address_lng || null,
          });
        }
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  const handleMapChange = ({ lat, lng, address }) => {
    setForm((f) => ({ ...f, address, address_lat: lat, address_lng: lng }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.address_lat || !form.address_lng) {
      setError('Veuillez sélectionner votre adresse sur la carte');
      return;
    }
    setLoading(true);
    try {
      await profileAPI.save(form);
      setSuccess(true);
      if (onComplete) onComplete();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div className="spinner spinner-dark" />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.sectionHeader}>
        <User size={18} color="var(--teal)" />
        <h3 style={{ fontSize: '1rem', margin: 0 }}>Informations personnelles</h3>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={15} />
          {error}
        </div>
      )}
      {success && (
        <div className="alert alert-success">
          <CheckCircle size={15} />
          Profil sauvegardé avec succès !
        </div>
      )}

      <div className="grid-2">
        <div className="form-group">
          <label>Prénom *</label>
          <input
            type="text"
            placeholder="Votre prénom"
            value={form.first_name}
            onChange={e => setForm({ ...form, first_name: e.target.value })}
            required
          />
        </div>
        <div className="form-group">
          <label>Nom *</label>
          <input
            type="text"
            placeholder="Votre nom de famille"
            value={form.last_name}
            onChange={e => setForm({ ...form, last_name: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="form-group">
        <label>Date de naissance *</label>
        <input
          type="date"
          value={form.birthday}
          onChange={e => setForm({ ...form, birthday: e.target.value })}
          required
        />
      </div>

      <div className="form-group">
        <label>Adresse *</label>
        <MapPicker
          value={form.address_lat ? { lat: form.address_lat, lng: form.address_lng, address: form.address } : null}
          onChange={handleMapChange}
        />
        {form.address && (
          <input
            type="text"
            value={form.address}
            onChange={e => setForm({ ...form, address: e.target.value })}
            placeholder="Adresse sélectionnée"
            style={{ marginTop: 8 }}
          />
        )}
      </div>

      <button type="submit" className="btn btn-primary" disabled={loading} style={{ alignSelf: 'flex-start' }}>
        {loading ? <span className="spinner" /> : <><CheckCircle size={15} /> Sauvegarder le profil</>}
      </button>
    </form>
  );
}

const styles = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
    borderBottom: '1px solid var(--border)',
  },
};
