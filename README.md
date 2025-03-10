# Tic-Tac-Toe (5x5)

## User Interaction
- **Board Interaction:** The game board is a 3×3 grid captured within the Canvas element. Players can click on a grid cell (positions 1–25) to make a move.
- **Game Mode Selection:** Players can choose between single-player (1P) and two-player (2P) modes using radio buttons. In 1P mode, the AI will automatically take its turn.
- **Visual Effects:** WebGPU is used to render 3D models and dynamic lighting effects, enhancing the overall user experience.

## Installation & Setup
### 1. Environment Setup:
- Ensure **Google Chrome** is set as the default browser and is up to date. Otherwise, manually open `index.html` from the project directory.
- Install **Python 3** and required dependencies (`Flask`, `Flask-SocketIO`, `EasyAI`, `Flask-CORS`).
- Keep all frontend files (HTML, CSS, JavaScript) and backend files (Python) in the same project directory.

### 2. Running the Backend Server:
- Open a terminal and run:
  ```bash
  python index_Jack.py
  ```
- The server will start on port 5000 and automatically open the game interface in the default browser.

## Game Instructions
### 1. Selecting a Mode:
- Use the radio buttons at the top of the interface to choose between **single-player (1P)** or **two-player (2P)** mode (default: 1P).

### 2. Making a Move:
- Click on a grid cell (1–25) to place your move. The game checks for a win condition starting from move 9 and updates the frontend accordingly.

### 3. Move Logging:
- Each move is logged in `tictactoe.txt` in the format `X:number` or `O:number` for future reference.

### 4. Win/Loss Detection:
- The game will display a pop-up message when a player wins or the board is full.
- Winning positions will be highlighted on the board.

### 5. Restarting the Game:
- Refresh the page, confirm the pop-up, or switch game modes to start a new round. Move logs will be retained until the next game starts.

## Additional Features
- **AI Opponent:**
  - In single-player mode, the AI uses the **Negamax** algorithm to calculate optimal moves, adding a layer of challenge. The AI logic may be further optimized in future updates.

- **Real-Time Updates:**
  - The game leverages WebSocket for low-latency, real-time communication, ensuring the frontend and backend remain in sync with each move.

