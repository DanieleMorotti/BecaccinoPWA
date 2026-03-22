import React from 'react';

interface IOSInstallHintProps {
  isVisible: boolean;
  onClose: () => void;
  isIphone: boolean;
  message: string;
}

const IOSInstallHint: React.FC<IOSInstallHintProps> = ({ isVisible, onClose, isIphone, message }) => {
  if (!isVisible) return null;

  return (
    <div
      className={`
        fixed z-[100] left-1/2 -translate-x-1/2 px-4 w-full max-w-sm transition-all duration-500 animate-in fade-in 
        ${isIphone ? 'bottom-6 slide-in-from-bottom-10' : 'top-6 slide-in-from-top-10'}
      `}
      role="dialog"
      aria-live="polite"
    >
      <div className="relative bg-white text-gray-900 rounded-2xl p-4 shadow-2xl flex items-center gap-4 border border-gray-200">
        <div
          className={`
            absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45 border-gray-200
            ${isIphone ? 'bottom-[-8px] border-r border-b' : 'top-[-8px] border-l border-t'}
          `}
        />

        <div className="bg-brand-500/10 p-2 rounded-xl">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </div>

        <div className="flex-1 pr-4">
          <p className="text-sm font-semibold leading-tight text-gray-900">
            {message}
          </p>
        </div>

        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1"
          aria-label="Chiudi suggerimento installazione"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default IOSInstallHint;
