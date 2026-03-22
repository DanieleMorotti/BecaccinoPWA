/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import SetupScreen from './components/SetupScreen';
import RoomManager from './components/RoomManager';
import IOSInstallHint from './components/IOSInstallHint';
import { Toaster } from 'sonner';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [roomId, setRoomId] = useState<string | null>(() => localStorage.getItem('becaccino:roomId'));
  const [loading, setLoading] = useState(true);
  const [showIosHint, setShowIosHint] = useState(false);
  const [isIphone, setIsIphone] = useState(false);

  useEffect(() => {
    if (roomId) {
      localStorage.setItem('becaccino:roomId', roomId);
    } else {
      localStorage.removeItem('becaccino:roomId');
    }
  }, [roomId]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    
    return () => unsub();
  }, []);

  useEffect(() => {
    const dismissed = localStorage.getItem('becaccino:iosInstallHintDismissed');
    if (dismissed) return;

    const ua = navigator.userAgent || '';
    const isIphoneDevice = /iPhone|iPod/.test(ua);
    const isIpadDevice = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isIos = isIphoneDevice || isIpadDevice;
    if (!isIos) return;

    const nav = navigator as Navigator & { standalone?: boolean };
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || !!nav.standalone;
    if (isStandalone) return;

    setIsIphone(isIphoneDevice);
    const timeout = window.setTimeout(() => setShowIosHint(true), 1200);
    return () => window.clearTimeout(timeout);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-emerald-800 font-medium">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-sans selection:bg-emerald-200">
      <Toaster position="top-center" richColors />
      <IOSInstallHint
        isVisible={showIosHint}
        isIphone={isIphone}
        onClose={() => {
          localStorage.setItem('becaccino:iosInstallHintDismissed', 'true');
          setShowIosHint(false);
        }}
        message={'Per installare l\'app: in Safari tocca i tre puntini (⋯), poi Condividi e infine "Aggiungi alla schermata Home".'}
      />
      {roomId && user ? (
        <RoomManager roomId={roomId} onLeave={() => setRoomId(null)} user={user} />
      ) : (
        <SetupScreen onJoinRoom={setRoomId} />
      )}
    </div>
  );
}
