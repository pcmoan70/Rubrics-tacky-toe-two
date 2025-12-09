import React from 'react';
import { GameScene } from './components/GameScene';
import { UI } from './components/UI';

const App = () => {
  return (
    <div className="relative w-full h-screen bg-gray-900 overflow-hidden font-sans">
      <GameScene />
      <UI />
    </div>
  );
};

export default App;
