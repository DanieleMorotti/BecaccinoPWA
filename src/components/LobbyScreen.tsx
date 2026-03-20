import { doc, updateDoc, runTransaction, serverTimestamp, deleteDoc, arrayRemove } from "firebase/firestore";
import { db } from "../firebase";
import { countTeams, MAX_PLAYERS, shuffle, buildDeck, dealFullDeck } from "../lib/gameLogic";
import { Users, Copy, Check, LogOut, Play, UserMinus } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

export default function LobbyScreen({ room, players, user, onLeave }: any) {
  const [copied, setCopied] = useState(false);
  const isHost = room.hostId === user.uid;

  useEffect(() => {
    if (room.lobbyReason) {
      toast.error(room.lobbyReason);
      if (isHost) {
        updateDoc(doc(db, "rooms", room.id), { lobbyReason: null }).catch(() => {});
      }
    }
  }, [room.lobbyReason, room.id, isHost]);

  const handleLeave = async () => {
    try {
      if (isHost) {
        await updateDoc(doc(db, "rooms", room.id), { status: "closed" });
        // Delete all players
        for (const p of players) {
          await deleteDoc(doc(db, "rooms", room.id, "players", p.id));
        }
        await deleteDoc(doc(db, "rooms", room.id));
      } else {
        await deleteDoc(doc(db, "rooms", room.id, "players", user.uid));
        await updateDoc(doc(db, "rooms", room.id), { playerIds: arrayRemove(user.uid) });
      }
    } catch (e) {
      console.error(e);
    }
    onLeave();
  };

  const [playerToKick, setPlayerToKick] = useState<string | null>(null);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const textArea = document.createElement("textarea");
      textArea.value = room.id;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        console.error("Copy failed", e);
      }
      document.body.removeChild(textArea);
    }
  };

  const kickPlayer = async (playerId: string) => {
    if (!isHost || playerId === user.uid) return;
    setPlayerToKick(playerId);
  };

  const confirmKickPlayer = async () => {
    if (!playerToKick) return;
    try {
      await deleteDoc(doc(db, "rooms", room.id, "players", playerToKick));
      await updateDoc(doc(db, "rooms", room.id), { playerIds: arrayRemove(playerToKick) });
    } catch (e) {
      console.error(e);
    }
    setPlayerToKick(null);
  };

  const updateTeam = async (playerId: string, team: string) => {
    if (!isHost) return;
    const counts = countTeams(players);
    const player = players.find((p: any) => p.id === playerId);
    
    if (team && counts[team as "A" | "B"] >= 2 && player?.team !== team) {
      toast.error("La squadra selezionata è già completa.");
      return;
    }
    
    await updateDoc(doc(db, "rooms", room.id, "players", playerId), { team: team || null });
  };

  const startGame = async () => {
    if (!isHost) return;
    
    try {
      await runTransaction(db, async (tx) => {
        const roomDoc = doc(db, "rooms", room.id);
        const roomSnap = await tx.get(roomDoc);
        if (!roomSnap.exists()) throw new Error("Room not found");
        
        const currentRoom = roomSnap.data();
        if (currentRoom.status !== "lobby") throw new Error("Already started");

        const playerIds = currentRoom.playerIds || [];
        if (playerIds.length !== MAX_PLAYERS) throw new Error("Not enough players");

        const currentPlayers = [];
        for (const playerId of playerIds) {
          const snap = await tx.get(doc(db, "rooms", room.id, "players", playerId));
          if (!snap.exists()) throw new Error("Missing player");
          currentPlayers.push({ id: playerId, ...snap.data() });
        }

        const teamByPlayer: Record<string, string> = {};
        const teamA: string[] = [];
        const teamB: string[] = [];
        currentPlayers.forEach((p) => {
          if (p.team === "A") { teamA.push(p.id); teamByPlayer[p.id] = "A"; }
          else if (p.team === "B") { teamB.push(p.id); teamByPlayer[p.id] = "B"; }
        });
        
        if (teamA.length !== 2 || teamB.length !== 2) throw new Error("Teams not ready");

        const order = [teamA[0], teamB[0], teamA[1], teamB[1]];
        const deck = shuffle(buildDeck());
        const hands = dealFullDeck(order, deck);

        const firstChooserId = order.find((id) => hands[id]?.includes("COINS-4")) || order[0];
        const chooserIndex = order.indexOf(firstChooserId);

        order.forEach((playerId) => {
          tx.update(doc(db, "rooms", room.id, "players", playerId), { hand: hands[playerId], ready: false });
        });

        tx.update(roomDoc, {
          status: "playing",
          phase: "choose_briscola",
          playerOrder: order,
          teamByPlayer,
          table: [],
          handNumber: 1,
          briscolaSuit: null,
          briscolaChooserId: firstChooserId,
          briscolaChooserIndex: chooserIndex,
          turnIndex: chooserIndex,
          handTeamA: 0,
          handTeamB: 0,
          trickCount: 0,
          startedAt: serverTimestamp(),
        });
      });
    } catch (e: any) {
      if (e.message.includes("Teams")) toast.error("Assegna 2 giocatori per squadra prima di iniziare.");
      else if (e.message.includes("Not enough")) toast.error("Servono 4 giocatori.");
      else toast.error("Impossibile avviare la partita.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 pt-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-serif font-bold text-emerald-900">Lobby</h1>
          <p className="text-emerald-600 text-sm mt-1">
            Target: {room.targetPoints} punti
          </p>
        </div>
        <button
          onClick={handleLeave}
          className="text-stone-500 hover:text-stone-700 px-4 py-2 rounded-xl hover:bg-stone-200/50 transition-colors text-sm font-medium flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Esci
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-xl shadow-emerald-900/5 border border-emerald-100 overflow-hidden mb-6">
        <div className="p-6 text-center border-b border-emerald-100 bg-emerald-50/30">
          <p className="text-sm font-medium text-emerald-600 mb-2 uppercase tracking-wider">Codice Stanza</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-4xl font-mono font-bold text-emerald-900 tracking-widest">{room.id}</span>
            <button
              onClick={handleCopyCode}
              className="p-2 rounded-xl hover:bg-emerald-100 text-emerald-600 transition-colors"
              title="Copia codice"
            >
              {copied ? <Check className="w-6 h-6" /> : <Copy className="w-6 h-6" />}
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-emerald-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              Giocatori ({players.length}/{MAX_PLAYERS})
            </h2>
          </div>

          <div className="space-y-3">
            {players.map((player: any) => (
              <div key={player.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-stone-50 border border-stone-100 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold shrink-0">
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-stone-900 truncate">
                      {player.name} {player.id === user.uid && "(Tu)"}
                    </p>
                    {player.id === room.hostId && (
                      <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full inline-block mt-1">Host</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={player.team || ""}
                    onChange={(e) => updateTeam(player.id, e.target.value)}
                    disabled={!isHost}
                    className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-white border border-stone-200 text-sm font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-70 disabled:bg-stone-50"
                  >
                    <option value="">Nessuna squadra</option>
                    <option value="A">Squadra A</option>
                    <option value="B">Squadra B</option>
                  </select>
                  {isHost && player.id !== user.uid && (
                    <button
                      onClick={() => kickPlayer(player.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                      title="Espelli giocatore"
                    >
                      <UserMinus className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            
            {Array.from({ length: MAX_PLAYERS - players.length }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center justify-between p-4 rounded-2xl bg-stone-50/50 border border-stone-100 border-dashed">
                <div className="flex items-center gap-3 opacity-50">
                  <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center text-stone-400">
                    ?
                  </div>
                  <p className="font-medium text-stone-500">In attesa...</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isHost && (
        <button
          onClick={startGame}
          disabled={players.length !== MAX_PLAYERS}
          className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-semibold shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
        >
          <Play className="w-5 h-5" />
          Inizia Partita
        </button>
      )}
      {!isHost && (
        <div className="text-center p-4 rounded-2xl bg-stone-100 text-stone-600 font-medium">
          In attesa che l'host avvii la partita...
        </div>
      )}

      {/* Kick Confirm Modal */}
      <AnimatePresence>
        {playerToKick && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white p-6 rounded-2xl max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-xl font-bold text-stone-900 mb-2">Espelli giocatore</h3>
              <p className="text-stone-600 mb-6">
                Sei sicuro di voler espellere questo giocatore dalla stanza?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setPlayerToKick(null)}
                  className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={confirmKickPlayer}
                  className="px-4 py-2 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors shadow-lg shadow-red-500/20"
                >
                  Espelli
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
