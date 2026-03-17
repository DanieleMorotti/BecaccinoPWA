import { useEffect, useState } from 'react';
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';
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
