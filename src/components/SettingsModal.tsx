import React, { useState, useEffect, useRef, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── INTERNA INLINE SVGs ──────────────────────────────────────────────
const InlineIcon = memo(({ name, className = "w-5 h-5" }) => {
  const svgs = {
    close: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
    settings: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    person: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    photo_camera: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    google: <svg className={className} viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>,
    archive: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
    check: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
  };
  return svgs[name] || null;
});

export default function App() {
  const [isOpen, setIsOpen] = useState(true);
  const [userName, setUserName] = useState("Hem-Listan");

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <AnimatePresence>
        {isOpen && (
          <SettingsModal 
            userName={userName}
            onUpdateUserName={setUserName}
            onClose={() => setIsOpen(false)}
            onResetLists={() => alert("Listor återställda!")}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SettingsModal({ userName, onUpdateUserName, onClose, onResetLists }) {
  const [authMode, setAuthMode] = useState("default");
  const [profileImage, setProfileImage] = useState(null);
  const fileInputRef = useRef(null);

  // Ladda bild från LocalStorage
  useEffect(() => {
    const savedImage = localStorage.getItem("user_profile_image");
    if (savedImage) setProfileImage(savedImage);
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        setProfileImage(base64String);
        localStorage.setItem("user_profile_image", base64String);
      };
      reader.readAsDataURL(file);
    }
  };
  
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.95 }} 
        animate={{ scale: 1 }} 
        exit={{ scale: 0.95 }}
        className="bg-white w-full max-w-[420px] rounded-3xl shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="flex items-center justify-between p-6 pb-2">
          <div className="flex items-center gap-2 text-gray-900">
            <InlineIcon name="settings" className="w-5 h-5" />
            <h2 className="text-xl font-bold">Inställningar</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <InlineIcon name="close" className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 pt-2 space-y-6">
          <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/50">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative cursor-pointer group" onClick={() => fileInputRef.current.click()}>
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden border-2 border-white shadow-sm hover:opacity-90">
                  {profileImage ? (
                    <img src={profileImage} alt="Profil" className="w-full h-full object-cover" />
                  ) : (
                    <InlineIcon name="person" className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white p-1 rounded-full border-2 border-white">
                  <InlineIcon name="photo_camera" className="w-3 h-3" />
                </div>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
              
              <div>
                <p className="font-bold text-gray-900">{userName}</p>
                <p className="text-sm text-gray-500">Lokal profil</p>
                <button onClick={() => fileInputRef.current.click()} className="text-emerald-600 text-xs font-bold mt-1 hover:underline">Ändra bild</button>
              </div>
            </div>
            
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Visningsnamn</label>
            <div className="flex gap-2">
              <input 
                value={userName} 
                onChange={(e) => onUpdateUserName(e.target.value)}
                className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <button className="bg-emerald-600 text-white px-5 rounded-xl font-bold text-sm hover:bg-emerald-700">Spara</button>
            </div>
          </div>

          <div className="bg-[#FAF9F5] border border-[#EDEADF] rounded-2xl p-4">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">Konto & Delning ⓘ</h3>
            {authMode === "default" ? (
               <div className="space-y-3">
                <button className="w-full bg-white border border-[#EDEADF] py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-white/80 shadow-sm">
                  <InlineIcon name="google" className="w-5 h-5" />
                  Fortsätt med Google
                </button>
               </div>
            ) : null}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
