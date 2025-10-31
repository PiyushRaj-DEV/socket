import React, { useState } from 'react';
import Login from './components/Login';
import Chat from './components/Chat';

export default function App() {
  const [me, setMe] = useState(null); // { username, room }
  return (
    <div className="app">
      {!me ? <Login onJoin={setMe} /> : <Chat me={me} onLeave={() => setMe(null)} />}
    </div>
  );
}
