import { useEffect, useRef, useState, useCallback } from 'react'

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 500
const PADDLE_WIDTH = 12
const PADDLE_HEIGHT = 80
const BALL_SIZE = 10
const PADDLE_SPEED = 5
const WINNING_SCORE = 7
const AI_SPEED = 4

function PongGame({ mode, onBack }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const keysRef = useRef({})
  const animFrameRef = useRef(null)
  const [scores, setScores] = useState({ p1: 0, p2: 0 })
  const [winner, setWinner] = useState(null)

  const initState = useCallback(() => ({
    ball: {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      vx: (Math.random() > 0.5 ? 1 : -1) * 4,
      vy: (Math.random() * 4 - 2),
    },
    p1: { y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2 },
    p2: { y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2 },
  }), [])

  const resetBall = (state, scorer) => {
    state.ball.x = CANVAS_WIDTH / 2
    state.ball.y = CANVAS_HEIGHT / 2
    state.ball.vx = (scorer === 1 ? -1 : 1) * 4
    state.ball.vy = Math.random() * 4 - 2
  }

  useEffect(() => {
    stateRef.current = initState()

    const handleKeyDown = (e) => { keysRef.current[e.key] = true }
    const handleKeyUp = (e) => { keysRef.current[e.key] = false }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let p1Score = 0
    let p2Score = 0

    const draw = () => {
      const s = stateRef.current
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      // Center line
      ctx.setLineDash([10, 10])
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(CANVAS_WIDTH / 2, 0)
      ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT)
      ctx.stroke()
      ctx.setLineDash([])

      // Paddles
      ctx.fillStyle = '#e94560'
      ctx.beginPath()
      ctx.roundRect(10, s.p1.y, PADDLE_WIDTH, PADDLE_HEIGHT, 4)
      ctx.fill()

      ctx.fillStyle = '#0f3460'
      ctx.beginPath()
      ctx.roundRect(CANVAS_WIDTH - 10 - PADDLE_WIDTH, s.p2.y, PADDLE_WIDTH, PADDLE_HEIGHT, 4)
      ctx.fill()

      // Ball
      ctx.fillStyle = '#e2e2e2'
      ctx.beginPath()
      ctx.arc(s.ball.x, s.ball.y, BALL_SIZE / 2, 0, Math.PI * 2)
      ctx.fill()
    }

    const update = () => {
      const s = stateRef.current
      const keys = keysRef.current

      // Player 1 (W/S)
      if (keys['w'] || keys['W']) s.p1.y = Math.max(0, s.p1.y - PADDLE_SPEED)
      if (keys['s'] || keys['S']) s.p1.y = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, s.p1.y + PADDLE_SPEED)

      // Player 2 or AI
      if (mode === '2player') {
        if (keys['ArrowUp']) s.p2.y = Math.max(0, s.p2.y - PADDLE_SPEED)
        if (keys['ArrowDown']) s.p2.y = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, s.p2.y + PADDLE_SPEED)
      } else {
        // AI: track ball with some error margin
        const paddleMid = s.p2.y + PADDLE_HEIGHT / 2
        const diff = s.ball.y - paddleMid
        if (Math.abs(diff) > 5) {
          s.p2.y += diff > 0
            ? Math.min(AI_SPEED, diff)
            : Math.max(-AI_SPEED, diff)
        }
        s.p2.y = Math.max(0, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, s.p2.y))
      }

      // Ball movement
      s.ball.x += s.ball.vx
      s.ball.y += s.ball.vy

      // Top/bottom bounce
      if (s.ball.y - BALL_SIZE / 2 <= 0) {
        s.ball.y = BALL_SIZE / 2
        s.ball.vy *= -1
      }
      if (s.ball.y + BALL_SIZE / 2 >= CANVAS_HEIGHT) {
        s.ball.y = CANVAS_HEIGHT - BALL_SIZE / 2
        s.ball.vy *= -1
      }

      // P1 paddle collision
      if (
        s.ball.x - BALL_SIZE / 2 <= 10 + PADDLE_WIDTH &&
        s.ball.y >= s.p1.y &&
        s.ball.y <= s.p1.y + PADDLE_HEIGHT &&
        s.ball.vx < 0
      ) {
        s.ball.vx *= -1.05
        const hitPos = (s.ball.y - s.p1.y) / PADDLE_HEIGHT - 0.5
        s.ball.vy = hitPos * 8
        s.ball.x = 10 + PADDLE_WIDTH + BALL_SIZE / 2
      }

      // P2 paddle collision
      if (
        s.ball.x + BALL_SIZE / 2 >= CANVAS_WIDTH - 10 - PADDLE_WIDTH &&
        s.ball.y >= s.p2.y &&
        s.ball.y <= s.p2.y + PADDLE_HEIGHT &&
        s.ball.vx > 0
      ) {
        s.ball.vx *= -1.05
        const hitPos = (s.ball.y - s.p2.y) / PADDLE_HEIGHT - 0.5
        s.ball.vy = hitPos * 8
        s.ball.x = CANVAS_WIDTH - 10 - PADDLE_WIDTH - BALL_SIZE / 2
      }

      // Speed cap
      const speed = Math.sqrt(s.ball.vx ** 2 + s.ball.vy ** 2)
      if (speed > 14) {
        s.ball.vx = (s.ball.vx / speed) * 14
        s.ball.vy = (s.ball.vy / speed) * 14
      }

      // Scoring
      if (s.ball.x < 0) {
        p2Score++
        setScores({ p1: p1Score, p2: p2Score })
        if (p2Score >= WINNING_SCORE) { setWinner(mode === 'ai' ? 'AI' : 'Player 2'); return }
        resetBall(s, 2)
      }
      if (s.ball.x > CANVAS_WIDTH) {
        p1Score++
        setScores({ p1: p1Score, p2: p2Score })
        if (p1Score >= WINNING_SCORE) { setWinner('Player 1'); return }
        resetBall(s, 1)
      }
    }

    const loop = () => {
      update()
      draw()
      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [mode, initState])

  const restart = () => {
    stateRef.current = initState()
    setScores({ p1: 0, p2: 0 })
    setWinner(null)
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
        <span>{mode === 'ai' ? 'AI' : 'Player 2'}</span>
      </div>
      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="pong-canvas" />
      {winner && (
        <div className="overlay">
          <div className="winner-card">
            <h2>{winner} Wins!</h2>
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
