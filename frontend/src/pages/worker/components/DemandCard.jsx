import React from 'react';
import StatusBadge from '../../../components/StatusBadge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Scan, ListChecks, PenLine, ChevronRight } from 'lucide-react';

export default function DemandCard({ demand: d, onSelect, isMobile }) {
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
          {d.total_price && !isMobile && <span style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--teal-dark)', background: 'rgba(10,147,150,0.08)', padding: '3px 8px', borderRadius: 20 }}>{Number(d.total_price).toLocaleString('fr-DZ')} DA</span>}
          <ChevronRight size={15} color="var(--text-muted)" />
        </div>
      </div>
      {d.total_price && isMobile && <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--teal-dark)' }}>{Number(d.total_price).toLocaleString('fr-DZ')} DA</p>}
      {d.items?.length > 0 && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.items.map(i => i.name).join(' · ')}</p>}
    </div>
  );
}
