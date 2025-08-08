from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from easyAI.AI import Negamax
from easyAI.TwoPlayerGame import TwoPlayerGame
from easyAI.Player import AI_Player

import webbrowser
import os


## Creating a Flask Application Instance
app = Flask(__name__)
## Enabled cross-domain resource sharing for Flask applications (Troubleshooting CORS for local debugging)
CORS(app)
## Integration of SocketIO for real-time communication
socketIO = SocketIO(app, cors_allowed_origins="*")


class game:
    def __init__(self, gameMode=1):
        """
        gameMode:
            1: single player mode (1P)
            2: two pleayer mode (2P)
        moves: Save all moves, moves 1~25 indicate board position
        """
        self.gameMode = gameMode
        self.moves = []

    def parity(self):
        """
        Determine the parity of the current number of drops:
            0: even
            1: odd
        """
        if len(self.moves) % 2 == 0:
            return 0
        else:
            return 1

    def check_win(self, moves):
        """
        Detects whether the given drop list numbers constitute a winning game.
        """
        winning_patterns = [
            [1, 2, 3, 4, 5],
            [6, 7, 8, 9, 10],
            [11, 12, 13, 14, 15],
            [16, 17, 18, 19, 20],
            [21, 22, 23, 24, 25],
            [1, 6, 11, 16, 21],
            [2, 7, 12, 17, 22],
            [3, 8, 13, 18, 23],
            [4, 9, 14, 19, 24],
            [5, 10, 15, 20, 25],
            [1, 7, 13, 19, 25],
            [5, 9, 13, 17, 21],
        ]
        for pattern in winning_patterns:
            if set(pattern).issubset(set(moves)):
                ## win
                return True, pattern
        ## lose
        return False, None

    def reset(self, gameMode_reset):
        """
        Reset the game state, clear the drop record, write to the log.
        """
        self.gameMode = gameMode_reset
        self.moves = []
        # self.log_moves()
        print("🚨 Game reset")
        result = {"number": 0}
        emit("update", result, broadcast=True)
        return result

    def log_moves(self):
        """
        Write the current drop record to tictactoe.txt.
        """
        with open("tictactoe.txt", "w") as file:
            for index, move in enumerate(self.moves):
                if index % 2 == 0:
                    file.write(f"O: {move}\n")
                else:
                    file.write(f"X: {move}\n")

    def move_AI(self):
        """
        Calculate the the AI's move using EasyAI's Negamax algorithm (Negamax(node,depth)=max(−Negamax(child,depth−1))).
        """
        available_moves = []
        for i in range(1, 26):
            if i not in self.moves:
                available_moves.append(i)

        if not available_moves:
            return None

        class AI(TwoPlayerGame):
            def __init__(self, moves):
                self.moves = moves.copy()
                self.current_player = 2  # AI as Player2 (X)
                self.ai_move = None

            def possible_moves(self):
                available_moves = []
                for i in range(1, 26):
                    if i not in self.moves:
                        available_moves.append(str(i))
                return available_moves

            def make_move(self, move):
                self.moves.append(int(move))
                self.ai_move = move

            def unmake_move(self, move):
                self.moves.remove(int(move))

            def winner(self):
                moves_O = set()
                moves_X = set()

                for i in range(len(self.moves)):
                    if i % 2 == 0:
                        moves_O.add(self.moves[i])
                    else:
                        moves_X.add(self.moves[i])
                for wins in [
                    {1, 2, 3, 4, 5},
                    {6, 7, 8, 9, 10},
                    {11, 12, 13, 14, 15},
                    {16, 17, 18, 19, 20},
                    {21, 22, 23, 24, 25},
                    {1, 6, 11, 16, 21},
                    {2, 7, 12, 17, 22},
                    {3, 8, 13, 18, 23},
                    {4, 9, 14, 19, 24},
                    {5, 10, 15, 20, 25},
                    {1, 7, 13, 19, 25},
                    {5, 9, 13, 17, 21},
                ]:
                    if wins.issubset(moves_O):
                        return 1  # O win
                    if wins.issubset(moves_X):
                        return 2  # X win
                return None

            def scoring(self):
                winner = self.winner()
                if winner == 2:
                    return 100
                elif winner == 1:
                    return -100
                else:
                    return 0

            def is_over(self):
                if self.winner() is not None or len(self.moves) == 25:
                    return True

        algorithm = Negamax(5)  # Calculated depth: 5
        ai = AI(self.moves)
        move = AI_Player(algorithm).ask_move(ai)
        if move:
            return int(move)
        else:
            return None

    def info(self, data):
        """
        Process game logic based on "data" from the fromtend.

        Steps:
        1. **Game Mode**:
            - Reset the game and update the mode if "gameMode" is in data

        2. **Move**:
            If "move" is valid:
                - Add "move" to "moves" if it's not already taken
                If at least 9 moves have been made:
                    - Check for a win or draw

        3. **AI Move (1P)**:
            If it's AI's turn:
                - AI makes a move
                - Check for a win or draw (Can be optimized)
        """
        result = []

        ## Update gameMode and reset the game
        if "gameMode" in data:
            self.gameMode = int(data["gameMode"])
            result.append(self.reset(self.gameMode))

        move = data.get("number")
        if move is None:
            return result

        ## Player's move:
        if move != 0 and move not in self.moves:
            self.moves.append(move)
            print("Moves:", self.moves)

            subresult = {"number": move, "parity": self.parity()}

            ## Check win or draw condition
            if len(self.moves) >= 9:
                moves_player = []
                for i in range(len(self.moves)):
                    if i % 2 != self.parity():
                        moves_player.append(self.moves[i])
                if self.check_win(moves_player)[0] or len(self.moves) == 25:
                    subresult["win"], subresult["numbers_win"] = self.check_win(
                        moves_player
                    )
                    subresult["AI"] = False

            self.log_moves()
            result.append(subresult)

            ## AI's move
            if self.gameMode == 1 and self.parity() == 1:
                move_ai = self.move_AI()
                if move_ai:
                    self.moves.append(move_ai)
                    print("AI's Move:", move_ai)
                    moves_ai = []
                    for i in range(len(self.moves)):
                        if i % 2 == 1:
                            moves_ai.append(self.moves[i])
                    subresult = {"number": move_ai, "parity": self.parity()}
                    if self.check_win(moves_ai)[0]:
                        subresult["win"], subresult["numbers_win"] = self.check_win(
                            moves_ai
                        )
                        subresult["AI"] = True
                    result.append(subresult)

        elif move == 0:
            self.reset(self.gameMode)

        return result


## Creating a game instance
instance = game(gameMode=1)


@socketIO.on("info")
def handle_info(data):
    results = instance.info(data)
    for result in results:
        emit("update", result, broadcast=True)


@socketIO.on("disconnect")
def handle_disconnect():
    instance.reset(1)


if __name__ == "__main__":
    filePath = os.path.abspath("index.html")
    webbrowser.open("file://" + filePath)
    socketIO.run(app, host="0.0.0.0", port=5000, debug=True, use_reloader=False)
