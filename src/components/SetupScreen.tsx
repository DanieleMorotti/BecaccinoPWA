import React, { useState, useEffect } from "react";
import { doc, setDoc, getDoc, collection, query, orderBy, getDocs, serverTimestamp, arrayUnion } from "firebase/firestore";
import { db, ensureAuth } from "../firebase";
import { generateRoomCode, MAX_PLAYERS } from "../lib/gameLogic";
import { Plus, LogIn } from "lucide-react";

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
    if (!playerName.trim()) return alert("Inserisci un nome giocatore.");
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
      alert("Errore durante la creazione della stanza.");
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!playerName.trim()) return alert("Inserisci un nome giocatore.");
    const code = roomCode.trim().toUpperCase();
    if (!code) return alert("Inserisci un codice stanza.");
    setLoading(true);
    try {
      const currentUser = await ensureAuth();
      const roomDoc = doc(db, "rooms", code);
      const roomSnap = await getDoc(roomDoc);
      
      if (!roomSnap.exists()) {
        alert("Stanza non trovata.");
        setLoading(false);
        return;
      }

      const room = roomSnap.data();
      if (room.status !== "lobby") {
        alert("La partita è già iniziata.");
        setLoading(false);
        return;
      }

      const playersQuery = query(collection(db, "rooms", code, "players"), orderBy("joinedAt"));
      const playersSnap = await getDocs(playersQuery);
      const alreadyJoined = playersSnap.docs.some((d) => d.id === currentUser.uid);
      
      if (!alreadyJoined && playersSnap.size >= MAX_PLAYERS) {
        alert("La stanza è piena.");
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
      alert("Errore durante l'accesso alla stanza.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 pt-12">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-serif font-bold text-emerald-900 mb-2">Becaccino</h1>
        <p className="text-emerald-700/80">Gioca 2v2 in tempo reale</p>
      </div>

      <div className="bg-white rounded-3xl shadow-xl shadow-emerald-900/5 overflow-hidden border border-emerald-100">
        <div className="flex p-2 bg-emerald-50/50 border-b border-emerald-100">
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

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-emerald-900 mb-1.5">Nome Giocatore</label>
            <input
              type="text"
              value={playerName}
              onChange={handleNameChange}
              placeholder="Es. Luca"
              maxLength={18}
              className="w-full px-4 py-3 rounded-xl bg-emerald-50/50 border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-emerald-900 placeholder:text-emerald-300"
            />
          </div>

          {activeMode === "create" ? (
            <>
              <div>
                <label className="block text-sm font-medium text-emerald-900 mb-1.5">Punti per vincere</label>
                <select
                  value={targetPoints}
                  onChange={(e) => setTargetPoints(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-emerald-50/50 border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-emerald-900"
                >
                  <option value="31">31 punti</option>
                  <option value="41">41 punti</option>
                </select>
              </div>
              <button
                onClick={createRoom}
                disabled={loading}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] disabled:opacity-70"
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
                  className="w-full px-4 py-3 rounded-xl bg-emerald-50/50 border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-emerald-900 placeholder:text-emerald-300 uppercase"
                />
              </div>
              <button
                onClick={joinRoom}
                disabled={loading}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] disabled:opacity-70"
              >
                {loading ? "Accesso..." : "Entra nella Stanza"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
