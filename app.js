import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  collection,
  query,
  orderBy,
  onSnapshot,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";


const firebaseConfig = {
  apiKey: "AIzaSyBCDflnhtbfqsU6nCAYWQ-pgnDGlOvO8f8",
  authDomain: "becaccino-9bd67.firebaseapp.com",
  projectId: "becaccino-9bd67",
  storageBucket: "becaccino-9bd67.firebasestorage.app",
  messagingSenderId: "506804103545",
  appId: "1:506804103545:web:03d1af7c770cfa16a5e7a8"
};

const MAX_PLAYERS = 4;
const ROOM_CODE_LENGTH = 6;
const POINT_UNIT = 3; // 1 punto = 3 unita (terzi di punto)

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const state = {
  user: null,
  roomId: null,
  room: null,
  players: [],
};

const el = {
  connectionStatus: document.getElementById("connection-status"),
  setup: document.getElementById("setup"),
  roomSection: document.getElementById("room"),
  roomCode: document.getElementById("room-code"),
  roomMeta: document.getElementById("room-meta"),
  playerList: document.getElementById("player-list"),
  lobby: document.getElementById("lobby"),
  game: document.getElementById("game"),
  handCards: document.getElementById("hand-cards"),
  turnIndicator: document.getElementById("turn-indicator"),
  roundIndicator: document.getElementById("round-indicator"),
  briscolaIndicator: document.getElementById("briscola-indicator"),
  briscolaPicker: document.getElementById("briscola-picker"),
  teamAssignments: document.getElementById("team-assignments"),
  teamANames: document.getElementById("team-a-names"),
  teamBNames: document.getElementById("team-b-names"),
  teamAScore: document.getElementById("team-a-score"),
  teamBScore: document.getElementById("team-b-score"),
  teamAHand: document.getElementById("team-a-hand"),
  teamBHand: document.getElementById("team-b-hand"),
  seatTopName: document.getElementById("seat-top-name"),
  seatTopCard: document.getElementById("seat-top-card"),
  seatLeftName: document.getElementById("seat-left-name"),
  seatLeftCard: document.getElementById("seat-left-card"),
  seatRightName: document.getElementById("seat-right-name"),
  seatRightCard: document.getElementById("seat-right-card"),
  seatBottomName: document.getElementById("seat-bottom-name"),
  seatBottomCard: document.getElementById("seat-bottom-card"),
  toggleHand: document.getElementById("toggle-hand"),
  handPanel: document.getElementById("hand-panel"),
  createPanel: document.getElementById("create-panel"),
  joinPanel: document.getElementById("join-panel"),
  modeButtons: Array.from(document.querySelectorAll(".mode-button")),
  playerNameCreate: document.getElementById("player-name-create"),
  playerNameJoin: document.getElementById("player-name-join"),
  roomCodeInput: document.getElementById("room-code-input"),
  targetPoints: document.getElementById("target-points"),
  createRoom: document.getElementById("create-room"),
  joinRoom: document.getElementById("join-room"),
  leaveRoom: document.getElementById("leave-room"),
  startGame: document.getElementById("start-game"),
  endGame: document.getElementById("end-game"),
};

let unsubRoom = null;
let unsubPlayers = null;
let activeMode = "create";
let isHandOpen = window.matchMedia?.("(min-width: 900px)")?.matches ?? false;

const savedName = localStorage.getItem("becaccino:name");
if (savedName) {
  if (el.playerNameCreate) {
    el.playerNameCreate.value = savedName;
  }
  if (el.playerNameJoin) {
    el.playerNameJoin.value = savedName;
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}

window.addEventListener("online", updateConnection);
window.addEventListener("offline", updateConnection);
updateConnection();

onAuthStateChanged(auth, (user) => {
  state.user = user;
  updateConnection();
});

async function ensureAuth() {
  if (!state.user) {
    await signInAnonymously(auth);
  }
}

function updateConnection() {
  const online = navigator.onLine && state.user;
  el.connectionStatus.textContent = online ? "Online" : "Offline";
}

function setHidden(element, hidden) {
  element.classList.toggle("hidden", hidden);
}

function setMode(mode) {
  activeMode = mode === "join" ? "join" : "create";
  if (el.createPanel) {
    setHidden(el.createPanel, activeMode !== "create");
  }
  if (el.joinPanel) {
    setHidden(el.joinPanel, activeMode !== "join");
  }
  el.modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === activeMode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function getPlayerName() {
  const input = activeMode === "join" ? el.playerNameJoin : el.playerNameCreate;
  const name = input?.value.trim() || "";
  if (!name) {
    alert("Inserisci un nome giocatore.");
    input?.focus();
    return null;
  }
  localStorage.setItem("becaccino:name", name);
  if (el.playerNameCreate) {
    el.playerNameCreate.value = name;
  }
  if (el.playerNameJoin) {
    el.playerNameJoin.value = name;
  }
  return name;
}

function normalizeRoomCode(code) {
  return code.trim().toUpperCase();
}

function generateRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function roomRef(roomId) {
  return doc(db, "rooms", roomId);
}

function playersCol(roomId) {
  return collection(db, "rooms", roomId, "players");
}

function playerRef(roomId, playerId) {
  return doc(db, "rooms", roomId, "players", playerId);
}

function renderRoom() {
  if (!state.roomId || !state.room) {
    setHidden(el.setup, false);
    setHidden(el.roomSection, true);
    document.body.classList.remove("in-game");
    el.roomSection?.classList.remove("playing");
    return;
  }

  setHidden(el.setup, true);
  setHidden(el.roomSection, false);
  el.roomCode.textContent = state.roomId;

  const hostName = state.players.find((player) => player.id === state.room.hostId)?.name || "Host";
  const target = state.room.targetPoints || 31;
  el.roomMeta.textContent = `Host: ${hostName} | Giocatori: ${state.players.length}/${MAX_PLAYERS} | Target: ${target}`;

  const inLobby = state.room.status === "lobby";
  const inGame = state.room.status === "playing";
  const isHost = state.room.hostId === state.user?.uid;
  setHidden(el.lobby, !inLobby);
  setHidden(el.game, inLobby);
  if (el.startGame) {
    setHidden(el.startGame, !isHost);
    el.startGame.disabled = !isHost;
  }
  document.body.classList.toggle("in-game", inGame);
  el.roomSection.classList.toggle("playing", inGame);

  renderPlayers();
  renderTeamAssignments();
  renderGame();
  renderScores();
}

function renderPlayers() {
  el.playerList.innerHTML = "";
  const meId = state.user?.uid;
  state.players.forEach((player) => {
    const li = document.createElement("li");
    const left = document.createElement("span");
    const teamLabel = player.team ? ` [${player.team}]` : "";
    left.textContent = `${player.name}${teamLabel}${player.id === state.room.hostId ? " (host)" : ""}${
      player.id === meId ? " (tu)" : ""
    }`;
    const right = document.createElement("span");
    right.textContent = "Presente";
    li.append(left, right);
    el.playerList.append(li);
  });
}

function countTeams(players) {
  return players.reduce(
    (acc, player) => {
      if (player.team === "A") {
        acc.A += 1;
      } else if (player.team === "B") {
        acc.B += 1;
      }
      return acc;
    },
    { A: 0, B: 0 }
  );
}

function renderTeamAssignments() {
  if (!el.teamAssignments) return;
  el.teamAssignments.innerHTML = "";
  if (!state.room) return;

  const isHost = state.room.hostId === state.user?.uid;
  const teamCounts = countTeams(state.players);
  state.players.forEach((player) => {
    const row = document.createElement("div");
    row.className = "team-row";
    const name = document.createElement("span");
    name.textContent = player.name;
    const select = document.createElement("select");
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Scegli squadra";
    select.append(empty);
    ["A", "B"].forEach((team) => {
      const isFull = teamCounts[team] >= 2 && player.team !== team;
      if (isFull) return;
      const option = document.createElement("option");
      option.value = team;
      option.textContent = `Squadra ${team}`;
      select.append(option);
    });
    select.value = player.team || "";
    select.disabled = !isHost;
    select.addEventListener("change", async () => {
      const nextTeam = select.value;
      const ok = await updatePlayerTeam(player.id, nextTeam);
      if (!ok) {
        select.value = player.team || "";
      }
    });
    row.append(name, select);
    el.teamAssignments.append(row);
  });
}

function renderGame() {
  if (!state.room) {
    return;
  }

  if (state.room.status === "ended") {
    el.turnIndicator.textContent = "Partita chiusa.";
    el.roundIndicator.textContent = "Fine";
    el.briscolaIndicator.textContent = "";
    clearTableSeats();
    el.handCards.innerHTML = "";
    if (el.toggleHand) {
      setHidden(el.toggleHand, true);
    }
    if (el.handPanel) {
      setHidden(el.handPanel, true);
    }
    return;
  }

  if (state.room.status !== "playing") {
    return;
  }

  if (el.toggleHand) {
    setHidden(el.toggleHand, false);
  }
  setHandOpen(isHandOpen);

  const meId = state.user?.uid;
  const me = state.players.find((player) => player.id === meId);
  const order = state.room.playerOrder || [];
  const turnPlayerId = order[state.room.turnIndex] || null;
  const turnName =
    state.players.find((player) => player.id === turnPlayerId)?.name || "Giocatore";
  const phase = state.room.phase || "playing";
  if (phase === "choose_briscola") {
    el.turnIndicator.textContent =
      state.room.briscolaChooserId === meId
        ? "Scegli la briscola per iniziare."
        : `In attesa che ${turnName} scelga la briscola.`;
  } else {
    el.turnIndicator.textContent =
      turnPlayerId === meId ? "Tocca a te!" : `Turno di ${turnName}`;
  }
  el.roundIndicator.textContent = `Mano ${state.room.handNumber || 1}`;
  el.briscolaIndicator.textContent = state.room.briscolaSuit
    ? `Briscola: ${SUITS.find((s) => s.key === state.room.briscolaSuit)?.label || ""}`
    : "Briscola non scelta";

  renderTableSeats();

  el.handCards.innerHTML = "";
  (me?.hand || []).forEach((card) => {
    const cardEl = document.createElement("div");
    cardEl.className = "card";
    if (turnPlayerId === meId && phase === "playing") {
      cardEl.classList.add("playable");
      cardEl.addEventListener("click", () => playCard(card));
    }
    const img = document.createElement("img");
    img.src = cardImage(card);
    img.alt = formatCard(card);
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = formatCard(card);
    cardEl.append(img, label);
    el.handCards.append(cardEl);
  });

  renderBriscolaPicker();
}

function setHandOpen(open) {
  isHandOpen = open;
  if (!el.handPanel || !el.toggleHand) return;
  setHidden(el.handPanel, !open);
  el.toggleHand.textContent = open ? "Nascondi mano" : "Mostra mano";
}

function renderScores() {
  const teamByPlayer = getTeamByPlayer();
  const teamAPlayers = Object.entries(teamByPlayer)
    .filter(([, team]) => team === "A")
    .map(([id]) => state.players.find((player) => player.id === id)?.name)
    .filter(Boolean)
    .join(" + ");
  const teamBPlayers = Object.entries(teamByPlayer)
    .filter(([, team]) => team === "B")
    .map(([id]) => state.players.find((player) => player.id === id)?.name)
    .filter(Boolean)
    .join(" + ");
  el.teamANames.textContent = teamAPlayers || "--";
  el.teamBNames.textContent = teamBPlayers || "--";
  el.teamAScore.textContent = formatPointsInt(state.room?.scoreTeamA || 0);
  el.teamBScore.textContent = formatPointsInt(state.room?.scoreTeamB || 0);
  el.teamAHand.textContent = formatPointsUnits(state.room?.handTeamA || 0);
  el.teamBHand.textContent = formatPointsUnits(state.room?.handTeamB || 0);
}

function renderTableSeats() {
  const seatMap = getSeatMap();
  if (!seatMap) return;
  const tableMap = new Map((state.room?.table || []).map((entry) => [entry.playerId, entry.card]));

  renderSeat(
    el.seatBottomName,
    el.seatBottomCard,
    seatMap.bottom,
    tableMap.get(seatMap.bottom)
  );
  renderSeat(
    el.seatLeftName,
    el.seatLeftCard,
    seatMap.left,
    tableMap.get(seatMap.left)
  );
  renderSeat(
    el.seatTopName,
    el.seatTopCard,
    seatMap.top,
    tableMap.get(seatMap.top)
  );
  renderSeat(
    el.seatRightName,
    el.seatRightCard,
    seatMap.right,
    tableMap.get(seatMap.right)
  );
}

function clearTableSeats() {
  renderSeat(el.seatBottomName, el.seatBottomCard, null, null);
  renderSeat(el.seatLeftName, el.seatLeftCard, null, null);
  renderSeat(el.seatTopName, el.seatTopCard, null, null);
  renderSeat(el.seatRightName, el.seatRightCard, null, null);
}

function renderSeat(nameEl, cardEl, playerId, card) {
  if (!nameEl || !cardEl) return;
  const player = state.players.find((p) => p.id === playerId);
  nameEl.textContent = player ? player.name : "--";
  cardEl.innerHTML = "";
  if (!card) return;
  const cardWrap = document.createElement("div");
  cardWrap.className = "card";
  const img = document.createElement("img");
  img.src = cardImage(card);
  img.alt = formatCard(card);
  cardWrap.append(img);
  cardEl.append(cardWrap);
}

function getSeatMap() {
  const order = state.room?.playerOrder || state.players.map((player) => player.id);
  if (!order.length) return null;
  const meId = state.user?.uid;
  const startIndex = order.includes(meId) ? order.indexOf(meId) : 0;
  return {
    bottom: order[startIndex],
    left: order[(startIndex + 1) % order.length],
    top: order[(startIndex + 2) % order.length],
    right: order[(startIndex + 3) % order.length],
  };
}

function renderBriscolaPicker() {
  if (!state.room || state.room.status !== "playing") {
    setHidden(el.briscolaPicker, true);
    return;
  }

  const shouldChoose =
    state.room.phase === "choose_briscola" && state.room.briscolaChooserId === state.user?.uid;
  setHidden(el.briscolaPicker, !shouldChoose);
}

async function updatePlayerTeam(playerId, team) {
  if (!state.roomId) return false;
  if (!team) {
    await updateDoc(playerRef(state.roomId, playerId), { team: null });
    return true;
  }
  const current = state.players.find((player) => player.id === playerId);
  const counts = countTeams(state.players);
  if (counts[team] >= 2 && current?.team !== team) {
    alert("La squadra selezionata e gia completa.");
    return false;
  }
  await updateDoc(playerRef(state.roomId, playerId), { team });
  return true;
}

const SUITS = [
  { key: "CUPS", label: "Coppe", asset: "Cups" },
  { key: "COINS", label: "Denari", asset: "Coins" },
  { key: "CLUBS", label: "Bastoni", asset: "Clubs" },
  { key: "SWORDS", label: "Spade", asset: "Swords" },
];

const RANKS = [
  { key: "1", label: "Asso" },
  { key: "2", label: "2" },
  { key: "3", label: "3" },
  { key: "4", label: "4" },
  { key: "5", label: "5" },
  { key: "6", label: "6" },
  { key: "7", label: "7" },
  { key: "F", label: "Fante" },
  { key: "H", label: "Cavallo" },
  { key: "K", label: "Re" },
];

const CARD_LABELS = new Map();
for (const suit of SUITS) {
  for (const rank of RANKS) {
    CARD_LABELS.set(`${suit.key}-${rank.key}`, `${rank.label} di ${suit.label}`);
  }
}

function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(`${suit.key}-${rank.key}`);
    }
  }
  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function dealFullDeck(order, deck) {
  const hands = {};
  order.forEach((playerId) => {
    hands[playerId] = [];
  });
  deck.forEach((card, index) => {
    const playerId = order[index % order.length];
    hands[playerId].push(card);
  });
  return hands;
}

function formatCard(card) {
  return CARD_LABELS.get(card) || card;
}

function parseCard(card) {
  const [suit, rank] = card.split("-");
  return { suit, rank };
}

function cardImage(card) {
  const { suit, rank } = parseCard(card);
  const suitAsset = SUITS.find((s) => s.key === suit)?.asset || suit;
  return `assets/cards/${suitAsset}_${rank}.png`;
}

const TRICK_ORDER = ["3", "2", "1", "K", "H", "F", "7", "6", "5", "4"];
const TRICK_RANK = new Map(TRICK_ORDER.map((rank, index) => [rank, index]));

const POINT_VALUE = new Map([
  ["1", POINT_UNIT],
  ["2", 1],
  ["3", 1],
  ["K", 1],
  ["H", 1],
  ["F", 1],
]);

function cardPoints(card) {
  const { rank } = parseCard(card);
  return POINT_VALUE.get(rank) || 0;
}

function compareCards(a, b, leadSuit, briscolaSuit) {
  const ca = parseCard(a);
  const cb = parseCard(b);

  const aIsBriscola = ca.suit === briscolaSuit;
  const bIsBriscola = cb.suit === briscolaSuit;
  if (aIsBriscola && !bIsBriscola) return 1;
  if (!aIsBriscola && bIsBriscola) return -1;

  const suitToFollow = aIsBriscola || bIsBriscola ? briscolaSuit : leadSuit;
  const aMatches = ca.suit === suitToFollow;
  const bMatches = cb.suit === suitToFollow;
  if (aMatches && !bMatches) return 1;
  if (!aMatches && bMatches) return -1;

  const rankA = TRICK_RANK.get(ca.rank) ?? 99;
  const rankB = TRICK_RANK.get(cb.rank) ?? 99;
  return rankA < rankB ? 1 : rankA > rankB ? -1 : 0;
}

function pointsFromUnits(units) {
  return Math.floor(units / POINT_UNIT);
}

function formatPointsUnits(units) {
  return `${pointsFromUnits(units)}`;
}

function formatPointsInt(points) {
  return `${points}`;
}

function getTeamByPlayer() {
  if (state.room?.teamByPlayer) {
    return state.room.teamByPlayer;
  }
  const map = {};
  state.players.forEach((player) => {
    if (player.team) {
      map[player.id] = player.team;
    }
  });
  return map;
}

function startListeners(roomId) {
  stopListeners();
  const roomDoc = roomRef(roomId);
  unsubRoom = onSnapshot(roomDoc, (snap) => {
    state.room = snap.exists() ? snap.data() : null;
    if (!state.room) {
      state.roomId = null;
      stopListeners();
    }
    renderRoom();
  });

  const playersQuery = query(playersCol(roomId), orderBy("joinedAt"));
  unsubPlayers = onSnapshot(playersQuery, (snap) => {
    state.players = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
    renderRoom();
  });
}

function stopListeners() {
  if (unsubRoom) {
    unsubRoom();
    unsubRoom = null;
  }
  if (unsubPlayers) {
    unsubPlayers();
    unsubPlayers = null;
  }
}

async function createRoom() {
  const name = getPlayerName();
  if (!name) return;
  await ensureAuth();

  const roomId = generateRoomCode();
  const roomDoc = roomRef(roomId);
  const playerDoc = playerRef(roomId, state.user.uid);
  const targetPoints = Number(el.targetPoints.value || 31);

  await setDoc(roomDoc, {
    createdAt: serverTimestamp(),
    hostId: state.user.uid,
    status: "lobby",
    phase: "lobby",
    table: [],
    handNumber: 1,
    targetPoints,
    scoreTeamA: 0,
    scoreTeamB: 0,
    handTeamA: 0,
    handTeamB: 0,
    playerIds: [state.user.uid],
  });

  await setDoc(playerDoc, {
    name,
    ready: false,
    joinedAt: serverTimestamp(),
    hand: [],
  });

  await updateDoc(roomDoc, { playerIds: arrayUnion(state.user.uid) });

  state.roomId = roomId;
  startListeners(roomId);
}

async function joinRoom() {
  const name = getPlayerName();
  if (!name) return;
  await ensureAuth();

  const roomId = normalizeRoomCode(el.roomCodeInput.value);
  if (!roomId) {
    alert("Inserisci un codice stanza.");
    return;
  }

  const roomDoc = roomRef(roomId);
  const roomSnap = await getDoc(roomDoc);
  if (!roomSnap.exists()) {
    alert("Stanza non trovata.");
    return;
  }

  const room = roomSnap.data();
  if (room.status !== "lobby") {
    alert("La partita e gia iniziata.");
    return;
  }

  const playersQuery = query(playersCol(roomId), orderBy("joinedAt"));
  const playersSnap = await getDocs(playersQuery);
  const alreadyJoined = playersSnap.docs.some((docSnap) => docSnap.id === state.user.uid);
  if (!alreadyJoined && playersSnap.size >= MAX_PLAYERS) {
    alert("La stanza e piena.");
    return;
  }

  const playerDoc = playerRef(roomId, state.user.uid);
  await setDoc(
    playerDoc,
    {
      name,
      ready: false,
      joinedAt: serverTimestamp(),
      hand: [],
    },
    { merge: true }
  );

  await updateDoc(roomDoc, { playerIds: arrayUnion(state.user.uid) });

  state.roomId = roomId;
  startListeners(roomId);
}

async function leaveRoom() {
  if (!state.roomId || !state.user) return;
  const message =
    state.room?.status === "playing"
      ? "Uscendo dalla partita, la sessione terminera per tutti. Vuoi uscire davvero?"
      : "Vuoi uscire dalla stanza?";
  if (!confirm(message)) return;
  const roomId = state.roomId;
  const roomDoc = roomRef(roomId);
  const playerDoc = playerRef(roomId, state.user.uid);

  await deleteDoc(playerDoc).catch(() => {});
  await updateDoc(roomDoc, { playerIds: arrayRemove(state.user.uid) }).catch(() => {});

  state.roomId = null;
  state.room = null;
  state.players = [];
  stopListeners();
  renderRoom();
}

async function startGame() {
  if (!state.roomId || !state.user) return;
  if (state.room?.hostId !== state.user.uid) {
    alert("Solo l'host puo avviare la partita.");
    return;
  }
  await runTransaction(db, async (tx) => {
    const roomDoc = roomRef(state.roomId);
    const roomSnap = await tx.get(roomDoc);
    if (!roomSnap.exists()) {
      throw new Error("Room not found");
    }
    const room = roomSnap.data();
    if (room.status !== "lobby") {
      throw new Error("Already started");
    }

    const playerIds = room.playerIds || [];
    if (playerIds.length !== MAX_PLAYERS) {
      throw new Error("Not enough players");
    }

    const players = [];
    for (const playerId of playerIds) {
      const snap = await tx.get(playerRef(state.roomId, playerId));
      if (!snap.exists()) {
        throw new Error("Missing player");
      }
      players.push({ id: playerId, ...snap.data() });
    }

    const teamByPlayer = {};
    let teamACount = 0;
    let teamBCount = 0;
    players.forEach((player) => {
      if (player.team === "A") {
        teamACount += 1;
        teamByPlayer[player.id] = "A";
      } else if (player.team === "B") {
        teamBCount += 1;
        teamByPlayer[player.id] = "B";
      }
    });
    if (teamACount !== 2 || teamBCount !== 2) {
      throw new Error("Teams not ready");
    }

    const order = playerIds;
    const deck = shuffle(buildDeck());
    const hands = dealFullDeck(order, deck);

    const firstChooserId =
      order.find((playerId) => hands[playerId]?.includes("COINS-4")) || order[0];
    const chooserIndex = order.indexOf(firstChooserId);

    order.forEach((playerId) => {
      tx.update(playerRef(state.roomId, playerId), { hand: hands[playerId], ready: false });
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
  }).catch((err) => {
    if (err?.message?.includes("Teams")) {
      alert("Assegna 2 giocatori per squadra prima di iniziare.");
      return;
    }
    if (err?.message?.includes("Not enough")) {
      alert("Servono 4 giocatori.");
      return;
    }
    alert("Impossibile avviare la partita.");
  });
}

async function playCard(card) {
  if (!state.roomId || !state.user) return;

  await runTransaction(db, async (tx) => {
    const roomDoc = roomRef(state.roomId);
    const roomSnap = await tx.get(roomDoc);
    if (!roomSnap.exists()) return;
    const room = roomSnap.data();
    if (room.status !== "playing" || room.phase !== "playing") return;
    if (!room.briscolaSuit) return;

    const order = room.playerOrder || [];
    const currentPlayerId = order[room.turnIndex];
    if (currentPlayerId !== state.user.uid) return;

    const meRef = playerRef(state.roomId, state.user.uid);
    const meSnap = await tx.get(meRef);
    if (!meSnap.exists()) return;
    const me = meSnap.data();
    const hand = [...(me.hand || [])];
    const index = hand.indexOf(card);
    if (index === -1) return;

    const leadSuit = room.table?.length ? parseCard(room.table[0].card).suit : null;
    if (leadSuit) {
      const hasLeadSuit = hand.some((c) => parseCard(c).suit === leadSuit);
      const cardSuit = parseCard(card).suit;
      if (hasLeadSuit && cardSuit !== leadSuit) return;
    }

    hand.splice(index, 1);
    const table = [...(room.table || []), { playerId: state.user.uid, card }];

    let nextIndex = (room.turnIndex + 1) % order.length;
    let tableUpdate = table;
    let handTeamA = room.handTeamA || 0;
    let handTeamB = room.handTeamB || 0;
    let trickCount = room.trickCount || 0;
    let scoreTeamA = room.scoreTeamA || 0;
    let scoreTeamB = room.scoreTeamB || 0;
    let phase = room.phase;
    let status = room.status;
    let briscolaSuit = room.briscolaSuit;
    let briscolaChooserIndex = room.briscolaChooserIndex ?? 0;
    let briscolaChooserId = room.briscolaChooserId;
    let handNumber = room.handNumber || 1;

    if (table.length === order.length) {
      const lead = parseCard(table[0].card).suit;
      let winning = table[0];
      for (const entry of table.slice(1)) {
        if (compareCards(entry.card, winning.card, lead, briscolaSuit) > 0) {
          winning = entry;
        }
      }
      const winnerId = winning.playerId;
      const winnerIndex = order.indexOf(winnerId);
      const points = table.reduce((sum, entry) => sum + cardPoints(entry.card), 0);
      const winnerTeam = room.teamByPlayer?.[winnerId];
      if (winnerTeam === "A") {
        handTeamA += points;
      } else if (winnerTeam === "B") {
        handTeamB += points;
      }

      trickCount += 1;
      tableUpdate = [];
      nextIndex = winnerIndex;

      if (trickCount >= 10) {
        const lastTrickBonus = POINT_UNIT;
        if (winnerTeam === "A") {
          handTeamA += lastTrickBonus;
        } else if (winnerTeam === "B") {
          handTeamB += lastTrickBonus;
        }

        const handPointsA = pointsFromUnits(handTeamA);
        const handPointsB = pointsFromUnits(handTeamB);
        scoreTeamA += handPointsA;
        scoreTeamB += handPointsB;

        const target = room.targetPoints || 31;
        if (scoreTeamA >= target || scoreTeamB >= target) {
          status = "ended";
          phase = "ended";
          briscolaSuit = room.briscolaSuit;
        } else {
          const deck = shuffle(buildDeck());
          const hands = dealFullDeck(order, deck);
          briscolaChooserIndex = (briscolaChooserIndex + 1) % order.length;
          briscolaChooserId = order[briscolaChooserIndex];

          order.forEach((playerId) => {
            tx.update(playerRef(state.roomId, playerId), { hand: hands[playerId] });
          });

          handTeamA = 0;
          handTeamB = 0;
          trickCount = 0;
          briscolaSuit = null;
          phase = "choose_briscola";
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
      phase,
      status,
      briscolaSuit,
      briscolaChooserId,
      briscolaChooserIndex,
      handNumber,
    });
  });
}

async function endGame() {
  if (!state.roomId || !state.user) return;
  if (state.room?.hostId !== state.user.uid) {
    alert("Solo l'host puo chiudere la partita.");
    return;
  }
  await updateDoc(roomRef(state.roomId), { status: "ended", phase: "ended" });
}

async function chooseBriscola(suit) {
  if (!state.roomId || !state.user) return;
  if (state.room?.phase !== "choose_briscola") return;
  if (state.room?.briscolaChooserId !== state.user.uid) return;
  await updateDoc(roomRef(state.roomId), {
    briscolaSuit: suit,
    phase: "playing",
    table: [],
    turnIndex: state.room.briscolaChooserIndex ?? 0,
  });
}

el.createRoom.addEventListener("click", createRoom);
el.joinRoom.addEventListener("click", joinRoom);
el.leaveRoom.addEventListener("click", leaveRoom);
el.startGame.addEventListener("click", startGame);
el.endGame.addEventListener("click", endGame);
if (el.toggleHand) {
  el.toggleHand.addEventListener("click", () => setHandOpen(!isHandOpen));
}
el.modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});
setMode(activeMode);

el.briscolaPicker.querySelectorAll("button[data-suit]").forEach((button) => {
  button.addEventListener("click", () => chooseBriscola(button.dataset.suit));
});
