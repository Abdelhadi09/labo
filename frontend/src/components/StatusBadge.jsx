import React from 'react';
import { Clock, CheckCircle, Scan, AlertCircle } from 'lucide-react';

const STATUS_MAP = {
  pending: { label: 'En attente', className: 'badge-pending', Icon: Clock },
  ocr_processed: { label: 'Traité (OCR)', className: 'badge-ocr', Icon: Scan },
  ocr_no_match: { label: 'OCR — révision', className: 'badge-no-match', Icon: AlertCircle },
  processed: { label: 'Traité', className: 'badge-processed', Icon: CheckCircle },
};

export default function StatusBadge({ status }) {
  const config = STATUS_MAP[status] || { label: status, className: 'badge-pending', Icon: Clock };
  const { label, className, Icon } = config;
  return (
    <span className={`badge ${className}`}>
      <Icon size={11} />
      {label}
    </span>
  );
}
