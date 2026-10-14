"""
Author: Joon Sung Park (joonspk@stanford.edu)

File: path_finder.py
Description: Implements various path finding functions for generative agents.
Some of the functions are defunct. 
"""
import numpy as np
from collections import deque

def print_maze(maze):
  for row in maze:
    for item in row:
      print(item, end='')
    print()


def path_finder_v1(maze, start, end, collision_block_char, verbose=False): 
  def prepare_maze(maze, start, end):
    maze[start[0]][start[1]] = "S"
    maze[end[0]][end[1]] = "E"
    return maze

  def find_start(maze):
    for row in range(len(maze)):
      for col in range(len(maze[0])):
        if maze[row][col] == 'S':
          return row, col

  def is_valid_position(maze, pos_r, pos_c):
    if pos_r < 0 or pos_c < 0:
      return False
    if pos_r >= len(maze) or pos_c >= len(maze[0]):
      return False
    if maze[pos_r][pos_c] in ' E':
      return True
    return False

  def solve_maze(maze, start, verbose=False):
    path = []
    # We use a Python list as a stack - then we have push operations as
    # append, and pop as pop.
    stack = []
    # Add the entry point (as a tuple)
    stack.append(start)
    # Go through the stack as long as there are elements
    while len(stack) > 0:
      pos_r, pos_c = stack.pop()
      if verbose: 
        print("Current position", pos_r, pos_c)
      if maze[pos_r][pos_c] == 'E':
        path += [(pos_r, pos_c)]
        return path
      if maze[pos_r][pos_c] == 'X':
        # Already visited
        continue
      # Mark position as visited
      maze[pos_r][pos_c] = 'X'
      path += [(pos_r, pos_c)]
      # Check for all possible positions and add if possible
      if is_valid_position(maze, pos_r - 1, pos_c):
        stack.append((pos_r - 1, pos_c))
      if is_valid_position(maze, pos_r + 1, pos_c):
        stack.append((pos_r + 1, pos_c))
      if is_valid_position(maze, pos_r, pos_c - 1):
        stack.append((pos_r, pos_c - 1))
      if is_valid_position(maze, pos_r, pos_c + 1):
        stack.append((pos_r, pos_c + 1))

      # To follow the maze
      if verbose: 
        print('Stack:' , stack)
        print_maze(maze)

    # We didn't find a path, hence we do not need to return the path
    return False

  # clean maze
  new_maze = []
  for row in maze: 
    new_row = []
    for j in row: 
      if j == collision_block_char: 
        new_row += ["#"]
      else: 
        new_row += [" "]
    new_maze += [new_row]

  maze = new_maze

  maze = prepare_maze(maze, start, end)
  start = find_start(maze)
  path = solve_maze(maze, start, verbose)
  return path


def path_finder_v2(a, start, end, collision_block_char, verbose=False):
  """
  Optimized Breadth-First Search (BFS) path finder.
  Functionally identical to original path_finder_v2 with 150-step horizon,
  but runs in O(V + E) rather than O(K * V) grid rescans.
  """
  if not a or not a[0]:
    return [end]

  num_rows = len(a)
  num_cols = len(a[0])

  start_r, start_c = start
  end_r, end_c = end

  if (start_r, start_c) == (end_r, end_c):
    return [(start_r, start_c)]

  if not (0 <= end_r < num_rows and 0 <= end_c < num_cols):
    return [end]
  if a[end_r][end_c] == collision_block_char:
    return [end]

  queue = deque([(start_r, start_c, 0)])
  parent = {}
  visited = {(start_r, start_c)}
  max_dist = 150
  found = False

  while queue:
    curr_r, curr_c, dist = queue.popleft()
    if (curr_r, curr_c) == (end_r, end_c):
      found = True
      break
    if dist >= max_dist:
      continue

    # Up, Left, Down, Right
    for dr, dc in ((-1, 0), (0, -1), (1, 0), (0, 1)):
      nr, nc = curr_r + dr, curr_c + dc
      if 0 <= nr < num_rows and 0 <= nc < num_cols:
        if (nr, nc) not in visited and a[nr][nc] != collision_block_char:
          visited.add((nr, nc))
          parent[(nr, nc)] = (curr_r, curr_c)
          queue.append((nr, nc, dist + 1))

  if not found:
    return [end]

  path = []
  curr = (end_r, end_c)
  while curr:
    path.append(curr)
    curr = parent.get(curr)
  path.reverse()
  return path


def path_finder(maze, start, end, collision_block_char, verbose=False):
  # EMERGENCY PATCH
  start = (start[1], start[0])
  end = (end[1], end[0])
  # END EMERGENCY PATCH

  path = path_finder_v2(maze, start, end, collision_block_char, verbose)

  new_path = []
  for i in path: 
    new_path += [(i[1], i[0])]
  path = new_path
  
  return path


def closest_coordinate(curr_coordinate, target_coordinates): 
  min_dist = None
  closest_coordinate = None
  for coordinate in target_coordinates: 
    a = np.array(coordinate)
    b = np.array(curr_coordinate)
    dist = abs(np.linalg.norm(a-b))
    if not closest_coordinate: 
      min_dist = dist
      closest_coordinate = coordinate
    else: 
      if min_dist > dist: 
        min_dist = dist
        closest_coordinate = coordinate

  return closest_coordinate


def path_finder_2(maze, start, end, collision_block_char, verbose=False):
  # start => persona_a
  # end => persona_b
  start = list(start)
  end = list(end)

  t_top = (end[0], end[1]+1)
  t_bottom = (end[0], end[1]-1)
  t_left = (end[0]-1, end[1])
  t_right = (end[0]+1, end[1])
  pot_target_coordinates = [t_top, t_bottom, t_left, t_right]

  maze_width = len(maze[0]) 
  maze_height = len(maze)
  target_coordinates = []
  for coordinate in pot_target_coordinates: 
    if coordinate[0] >= 0 and coordinate[0] < maze_width and coordinate[1] >= 0 and coordinate[1] < maze_height: 
      target_coordinates += [coordinate]

  target_coordinate = closest_coordinate(start, target_coordinates)

  path = path_finder(maze, start, target_coordinate, collision_block_char, verbose=False)
  return path


def path_finder_3(maze, start, end, collision_block_char, verbose=False):
  # start => persona_a
  # end => persona_b

  curr_path = path_finder(maze, start, end, collision_block_char, verbose=False)
  if len(curr_path) <= 2: 
    return []
  else: 
    a_path = curr_path[:int(len(curr_path)/2)]
    b_path = curr_path[int(len(curr_path)/2)-1:]
  b_path.reverse()

  print (a_path)
  print (b_path)
  return a_path, b_path


if __name__ == '__main__':
  maze = [['#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#'], 
          [' ', ' ', '#', ' ', ' ', ' ', ' ', ' ', '#', ' ', ' ', ' ', '#'], 
          ['#', ' ', '#', ' ', ' ', '#', '#', ' ', ' ', ' ', '#', ' ', '#'], 
          ['#', ' ', '#', ' ', ' ', '#', '#', ' ', '#', ' ', '#', ' ', '#'], 
          ['#', ' ', ' ', ' ', ' ', ' ', ' ', ' ', '#', ' ', ' ', ' ', '#'], 
          ['#', '#', '#', ' ', '#', ' ', '#', '#', '#', ' ', '#', ' ', '#'], 
          ['#', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', '#', ' ', ' '], 
          ['#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#', '#']]
  start = (0, 1)
  end = (0, 1)
  print (path_finder(maze, start, end, "#"))

  print ("-===")
  start = (0, 1)
  end = (11, 4)
  print (path_finder_2(maze, start, end, "#"))

  print ("-===")
  start = (0, 1)
  end = (12, 6)
  print (path_finder_3(maze, start, end, "#"))

  print ("-===")
  path_finder_3(maze, start, end, "#")[0]
  path_finder_3(maze, start, end, "#")[1]




