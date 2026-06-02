```react
import React, { useState, useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  day?: string;
  mealType?: string;
}

export default function MealModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  day = "Måndag", 
  mealType = "frukost" 
}: ModalProps) { 
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

  if (!isOpen && !isClosing) return null;

  const handleCancel = () => { 
    setIsClosing(true); 
    setTimeout(() => { 
      onClose(); 
    }, 300); 
  };

  const handleConfirm = () => { 
    setIsAnimating(true); 
    
    setTimeout(() => {
      setShowCheck(true);
    }, 900);

    setTimeout(() => { 
      onConfirm(inputValue); 
      setIsClosing(true); 
      setTimeout(() => { 
        onClose(); 
      }, 300); 
    }, 1800); 
  };

  const overlayClass = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity duration-300 " + 
    (isClosing || !isOpen ? "opacity-0 pointer-events-none" : "opacity-100");

  const containerClass = "w-full mx-auto p-6 relative " + 
    (isAnimating 
      ? "bg-[#003b05] border-[#003b05] rounded-full w-[80px] h-[80px] p-0 flex items-center justify-center overflow-hidden scale-100 shadow-[0_0_20px_rgba(0,59,5,0.6)]" 
      : "bg-gradient-to-br from-[#fcf9f8] to-[#e8f5e9] border border-[#003b05]/10 shadow-2xl rounded-[24px] max-w-xs"
    );

  const contentClass = "transition-opacity duration-150 " + 
    (isAnimating ? "opacity-0 pointer-events-none absolute" : "opacity-100");

  const checkMarkClass = "w-[40px] h-[40px] stroke-white stroke-[4] fill-none transition-all duration-400 " +
    (showCheck ? "opacity-100 scale-100" : "opacity-0 scale-50");

  return ( 
    <div className={overlayClass} style={{ WebkitBackdropFilter: 'blur(4px)' }}> 
      <div 
        className={containerClass}
        style={{
          transition: 'all 900ms cubic-bezier(0.4, 0, 0.2, 1)',
          transform: 'translate3d(0,0,0)',
          willChange: 'transform, width, height, border-radius, background-color'
        }}
      > 
        {isAnimating && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className={checkMarkClass} viewBox="0 0 52 52"> 
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M14.1 27.2l7.1 7.2 16.7-16.8" 
              /> 
            </svg> 
          </div>
        )}

        <div className={contentClass}> 
          <h2 className="text-xl font-semibold text-gray-800 mb-2 leading-tight"> 
            Vad vill du lägga till för {mealType} på {day}? 
          </h2> 
          <p className="text-sm text-gray-600 mb-6"> 
            Skriv in en maträtt eller en länk. 
          </p>

          <input 
            type="text" 
            style={{
              boxShadow: 'inset 4px 4px 8px #dcd9d8, inset -4px -4px 8px #ffffff'
            }}
            className="w-full p-4 rounded-2xl text-gray-700 mb-8 bg-[#fcf9f8] border-none focus:outline-none focus:ring-2 focus:ring-[#003b05]/20 transition-all" 
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
}

```
