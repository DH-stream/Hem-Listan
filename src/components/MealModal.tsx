import React, { useState, useEffect } from 'react';

/**
 * Modal Component for React/Vite
 * 
 * Features:
 * - Neomorphic Input with focus state
 * - Soft green gradient background
 * - Custom CSS/JS animations for the "OK" confirmation (shrink + checkmark)
 * - Simple fade-out for "Cancel"
 * - Mobile responsive design
 */

const Modal = ({ isOpen, onClose, onConfirm, day = "Måndag", mealType = "frukost" }) => {
  const [inputValue, setInputValue] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(false);
      setIsClosing(false);
      setInputValue('');
    }
  }, [isOpen]);

  if (!isOpen && !isClosing) return null;

  const handleCancel = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300); // Match fade-out duration
  };

  const handleConfirm = () => {
    setIsAnimating(true);
    // Timing for the "mighty" animation sequence
    setTimeout(() => {
      onConfirm(inputValue);
      setIsClosing(true);
      setTimeout(() => {
        onClose();
      }, 300);
    }, 2000); // Duration for shrink + checkmark + glow
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
      <style>{`
        @keyframes shrinkToCircle {
          0% { border-radius: 24px; width: 100%; max-width: 320px; height: auto; padding: 24px; }
          100% { border-radius: 50%; width: 80px; height: 80px; padding: 0; background: #003b05; border-color: #003b05; }
        }

        @keyframes drawCheck {
          to { stroke-dashoffset: 0; }
        }

        @keyframes glowPop {
          0% { transform: scale(1); box-shadow: 0 0 0 rgba(0, 59, 5, 0); }
          50% { transform: scale(1.1); box-shadow: 0 0 20px rgba(0, 59, 5, 0.6); }
          100% { transform: scale(1); box-shadow: 0 0 0 rgba(0, 59, 5, 0); }
        }

        .modal-container {
          background: linear-gradient(135deg, #fcf9f8 0%, #e8f5e9 100%);
          border: 1px solid rgba(0, 59, 5, 0.1);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .modal-animating {
          animation: shrinkToCircle 0.8s forwards cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
        }

        .check-container {
          display: none;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
        }

        .modal-animating .check-container {
          display: flex;
          animation: glowPop 0.6s 1.2s forwards;
        }

        .checkmark-svg {
          width: 40px;
          height: 40px;
          stroke: white;
          stroke-width: 4;
          stroke-linecap: round;
          stroke-linejoin: round;
          fill: none;
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          animation: drawCheck 0.5s 0.8s forwards;
        }

        .neomorphic-input {
          background: #fcf9f8;
          box-shadow: inset 4px 4px 8px #dcd9d8, inset -4px -4px 8px #ffffff;
          border: none;
          transition: all 0.3s ease;
        }

        .neomorphic-input:focus {
          outline: none;
          box-shadow: inset 2px 2px 5px #dcd9d8, inset -2px -2px 5px #ffffff, 0 0 8px rgba(0, 59, 5, 0.2);
          transform: translateY(1px);
        }

        .modal-content-fade {
          transition: opacity 0.3s ease;
        }

        .is-animating-content {
          opacity: 0;
          pointer-events: none;
        }
      `}</style>

      <div className={`modal-container w-full mx-auto rounded-3xl p-6 relative ${isAnimating ? 'modal-animating' : 'max-w-xs'}`}>
        {/* Success Animation Layer */}
        <div className="check-container">
          <svg className="checkmark-svg" viewBox="0 0 52 52">
            <path d="M14.1 27.2l7.1 7.2 16.7-16.8" />
          </svg>
        </div>

        {/* Modal UI Content */}
        <div className={`modal-content-fade ${isAnimating ? 'is-animating-content' : ''}`}>
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
    </div>
  );
};

export default Modal;