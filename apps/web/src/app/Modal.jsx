import { useEffect } from 'react';

// Prototype `.modal-bg` / `.modal` dialog; closes on Escape or a click on the backdrop.
export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div className="modal-bg" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal" role="dialog" aria-modal="true" aria-label={title}><h2>{title}</h2>{children}</div>
  </div>;
}
