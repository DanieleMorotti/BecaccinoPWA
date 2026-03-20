import { useState, useEffect } from "react";
import { doc, updateDoc, runTransaction, deleteDoc, arrayRemove } from "firebase/firestore";
import { db } from "../firebase";
import { SUITS, cardImage, formatCard, compareCards, cardPoints, pointsFromUnits, buildDeck, shuffle, dealFullDeck, POINT_UNIT, parseCard, TRICK_RANK } from "../lib/gameLogic";
import { LogOut, ChevronUp, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

export default function GameScreen({ room, players, user, onLeave }: any) {
  const [isHandOpen, setIsHandOpen] = useState(window.innerWidth >= 900);
  const [selectedCardToPlay, setSelectedCardToPlay] = useState<string | null>(null);
  const [isScoresOpen, setIsScoresOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
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
    if (!confirm("Sei sicuro di voler terminare la partita e tornare alla lobby?")) return;
    await updateDoc(doc(db, "rooms", room.id), { status: "lobby", phase: "waiting" });
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

  const leadSuit = room.table?.length ? room.table[0].card.split('-')[0] : null;
  const hasLeadSuit = me?.hand?.some((c: string) => c.split('-')[0] === leadSuit);

  const isCardPlayable = (card: string) => {
    if (phase !== "playing" || !isMyTurn || !room.briscolaSuit) return false;
    if (leadSuit && hasLeadSuit) {
      return card.split('-')[0] === leadSuit;
    }
    return true;
  };

  const handleCardClick = (card: string) => {
    if (!isCardPlayable(card)) return;
    if (selectedCardToPlay === card) {
      playCard(card);
      setSelectedCardToPlay(null);
    } else {
      setSelectedCardToPlay(card);
    }
  };

  const playCard = async (card: string) => {
    if (!isCardPlayable(card)) return;

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

      const currentLeadSuit = currentRoom.table?.length ? currentRoom.table[0].card.split('-')[0] : null;
      if (currentLeadSuit) {
        const currentHasLeadSuit = hand.some((c) => c.split('-')[0] === currentLeadSuit);
        const cardSuit = card.split('-')[0];
        if (currentHasLeadSuit && cardSuit !== currentLeadSuit) return; // Must follow suit
      }

      hand.splice(index, 1);
      const table = [...(currentRoom.table || []), { playerId: user.uid, card }];

      let nextIndex = (currentRoom.turnIndex + 1) % order.length;

      if (table.length === order.length) {
        const lead = table[0].card.split('-')[0];
        let winning = table[0];
        for (const entry of table.slice(1)) {
          if (compareCards(entry.card, winning.card, lead, currentRoom.briscolaSuit) > 0) {
            winning = entry;
          }
        }
        
        tx.update(meRef, { hand });
        tx.update(roomDoc, {
          table,
          phase: "trick_end",
          trickWinnerId: winning.playerId,
          turnIndex: order.indexOf(winning.playerId)
        });
        return;
      }

      tx.update(meRef, { hand });
      tx.update(roomDoc, {
        table,
        turnIndex: nextIndex,
      });
    });
  };

  useEffect(() => {
    if (room.phase === "trick_end" && isHost) {
      const timer = setTimeout(async () => {
        await resolveTrick();
      }, 3000);
      return () => clearTimeout(timer);
    }
    if (room.phase === "hand_end" && isHost) {
      const timer = setTimeout(async () => {
        await startNextHand();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [room.phase, isHost, room.id]);

  const startNextHand = async () => {
    await runTransaction(db, async (tx) => {
      const roomDoc = doc(db, "rooms", room.id);
      const roomSnap = await tx.get(roomDoc);
      if (!roomSnap.exists()) return;
      const currentRoom = roomSnap.data();
      if (currentRoom.phase !== "hand_end") return;

      const target = currentRoom.targetPoints || 31;
      if (currentRoom.scoreTeamA >= target || currentRoom.scoreTeamB >= target) {
        tx.update(roomDoc, { status: "ended", phase: "ended" });
        return;
      }

      const order = currentRoom.playerOrder || [];
      const deck = shuffle(buildDeck());
      const hands = dealFullDeck(order, deck);
      const briscolaChooserIndex = ((currentRoom.briscolaChooserIndex ?? 0) + 1) % order.length;
      const briscolaChooserId = order[briscolaChooserIndex];

      order.forEach((playerId: string) => {
        tx.update(doc(db, "rooms", room.id, "players", playerId), { hand: hands[playerId] });
      });

      tx.update(roomDoc, {
        phase: "choose_briscola",
        handTeamA: 0,
        handTeamB: 0,
        trickCount: 0,
        briscolaSuit: null,
        briscolaChooserId,
        briscolaChooserIndex,
        turnIndex: briscolaChooserIndex,
        handNumber: (currentRoom.handNumber || 1) + 1,
      });
    });
  };

  const resolveTrick = async () => {
    await runTransaction(db, async (tx) => {
      const roomDoc = doc(db, "rooms", room.id);
      const roomSnap = await tx.get(roomDoc);
      if (!roomSnap.exists()) return;
      const currentRoom = roomSnap.data();
      if (currentRoom.phase !== "trick_end") return;

      const table = currentRoom.table || [];
      if (table.length < 4) return;

      const lead = table[0].card.split('-')[0];
      let winning = table[0];
      for (const entry of table.slice(1)) {
        if (compareCards(entry.card, winning.card, lead, currentRoom.briscolaSuit) > 0) {
          winning = entry;
        }
      }

      const winnerId = winning.playerId;
      const points = table.reduce((sum: number, entry: any) => sum + cardPoints(entry.card), 0);
      const winnerTeam = currentRoom.teamByPlayer?.[winnerId];
      
      let handTeamA = currentRoom.handTeamA || 0;
      let handTeamB = currentRoom.handTeamB || 0;
      if (winnerTeam === "A") handTeamA += points;
      else if (winnerTeam === "B") handTeamB += points;

      let trickCount = (currentRoom.trickCount || 0) + 1;
      let scoreTeamA = currentRoom.scoreTeamA || 0;
      let scoreTeamB = currentRoom.scoreTeamB || 0;
      let nextPhase = "playing";
      let status = currentRoom.status;
      let briscolaSuit = currentRoom.briscolaSuit;
      let briscolaChooserIndex = currentRoom.briscolaChooserIndex ?? 0;
      let briscolaChooserId = currentRoom.briscolaChooserId;
      let handNumber = currentRoom.handNumber || 1;
      const order = currentRoom.playerOrder || [];

      if (trickCount >= 10) {
        const lastTrickBonus = POINT_UNIT;
        if (winnerTeam === "A") handTeamA += lastTrickBonus;
        else if (winnerTeam === "B") handTeamB += lastTrickBonus;

        scoreTeamA += pointsFromUnits(handTeamA);
        scoreTeamB += pointsFromUnits(handTeamB);

        tx.update(roomDoc, {
          table: [],
          phase: "hand_end",
          status,
          handTeamA,
          handTeamB,
          trickCount,
          scoreTeamA,
          scoreTeamB,
          trickWinnerId: null
        });
        return;
      }

      tx.update(roomDoc, {
        table: [],
        phase: nextPhase,
        status,
        handTeamA,
        handTeamB,
        trickCount,
        scoreTeamA,
        scoreTeamB,
        briscolaSuit,
        briscolaChooserId,
        briscolaChooserIndex,
        handNumber,
        trickWinnerId: null
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

  const getWinningPlayerId = () => {
    if (!room.table || room.table.length === 0) return null;
    const lead = room.table[0].card.split('-')[0];
    let winning = room.table[0];
    for (const entry of room.table.slice(1)) {
      if (compareCards(entry.card, winning.card, lead, room.briscolaSuit) > 0) {
        winning = entry;
      }
    }
    return winning.playerId;
  };

  const currentWinningPlayerId = getWinningPlayerId();

  const renderSeat = (position: string, playerId: string) => {
    const player = players.find((p: any) => p.id === playerId);
    const card = tableMap.get(playerId);
    const isTurn = turnPlayerId === playerId && phase === "playing";
    const team = room.teamByPlayer?.[playerId];
    const isWinning = currentWinningPlayerId === playerId && (room.table?.length || 0) > 1;

    return (
      <div className={cn(
        "absolute flex flex-col items-center gap-2 transition-all",
        position === "bottom" && "bottom-10 left-1/2 -translate-x-1/2",
        position === "top" && "top-16 left-1/2 -translate-x-1/2",
        position === "left" && "left-4 top-1/2 -translate-y-1/2",
        position === "right" && "right-4 top-1/2 -translate-y-1/2"
      )}>
        <div className={cn(
          "px-3 py-1 rounded-full text-xs font-semibold shadow-sm border whitespace-nowrap flex items-center gap-1.5 transition-all duration-300",
          isTurn ? "bg-amber-400 text-amber-950 border-amber-500 shadow-[0_0_15px_rgba(251,191,36,0.6)] scale-110" : "bg-white/90 text-stone-800 border-stone-200/50"
        )}>
          <span>{player?.name || "--"}</span>
          {team && (
            <span className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-bold",
              team === "A" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
            )}>
              {team}
            </span>
          )}
        </div>
        <div className={cn(
          "w-16 h-24 rounded-lg bg-black/10 flex items-center justify-center transition-all relative",
          isWinning ? "border-2 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]" : "border border-white/10"
        )}>
          {card && (
            <motion.img
              initial={{ scale: 0, rotate: position === 'left' ? 90 : position === 'right' ? -90 : 0 }}
              animate={{ scale: 1, rotate: 0 }}
              src={cardImage(card as string)}
              alt={formatCard(card as string)}
              className="w-full h-full object-contain drop-shadow-lg rounded-lg"
            />
          )}
          {isWinning && (
            <div className="absolute -top-2 -right-2 bg-amber-400 text-amber-950 rounded-full p-0.5 shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>
      </div>
    );
  };

  const sortedHand = [...(me?.hand || [])].sort((a, b) => {
    const ca = parseCard(a);
    const cb = parseCard(b);
    if (ca.suit !== cb.suit) return ca.suit.localeCompare(cb.suit);
    return (TRICK_RANK.get(cb.rank) ?? 99) - (TRICK_RANK.get(ca.rank) ?? 99);
  });

  return (
    <div className="fixed inset-0 bg-emerald-950 text-stone-100 flex flex-col overflow-hidden bg-[url('/assets/table.jpg')] bg-cover bg-center">
      <div className="absolute inset-0 bg-emerald-950/80 pointer-events-none" />

      {/* HUD */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 pointer-events-none">
        {/* Left side: Punti */}
        <div className="flex flex-col gap-2 pointer-events-auto">
          <button 
            onClick={() => { setIsScoresOpen(!isScoresOpen); setIsInfoOpen(false); }}
            className="bg-emerald-900/90 backdrop-blur-md text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 border border-white/10 shadow-lg"
          >
            Punti {isScoresOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          <AnimatePresence>
            {isScoresOpen && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-emerald-900/95 backdrop-blur-md rounded-xl p-3 border border-white/10 flex flex-col gap-3 w-40 shadow-xl"
              >
                <div className="flex flex-col">
                  <span className="text-xs text-emerald-300 font-medium">Squadra A</span>
                  <span className="text-[10px] text-emerald-400/80 truncate">{getTeamNames("A")}</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold text-white leading-none">{room.scoreTeamA || 0}</span>
                    <span className="text-xs text-emerald-300">+{pointsFromUnits(Number(room.handTeamA) || 0)}</span>
                  </div>
                </div>
                <div className="h-px bg-white/10 w-full" />
                <div className="flex flex-col">
                  <span className="text-xs text-emerald-300 font-medium">Squadra B</span>
                  <span className="text-[10px] text-emerald-400/80 truncate">{getTeamNames("B")}</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold text-white leading-none">{room.scoreTeamB || 0}</span>
                    <span className="text-xs text-emerald-300">+{pointsFromUnits(Number(room.handTeamB) || 0)}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right side: Info */}
        <div className="flex flex-col gap-2 items-end pointer-events-auto">
          <button 
            onClick={() => { setIsInfoOpen(!isInfoOpen); setIsScoresOpen(false); }}
            className="bg-emerald-900/90 backdrop-blur-md text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 border border-white/10 shadow-lg"
          >
            Info {isInfoOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <AnimatePresence>
            {isInfoOpen && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-emerald-900/95 backdrop-blur-md rounded-xl p-3 border border-white/10 flex flex-col gap-3 w-48 shadow-xl items-end text-right"
              >
                <div className="flex flex-col items-end">
                  <span className="text-xs text-emerald-300 font-medium uppercase tracking-wider">Mano</span>
                  <span className="text-lg font-bold text-white">{room.handNumber || 1}</span>
                </div>
                
                {room.briscolaSuit && (
                  <>
                    <div className="h-px bg-white/10 w-full" />
                    <div className="flex flex-col items-end">
                      <span className="text-xs text-emerald-300 font-medium uppercase tracking-wider">Briscola</span>
                      <span className="text-lg font-bold text-white">{SUITS.find(s => s.key === room.briscolaSuit)?.label}</span>
                      <span className="text-[10px] text-emerald-400">scelta da {players.find((p: any) => p.id === room.briscolaChooserId)?.name}</span>
                    </div>
                  </>
                )}

                <div className="h-px bg-white/10 w-full" />
                <div className="flex gap-2 w-full justify-end">
                  {isHost && (
                    <button onClick={endGame} className="px-3 py-1.5 text-xs font-medium bg-red-500/80 text-white hover:bg-red-500 rounded-lg transition-colors shadow-lg">
                      Termina
                    </button>
                  )}
                  <button onClick={handleLeave} className="p-1.5 bg-emerald-800/80 text-emerald-300 hover:text-white hover:bg-emerald-700 rounded-lg transition-colors border border-white/10 shadow-lg">
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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

        {/* Trick Winner Overlay */}
        <AnimatePresence>
          {phase === "trick_end" && room.trickWinnerId && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -20 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
            >
              <div className="bg-emerald-900/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl border border-emerald-500/30 text-lg font-serif font-bold whitespace-nowrap">
                Ha preso {players.find((p: any) => p.id === room.trickWinnerId)?.name}!
              </div>
            </motion.div>
          )}

          {phase === "hand_end" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -20 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
            >
              <div className="bg-emerald-900/95 backdrop-blur-md text-white p-6 rounded-3xl shadow-2xl border border-amber-500/50 flex flex-col items-center gap-4 min-w-[280px]">
                <h3 className="text-2xl font-serif font-bold text-amber-400">Fine Mano {room.handNumber}</h3>
                <div className="flex w-full justify-between items-center px-4">
                  <div className="flex flex-col items-center">
                    <span className="text-sm text-emerald-300 font-medium">Squadra A</span>
                    <span className="text-3xl font-bold">+{pointsFromUnits(Number(room.handTeamA) || 0)}</span>
                  </div>
                  <div className="h-12 w-px bg-white/20 mx-4" />
                  <div className="flex flex-col items-center">
                    <span className="text-sm text-emerald-300 font-medium">Squadra B</span>
                    <span className="text-3xl font-bold">+{pointsFromUnits(Number(room.handTeamB) || 0)}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          
          {phase === "choose_briscola" && room.briscolaChooserId !== user.uid && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
            >
              <div className="bg-emerald-900/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl border border-emerald-500/30 text-sm font-medium whitespace-nowrap">
                Attesa briscola da {players.find((p: any) => p.id === room.briscolaChooserId)?.name}...
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                <div className="p-4">
                  <div className="grid grid-cols-5 md:flex md:flex-row md:flex-wrap md:justify-center gap-2 max-w-md md:max-w-4xl mx-auto">
                    {sortedHand.map((card: string) => {
                      const isPlayable = isCardPlayable(card);
                      return (
                        <div
                          key={card}
                          onClick={() => handleCardClick(card)}
                          className={cn(
                            "relative w-full md:w-24 aspect-[2/3] md:aspect-auto md:h-36 rounded-xl bg-white p-1 shadow-lg transition-all duration-200",
                            isPlayable ? "cursor-pointer ring-2 ring-amber-400 shadow-amber-400/20" : "opacity-80 grayscale-[50%]",
                            selectedCardToPlay === card && "ring-4 ring-emerald-500 shadow-emerald-500/50 -translate-y-2"
                          )}
                        >
                          <img src={cardImage(card)} alt={formatCard(card)} className="w-full h-full object-contain rounded-lg pointer-events-none" />
                          {selectedCardToPlay === card && (
                            <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center backdrop-blur-[1px]">
                              <span className="bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">Gioca</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {(!sortedHand || sortedHand.length === 0) && (
                      <div className="col-span-5 md:w-full text-emerald-300/50 text-sm italic py-8 px-4 text-center">
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
      {/* End Game Overlay */}
      {room.status === "ended" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-emerald-900 text-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center border border-emerald-500/30">
            <h2 className="text-3xl font-serif font-bold mb-2 text-amber-400">Partita Terminata!</h2>
            <div className="text-xl mb-6">
              {room.scoreTeamA >= (room.targetPoints || 31) && room.scoreTeamA > room.scoreTeamB ? "Vince la Squadra A!" :
               room.scoreTeamB >= (room.targetPoints || 31) && room.scoreTeamB > room.scoreTeamA ? "Vince la Squadra B!" :
               "Pareggio!"}
            </div>
            <div className="flex justify-center gap-8 mb-8">
              <div className="flex flex-col items-center">
                <span className="text-sm text-emerald-300">Squadra A</span>
                <span className="text-4xl font-bold">{room.scoreTeamA}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-sm text-emerald-300">Squadra B</span>
                <span className="text-4xl font-bold">{room.scoreTeamB}</span>
              </div>
            </div>
            {isHost && (
              <button 
                onClick={async () => {
                  await updateDoc(doc(db, "rooms", room.id), { status: "lobby", phase: "waiting" });
                }}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold rounded-xl transition-colors"
              >
                Torna alla Lobby
              </button>
            )}
            {!isHost && (
              <p className="text-sm text-emerald-300">In attesa dell'host...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
