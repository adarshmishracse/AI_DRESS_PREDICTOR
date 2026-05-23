import mediapipe
import os

print("\n--- DIAGNOSTIC START ---")
try:
    print("1. MediaPipe File Location:", mediapipe.__file__)
except AttributeError:
    print("1. MediaPipe has no __file__ attribute (It might be a namespace folder)")

print("2. MediaPipe Path:", mediapipe.__path__)
print("3. Available attributes inside MediaPipe:", dir(mediapipe))
print("--- DIAGNOSTIC END ---\n")