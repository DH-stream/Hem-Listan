```react
import React, { useState, useEffect } from 'react';

/**
 * MealModal för React/Vite
 * * Fixat Esbuild/PWA-parserfelet permanent genom att Base64-koda CSS-strängen.
 * Detta förhindrar att Esbuild försöker tolka CSS-koden under server-bygget.
 * * Alla originalanimationer, utseende och prestandafixar är helt oförändrade!
 */

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  day?: string;
  mealType?: string;
}

// Denna sträng är din exakta original-CSS, men Base64-kodad.
// På så sätt ser Esbuild bara en vanlig textsträng utan specialtecken som kraschar bygget.
const base64CSS = 
  "QGtleWZyYW1lcyBzaHJpbmtUb0NpcmNsZSB7IDAlIHsgYm9yZGVyLXJhZGl1czogMjRweDsgd2lkdGg6IDEw" +
  "MCU7IG1heC13aWR0aDogMzIwcHg7IGhlaWdodDogYXV0bzsgcGFkZGluZzogMjRweDsgfSAxMDAlIHsgYm9y" +
  "ZGVyLXJhZGl1czogNTAlOyB3aWR0aDogODBweDsgaGVpZ2h0OiA4MHB4OyBwYWRkaW5nOiAwOyBiYWNrZ3Jv" +
  "dW5kOiAjMDAzYjA1OyBib3JkZXItY29sb3I6ICMwMDNiMDU7IH0gfSBAa2V5ZnJhbWVzIGRyYXdDaGVjayB7" +
  "IHRvIHsgc3Ryb2tlLWRhc2hvZmZzZXQ6IDA7IH0gfSBAa2V5ZnJhbWVzIGdsb3dQb3AgeyAwJSB7IHRyYW5z" +
  "Zm9ybTogc2NhbGUoMSk7IGJveC1zaGFkb3c6IDAgMCAwIHJyYmEoMCwgNTksIDUsIDApOyB9IDUwJSB7IHRy" +
  "YW5zZm9ybTogc2NhbGUoMS4xKTsgYm94LXNoYWRvdzogMCAwIDIwcHggcmdiYSgwLCA1OSwgNSwgMC42KTsg" +
  "fSAxMDAlIHsgdHJhbnNmb3JtOiBzY2FsZSgxKTsgYm94LXNoYWRvdzogMCAwIDAgcmdiYSgwLCA1OSwgNSwg" +
  "MCk7IH0gfSAubW9kYWwtY29udGFpbmVyIHsgYmFja2dyb3VuZDogbGluZWFyLWdyYWRpZW50KDEzNWRlZywg" +
  "I2ZjZjlmOCAwJSwgI2U4ZjVlOSAxMDAlKTsgYm9yZGVyOiAxcHggc29saWQgcmdiYSgwLCA1OSwgNSwgMC4x" +
  "KTsgYm94LXNoYWRvdzogMCAyMHB4IDI1cHggLTVweCByZ2JhKDAsIDAsIDAsIDAuMSksIDAgMTBweCAxMHB4" +
  "IC01cHggcmdiYSgwLCAwLCAwLCAwLjA0KTsgdHJhbnNpdGlvbjogYWxsIDAuNXMgY3ViaWMtYmV6aWVyKDAu" +
  "NCwgMCwgMC4yLCAxKTsgdHJhbnNmb3JtOiB0cmFuc2xhdGVaKDApOyB3aWxsLWNoYW5nZTogdHJhbnNmb3Jt" +
  "LCB3aWR0aCwgaGVpZ2h0LCBib3JkZXItcmFkaXVzLCBiYWNrZ3JvdW5kLWNvbG9yOyB9IC5tb2RhbC1hbmlt" +
  "YXRpbmcgeyBhbmltYXRpb246IHNocmlua1RvQ2lyY2xlIDAuOHMgZm9yd2FyZHMgY3ViaWMtYmV6aWVyKDAu" +
  "NCwgMCwgMC4yLCAxKTsgb3ZlcmZsb3c6IGhpZGRlbjsgfSAuY2hlY2stY29udGFpbmVyIHsgZGlzcGxheTog" +
  "bm9uZTsgYWxpZ24taXRlbXM6IGNlbnRlcjsganVzdGlmeS1jb250ZW50OiBjZW50ZXI7IHdpZHRoOiAxMDAl" +
  "OyBoZWlnaHQ6IDEwMCU7IH0gLm1vZGFsLWFuaW1hdGluZyAuY2hlY2stY29udGFpbmVyIHsgZGlzcGxheTog" +
  "ZmxleDsgYW5pbWF0aW9uOiBnbG93UG9wIDAuNnMgMS4ycyBmb3J3YXJkczsgfSAuY2hlY2ttYXJrLXN2ZyB7" +
  "IHdpZHRoOiA0MHB4OyBoZWlnaHQ6IDQwcHg7IHN0cm9rZTogd2hpdGU7IHN0cm9rZS13aWR0aDogNDsgc3Ry" +
  "b2tlLWxpbmVjYXA6IHJvdW5kOyBzdHJva2UtbGluZWpvaW46IHJvdW5kOyBmaWxsOiBub25lOyBzdHJva2Ut" +
  "ZGFzaGFycmF5OiAxMDA7IHN0cm9rZS1kYXNob2Zmc2V0OiAxMDA7IGFuaW1hdGlvbjogZHJhd0NoZWNrIDAu" +
  "NXMgMC44cyBmb3J3YXJkczsgfSAubmVvbW9ycGhpYy1pbnB1dCB7IGJhY2tncm91bmQ6ICNmY2Y5Zjg7IGJv" +
  "eC1zaGFkb3c6IGluc2V0IDRweCA0cHggOHB4ICNkY2Q5ZDgsIGluc2V0IC00cHggLTRweCA4cHggI2ZmZmZm" +
  "ZjsgYm9yZGVyOiBub25lOyB0cmFuc2l0aW9uOiBhbGwgMC4zcyBlYXNlOyB9IC5uZW9tb3JwaGljLWlucHV0" +
  "OmZvY3VzIHsgb3V0bGluZTogbm9uZTsgYm94LXNoYWRvdzogaW5zZXQgMnB4IDJweCA1cHggI2RjZDlkOCwg" +
  "aW5zZXQgLTJweCAtMnB4IDVweCAjZmZmZmZmLCAwIDAgOHB4IHJnYmEoMCwgNTksIDUsIDAuMik7IHRyYW5z" +
  "Zm9ybTogdHJhbnNsYXRlWSgxcHgpOyB9IC5tb2RhbC1jb250ZW50LWZhZGUgeyB0cmFuc2l0aW9uOiBvcGFj" +
  "aXR5IDAuM3MgZWFzZTsgfSAuaXMtYW5pbWF0aW5nLWNvbnRlbnQgeyBvcGFjaXR5OiAwOyBwb2ludGVyLWV2" +
  "ZW50czogbm9uZTsgfQ==";

const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  day = "Måndag", 
  mealType = "frukost" 
}) => { 
  const [inputValue, setInputValue] = useState(''); 
  const [isAnimating, setIsAnimating] = useState(false); 
  const [isClosing, setIsClosing] = useState(false);
  const [decodedCSS, setDecodedCSS] = useState('');

  // Avkoda CSS-strängen säkert på klientsidan efter första renderingen
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        setDecodedCSS(window.atob(base64CSS));
      } catch (e) {
        console.error("Kunde inte avkoda CSS-strängen", e);
      }
    }
  }, []);

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
    }, 300); 
  };

  const handleConfirm = () => { 
    setIsAnimating(true); 
    setTimeout(() => { 
      onConfirm(inputValue); 
      setIsClosing(true); 
      setTimeout(() => { 
        onClose(); 
      }, 300); 
    }, 2000); 
  };

  const overlayClass = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity duration-300 " + 
    (isClosing || !isOpen ? "opacity-0 pointer-events-none" : "opacity-100");

  const containerClass = "modal-container w-full mx-auto rounded-3xl p-6 relative " + 
    (isAnimating ? "modal-animating" : "max-w-xs");

  const contentClass = "modal-content-fade " + 
    (isAnimating ? "is-animating-content" : "");

  return ( 
    <div className={overlayClass} style={{ WebkitBackdropFilter: 'blur(4px)' }}> 
      {/* Stilarna laddas dynamiskt så att Esbuild/Vite aldrig ser några kraschande tecken */}
      {decodedCSS && <style dangerouslySetInnerHTML={{ __html: decodedCSS }} />}
      
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

export default Modal;

```
