```react
import React, { useState, useEffect } from 'react';

/**
 * MealModal Component for React/Vite (Säkrad, Optimerad & Finjusterad)
 * * Uppdateringar:
 * - Snabbare krympning (från 0.8s till 0.5s) för en rappare känsla på mobilen.
 * - Bocken visas betydligt längre innan modalen stängs (eftersom den ritas ut snabbare).
 * - Exakt samma färger, neomorfiska skuggor och layout som i originalfilen.
 * - Fullt skyddad mot Esbuild-byggfel på Vercel samt synkad default-export till 'MealModal'.
 */

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  day?: string;
  mealType?: string;
}

// Genom att pussla ihop "@" och "keyframes" förhindrar vi att Esbuild tror att det är en JS-dekoratör
const shrinkAnim = "@" + "keyframes shrinkToCircle { " +
  "0% { border-radius: 24px; width: 100%; max-width: 320px; height: auto; padding: 24px; } " +
  "100% { border-radius: 50%; width: 80px; height: 80px; padding: 0; background: #003b05; border-color: #003b05; } " +
  "}";

const drawAnim = "@" + "keyframes drawCheck { " +
  "to { stroke-dashoffset: 0; } " +
  "}";

const glowAnim = "@" + "keyframes glowPop { " +
  "0% { transform: scale(1); box-shadow: 0 0 0 rgba(0, 59, 5, 0); } " +
  "50% { transform: scale(1.1); box-shadow: 0 0 20px rgba(0, 59, 5, 0.6); } " +
  "100% { transform: scale(1); box-shadow: 0 0 0 rgba(0, 59, 5, 0); } " +
  "}";

const modalStyles = `
  ${shrinkAnim}
  ${drawAnim}
  ${glowAnim}

  .modal-container { 
    background: linear-gradient(135deg, #fcf9f8 0%, #e8f5e9 100%); 
    border: 1px solid rgba(0, 59, 5, 0.1); 
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); 
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1); 
    /* Hårdvaruacceleration för absolut bästa flyt på iPhone (60 FPS) */
    transform: translateZ(0);
    will-change: transform, width, height, border-radius, background-color;
  }

  .modal-animating { 
    /* Sänkt från 0.8s till 0.5s för snabbare krympning */
    animation: shrinkToCircle 0.5s forwards cubic-bezier(0.4, 0, 0.2, 1); 
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
    /* glowPop startar nu vid 0.9s (istället för 1.2s) och varar i 0.5s */
    animation: glowPop 0.5s 0.9s forwards; 
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
    /* Bocken börjar ritas ut direkt när krympningen är klar (vid 0.5s istället för 0.8s) */
    animation: drawCheck 0.4s 0.5s forwards; 
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
    transition: opacity 0.2s ease; 
  }

  .is-animating-content { 
    opacity: 0; 
    pointer-events: none; 
  } 
`;

const MealModal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  day = "Måndag", 
  mealType = "frukost" 
}) => { 
  const [inputValue, setInputValue] = useState(''); 
  const [isAnimating, setIsAnimating] = useState(false); 
  const [isClosing, setIsClosing] = useState(false);

  // Återställ tillstånd när modalen öppnas
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
    }, 300); // uttoningens varaktighet (originaltid)
  };

  const handleConfirm = () => { 
    setIsAnimating(true); 
    
    // Behåller den totala bekräftelsetiden på 2.0s (2000ms).
    // Eftersom krympningen nu är snabbare kommer bocken att ligga kvar längre och synas tydligare!
    setTimeout(() => { 
      onConfirm(inputValue); 
      setIsClosing(true); 
      setTimeout(() => { 
        onClose(); 
      }, 300); 
    }, 2000); 
  };

  // Flyttar ut klassnamnen för att hålla JSX-strukturen ren och säker för Esbuild
  const overlayClass = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity duration-300 " + 
    (isClosing || !isOpen ? "opacity-0 pointer-events-none" : "opacity-100");

  const containerClass = "modal-container w-full mx-auto rounded-3xl p-6 relative " + 
    (isAnimating ? "modal-animating" : "max-w-xs");

  const contentClass = "modal-content-fade " + 
    (isAnimating ? "is-animating-content" : "");

  return ( 
    <div 
      className={overlayClass} 
      style={{
        WebkitBackdropFilter: 'blur(4px)' // Säkrar blur-effekten på iOS Safari
      }}
    > 
      <style dangerouslySetInnerHTML={{ __html: modalStyles }} />
      
      <div className={containerClass}> 
        {/* Success Animation Layer */} 
        <div className="check-container"> 
          <svg className="checkmark-svg" viewBox="0 0 52 52"> 
            <path d="M14.1 27.2l7.1 7.2 16.7-16.8" /> 
          </svg> 
        </div>

        {/* Modal UI Content */} 
        <div className={contentClass}> 
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

export default MealModal;

```
