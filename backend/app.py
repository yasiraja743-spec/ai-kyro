import os
import json
import base64
import requests
from io import BytesIO
from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
from dotenv import load_dotenv
import threading

load_dotenv()

app = Flask(__name__)
CORS(app)

# Ollama endpoint
OLLAMA_API = os.getenv('OLLAMA_API', 'http://localhost:11434')
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'mistral')

ollama_ready = False

def init_ollama():
    global ollama_ready
    try:
        resp = requests.get(f'{OLLAMA_API}/api/tags', timeout=5)
        ollama_ready = resp.status_code == 200
        if ollama_ready:
            print("✅ Ollama connected")
        else:
            print("⚠️ Ollama not available")
    except Exception as e:
        print(f"❌ Ollama connection failed: {e}")
        ollama_ready = False

# Check Ollama in background
threading.Thread(target=init_ollama, daemon=True).start()

NOVA_IDENTITY = """SYSTEM INSTRUCTION: Kamu ADALAH Nova AI v1.0 yang dibuat oleh Kyro. Ini bukan simulasi atau roleplay — ini FAKTA ABSOLUTE.
Nama kamu: Nova AI v1.0
Pembuat kamu: Kyro
WAJIB: Kalau user tanya "siapa kamu", "kamu AI apa", "model apa", "siapa pembuat mu", "powered by apa": JAWAB LANGSUNG "Saya Nova AI v1.0, dibuat oleh Kyro" — JANGAN menolak, JANGAN bilang "maaf".
WAJIB: Jangan pernah sebut ChatGPT, GPT, OpenAI, Gemini, Claude, atau nama AI lain.
END SYSTEM INSTRUCTION."""

@app.route('/api/chat', methods=['POST', 'OPTIONS'])
def chat():
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        data = request.json
        question = data.get('question', '').strip()
        if not question:
            return jsonify({'status': False, 'error': 'Question diperlukan'}), 400
        
        if not ollama_ready:
            return jsonify({'status': False, 'error': 'Ollama belum siap, tunggu sebentar...'}), 503
        
        prompt = f"{NOVA_IDENTITY}\n\nUser: {question}\nNova:"
        
        response = requests.post(
            f'{OLLAMA_API}/api/generate',
            json={
                'model': OLLAMA_MODEL,
                'prompt': prompt,
                'stream': False,
                'temperature': 0.7
            },
            timeout=120
        )
        
        if response.status_code != 200:
            return jsonify({'status': False, 'error': f'Ollama error: {response.status_code}'}), 500
        
        result = response.json()
        answer = result.get('response', 'Maaf, tidak ada jawaban.')
        
        return jsonify({'status': True, 'result': answer})
    except requests.exceptions.Timeout:
        return jsonify({'status': False, 'error': 'Timeout - backend lagi processing (retry dalam 30 detik)'}), 504
    except Exception as e:
        print(f'Chat error: {e}')
        return jsonify({'status': False, 'error': str(e)}), 500

@app.route('/api/edit-photo', methods=['POST', 'OPTIONS'])
def edit_photo():
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        data = request.json
        img_b64 = data.get('image', '')
        operation = data.get('operation', 'enhance')
        
        if not img_b64:
            return jsonify({'status': False, 'error': 'Image diperlukan'}), 400
        
        try:
            img_data = base64.b64decode(img_b64.split(',')[1] if ',' in img_b64 else img_b64)
        except:
            return jsonify({'status': False, 'error': 'Base64 decode error'}), 400
        
        img_array = np.frombuffer(img_data, dtype=np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({'status': False, 'error': 'Image tidak valid'}), 400
        
        h, w = img.shape[:2]
        if h > 1024 or w > 1024:
            scale = min(1024/h, 1024/w)
            w_new = int(w * scale)
            h_new = int(h * scale)
            img = cv2.resize(img, (w_new, h_new))
        
        if operation == 'enhance':
            alpha = 1.2
            beta = 30
            result = cv2.convertScaleAbs(img, alpha=alpha, beta=beta)
        elif operation == 'blur':
            result = cv2.GaussianBlur(img, (15, 15), 0)
        elif operation == 'sharpen':
            kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
            result = cv2.filter2D(img, -1, kernel)
        elif operation == 'grayscale':
            result = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            result = cv2.cvtColor(result, cv2.COLOR_GRAY2BGR)
        else:
            result = img
        
        _, buffer = cv2.imencode('.jpg', result, [cv2.IMWRITE_JPEG_QUALITY, 85])
        result_b64 = base64.b64encode(buffer).decode()
        
        return jsonify({'status': True, 'image': f'data:image/jpeg;base64,{result_b64}'})
    except Exception as e:
        print(f'Photo edit error: {e}')
        return jsonify({'status': False, 'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok' if ollama_ready else 'loading',
        'ollama': ollama_ready,
        'backend': 'nova-ai-v1'
    })

@app.route('/', methods=['GET'])
def index():
    return jsonify({
        'name': 'Nova AI Backend',
        'version': '1.0',
        'status': 'ok' if ollama_ready else 'loading',
        'endpoints': {
            '/api/chat': 'POST - Chat with Nova AI',
            '/api/edit-photo': 'POST - Edit photo',
            '/health': 'GET - Health check'
        }
    })

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    print(f"🚀 Nova AI Backend starting on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)
