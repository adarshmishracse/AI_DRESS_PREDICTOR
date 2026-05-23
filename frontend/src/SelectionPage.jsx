import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom'; 
import { Camera, CheckCircle, ScanLine, ArrowLeft, RefreshCw } from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { db, auth } from './firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const SelectionPage = () => {
  // --- 1. STATE VARIABLES ---
  const [selectedType, setSelectedType] = useState(null);
  const [image, setImage] = useState(null); // Preview URL
  const [imageBlob, setImageBlob] = useState(null); // Actual File for API
  const [isLoading, setIsLoading] = useState(false); 
  
  // Camera State
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();
  
  // Default to Men if no category is passed
  const category = location.state?.category || 'Men';

  // --- UPDATED OPTIONS TO MATCH INVENTORY EXACTLY ---
  const allClothingOptions = {
    Men: [
      { id: 'T-Shirt', name: 'T-Shirt / Polo', icon: '👕' },
      { id: 'Shirt', name: 'Formal Shirt', icon: '👔' },
      { id: 'Jeans', name: 'Jeans / Cargo', icon: '👖' },
      { id: 'Trousers', name: 'Formal Trousers', icon: '🕴️' },
      { id: 'Suit', name: 'Suit / Blazer', icon: '💼' },
      { id: 'Dhoti Kurta', name: 'Dhoti / Kurta', icon: '🕌' },
      { id: 'Sherwani', name: 'Sherwani', icon: '👑' },
      { id: 'Shorts', name: 'Shorts', icon: '🩳' },
      { id: 'Jacket', name: 'Winter Jacket', icon: '🧥' },
    ],
    Women: [
      { id: 'Saree', name: 'Saree', icon: '🥻' },
      { id: 'Kurti', name: 'Kurti / Salwar', icon: '🧣' },
      { id: 'Lehenga', name: 'Lehenga', icon: '💃' },
      { id: 'Top', name: 'Tops / T-Shirts', icon: '👚' },
      { id: 'Dress', name: 'Western Dress', icon: '👗' },
      { id: 'Jeans', name: 'Jeans / Jeggings', icon: '👖' },
      { id: 'Skirt', name: 'Skirts / Shorts', icon: '🩰' },
      { id: 'Jumpsuit', name: 'Jumpsuit', icon: '👘' },
      { id: 'Winter', name: 'Blazer / Coat', icon: '🧥' },
    ],
    Boy: [
      { id: 'T-Shirt', name: 'T-Shirt', icon: '👕' },
      { id: 'Shirt', name: 'Shirt', icon: '👔' },
      { id: 'Jeans', name: 'Jeans', icon: '👖' },
      { id: 'Shorts', name: 'Shorts', icon: '🩳' },
      { id: 'Dungaree', name: 'Dungarees', icon: '👶' },
    ],
    Girl: [
      { id: 'Frock', name: 'Frock / Dress', icon: '👗' },
      { id: 'Top', name: 'Tops / Tees', icon: '👚' },
      { id: 'Lehenga', name: 'Lehenga / Ethnic', icon: '🥻' },
      { id: 'Skirt', name: 'Skirt', icon: '🩰' },
      { id: 'Jeans', name: 'Jeans / Leggings', icon: '👖' },
    ]
  };

  const currentOptions = allClothingOptions[category] || allClothingOptions['Men'];

  // --- 2. CAMERA HANDLERS ---
  const startCamera = async () => {
    setIsCameraOpen(true);
    setImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera Error:", err);
      alert("Could not access camera. Please check permissions.");
      setIsCameraOpen(false);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      // Save for API
      canvas.toBlob((blob) => {
        setImageBlob(blob);
      }, 'image/jpeg');

      // Save for Preview
      setImage(canvas.toDataURL('image/jpeg'));
      
      // Stop Stream
      const stream = video.srcObject;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      setIsCameraOpen(false);
    }
  };

  const retakePhoto = () => {
    setImage(null);
    setImageBlob(null);
    startCamera();
  };

  // --- 3. GENERATE FUNCTION ---
  const handleGenerate = async () => {
    if (!imageBlob) {
      alert("Please capture a photo first!");
      return;
    }

    setIsLoading(true);
    console.log("🚀 React: Button Clicked. Preparing to send...");

    try {
      const formData = new FormData();
      formData.append("image", imageBlob, "customer_scan.jpg"); 
      formData.append("category", category);

      console.log("📡 React: Sending to AI Engine (Python)...");

      // 1. Call Python AI
      const response = await fetch('http://localhost:5000/analyze', {
          method: 'POST',
          body: formData,
      });

      if (!response.ok) throw new Error(`Server Error: ${response.status}`);

      const data = await response.json();
      console.log("✅ AI Result:", data);

      // 2. FIREBASE SAVE (BACKGROUND)
      if (auth.currentUser) {
        addDoc(collection(db, "scans"), {
          userEmail: auth.currentUser.email,
          bodyShape: data.body_shape,
          timestamp: serverTimestamp(),
          category: category,
          lookingFor: selectedType 
        })
        .then(() => console.log("📝 Saved to History"))
        .catch((err) => console.warn("⚠️ History save failed:", err));
      }

      // 3. Navigate to Results
      navigate('/result', { 
        state: { 
          bodyShape: data.body_shape, 
          recommendation: data.recommendation,
          suggestions: data.suggestions,
          image: image,
          
          // --- FIX IS HERE: PASS THE AI IMAGE ---
          try_on_image: data.try_on_image, 
          // ------------------------------------

          category: category, 
          lookingFor: selectedType 
        } 
      });

    } catch (error) {
      console.error("❌ React Critical Error:", error);
      alert("AI Connection Failed! Make sure 'python app.py' is running.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col items-center">
      
      <div className="w-full max-w-6xl flex items-center justify-between mb-8">
        <button onClick={() => navigate('/dashboard')} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-500">
          Style {category}
        </h1>
        <div className="w-10"></div>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* LEFT COLUMN: Clothing Type Selection */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-slate-200">1. Select Clothing Type</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {currentOptions.map((item) => (
              <motion.div
                key={item.id}
                onClick={() => setSelectedType(item.id)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col items-center justify-center gap-2 h-32
                  ${selectedType === item.id 
                    ? 'bg-purple-600/20 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]' 
                    : 'bg-slate-800 border-slate-700 hover:border-slate-500'
                  }`}
              >
                <span className="text-4xl filter drop-shadow-md">{item.icon}</span>
                <span className="font-medium text-slate-200 text-sm text-center">{item.name}</span>
                {selectedType === item.id && <CheckCircle size={16} className="text-purple-400 absolute top-2 right-2"/>}
              </motion.div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: Camera Scan Area */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-slate-200">2. Customer Scan</h2>
          
          <div className={`relative w-full h-[500px] rounded-3xl border-2 border-dashed border-slate-600 bg-slate-800 flex flex-col items-center justify-center overflow-hidden`}>
            
            {/* 1. START STATE: No Camera, No Image */}
            {!isCameraOpen && !image && (
              <div className="text-center">
                <button 
                  onClick={startCamera}
                  className="w-24 h-24 bg-slate-700 rounded-full flex items-center justify-center mb-6 hover:bg-purple-600 hover:scale-110 transition-all shadow-lg"
                >
                  <Camera size={40} className="text-white" />
                </button>
                <p className="text-slate-300 font-medium text-lg">
                  Open Camera
                </p>
                <p className="text-slate-500 text-sm mt-2">Position customer approx 6ft away</p>
              </div>
            )}

            {/* 2. CAMERA ACTIVE STATE */}
            {isCameraOpen && (
              <>
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
                <button 
                  onClick={capturePhoto} 
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 w-20 h-20 bg-white rounded-full border-4 border-slate-300 hover:scale-110 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.5)]"
                ></button>
                <motion.div 
                    initial={{ top: "0%" }}
                    animate={{ top: "100%" }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                    className="absolute left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-400 to-transparent shadow-[0_0_20px_rgba(34,197,94,1)] z-10 pointer-events-none"
                />
              </>
            )}

            {/* 3. IMAGE CAPTURED STATE */}
            {image && (
              <div className="relative w-full h-full">
                <img src={image} alt="Captured" className="w-full h-full object-cover" />
                <motion.div 
                    initial={{ top: "0%" }}
                    animate={{ top: "100%" }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                    className="absolute left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-400 to-transparent shadow-[0_0_20px_rgba(34,197,94,1)] z-10"
                >
                     <div className="absolute right-2 -top-6 bg-black/60 text-green-400 text-[10px] font-mono px-2 py-1 rounded border border-green-500/30">
                       DETECTING BODY_SHAPE...
                     </div>
                </motion.div>
                <button onClick={retakePhoto} className="absolute bottom-4 right-4 bg-slate-800/80 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm backdrop-blur-md transition-colors flex items-center gap-2 border border-slate-600">
                  <RefreshCw size={16} /> Retake
                </button>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden"></canvas>
          </div>
        </div>
      </div>

      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-8 z-20"
      >
        <button 
          onClick={handleGenerate} 
          disabled={!image || !selectedType || isLoading}
          className={`px-12 py-4 rounded-full font-bold text-lg flex items-center space-x-3 shadow-2xl transition-all
            ${(!image || !selectedType || isLoading) 
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
              : 'bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:scale-105 hover:shadow-pink-500/30'
            }`}
        >
          {isLoading ? (
            <>
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>PROCESSING...</span>
            </>
          ) : (
            <>
              <ScanLine size={24} />
              <span>GENERATE AI LOOK</span>
            </>
          )}
        </button>
      </motion.div>
    </div>
  );
};

export default SelectionPage;