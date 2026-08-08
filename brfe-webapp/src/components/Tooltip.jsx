import { useState } from 'react';

export default function Tooltip({ text, children, position = 'right' }) {
  const [show, setShow] = useState(false);

  if (!text) return children;

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-3',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  };

  return (
    <div className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className={`absolute ${positions[position]} px-2.5 py-1.5 bg-slate-900 text-white text-xs rounded-lg whitespace-nowrap z-[60] shadow-lg animate-fade-in pointer-events-none`}>
          {text}
        </div>
      )}
    </div>
  );
}
