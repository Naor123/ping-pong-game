import { useEffect, useRef, useState, useCallback } from 'react'

// ── Canvas & physics constants ────────────────────────────────────────────────
const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 500
const PADDLE_WIDTH = 12
const PADDLE_HEIGHT = 80
const BALL_SIZE = 10
const PADDLE_SPEED = 5       // px/frame for human players
const PLAYER_WIN_SCORE = 7   // player must reach this to win
const AI_WIN_SCORE = 5       // AI reaching this ends the game (player loses)
const AI_LEVEL_TRIGGER = 5   // player score that causes AI to level up

// AI behaviour per level.
// trackFromCenter: true  = only reacts when ball is in its own half
// errorRange: random aim offset recalculated each second (0 = perfect aim)
const AI_LEVELS = {
  1: { speed: 2.0, trackFromCenter: true,  errorRange: 55 },
  2: { speed: 4.5, trackFromCenter: false, errorRange: 15 },
}

function PongGame({ mode, onBack }) {
  // Canvas and animation
  const canvasRef    = useRef(null)
  const animFrameRef = useRef(null)

  // Game state lives in refs so the rAF loop always reads the latest values
  // without triggering React re-renders on every frame.
  const stateRef    = useRef(null)  // { ball, p1, p2 } positions
  const keysRef     = useRef({})    // currently held keys
  const p1ScoreRef  = useRef(0)     // scores in refs so they stay in sync with the loop
  const p2ScoreRef  = useRef(0)
  const aiLevelRef   = useRef(1)
  const gameOverRef  = useRef(false) // halts the rAF loop once a winner is found
  const aiErrorRef   = useRef(0)     // current aim offset in px (level 1 imprecision)
  const aiErrorTimer = useRef(0)     // counts frames; refreshes error every ~60 frames

  // React state (drives UI re-renders only)
  const [scores,     setScores]     = useState({ p1: 0, p2: 0 })
  const [winner,     setWinner]     = useState(null)
  const [aiLevel,    setAiLevel]    = useState(1)
  const [levelUpMsg, setLevelUpMsg] = useState(false)
  // Incrementing this forces the useEffect to re-run and restarts the loop cleanly
  const [gameKey,    setGameKey]    = useState(0)

  // Returns a fresh physics state centred on the canvas
  const initState = useCallback(() => ({
    ball: {
      x:  CANVAS_WIDTH / 2,
      y:  CANVAS_HEIGHT / 2,
      vx: (Math.random() > 0.5 ? 1 : -1) * 4,
      vy: Math.random() * 4 - 2,
    },
    p1: { y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2 },
    p2: { y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2 },
  }), [])

  // Re-launch the ball toward the player who just conceded
  const resetBall = (state, scorer) => {
    state.ball.x  = CANVAS_WIDTH / 2
    state.ball.y  = CANVAS_HEIGHT / 2
    state.ball.vx = (scorer === 1 ? -1 : 1) * 4
    state.ball.vy = Math.random() * 4 - 2
  }

  // ── Main game loop ─────────────────────────────────────────────────────────
  // Runs once per (mode, gameKey) pair. gameKey increments on restart so the
  // effect re-fires with clean refs instead of duplicating the loop logic.
  useEffect(() => {
    // Reset all mutable state for a fresh game
    stateRef.current    = initState()
    aiLevelRef.current  = 1
    gameOverRef.current = false
    p1ScoreRef.current  = 0
    p2ScoreRef.current  = 0
    aiErrorRef.current  = 0
    aiErrorTimer.current = 0

    const handleKeyDown = (e) => { keysRef.current[e.key] = true }
    const handleKeyUp   = (e) => { keysRef.current[e.key] = false }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup',   handleKeyUp)

    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')

    // ── Draw ─────────────────────────────────────────────────────────────────
    const draw = () => {
      const s = stateRef.current
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      // Dashed centre line
      ctx.setLineDash([10, 10])
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'
      ctx.lineWidth   = 2
      ctx.beginPath()
      ctx.moveTo(CANVAS_WIDTH / 2, 0)
      ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT)
      ctx.stroke()
      ctx.setLineDash([])

      // Player paddle (left, always red)
      ctx.fillStyle = '#e94560'
      ctx.beginPath()
      ctx.roundRect(10, s.p1.y, PADDLE_WIDTH, PADDLE_HEIGHT, 4)
      ctx.fill()

      // AI / P2 paddle — turns red at level 2 to signal danger
      ctx.fillStyle = aiLevelRef.current === 2 ? '#ff0044' : '#0f3460'
      ctx.beginPath()
      ctx.roundRect(CANVAS_WIDTH - 10 - PADDLE_WIDTH, s.p2.y, PADDLE_WIDTH, PADDLE_HEIGHT, 4)
      ctx.fill()

      // Ball
      ctx.fillStyle = '#e2e2e2'
      ctx.beginPath()
      ctx.arc(s.ball.x, s.ball.y, BALL_SIZE / 2, 0, Math.PI * 2)
      ctx.fill()
    }

    // ── Update (physics + input + scoring) ───────────────────────────────────
    const update = () => {
      const s    = stateRef.current
      const keys = keysRef.current

      // ── Player 1 input (W / S) ──────────────────────────────────────────
      if (keys['w'] || keys['W'])
        s.p1.y = Math.max(0, s.p1.y - PADDLE_SPEED)
      if (keys['s'] || keys['S'])
        s.p1.y = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, s.p1.y + PADDLE_SPEED)

      // ── Player 2 input or AI ─────────────────────────────────────────────
      if (mode === '2player') {
        if (keys['ArrowUp'])
          s.p2.y = Math.max(0, s.p2.y - PADDLE_SPEED)
        if (keys['ArrowDown'])
          s.p2.y = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, s.p2.y + PADDLE_SPEED)
      } else {
        const lvl            = AI_LEVELS[aiLevelRef.current]
        const ballComingToAI = s.ball.vx > 0
        // Level 1 only wakes up when ball is in the rightmost third of the court
        const ballInZone = lvl.trackFromCenter
          ? s.ball.x > CANVAS_WIDTH * 0.67
          : true
        const shouldTrack = ballComingToAI && ballInZone

        // Refresh the aim error once per second (~60 frames) so it feels organic
        if (lvl.errorRange > 0) {
          aiErrorTimer.current++
          if (aiErrorTimer.current >= 60) {
            aiErrorTimer.current = 0
            aiErrorRef.current   = (Math.random() * 2 - 1) * lvl.errorRange
          }
        } else {
          aiErrorRef.current = 0
        }

        if (shouldTrack) {
          const paddleMid = s.p2.y + PADDLE_HEIGHT / 2
          // errorRef shifts the target so the AI occasionally aims off-centre
          const target = s.ball.y + aiErrorRef.current
          const diff   = target - paddleMid
          // Clamp movement to AI speed so it can't teleport to the ball
          if (Math.abs(diff) > 6)
            s.p2.y += diff > 0 ? Math.min(lvl.speed, diff) : Math.max(-lvl.speed, diff)
        } else {
          // When idle, drift back to centre so it doesn't hug a corner
          const center = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2
          const diff   = center - s.p2.y
          if (Math.abs(diff) > 4) s.p2.y += diff > 0 ? 1.5 : -1.5
        }
        s.p2.y = Math.max(0, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, s.p2.y))
      }

      // ── Ball movement ────────────────────────────────────────────────────
      s.ball.x += s.ball.vx
      s.ball.y += s.ball.vy

      // Bounce off top and bottom walls
      if (s.ball.y - BALL_SIZE / 2 <= 0) {
        s.ball.y  = BALL_SIZE / 2
        s.ball.vy *= -1
      }
      if (s.ball.y + BALL_SIZE / 2 >= CANVAS_HEIGHT) {
        s.ball.y  = CANVAS_HEIGHT - BALL_SIZE / 2
        s.ball.vy *= -1
      }

      // ── Paddle collisions ────────────────────────────────────────────────
      // The hit position along the paddle (-0.5 … 0.5) controls the deflection
      // angle, letting players aim their shots.

      // Left (P1) paddle
      if (
        s.ball.x - BALL_SIZE / 2 <= 10 + PADDLE_WIDTH &&
        s.ball.y >= s.p1.y &&
        s.ball.y <= s.p1.y + PADDLE_HEIGHT &&
        s.ball.vx < 0
      ) {
        s.ball.vx *= -1.015  // very gradual speed-up so rallies last longer
        s.ball.vy  = ((s.ball.y - s.p1.y) / PADDLE_HEIGHT - 0.5) * 8
        s.ball.x   = 10 + PADDLE_WIDTH + BALL_SIZE / 2  // push out of paddle
      }

      // Right (P2 / AI) paddle
      if (
        s.ball.x + BALL_SIZE / 2 >= CANVAS_WIDTH - 10 - PADDLE_WIDTH &&
        s.ball.y >= s.p2.y &&
        s.ball.y <= s.p2.y + PADDLE_HEIGHT &&
        s.ball.vx > 0
      ) {
        s.ball.vx *= -1.05
        s.ball.vy  = ((s.ball.y - s.p2.y) / PADDLE_HEIGHT - 0.5) * 8
        s.ball.x   = CANVAS_WIDTH - 10 - PADDLE_WIDTH - BALL_SIZE / 2
      }

      // Global speed cap — keeps rallies playable for longer
      const speed = Math.sqrt(s.ball.vx ** 2 + s.ball.vy ** 2)
      if (speed > 9) {
        s.ball.vx = (s.ball.vx / speed) * 9
        s.ball.vy = (s.ball.vy / speed) * 9
      }

      // ── Scoring ──────────────────────────────────────────────────────────
      // Ball exits left edge → P2 / AI scores
      if (s.ball.x < 0) {
        p2ScoreRef.current++
        setScores({ p1: p1ScoreRef.current, p2: p2ScoreRef.current })

        if (mode === 'ai' && p2ScoreRef.current >= AI_WIN_SCORE) {
          gameOverRef.current = true  // stops the rAF loop on next tick
          setWinner('AI')
          return
        }
        if (mode === '2player' && p2ScoreRef.current >= PLAYER_WIN_SCORE) {
          gameOverRef.current = true
          setWinner('Player 2')
          return
        }
        resetBall(s, 2)
      }

      // Ball exits right edge → P1 scores
      if (s.ball.x > CANVAS_WIDTH) {
        p1ScoreRef.current++
        setScores({ p1: p1ScoreRef.current, p2: p2ScoreRef.current })

        // Trigger AI level-up exactly once when player crosses the threshold
        if (mode === 'ai' && p1ScoreRef.current === AI_LEVEL_TRIGGER && aiLevelRef.current === 1) {
          aiLevelRef.current  = 2
          // Reset scores so the next round starts fresh at 0-0
          p1ScoreRef.current  = 0
          p2ScoreRef.current  = 0
          setScores({ p1: 0, p2: 0 })
          setAiLevel(2)
          setLevelUpMsg(true)
          setTimeout(() => setLevelUpMsg(false), 2000)
        }

        if (p1ScoreRef.current >= PLAYER_WIN_SCORE) {
          gameOverRef.current = true
          setWinner('Player 1')
          return
        }
        resetBall(s, 1)
      }
    }

    // rAF loop — checks gameOverRef each tick so it stops cleanly when a
    // winner is set, without the score continuing to increment in the background.
    const loop = () => {
      if (gameOverRef.current) return
      update()
      draw()
      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup',   handleKeyUp)
    }
  }, [mode, gameKey, initState]) // gameKey increment triggers a clean restart

  // Incrementing gameKey causes useEffect to re-fire with all refs reset
  const restart = () => {
    setScores({ p1: 0, p2: 0 })
    setAiLevel(1)
    setWinner(null)
    setLevelUpMsg(false)
    setGameKey(k => k + 1)
  }

  return (
    <div className="game-wrapper">
      <div className="scoreboard">
        <span className="score p1-score">{scores.p1}</span>
        <span className="score-divider">:</span>
        <span className="score p2-score">{scores.p2}</span>
      </div>
      <div className="player-labels">
        <span>Player 1</span>
        {mode === 'ai'
          ? <span className={aiLevel === 2 ? 'ai-label-danger' : ''}>
              AI {aiLevel === 2 ? '⚡ LVL 2' : 'LVL 1'}
            </span>
          : <span>Player 2</span>
        }
      </div>
      <div className="canvas-container">
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="pong-canvas" />
        {levelUpMsg && (
          <div className="levelup-banner">⚡ AI LEVEL UP! ⚡</div>
        )}
      </div>
      {winner && (
        <div className="overlay">
          <div className="winner-card">
            <h2>{winner === 'AI' ? 'You Lost!' : `${winner} Wins!`}</h2>
            {winner === 'AI' && <p className="loss-sub">The AI reached {AI_WIN_SCORE} points</p>}
            <div className="overlay-buttons">
              <button onClick={restart}>Play Again</button>
              <button onClick={onBack}>Main Menu</button>
            </div>
          </div>
        </div>
      )}
      <button className="back-btn" onClick={onBack}>Menu</button>
    </div>
  )
}

export default PongGame
