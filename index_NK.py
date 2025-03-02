class TicTacToe:
   def __init__(self):
       self.board = [[' ' for _ in range(5)] for _ in range(5)]
       self.current_player = 'X'
       self.winner = None
       self.move_count = 0
   
   def print_board(self):
       for row in self.board:
           print("|".join(row))
           print("-" * 9)
   
   def switch_player(self):
       self.current_player = 'O' if self.current_player == 'X' else 'X'
   
   def make_move(self, row, col):
       if self.board[row][col] == ' ':
           self.board[row][col] = self.current_player
           self.move_count += 1
           if self.check_winner():
               self.winner = self.current_player
           elif self.move_count == 25:  # All cells filled
               self.winner = 'Draw'
           else:
               self.switch_player()
       else:
           print("Invalid move! Cell already occupied.")
   
   def check_winner(self):
       # Check rows, columns, and diagonals for a winning condition
       for i in range(5):
           # Check rows and columns
           if all(self.board[i][j] == self.current_player for j in range(5)) or \
              all(self.board[j][i] == self.current_player for j in range(5)):
               return True
       
       # Check diagonals
       if all(self.board[i][i] == self.current_player for i in range(5)) or \
          all(self.board[i][4 - i] == self.current_player for i in range(5)):
           return True
       
       return False
   
   def play_game(self):
       while self.winner is None:
           self.print_board()
           try:
               row = int(input(f"Player {self.current_player}, enter the row (0-4): "))
               col = int(input(f"Player {self.current_player}, enter the column (0-4): "))
               
               if 0 <= row < 5 and 0 <= col < 5:
                   self.make_move(row, col)
               else:
                   print("Invalid input! Please enter values between 0 and 4.")
           except ValueError:
               print("Invalid input! Please enter integers between 0 and 4.")      
                       
       # Game over
       self.print_board()
       if self.winner == 'Draw':
           print("The game is a draw!")
       else:
           print(f"Player {self.winner} wins!")
 
   # Function to save the moves in a file
   def save_move(player, move, filename="tictactoe.txt"):
       with open(filename, "a") as file:
           file.write(f"{player}:{move}\n")
 
   # Example of storing moves for X and O
   save_move("X", 5)
   save_move("O", 2)
   save_move("X", 1)
   save_move("O", 9)
 
print("Moves saved to tictactoe.txt.")
   
# To play the game:
game = TicTacToe()
game.play_game()