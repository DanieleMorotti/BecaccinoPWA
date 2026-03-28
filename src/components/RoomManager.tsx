import { useEffect, useState } from 'react';
import { doc, onSnapshot, collection, query, orderBy, updateDoc, deleteDoc, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import LobbyScreen from './LobbyScreen';
import GameScreen from './GameScreen';
import { User } from 'firebase/auth';
import { toast } from 'sonner';

interface RoomManagerProps {
  roomId: string;
  onLeave: () => void;
  user: User;
}

export default function RoomManager({ roomId, onLeave, user }: RoomManagerProps) {
  const [room, setRoom] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubRoom = onSnapshot(doc(db, 'rooms', roomId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.status === 'closed') {
          if (data.closedReason) {
            toast.error(data.closedReason);
          }
          onLeave();
        } else if (data.playerIds && !data.playerIds.includes(user.uid)) {
          toast.error("Sei stato rimosso dalla stanza.");
          onLeave();
        } else {
          setRoom({ id: snap.id, ...data });
        }
      } else {
        onLeave();
      }
      setLoading(false);
    }, (error) => {
      console.error("Room snapshot error:", error);
      toast.error("Sei stato rimosso dalla stanza o la stanza non esiste più.");
      onLeave();
    });

    const unsubPlayers = onSnapshot(query(collection(db, 'rooms', roomId, 'players'), orderBy('joinedAt')), (snap) => {
      setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Players snapshot error:", error);
    });

    return () => {
      unsubRoom();
      unsubPlayers();
    };
  }, [roomId, onLeave]);

  // Heartbeat
  useEffect(() => {
    if (!room) return;

    const pingInterval = setInterval(() => {
      updateDoc(doc(db, 'rooms', roomId, 'players', user.uid), {
        lastPing: serverTimestamp()
      }).catch(() => {});
    }, 10000);

    return () => {
      clearInterval(pingInterval);
    };
  }, [roomId, user.uid, room]);

  // Host checks for disconnected players, and players check for disconnected host
  useEffect(() => {
    if (!room) return;

    const checkInterval = setInterval(() => {
      const now = Date.now();
      
      if (room.hostId === user.uid) {
        players.forEach(p => {
          if (p.id !== user.uid && p.lastPing) {
            const pingTime = p.lastPing.toMillis ? p.lastPing.toMillis() : (p.lastPing.seconds * 1000);
            const timeout = room.status === 'playing' ? 300000 : 60000; // 5 mins in game, 1 min in lobby
            if (now - pingTime > timeout) {
              if (room.status === 'playing') {
                const playerName = p.name || 'Un giocatore';
                updateDoc(doc(db, 'rooms', roomId), { 
                  status: 'lobby', 
                  phase: 'waiting',
                  lobbyReason: `${playerName} si è disconnesso.`,
                  playerIds: arrayRemove(p.id)
                }).catch(() => {});
                deleteDoc(doc(db, 'rooms', roomId, 'players', p.id)).catch(() => {});
              } else {
                deleteDoc(doc(db, 'rooms', roomId, 'players', p.id)).catch(() => {});
                updateDoc(doc(db, 'rooms', roomId), { playerIds: arrayRemove(p.id) }).catch(() => {});
              }
            }
          }
        });
      } else {
        // Non-host checks if host disconnected
        const host = players.find(p => p.id === room.hostId);
        if (host && host.lastPing) {
          const pingTime = host.lastPing.toMillis ? host.lastPing.toMillis() : (host.lastPing.seconds * 1000);
          const timeout = room.status === 'playing' ? 300000 : 60000; // 5 mins in game, 1 min in lobby
          if (now - pingTime > timeout) {
            updateDoc(doc(db, 'rooms', roomId), { 
              status: 'closed',
              closedReason: "L'host si è disconnesso."
            }).catch(() => {});
          }
        }
      }
    }, 15000);

    return () => clearInterval(checkInterval);
  }, [roomId, user.uid, room, players]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-emerald-800 font-medium">Caricamento stanza...</p>
        </div>
      </div>
    );
  }

  if (!room) return null;

  if (room.status === 'lobby') {
    return <LobbyScreen room={room} players={players} user={user} onLeave={onLeave} />;
  }

  return <GameScreen room={room} players={players} user={user} onLeave={onLeave} />;
}
