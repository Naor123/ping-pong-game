# Ping Pong Game

A browser-based Ping Pong game built with React and served via Docker (nginx).

## Features

- **2-Player mode** — both players on the same keyboard
- **vs AI mode** — progressive difficulty with a level system
- Smooth 60 fps canvas rendering
- Ball angle deflection based on paddle hit position

## Controls

| Player | Up | Down |
|--------|-----|------|
| Player 1 | `W` | `S` |
| Player 2 (2P mode) | `↑` | `↓` |

## AI Level System (vs AI mode)

| Event | Result |
|-------|--------|
| AI scores **5** | You lose immediately |
| You score **5** | AI upgrades to **Level 2** (faster, tracks ball from anywhere) |
| You score **7** | You win |

Level 1 AI only reacts when the ball is in its own half, giving you time to breathe. Level 2 AI tracks the ball from anywhere on the court at nearly double the speed.

## Run with Docker

```bash
docker compose up --build
```

Then open [http://localhost:3000](http://localhost:3000).

## Run locally (dev)

```bash
npm install
npm run dev
```

## Tech Stack

- **React** + **Vite** — UI and build tooling
- **HTML5 Canvas** — game rendering loop (requestAnimationFrame)
- **Docker** — multi-stage build (Node builder → nginx alpine)
