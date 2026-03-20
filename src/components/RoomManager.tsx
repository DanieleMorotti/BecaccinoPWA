import { useEffect, useState } from 'react';
import { doc, onSnapshot, collection, query, orderBy, updateDoc, deleteDoc, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import LobbyScreen from './LobbyScreen';
import GameScreen from './GameScreen';
import { User } from 'firebase/auth';

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
        setRoom({ id: snap.id, ...snap.data() });
      } else {
        onLeave();
      }
      setLoading(false);
    });

    const unsubPlayers = onSnapshot(query(collection(db, 'rooms', roomId, 'players'), orderBy('joinedAt')), (snap) => {
      setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubRoom();
      unsubPlayers();
    };
  }, [roomId, onLeave]);

  // Heartbeat and beforeunload
  useEffect(() => {
    if (!room) return;

    const handleBeforeUnload = () => {
      if (room.hostId === user.uid) {
        updateDoc(doc(db, 'rooms', roomId), { status: 'ended' }).catch(() => {});
      } else {
        if (room.status === 'playing') {
          updateDoc(doc(db, 'rooms', roomId), { status: 'ended' }).catch(() => {});
        } else {
          deleteDoc(doc(db, 'rooms', roomId, 'players', user.uid)).catch(() => {});
          updateDoc(doc(db, 'rooms', roomId), { playerIds: arrayRemove(user.uid) }).catch(() => {});
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    const pingInterval = setInterval(() => {
      updateDoc(doc(db, 'rooms', roomId, 'players', user.uid), {
        lastPing: serverTimestamp()
      }).catch(() => {});
    }, 10000);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(pingInterval);
    };
  }, [roomId, user.uid, room]);

  // Host checks for disconnected players
  useEffect(() => {
    if (!room || room.hostId !== user.uid) return;

    const checkInterval = setInterval(() => {
      const now = Date.now();
      players.forEach(p => {
        if (p.id !== user.uid && p.lastPing) {
          const pingTime = p.lastPing.toMillis ? p.lastPing.toMillis() : (p.lastPing.seconds * 1000);
          if (now - pingTime > 30000) { // 30 seconds timeout
            if (room.status === 'playing') {
              updateDoc(doc(db, 'rooms', roomId), { status: 'ended' }).catch(() => {});
            } else {
              deleteDoc(doc(db, 'rooms', roomId, 'players', p.id)).catch(() => {});
              updateDoc(doc(db, 'rooms', roomId), { playerIds: arrayRemove(p.id) }).catch(() => {});
            }
          }
        }
      });
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
