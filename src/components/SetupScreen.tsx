import React, { useState, useEffect } from "react";
import { doc, setDoc, getDoc, collection, query, orderBy, getDocs, serverTimestamp, arrayUnion } from "firebase/firestore";
import { db, ensureAuth } from "../firebase";
import { generateRoomCode, MAX_PLAYERS } from "../lib/gameLogic";
import { Plus, LogIn } from "lucide-react";
import { toast } from "sonner";

interface SetupScreenProps {
  onJoinRoom: (roomId: string) => void;
}

export default function SetupScreen({ onJoinRoom }: SetupScreenProps) {
  const [activeMode, setActiveMode] = useState<"create" | "join">("create");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [targetPoints, setTargetPoints] = useState("31");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedName = localStorage.getItem("becaccino:name");
    if (savedName) setPlayerName(savedName);
  }, []);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlayerName(e.target.value);
    localStorage.setItem("becaccino:name", e.target.value);
  };

  const createRoom = async () => {
    if (!playerName.trim()) return toast.error("Inserisci un nome giocatore.");
    setLoading(true);
    try {
      const currentUser = await ensureAuth();
      const roomId = generateRoomCode();
      const roomDoc = doc(db, "rooms", roomId);
      const playerDoc = doc(db, "rooms", roomId, "players", currentUser.uid);

      await setDoc(roomDoc, {
        createdAt: serverTimestamp(),
        hostId: currentUser.uid,
        status: "lobby",
        phase: "lobby",
        table: [],
        handNumber: 1,
        targetPoints: Number(targetPoints),
        scoreTeamA: 0,
        scoreTeamB: 0,
        handTeamA: 0,
        handTeamB: 0,
        playerIds: [currentUser.uid],
      });

      await setDoc(playerDoc, {
        name: playerName.trim(),
        ready: false,
        joinedAt: serverTimestamp(),
        hand: [],
      });

      onJoinRoom(roomId);
    } catch (e) {
      console.error(e);
      toast.error("Errore durante la creazione della stanza.");
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!playerName.trim()) return toast.error("Inserisci un nome giocatore.");
    const code = roomCode.trim().toUpperCase();
    if (!code) return toast.error("Inserisci un codice stanza.");
    setLoading(true);
    try {
      const currentUser = await ensureAuth();
      const roomDoc = doc(db, "rooms", code);
      const roomSnap = await getDoc(roomDoc);
      
      if (!roomSnap.exists()) {
        toast.error("Stanza non trovata.");
        setLoading(false);
        return;
      }

      const room = roomSnap.data();
      if (room.status !== "lobby") {
        toast.error("La partita è già iniziata.");
        setLoading(false);
        return;
      }

      const playersQuery = query(collection(db, "rooms", code, "players"), orderBy("joinedAt"));
      const playersSnap = await getDocs(playersQuery);
      const alreadyJoined = playersSnap.docs.some((d) => d.id === currentUser.uid);
      
      if (!alreadyJoined && playersSnap.size >= MAX_PLAYERS) {
        toast.error("La stanza è piena.");
        setLoading(false);
        return;
      }

      const playerDoc = doc(db, "rooms", code, "players", currentUser.uid);
      await setDoc(
        playerDoc,
        {
          name: playerName.trim(),
          ready: false,
          joinedAt: serverTimestamp(),
          hand: [],
        },
        { merge: true }
      );

      await setDoc(roomDoc, { playerIds: arrayUnion(currentUser.uid) }, { merge: true });

      onJoinRoom(code);
    } catch (e) {
      console.error(e);
      toast.error("Errore durante l'accesso alla stanza.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-800">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-lime-300/10 blur-3xl" />

      <div className="relative z-10 max-w-md mx-auto px-6 pt-10 pb-10">
        <div className="text-center mb-8">
          <div className="relative mx-auto mb-4 h-36 w-36">
            <div className="absolute inset-0 rounded-[34px] bg-gradient-to-br from-lime-300/50 via-emerald-300/30 to-amber-200/30 blur-2xl" />
            <div className="absolute -inset-1 rounded-[36px] bg-[conic-gradient(from_180deg,rgba(167,243,208,0.4),rgba(190,242,100,0.3),rgba(52,211,153,0.35),rgba(167,243,208,0.4))] opacity-70 animate-[spin_18s_linear_infinite]" />
            <div className="relative h-full w-full rounded-[30px] bg-emerald-950/70 p-2 shadow-2xl shadow-emerald-950/40 ring-1 ring-emerald-200/20">
              <img
                src={`${import.meta.env.BASE_URL}icons/icon-512.png`}
                alt="Becaccino"
                className="h-full w-full rounded-[24px] object-cover scale-[1.06] transform-gpu"
              />
            </div>
          </div>
          <h1 className="text-4xl font-serif font-bold text-emerald-50 mb-1.5">Becaccino</h1>
          <p className="text-emerald-100/80">Gioca 2v2 in tempo reale</p>
        </div>

        <div className="bg-white/95 rounded-3xl shadow-2xl shadow-emerald-950/30 overflow-hidden border border-emerald-100/70 backdrop-blur">
          <div className="flex p-2 bg-emerald-50/80 border-b border-emerald-100/80">
          <button
            onClick={() => setActiveMode("create")}
            className={`flex-1 py-3 px-4 rounded-2xl text-sm font-medium transition-all ${
              activeMode === "create"
                ? "bg-white text-emerald-900 shadow-sm border border-emerald-100/50"
                : "text-emerald-600 hover:bg-emerald-100/50"
            }`}
          >
            <Plus className="w-4 h-4 inline-block mr-2" />
            Crea Stanza
          </button>
          <button
            onClick={() => setActiveMode("join")}
            className={`flex-1 py-3 px-4 rounded-2xl text-sm font-medium transition-all ${
              activeMode === "join"
                ? "bg-white text-emerald-900 shadow-sm border border-emerald-100/50"
                : "text-emerald-600 hover:bg-emerald-100/50"
            }`}
          >
            <LogIn className="w-4 h-4 inline-block mr-2" />
            Entra
          </button>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-emerald-900 mb-1.5">Nome Giocatore</label>
              <input
                type="text"
                value={playerName}
                onChange={handleNameChange}
                placeholder="Es. Luca"
                maxLength={18}
                className="w-full px-4 py-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-emerald-900 placeholder:text-emerald-300"
              />
            </div>

            {activeMode === "create" ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-emerald-900 mb-1.5">Punti per vincere</label>
                  <select
                    value={targetPoints}
                    onChange={(e) => setTargetPoints(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-emerald-900"
                  >
                    <option value="31">31 punti</option>
                    <option value="41">41 punti</option>
                  </select>
                </div>
                <button
                  onClick={createRoom}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] disabled:opacity-70"
                >
                  {loading ? "Creazione..." : "Crea Stanza"}
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-emerald-900 mb-1.5">Codice Stanza</label>
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="ABCD12"
                    maxLength={6}
                    className="w-full px-4 py-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-emerald-900 placeholder:text-emerald-300 uppercase"
                  />
                </div>
                <button
                  onClick={joinRoom}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] disabled:opacity-70"
                >
                  {loading ? "Accesso..." : "Entra nella Stanza"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
