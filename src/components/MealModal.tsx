import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const Modal = ({ isOpen, onClose, onConfirm, day = "Måndag", mealType = "frukost" }) => {
  const [inputValue, setInputValue] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showCheck, setShowCheck] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(false);
      setIsClosing(false);
      setShowCheck(false);
      setInputValue('');
    }
  }, [isOpen]);

  const handleCancel = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 300);
  };

  const handleConfirm = () => {
    setIsAnimating(true);
    setTimeout(() => setShowCheck(true), 900);
    setTimeout(() => {
      onConfirm(inputValue);
      setIsClosing(true);
      setTimeout(() => onClose(), 300);
    }, 1800);
  };

  if (!isOpen && !isClosing) return null;

  return createPortal(
    <div
      style={{ WebkitBackdropFilter: 'blur(4px)' }}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${isClosing || !isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
    >
      <style>{`
        @keyframes shrinkToCircle {
          0%   { border-radius: 24px; width: 320px; height: 260px; padding: 24px; }
          100% { border-radius: 50%; width: 80px; height: 80px; padding: 0; background: #003b05; }
        }
        @keyframes drawCheck {
          to { stroke-dashoffset: 0; }
        }
        @keyframes fadeScaleIn {
          from { opacity: 0; transform: scale(0.5); }
          to   { opacity: 1; transform: scale(1); }
        }
        .modal-container {
          background: linear-gradient(135deg, #fcf9f8 0%, #e8f5e9 100%);
          border: 1px solid rgba(0,59,5,0.1);
          box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
          contain: layout paint;
        }
        .modal-animating {
          animation: shrinkToCircle 0.9s forwards cubic-bezier(0.4,0,0.2,1) !important;
          overflow: hidden;
          box-shadow: 0 0 20px rgba(0,59,5,0.6) !important;
        }
        .neomorphic-input {
          background: #fcf9f8;
          box-shadow: inset 4px 4px 8px #dcd9d8, inset -4px -4px 8px #ffffff;
          border: none;
          transition: box-shadow 0.3s ease;
        }
        .neomorphic-input:focus {
          outline: none;
          box-shadow: inset 2px 2px 5px #dcd9d8, inset -2px -2px 5px #ffffff, 0 0 8px rgba(0,59,5,0.2);
        }
      `}</style>

      <div className={`modal-container w-full max-w-xs mx-auto rounded-3xl p-6 relative ${isAnimating ? 'modal-animating' : ''}`}>

        {isAnimating && showCheck && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ animation: 'fadeScaleIn 200ms ease-out forwards' }}
          >
            <svg
              viewBox="0 0 52 52"
              style={{
                width: 40, height: 40,
                stroke: 'white', strokeWidth: 4,
                strokeLinecap: 'round', strokeLinejoin: 'round',
                fill: 'none',
                strokeDasharray: 100, strokeDashoffset: 100,
                animation: 'drawCheck 0.4s ease-out forwards',
              }}
            >
              <path d="M14.1 27.2l7.1 7.2 16.7-16.8" />
            </svg>
          </div>
        )}

        <div className={`transition-opacity duration-150 ${isAnimating ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <h2 className="text-xl font-semibold text-gray-800 mb-2 leading-tight">
            Vad vill du lägga till för {mealType} på {day}?
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            Skriv in en maträtt eller en länk.
          </p>

          <input
            type="text"
            className="neomorphic-input w-full p-4 rounded-2xl text-gray-700 mb-8"
            placeholder="T.ex. Havregrynsgröt"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            autoFocus
          />

          <div className="flex gap-4">
            <button
              onClick={handleCancel}
              className="flex-1 py-4 px-6 rounded-2xl font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              Avbryt
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-4 px-6 rounded-2xl font-semibold text-white bg-[#003b05] shadow-lg shadow-green-900/20 hover:bg-[#002b04] transition-all"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
