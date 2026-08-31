import { memo } from 'react';
import { HiOutlineX } from 'react-icons/hi';

const Modal = memo(function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className={`relative rounded-xl shadow-xl w-full ${sizes[size]} max-h-[85vh] overflow-y-auto animate-slide-up`}
        style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-xl)' }}
      >
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800" style={{ color: 'var(--text-muted)' }}>
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-5 pb-20">
          {children}
        </div>
      </div>
    </div>
  );
});

export default Modal;
