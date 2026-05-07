import { useState } from 'react'
import PongGame from './components/PongGame'
import './App.css'

function App() {
  const [mode, setMode] = useState(null)

  if (!mode) {
    return (
      <div className="menu">
        <h1>Ping Pong</h1>
        <div className="menu-buttons">
          <button onClick={() => setMode('2player')}>2 Players</button>
          <button onClick={() => setMode('ai')}>vs AI</button>
        </div>
        <div className="controls-hint">
          <p><strong>Player 1:</strong> W / S</p>
          <p><strong>Player 2 (2P mode):</strong> ↑ / ↓</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <PongGame mode={mode} onBack={() => setMode(null)} />
    </div>
  )
}

export default App
