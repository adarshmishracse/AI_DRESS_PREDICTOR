import firebase_admin
from firebase_admin import credentials, firestore
from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import mediapipe as mp
import base64
import requests
import io
from gradio_client import Client, handle_file
import tempfile
import uuid
import os

# --- NEW: OFFICIAL HUGGING FACE LOGIN ---
from huggingface_hub import login

# HF_TOKEN = "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" # <--- PASTE YOUR TOKEN HERE!

HF_TOKEN = os.getenv("HF_TOKEN")
print("Logging into Hugging Face...")
login(token=HF_TOKEN) # This FORCES the ZeroGPU server to recognize your account!

print(" Connecting to IDM-VTON AI Model...")
hf_client = Client("yisol/IDM-VTON")
print("AI Model Ready!")

# --- 1. INIT FIREBASE ---
# (Keep the rest of your code exactly the same below this line)

# --- 1. INIT FIREBASE ---
try:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print(" Connected to Firebase")
except Exception as e:
    print(f" Firebase Error: {e}")

app = Flask(__name__)
CORS(app)

# --- MEDIAPIPE POSE INITIALIZATION ---
mp_pose = mp.solutions.pose
pose = mp_pose.Pose(static_image_mode=True, model_complexity=2, min_detection_confidence=0.5)

# --- 2. HELPER: IMAGE LOADER ---
def load_image_data(image_data):
    try:
        if not image_data: return None
        if isinstance(image_data, str) and (image_data.startswith("data:image") or len(image_data) > 200):
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            missing_padding = len(image_data) % 4
            if missing_padding: image_data += '=' * (4 - missing_padding)
            image_bytes = base64.b64decode(image_data)
            np_arr = np.frombuffer(image_bytes, np.uint8)
            return cv2.imdecode(np_arr, cv2.IMREAD_UNCHANGED)
        elif isinstance(image_data, str) and image_data.startswith("http"):
            resp = requests.get(image_data)
            np_arr = np.asarray(bytearray(resp.content), dtype="uint8")
            return cv2.imdecode(np_arr, cv2.IMREAD_UNCHANGED)
        return None
    except Exception as e:
        print(f"Image Load Error: {e}")
        return None

# --- 3. BIO-METRIC ANALYSIS LOGIC ---
def get_dominant_skin_color(image, landmarks):
    try:
        h, w, _ = image.shape
        nose = landmarks[mp_pose.PoseLandmark.NOSE]
        cx, cy = int(nose.x * w), int(nose.y * h)
        y1, y2 = cy - 20, cy + 20
        x1, x2 = cx - 20, cx + 20
        if y1 < 0 or x1 < 0: return "Wheatish", "#D2B48C"
        
        face_patch = image[y1:y2, x1:x2]
        avg_color = np.mean(face_patch, axis=(0,1))
        b, g, r = int(avg_color[0]), int(avg_color[1]), int(avg_color[2])
        hex_color = "#{:02x}{:02x}{:02x}".format(r, g, b)
        
        brightness = (r + g + b) / 3
        if brightness > 200: tone = "Fair"
        elif brightness > 160: tone = "Wheatish"
        elif brightness > 120: tone = "Medium Brown"
        else: tone = "Dark Brown"
        return tone, hex_color
    except: return "Wheatish", "#D2B48C"

def analyze_body_metrics(landmarks, width, height):
    l_sh = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER].x * width
    r_sh = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER].x * width
    l_hip = landmarks[mp_pose.PoseLandmark.LEFT_HIP].x * width
    r_hip = landmarks[mp_pose.PoseLandmark.RIGHT_HIP].x * width
    
    shoulder_dist = abs(l_sh - r_sh)
    hip_dist = abs(l_hip - r_hip)
    
    report = {}
    ratio = shoulder_dist / hip_dist if hip_dist > 0 else 1.0
    
    if ratio > 1.4: report['shape'] = "Trapezoid (Broad)"
    elif ratio > 1.1: report['shape'] = "Inverted Triangle"
    elif ratio < 0.9: report['shape'] = "Triangle"
    elif ratio < 1.05: report['shape'] = "Rectangle"
    else: report['shape'] = "Oval"

    # EXPLICIT SIZE PREDICTION (Calibrated for Close-up Webcams)
    frame_coverage = shoulder_dist / width
    if frame_coverage > 0.65: 
        report['build'] = "Broad / Heavy"
        report['size'] = "XL / XXL"
    elif frame_coverage < 0.55: 
        report['build'] = "Slim / Narrow"
        report['size'] = "S / M"
    else: 
        report['build'] = "Medium / Athletic"
        report['size'] = "L / M"
    
    return report

# --- 5. ENDPOINT: ANALYZE (Initial Scan & Smart Queue) ---
@app.route('/analyze', methods=['POST'])
def analyze():
    if 'image' not in request.files: return jsonify({"error": "No image"}), 400
    file = request.files['image']
    user_img = cv2.imdecode(np.frombuffer(file.read(), np.uint8), cv2.IMREAD_COLOR)

    results = pose.process(cv2.cvtColor(user_img, cv2.COLOR_BGR2RGB))
    if not results.pose_landmarks: return jsonify({"error": "No person detected"}), 400

    landmarks = results.pose_landmarks.landmark
    h, w, _ = user_img.shape

    skin_name, skin_hex = get_dominant_skin_color(user_img, landmarks)
    body_report = analyze_body_metrics(landmarks, w, h)
    
    # Updated Analysis String with Explicit Size
    analysis_string = f"{skin_name} Tone • {body_report['build']} • Recommended Size: {body_report['size']}"
    
    category = request.form.get('category', 'Men')
    docs = db.collection('inventory').where('category', '==', category).stream()
    
   # Smart Scoring Algorithm for Descending Queue
    suggestions = []
    for doc in docs:
        item = doc.to_dict()
        item['id'] = doc.id
        
        # 1. BASE VARIANCE: Har item ko thoda alag score dene ke liye uske ID ka use kiya hai
        # Isse agar 2 shirt bilkul same bhi hain, toh unka score 2-5% alag aayega
        base_variance = sum(ord(c) for c in doc.id) % 10 
        score = 60 + base_variance # Base score 60-69 ke beech rahega
        
        # --- 2. FIT LOGIC ---
        fit = item.get('fitType', 'Regular')
        
        if body_report['build'] == "Slim / Narrow":
            if fit == "Slim": score += 15
            elif fit == "Regular": score += 5
            elif fit == "Relaxed": score -= 10
        elif body_report['build'] == "Broad / Heavy":
            if fit == "Relaxed": score += 15
            elif fit == "Regular": score += 5
            elif fit == "Slim": score -= 15
        elif body_report['build'] == "Medium / Athletic":
            if fit == "Regular": score += 15
            elif fit == "Slim": score += 10
            elif fit == "Relaxed": score += 2
            
        # --- 3. COLOR LOGIC ---
        color = item.get('color', 'Black')
        
        if skin_name == "Fair":
            if color in ['Black', 'Navy', 'Maroon', 'Green', 'Purple']: score += 12
            elif color in ['White', 'Yellow', 'Beige', 'Pink']: score -= 5
        elif skin_name in ["Dark Brown", "Medium Brown"]:
            if color in ['White', 'Yellow', 'Pink', 'Light Blue', 'Red', 'Beige']: score += 14
            elif color in ['Black', 'Navy', 'Dark Brown']: score -= 5
        elif skin_name == "Wheatish":
            if color in ['Olive', 'Maroon', 'Navy', 'Teal', 'Rust']: score += 12

        # 4. STRICT CAPPING: Score humesha 60 se 98 ke beech hi rahega
        item['match_score'] = min(98, max(60, score))
        suggestions.append(item)

    # Sort array in descending order (Best match = highest score)
    suggestions.sort(key=lambda x: x.get('match_score', 0), reverse=True)

    return jsonify({
        "body_shape": analysis_string,
        "raw_data": { "skin_hex": skin_hex, "exact_shape": body_report['shape'], "recommended_size": body_report['size'] },
        "try_on_image": None,
        "suggestions": suggestions[:10] # Send top 10 to queue
    })

# --- 6. ENDPOINT: IDM-VTON VIRTUAL TRY-ON ---
@app.route('/virtual-try-on', methods=['POST'])
def virtual_try_on():
    user_path = None
    cloth_path = None
    try:
        print("👕 Sending to IDM-VTON... (This takes 30-60 seconds)")
        if 'user_image' not in request.form: return jsonify({"error": "No user image"}), 400
        
        user_img = load_image_data(request.form['user_image'])
        cloth_url = request.form.get('cloth_image')
        cloth_img = load_image_data(cloth_url)
        
        if user_img is None or cloth_img is None: 
            return jsonify({"error": "Failed to load images"}), 400

        # 1. Create temporary safe paths for Windows
        user_path = os.path.join(tempfile.gettempdir(), f"user_{uuid.uuid4().hex}.png")
        cloth_path = os.path.join(tempfile.gettempdir(), f"cloth_{uuid.uuid4().hex}.png")
        cv2.imwrite(user_path, user_img)
        cv2.imwrite(cloth_path, cloth_img)

        # 2. Call the True Virtual Try-On API
        result = hf_client.predict(
            dict={"background": handle_file(user_path), "layers": [], "composite": None},
            garm_img=handle_file(cloth_path),
            garment_des="clothing",
            is_checked=True,
            is_checked_crop=False,
            denoise_steps=30,
            seed=42,
            api_name="/tryon"
        )

        # 3. Read the generated image and send it back to React
        out_path = result[0] if isinstance(result, tuple) else result
        out_img = cv2.imread(out_path)
        _, buffer = cv2.imencode('.png', out_img)
        result_base64 = "data:image/png;base64," + base64.b64encode(buffer).decode('utf-8')
        
        print("✅ Try-On Generated Successfully!")
        return jsonify({"try_on_image": result_base64})

    except Exception as e:
        print(f"❌ Server Error: {e}")
        return jsonify({"error": "AI Server is busy. Try again!"}), 500
    finally:
        # Clean up temp files so your computer doesn't run out of space
        if user_path and os.path.exists(user_path): os.remove(user_path)
        if cloth_path and os.path.exists(cloth_path): os.remove(cloth_path)

if __name__ == '__main__':
    print("🚀 Server Running with BOTH endpoints...")
    app.run(port=5000, debug=True)