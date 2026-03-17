import { useState, useEffect } from "react";
import { doc, updateDoc, runTransaction, deleteDoc, arrayRemove } from "firebase/firestore";
import { db } from "../firebase";
import { SUITS, cardImage, formatCard, compareCards, cardPoints, pointsFromUnits, buildDeck, shuffle, dealFullDeck, POINT_UNIT } from "../lib/gameLogic";
import { LogOut, ChevronUp, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

export default function GameScreen({ room, players, user, onLeave }: any) {
  const [isHandOpen, setIsHandOpen] = useState(window.innerWidth >= 900);
  const me = players.find((p: any) => p.id === user.uid);
  const isHost = room.hostId === user.uid;
  const order = room.playerOrder || [];
  const turnPlayerId = order[room.turnIndex];
  const isMyTurn = turnPlayerId === user.uid;
  const phase = room.phase;

  useEffect(() => {
    const handleResize = () => setIsHandOpen(window.innerWidth >= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getSeatMap = () => {
    if (!order.length) return null;
    const startIndex = order.includes(user.uid) ? order.indexOf(user.uid) : 0;
    return {
      bottom: order[startIndex],
      left: order[(startIndex + 1) % order.length],
      top: order[(startIndex + 2) % order.length],
      right: order[(startIndex + 3) % order.length],
    };
  };

  const seatMap = getSeatMap();
  const tableMap = new Map((room.table || []).map((entry: any) => [entry.playerId, entry.card]));

  const handleLeave = async () => {
    const message = room.status === "playing"
      ? "Uscendo dalla partita, la sessione terminerà per tutti. Vuoi uscire davvero?"
      : "Vuoi uscire dalla stanza?";
    if (!confirm(message)) return;
    
    try {
      await deleteDoc(doc(db, "rooms", room.id, "players", user.uid));
      await updateDoc(doc(db, "rooms", room.id), { playerIds: arrayRemove(user.uid) });
    } catch (e) {
      console.error(e);
    }
    onLeave();
  };

  const endGame = async () => {
    if (!isHost) return;
    await updateDoc(doc(db, "rooms", room.id), { status: "ended", phase: "ended" });
  };

  const chooseBriscola = async (suit: string) => {
    if (phase !== "choose_briscola" || room.briscolaChooserId !== user.uid) return;
    await updateDoc(doc(db, "rooms", room.id), {
      briscolaSuit: suit,
      phase: "playing",
      table: [],
      turnIndex: room.briscolaChooserIndex ?? 0,
    });
  };

  const playCard = async (card: string) => {
    if (phase !== "playing" || !isMyTurn || !room.briscolaSuit) return;

    await runTransaction(db, async (tx) => {
      const roomDoc = doc(db, "rooms", room.id);
      const roomSnap = await tx.get(roomDoc);
      if (!roomSnap.exists()) return;
      const currentRoom = roomSnap.data();
      if (currentRoom.status !== "playing" || currentRoom.phase !== "playing") return;

      const meRef = doc(db, "rooms", room.id, "players", user.uid);
      const meSnap = await tx.get(meRef);
      if (!meSnap.exists()) return;
      
      const hand = [...(meSnap.data().hand || [])];
      const index = hand.indexOf(card);
      if (index === -1) return;

      const leadSuit = currentRoom.table?.length ? currentRoom.table[0].card.split('-')[0] : null;
      if (leadSuit) {
        const hasLeadSuit = hand.some((c) => c.split('-')[0] === leadSuit);
        const cardSuit = card.split('-')[0];
        if (hasLeadSuit && cardSuit !== leadSuit) return; // Must follow suit
      }

      hand.splice(index, 1);
      const table = [...(currentRoom.table || []), { playerId: user.uid, card }];

      let nextIndex = (currentRoom.turnIndex + 1) % order.length;
      let tableUpdate = table;
      let handTeamA = currentRoom.handTeamA || 0;
      let handTeamB = currentRoom.handTeamB || 0;
      let trickCount = currentRoom.trickCount || 0;
      let scoreTeamA = currentRoom.scoreTeamA || 0;
      let scoreTeamB = currentRoom.scoreTeamB || 0;
      let nextPhase = currentRoom.phase;
      let status = currentRoom.status;
      let briscolaSuit = currentRoom.briscolaSuit;
      let briscolaChooserIndex = currentRoom.briscolaChooserIndex ?? 0;
      let briscolaChooserId = currentRoom.briscolaChooserId;
      let handNumber = currentRoom.handNumber || 1;

      if (table.length === order.length) {
        const lead = table[0].card.split('-')[0];
        let winning = table[0];
        for (const entry of table.slice(1)) {
          if (compareCards(entry.card, winning.card, lead, briscolaSuit) > 0) {
            winning = entry;
          }
        }
        
        const winnerId = winning.playerId;
        const winnerIndex = order.indexOf(winnerId);
        const points = table.reduce((sum, entry) => sum + cardPoints(entry.card), 0);
        const winnerTeam = currentRoom.teamByPlayer?.[winnerId];
        
        if (winnerTeam === "A") handTeamA += points;
        else if (winnerTeam === "B") handTeamB += points;

        trickCount += 1;
        tableUpdate = [];
        nextIndex = winnerIndex;

        if (trickCount >= 10) {
          const lastTrickBonus = POINT_UNIT;
          if (winnerTeam === "A") handTeamA += lastTrickBonus;
          else if (winnerTeam === "B") handTeamB += lastTrickBonus;

          scoreTeamA += pointsFromUnits(handTeamA);
          scoreTeamB += pointsFromUnits(handTeamB);

          const target = currentRoom.targetPoints || 31;
          if (scoreTeamA >= target || scoreTeamB >= target) {
            status = "ended";
            nextPhase = "ended";
          } else {
            const deck = shuffle(buildDeck());
            const hands = dealFullDeck(order, deck);
            briscolaChooserIndex = (briscolaChooserIndex + 1) % order.length;
            briscolaChooserId = order[briscolaChooserIndex];

            order.forEach((playerId) => {
              tx.update(doc(db, "rooms", room.id, "players", playerId), { hand: hands[playerId] });
            });

            handTeamA = 0;
            handTeamB = 0;
            trickCount = 0;
            briscolaSuit = null;
            nextPhase = "choose_briscola";
            handNumber += 1;
            nextIndex = briscolaChooserIndex;
          }
        }
      }

      tx.update(meRef, { hand });
      tx.update(roomDoc, {
        table: tableUpdate,
        turnIndex: nextIndex,
        handTeamA,
        handTeamB,
        trickCount,
        scoreTeamA,
        scoreTeamB,
        phase: nextPhase,
        status,
        briscolaSuit,
        briscolaChooserId,
        briscolaChooserIndex,
        handNumber,
      });
    });
  };

  const getTeamNames = (team: string) => {
    return Object.entries(room.teamByPlayer || {})
      .filter(([, t]) => t === team)
      .map(([id]) => players.find((p: any) => p.id === id)?.name)
      .filter(Boolean)
      .join(" + ") || "--";
  };

  const renderSeat = (position: string, playerId: string) => {
    const player = players.find((p: any) => p.id === playerId);
    const card = tableMap.get(playerId);
    const isTurn = turnPlayerId === playerId && phase === "playing";

    return (
      <div className={cn(
        "absolute flex flex-col items-center gap-2 transition-all",
        position === "bottom" && "bottom-4 left-1/2 -translate-x-1/2",
        position === "top" && "top-4 left-1/2 -translate-x-1/2",
        position === "left" && "left-4 top-1/2 -translate-y-1/2",
        position === "right" && "right-4 top-1/2 -translate-y-1/2"
      )}>
        <div className={cn(
          "px-3 py-1 rounded-full text-xs font-semibold shadow-sm border whitespace-nowrap",
          isTurn ? "bg-emerald-500 text-white border-emerald-600" : "bg-white/90 text-stone-800 border-stone-200/50"
        )}>
          {player?.name || "--"}
        </div>
        <div className="w-16 h-24 rounded-lg bg-black/10 border border-white/10 flex items-center justify-center">
          {card && (
            <motion.img
              initial={{ scale: 0, rotate: position === 'left' ? 90 : position === 'right' ? -90 : 0 }}
              animate={{ scale: 1, rotate: 0 }}
              src={cardImage(card as string)}
              alt={formatCard(card as string)}
              className="w-full h-full object-contain drop-shadow-lg"
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-emerald-950 text-stone-100 flex flex-col overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '24px 24px' }} />

      {/* Header / HUD */}
      <div className="relative z-10 p-4 flex flex-col gap-3 bg-emerald-900/50 backdrop-blur-md border-b border-white/10">
        <div className="flex justify-between items-center">
          <div className="flex gap-4 items-center">
            <div className="flex flex-col">
              <span className="text-xs text-emerald-300 font-mono uppercase tracking-wider">Mano {room.handNumber || 1}</span>
              <span className="font-medium">
                {room.status === "ended" ? "Partita Chiusa" : 
                 phase === "choose_briscola" ? (room.briscolaChooserId === user.uid ? "Scegli la briscola!" : `Attesa briscola da ${players.find((p: any)=>p.id===room.briscolaChooserId)?.name}`) :
                 isMyTurn ? "Tocca a te!" : `Turno di ${players.find((p: any)=>p.id===turnPlayerId)?.name}`}
              </span>
            </div>
            {room.briscolaSuit && (
              <div className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 flex items-center gap-2">
                <span className="text-xs text-emerald-200 uppercase tracking-wider">Briscola</span>
                <span className="font-bold">{SUITS.find(s => s.key === room.briscolaSuit)?.label}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {isHost && (
              <button onClick={endGame} className="px-3 py-1.5 text-xs font-medium bg-red-500/20 text-red-200 hover:bg-red-500/30 rounded-lg transition-colors">
                Termina
              </button>
            )}
            <button onClick={handleLeave} className="p-1.5 text-emerald-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/10 rounded-xl p-2.5 flex items-center justify-between border border-white/5">
            <div className="flex flex-col">
              <span className="text-xs text-emerald-300 font-medium">Squadra A</span>
              <span className="text-[10px] text-emerald-400/80 truncate max-w-[100px]">{getTeamNames("A")}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">{room.scoreTeamA || 0}</span>
              <span className="text-xs text-emerald-300">+{pointsFromUnits(Number(room.handTeamA) || 0)}</span>
            </div>
          </div>
          <div className="bg-white/10 rounded-xl p-2.5 flex items-center justify-between border border-white/5">
            <div className="flex flex-col">
              <span className="text-xs text-emerald-300 font-medium">Squadra B</span>
              <span className="text-[10px] text-emerald-400/80 truncate max-w-[100px]">{getTeamNames("B")}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">{room.scoreTeamB || 0}</span>
              <span className="text-xs text-emerald-300">+{pointsFromUnits(Number(room.handTeamB) || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 relative min-h-0">
        {seatMap && (
          <>
            {renderSeat("top", seatMap.top)}
            {renderSeat("left", seatMap.left)}
            {renderSeat("right", seatMap.right)}
            {renderSeat("bottom", seatMap.bottom)}
          </>
        )}

        {/* Briscola Picker Overlay */}
        <AnimatePresence>
          {phase === "choose_briscola" && room.briscolaChooserId === user.uid && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            >
              <div className="bg-white text-stone-900 p-6 rounded-3xl shadow-2xl max-w-sm w-full">
                <h3 className="text-xl font-serif font-bold text-center mb-6 text-emerald-900">Scegli la Briscola</h3>
                <div className="grid grid-cols-2 gap-3">
                  {SUITS.map(suit => (
                    <button
                      key={suit.key}
                      onClick={() => chooseBriscola(suit.key)}
                      className="py-4 px-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 font-medium text-emerald-900 transition-colors flex flex-col items-center gap-2"
                    >
                      {suit.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hand Drawer */}
      {room.status !== "ended" && (
        <div className="relative z-30">
          <button 
            onClick={() => setIsHandOpen(!isHandOpen)}
            className="absolute -top-10 left-1/2 -translate-x-1/2 bg-emerald-800/90 backdrop-blur-md text-white px-4 py-1.5 rounded-t-xl text-xs font-medium flex items-center gap-1 border border-b-0 border-white/10"
          >
            {isHandOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            {isHandOpen ? "Nascondi Mano" : "Mostra Mano"}
          </button>
          
          <AnimatePresence initial={false}>
            {isHandOpen && (
              <motion.div 
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                className="bg-emerald-800/90 backdrop-blur-md border-t border-white/10 overflow-hidden"
              >
                <div className="p-4 overflow-x-auto">
                  <div className="flex gap-2 min-w-max pb-2 px-2">
                    {me?.hand?.map((card: string) => {
                      const isPlayable = phase === "playing" && isMyTurn;
                      return (
                        <motion.div
                          key={card}
                          whileHover={isPlayable ? { y: -10 } : {}}
                          whileTap={isPlayable ? { scale: 0.95 } : {}}
                          onClick={() => isPlayable && playCard(card)}
                          className={cn(
                            "w-20 sm:w-24 flex-shrink-0 rounded-xl bg-white p-1.5 shadow-lg transition-shadow",
                            isPlayable ? "cursor-pointer ring-2 ring-amber-400 shadow-amber-400/20" : "opacity-80 grayscale-[20%]"
                          )}
                        >
                          <img src={cardImage(card)} alt={formatCard(card)} className="w-full h-auto rounded-lg" />
                        </motion.div>
                      );
                    })}
                    {(!me?.hand || me.hand.length === 0) && (
                      <div className="text-emerald-300/50 text-sm italic py-8 px-4 text-center w-full">
                        Nessuna carta in mano
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
