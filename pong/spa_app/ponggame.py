import time
import random
import asyncio
from time import sleep
import random

class Game:
    def __init__(self):
        self.table_pos_z = -150
        self.ball_radius = 15
        self.half_racket_height = 50
        self.racket_w = 20
        self.racket_h = 100
        self.racket_d = 100
        self.table_w = 1200
        self.table_h = 75
        self.table_d = 600

        self.table_prop = {
            'minZ': self.table_pos_z - self.table_d / 2 + self.ball_radius,
            'maxZ': self.table_pos_z + self.table_d / 2 - self.ball_radius,
            'minX': -self.table_w / 2,
            'maxX': self.table_w / 2
        }

        self.ball_position = [0, self.table_h / 2 + 7, -(self.table_d / 4)]
        self.ball_velocity = [5, 0, 5]
        self.score = {'left': 0, 'right': 0}
        self.last_collision_time = 0
        self.collision_cooldown = 0.1
        self.collision_buffer = 1
        self.min_velocity = 2
        self.edge_tolerance = 5

        self.left_racket_position = [
            -((self.table_w / 2) - (self.racket_w / 2) - 10),
            self.table_h / 2 + self.racket_h,
            -(self.table_d / 4)
        ]
        self.right_racket_position = [
            (self.table_w / 2) - (self.racket_w / 2) - 10,
            self.table_h / 2 + self.racket_h,
            -(self.table_d / 4)
        ]

        self.game_running = False
        self.update_callback = None
        self.score_update_callback = None
        self.end_game_callback = None

    async def move_ball(self):
        try:
            self.ball_position[0] += self.ball_velocity[0]
            self.ball_position[1] += self.ball_velocity[1]
            self.ball_position[2] += self.ball_velocity[2]

            self.ball_position[0] = max(self.table_prop['minX'], min(self.table_prop['maxX'], self.ball_position[0]))
            self.ball_position[2] = max(self.table_prop['minZ'], min(self.table_prop['maxZ'], self.ball_position[2]))

            await self.check_collision()
        except Exception as e:
            print(f"Error in move_ball: {e}")

    async def check_collision(self):
        now = time.time()

        if now - self.last_collision_time < self.collision_cooldown:
            return

        # Wall collisions
        if self.ball_position[2] - self.ball_radius <= self.table_prop['minZ'] and self.ball_velocity[2] < 0:
            self.ball_velocity[2] *= -1
        elif self.ball_position[2] + self.ball_radius >= self.table_prop['maxZ'] and self.ball_velocity[2] > 0:
            self.ball_velocity[2] *= -1

        # Racket collisions
        if (self.ball_position[0] - self.ball_radius <= self.left_racket_position[0] + self.racket_w / 2 + self.collision_buffer and
            self.ball_position[0] + self.ball_radius >= self.left_racket_position[0] - self.racket_w / 2 - self.collision_buffer and
            self.ball_position[2] + self.ball_radius >= self.left_racket_position[2] - self.racket_d / 2 - self.collision_buffer and
            self.ball_position[2] - self.ball_radius <= self.left_racket_position[2] + self.racket_d / 2 + self.collision_buffer):
            self.handle_racket_collision(is_right=False)

        if (self.ball_position[0] - self.ball_radius <= self.right_racket_position[0] + self.racket_w / 2 + self.collision_buffer and
            self.ball_position[0] + self.ball_radius >= self.right_racket_position[0] - self.racket_w / 2 - self.collision_buffer and
            self.ball_position[2] + self.ball_radius >= self.right_racket_position[2] - self.racket_d / 2 - self.collision_buffer and
            self.ball_position[2] - self.ball_radius <= self.right_racket_position[2] + self.racket_d / 2 + self.collision_buffer):
            self.handle_racket_collision(is_right=True)

        # Scoring
        if self.ball_position[0] + self.ball_radius + 10 > self.table_prop['maxX'] + 5 and self.ball_velocity[0] > 0:
            await self.reset_ball('left')
        elif self.ball_position[0] - self.ball_radius - 10 < self.table_prop['minX'] - 5 and self.ball_velocity[0] < 0:
            await self.reset_ball('right')

    def handle_racket_collision(self, is_right=False):
        # distance_from_center_z = abs(self.ball_position[2] - (self.right_racket_position[2] if is_right else self.left_racket_position[2]))
        # is_near_edge_z = distance_from_center_z >= (self.racket_d / 2) - self.edge_tolerance

        # if is_near_edge_z:
        #     self.ball_velocity[2] += (random.random() - 0.5) * 0.4

        racket_position = self.right_racket_position if is_right else self.left_racket_position
        distance_from_center_z = self.ball_position[2] - racket_position[2]
        impact_factor_z = distance_from_center_z / (self.racket_d / 2)


        self.ball_velocity[2] += impact_factor_z * 0.4 

        if abs(self.ball_velocity[0]) < self.min_velocity:
            self.ball_velocity[0] = -self.min_velocity if self.ball_velocity[0] < 0 else self.min_velocity

        self.ball_velocity[0] *= -1
        self.ball_position[0] += self.collision_buffer if self.ball_velocity[0] > 0 else -self.collision_buffer
        self.last_collision_time = time.time()

    def set_score_update_callback(self, callback):
        self.score_update_callback = callback
    
    async def reset_ball(self, side_to_inc):
        print("RESET CALL?")
        self.ball_position = [0, self.table_h / 2 + 7, -(self.table_d / 4)]
        speed = 5
        direction_x = random.choice([-1, 1])
        direction_z = random.choice([-1, 1])

        self.ball_velocity = [direction_x * speed, 0, direction_z * speed]

        if side_to_inc == 'left':
            self.score['left'] += 1
        else:
            self.score['right'] += 1

        if self.score_update_callback:
            await self.score_update_callback(self.score)

    def set_update_callback(self, callback):
        self.update_callback = callback

    def start(self):
        self.game_running = True

    def set_end_game_callback(self, callback):
        self.end_game_callback = callback

    async def game_loop(self):
        self.game_running = True
        while self.game_running:
            try:
                await self.move_ball()
                if self.score['left'] >= 5 or self.score['right'] >= 5:
                    print("Game over! Reached score 5.")
                    self.game_running = False
                    if self.end_game_callback:
                        if self.score['left'] == 5:
                            await self.end_game_callback('left')
                        elif self.score['right'] == 5:
                            await self.end_game_callback('right')
                    break


                if self.update_callback:
                    await self.update_callback()

            except Exception as e:
                print(f"Exception in game loop: {e}")
                break 
            await asyncio.sleep(0.008)

    def update_game_state(self):
        print("Updating game state:", {
            'velocity': self.ball_velocity,
            'ball_position': self.ball_position,
        })

        return {
            'velocity': self.ball_velocity,
            'ball_position': self.ball_position,
        }

    def reset(self):
        self.table_pos_z = -150
        self.ball_radius = 15
        self.half_racket_height = 50
        self.racket_w = 20
        self.racket_h = 100
        self.racket_d = 100
        self.table_w = 1200
        self.table_h = 75
        self.table_d = 600

        self.table_prop = {
            'minZ': self.table_pos_z - self.table_d / 2 + self.ball_radius,
            'maxZ': self.table_pos_z + self.table_d / 2 - self.ball_radius,
            'minX': -self.table_w / 2,
            'maxX': self.table_w / 2
        }

        self.ball_position = [0, self.table_h / 2 + 7, -(self.table_d / 4)]
        print(f"RESETING BALL: {self.ball_position}")
        self.ball_velocity = [5, 0, 5]
        self.score = {'left': 0, 'right': 0}
        self.last_collision_time = 0
        self.collision_cooldown = 0.1
        self.collision_buffer = 1
        self.min_velocity = 2
        self.edge_tolerance = 5

        self.left_racket_position = [
            -((self.table_w / 2) - (self.racket_w / 2) - 10),
            self.table_h / 2 + self.racket_h,
            -(self.table_d / 4)
        ]
        self.right_racket_position = [
            (self.table_w / 2) - (self.racket_w / 2) - 10,
            self.table_h / 2 + self.racket_h,
            -(self.table_d / 4)
        ]

        self.game_running = False
        self.update_callback = None
        self.score_update_callback = None
        self.end_game_callback = None
