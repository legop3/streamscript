# Example file showing a circle moving on screen
import pygame
import random
import time

# pygame setup
pygame.init()
pygame.font.init()

screen = pygame.display.set_mode((1280, 720))
clock = pygame.time.Clock()
running = True
dt = 0

player_pos = pygame.Vector2(screen.get_width() / 2, screen.get_height() / 2)

font = pygame.font.SysFont('monospace', 60)

emoticons = [
    ":)",      # Happy
    ":(",      # Sad
    ":D",      # Very happy
    ";)",      # Winking
    ":P",      # Tongue out
    ":|",      # Neutral
    ":/",      # Confused/skeptical
    ":o",      # Surprised
    ":3",      # Cat-like smile
    "XD",      # Laughing
    "^_^",     # Anime-style happy
    "-_-",     # Annoyed/tired
    "o_O",     # Confused
    ">:(",     # Angry
    ":*",      # Kiss
    "<3",      # Heart
    "</3",     # Broken heart
    "T_T",     # Crying
    "^^",      # Happy eyes
    "@_@",     # Dizzy/confused
    "=)",      # Alternative smile
    "=D",      # Alternative big smile
    ":s",      # Worried
    ":x",      # Sealed lips
    "8)",      # Cool (sunglasses)
    "B)",      # Cool (alternative)
    ":')",     # Tears of joy
    ":'-(",    # Crying
    "¯\_(ツ)_/¯",  # Shrug
    "(╯°□°）╯︵ ┻━┻",  # Table flip
    "OwO", # owo
    "UwU" # uwu
]

counter = 177532

while running:
    # poll for events
    # pygame.QUIT event means the user clicked X to close your window
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False

    emote = emoticons[random.randint(0, (len(emoticons) - 1))]
    print(emote)


    # fill the screen with a color to wipe away anything from last frame
    screen.fill("purple")

    emote = font.render(emote, False, (0, 0, 0))
    screen.blit(emote, (0, 0))

    counter_text = font.render(str(counter), False, (0, 0, 0))
    screen.blit(counter_text, (screen.get_width()/2, screen.get_height()/2))


    pygame.draw.circle(screen, "red", player_pos, 10)


    # keys = pygame.key.get_pressed()
    # if keys[pygame.K_w]:
    #     player_pos.y -= 300 * dt
    # if keys[pygame.K_s]:
    #     player_pos.y += 300 * dt
    # if keys[pygame.K_a]:
    #     player_pos.x -= 300 * dt
    # if keys[pygame.K_d]:
    #     player_pos.x += 300 * dt

    if counter == 0:
        pygame.quit()

    player_pos.x = random.randint(0, 1280)
    player_pos.y = random.randint(0, 720)

    # pygame.draw.line(screen, "blue", )



    # time.sleep(10)

    # flip() the display to put your work on screen
    pygame.display.flip()
    time.sleep(5)

    counter = counter - 1

    # limits FPS to 60
    # dt is delta time in seconds since last frame, used for framerate-
    # independent physics.
    dt = clock.tick(60) / 1000

pygame.quit()