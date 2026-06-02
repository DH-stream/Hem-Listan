import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { createPortal } from 'react-dom';

const MealModal = memo(({ isOpen, onClose, onConfirm, day = "Måndag", mealType = "frukost" }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<'idle' | 'open' | 'confirming' | 'check' | 'closing'>('idle');

  useEffect(() => {
    if (isOpen) {
      setPhase('open');
      // Rensa input utan controlled state
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [isOpen]);

  const handleCancel = useCallback(() => {
    setPhase('closing');
    setTimeout(() => { setPhase('idle'); onClose(); }, 300);
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    const value = inputRef.current?.value ?? '';
    setPhase('confirming');
    setTimeout(() => setPhase('check'), 600);
    setTimeout(() => {
      onConfirm(value);
      setPhase('closing');
      setTimeout(() => { setPhase('idle'); onClose(); }, 300);
    }, 1200);
  }, [onConfirm, onClose]);

  if (phase === 'idle') return null;

  const isConfirming = phase === 'confirming' || phase === 'check';
  const isVisible = phase === 'open';
  const isClosing = phase === 'closing';

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        // Ingen backdrop-filter — orsakar repaint på mobil
        backgroundColor: 'rgba(0,0,0,0.5)',
        opacity: isClosing ? 0 : 1,
        transition: 'opacity 300ms ease',
        pointerEvents: isClosing ? 'none' : 'auto',
      }}
    >
      <style>{`
        @keyframes drawCheck {
          to { stroke-dashoffset: 0; }
        }
      `}</style>

      <div style={{
        position: 'relative',
        width: 80,
        height: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>

        {/* Grön cirkel */}
        <div style={{
          position: 'absolute',
          width: 80,
          height: 80,
          borderRadius: '50%',
          backgroundColor: '#1a6b20',
          transform: isConfirming ? 'scale(1)' : 'scale(0)',
          opacity: isConfirming ? 1 : 0,
          transition: 'transform 600ms cubic-bezier(0.4,0,0.2,1), opacity 400ms ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isConfirming ? '0 0 24px rgba(26,107,32,0.5)' : 'none',
          willChange: 'transform, opacity',
        }}>
          {phase === 'check' && (
            <svg
              viewBox="0 0 52 52"
              style={{
                width: 36, height: 36,
                stroke: 'white', strokeWidth: 4,
                strokeLinecap: 'round', strokeLinejoin: 'round',
                fill: 'none',
                strokeDasharray: 100,
                strokeDashoffset: 100,
                animation: 'drawCheck 0.35s ease-out forwards',
              }}
            >
              <path d="M14.1 27.2l7.1 7.2 16.7-16.8" />
            </svg>
          )}
        </div>

        {/* Modal-kort */}
        <div style={{
          position: 'absolute',
          width: 320,
          borderRadius: 24,
          background: 'linear-gradient(135deg, #fcf9f8 0%, #e8f5e9 100%)',
          border: '1px solid rgba(0,90,10,0.1)',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.12)',
          padding: 24,
          transform: isVisible ? 'scale(1)' : 'scale(0)',
          opacity: isVisible ? 1 : 0,
          transition: 'transform 400ms cubic-bezier(0.4,0,0.2,1), opacity 300ms ease',
          willChange: 'transform, opacity',
          transformOrigin: 'center center',
          contain: 'layout paint',
        }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#1f2937', marginBottom: 8, lineHeight: 1.3 }}>
            Vad vill du lägga till för {mealType} på {day}?
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: 24 }}>
            Skriv in en maträtt eller en länk.
          </p>

          <input
            ref={inputRef}
            type="text"
            defaultValue=""
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: 16,
              border: 'none',
              background: '#fcf9f8',
              boxShadow: 'inset 4px 4px 8px #dcd9d8, inset -4px -4px 8px #ffffff',
              color: '#374151',
              fontSize: '1rem',
              marginBottom: 28,
              boxSizing: 'border-box' as const,
              outline: 'none',
            }}
            placeholder="T.ex. Havregrynsgröt"
            autoFocus
          />

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleCancel}
              style={{
                flex: 1, padding: '14px 20px', borderRadius: 16,
                border: 'none', background: '#f3f4f6', color: '#374151',
                fontWeight: 500, fontSize: '1rem', cursor: 'pointer',
              }}
            >
              Avbryt
            </button>
            <button
              onClick={handleConfirm}
              style={{
                flex: 1, padding: '14px 20px', borderRadius: 16,
                border: 'none', background: '#1a6b20', color: 'white',
                fontWeight: 600, fontSize: '1rem', cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(26,107,32,0.35)',
              }}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
});

export default MealModal;
