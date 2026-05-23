import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Camera, ArrowLeft, Package, Check, RefreshCw, ScanText, Zap, Upload, Image as ImageIcon } from 'lucide-react';
import Tesseract from 'tesseract.js'; // IMPORT OCR LIBRARY

// FIREBASE IMPORTS
import { db, auth } from './firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const InventoryPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [scanningTag, setScanningTag] = useState(false);

  // --- FORM STATE ---
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('Men');
  const [clothingType, setClothingType] = useState('T-Shirt');
  const [basePrice, setBasePrice] = useState('');
  const [largeSizeExtra, setLargeSizeExtra] = useState(0);
  const [fitType, setFitType] = useState('Regular'); 

  // --- CLOTHING TYPES ---
  const clothingOptions = {
    Men: ['T-Shirt', 'Shirt', 'Jeans', 'Trousers', 'Suit', 'Dhoti Kurta', 'Sherwani', 'Jacket', 'Shorts'],
    Women: ['Top', 'T-Shirt', 'Dress', 'Saree', 'Kurti', 'Lehenga', 'Jeans', 'Skirt', 'Jumpsuit'],
    Boy: ['T-Shirt', 'Shirt', 'Jeans', 'Shorts', 'Dungaree'],
    Girl: ['Frock', 'Top', 'Skirt', 'Jeans', 'Lehenga']
  };

  useEffect(() => { setClothingType(clothingOptions[category][0]); }, [category]);

  // --- CAMERA & UPLOAD STATE ---
  const [imageBase64, setImageBase64] = useState(null); 
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null); // Reference for hidden file input

  // --- VARIANTS ---
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [selectedColors, setSelectedColors] = useState([]);
  const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const colors = [
    { name: 'Red', hex: '#ef4444' }, { name: 'Blue', hex: '#3b82f6' },
    { name: 'Green', hex: '#22c55e' }, { name: 'Black', hex: '#000000' },
    { name: 'White', hex: '#ffffff' }, { name: 'Yellow', hex: '#eab308' },
    { name: 'Pink', hex: '#ec4899' }, { name: 'Purple', hex: '#a855f7' }
  ];

  // --- CAMERA FUNCTIONS ---
  const startCamera = async () => {
    setIsCameraOpen(true);
    setImageBase64(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) { alert("Camera Error: " + err.message); setIsCameraOpen(false); }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      const scale = 300 / video.videoWidth; 
      canvas.width = 300;
      canvas.height = video.videoHeight * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      setImageBase64(canvas.toDataURL('image/jpeg', 0.6));
      video.srcObject.getTracks().forEach(track => track.stop());
      setIsCameraOpen(false);
    }
  };

  // --- NEW: HANDLE IMAGE UPLOAD ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageBase64(reader.result);
        setIsCameraOpen(false); // Ensure camera is off if an upload happens
      };
      reader.readAsDataURL(file);
    }
  };

  // --- AI TAG SCANNER (UPDATED: DETECTS ALL) ---
  const scanPriceTag = async () => {
    if (!videoRef.current) return;
    setScanningTag(true);
    
    // 1. Capture current frame for OCR
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    try {
      // 2. Run OCR
      const { data: { text } } = await Tesseract.recognize(canvas, 'eng');
      console.log("Full Scanned Text:", text);
      const lowerText = text.toLowerCase();

      let detectedInfo = [];

      // A. PRICE DETECTION (Smart Regex)
      const priceMatch = text.match(/(?:Rs\.?|₹|MRP)\s*[\.:]?\s*(\d{3,5})/i) || text.match(/(\d{3,4})/);
      if (priceMatch) {
         setBasePrice(priceMatch[1] || priceMatch[0]);
         detectedInfo.push(`Price: ₹${priceMatch[1] || priceMatch[0]}`);
      }

      // B. CLOTHING TYPE DETECTION
      if (lowerText.includes('shirt')) setClothingType('Shirt');
      else if (lowerText.includes('jean') || lowerText.includes('denim')) setClothingType('Jeans');
      else if (lowerText.includes('kurta')) setClothingType('Kurta');
      else if (lowerText.includes('saree')) setClothingType('Saree');

      // C. COLOR DETECTION
      const foundColors = colors.filter(c => lowerText.includes(c.name.toLowerCase()));
      if (foundColors.length > 0) {
        setSelectedColors(foundColors);
        detectedInfo.push(`Color: ${foundColors.map(c => c.name).join(', ')}`);
      }

      // D. SIZE DETECTION
      // Looks for standalone S, M, L, XL or numbers like 30, 32, 40
      const foundSizes = [];
      sizes.forEach(s => {
         // Regex ensures we match "XL" but not "EXTRA"
         const sizeRegex = new RegExp(`\\b${s}\\b`, 'i');
         if (sizeRegex.test(text)) foundSizes.push(s);
      });
      if (foundSizes.length > 0) {
        setSelectedSizes(foundSizes);
        detectedInfo.push(`Size: ${foundSizes.join(', ')}`);
      }

      // E. NAME GUESSING (Heuristic)
      // Look for the longest line of text that isn't a price/size/color
      const lines = text.split('\n');
      const nameCandidate = lines.find(l => 
        l.length > 5 && 
        !l.match(/[\d₹]/) && // No numbers or currency
        !l.toLowerCase().includes('price') && 
        !l.toLowerCase().includes('size')
      );
      if (nameCandidate) {
        setProductName(nameCandidate.trim());
        detectedInfo.push(`Name: ${nameCandidate.trim()}`);
      }

      alert(`🏷️ AI Scan Complete!\n${detectedInfo.length > 0 ? detectedInfo.join('\n') : "No clear data found. Try closer."}`);

    } catch (err) {
      console.error(err);
      alert("Could not read tag. Try getting closer/clearer lighting.");
    } finally {
      setScanningTag(false);
    }
  };

  // --- UPLOAD TO FIREBASE ---
  const handleUpload = async () => {
    if (!productName || !basePrice) { alert("Please enter Name and Price"); return; }
    if (!imageBase64) { alert("Capture or Upload product photo"); return; }

    setLoading(true);
    try {
      const uploadPromises = selectedColors.map(async (color) => {
        const priceObj = {};
        selectedSizes.forEach(s => {
          priceObj[s] = (s === 'XL' || s === 'XXL') ? Number(basePrice) + Number(largeSizeExtra) : Number(basePrice);
        });

        await addDoc(collection(db, "inventory"), {
          name: productName,
          category,
          subCategory: clothingType,
          basePrice: Number(basePrice),
          prices: priceObj,
          fitType,
          color: color.name,
          colorHex: color.hex,
          sizes: selectedSizes,
          imageUrl: imageBase64,
          shopOwnerEmail: auth.currentUser?.email || 'admin',
          createdAt: serverTimestamp()
        });
      });

      await Promise.all(uploadPromises);
      alert(`✅ Success! Added ${selectedColors.length} variants.`);
      navigate('/dashboard');
    } catch (error) {
      alert("Error: " + error.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 flex justify-center">
      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700"><ArrowLeft /></button>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-500">Stock Entry</h1>
          </div>
          <div className="bg-purple-900/30 px-4 py-2 rounded-full border border-purple-500/50 flex items-center gap-2 text-xs font-bold text-purple-300">
            <Zap size={14} /> AI AUTO-FILL ACTIVE
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* CAMERA / IMAGE SECTION */}
          <div className="space-y-6">
            <div className="relative h-96 bg-slate-800 rounded-2xl border-2 border-slate-600 flex items-center justify-center overflow-hidden bg-black group">
              
              {/* State 1: No Camera, No Image */}
              {!isCameraOpen && !imageBase64 && (
                <div className="flex flex-col gap-4 items-center">
                    <button onClick={startCamera} className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center hover:bg-purple-600 transition-all shadow-lg">
                        <Camera size={40}/>
                    </button>
                    <p className="text-slate-500 text-sm">Tap camera to start</p>
                    
                    {/* NEW UPLOAD BUTTON (Small, below camera trigger) */}
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-slate-600">or</span>
                        <button onClick={() => fileInputRef.current.click()} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs hover:bg-slate-700 transition-colors">
                            <ImageIcon size={14} className="text-blue-400"/> Upload Photo
                        </button>
                    </div>
                </div>
              )}
              
              {/* State 2: Camera Active */}
              {isCameraOpen && (
                <>
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <div className="absolute bottom-4 flex gap-6 items-center">
                    {/* Capture Button */}
                    <button onClick={capturePhoto} className="w-16 h-16 bg-white rounded-full border-4 border-slate-300 hover:scale-110 transition-transform" />
                    
                    {/* Scan Tag Button */}
                    <button onClick={scanPriceTag} disabled={scanningTag} className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center text-white border-4 border-slate-900 shadow-xl hover:scale-110 transition-transform">
                      {scanningTag ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"/> : <ScanText size={22} />}
                    </button>
                  </div>
                  {scanningTag && <p className="absolute top-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-sm text-blue-300 border border-blue-500/30">Reading Tag Info...</p>}
                </>
              )}
              
              {/* State 3: Image Captured/Uploaded */}
              {imageBase64 && (
                <>
                    <img src={imageBase64} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute bottom-4 right-4 flex gap-2">
                         {/* Retake / Re-upload */}
                        <button onClick={() => {setImageBase64(null);}} className="bg-slate-800/80 p-2 rounded-lg hover:bg-red-600 transition-colors text-white border border-white/10">
                            <RefreshCw size={18}/>
                        </button>
                    </div>
                </>
              )}

              {/* Hidden Canvas & File Input */}
              <canvas ref={canvasRef} className="hidden"></canvas>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
            </div>
            
            {/* Helper Text below camera box */}
            <p className="text-center text-xs text-slate-500">
                AI Scan reads: Name, Price, Size & Color
            </p>
          </div>

          {/* FORM SECTION */}
          <div className="space-y-4">
             {/* Auto-filled inputs */}
             <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5 space-y-4">
               <input type="text" placeholder="Product Name (e.g. Blue Polo)" value={productName} onChange={e => setProductName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 outline-none" />
               <div className="grid grid-cols-2 gap-4">
                 <select value={category} onChange={e => setCategory(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg p-3 outline-none">{Object.keys(clothingOptions).map(c => <option key={c}>{c}</option>)}</select>
                 <select value={clothingType} onChange={e => setClothingType(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg p-3 outline-none text-purple-300 font-bold">{clothingOptions[category].map(t => <option key={t}>{t}</option>)}</select>
               </div>
             </div>

             {/* DYNAMIC PRICING */}
             <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5 space-y-4">
               <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2">💰 Smart Pricing</h3>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-xs text-slate-500 mb-1 block">Base Price (₹)</label>
                   <input type="number" placeholder="999" value={basePrice} onChange={e => setBasePrice(e.target.value)} className="w-full bg-slate-800 border border-green-500/30 rounded-lg p-3 outline-none text-green-400 font-bold" />
                 </div>
                 <div>
                   <label className="text-xs text-slate-500 mb-1 block">Add for XL/XXL (+₹)</label>
                   <input type="number" placeholder="0" value={largeSizeExtra} onChange={e => setLargeSizeExtra(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 outline-none" />
                 </div>
               </div>
             </div>

             {/* VARIANTS */}
             <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5 space-y-4">
                <div className="flex flex-wrap gap-2">{sizes.map(s => <button key={s} onClick={() => setSelectedSizes(p=>p.includes(s)?p.filter(i=>i!==s):[...p,s])} className={`px-3 py-1 rounded text-sm border ${selectedSizes.includes(s)?'bg-white text-black':'border-slate-600'}`}>{s}</button>)}</div>
                <div className="flex flex-wrap gap-2">{colors.map(c => <button key={c.name} onClick={() => setSelectedColors(p=>p.some(i=>i.name===c.name)?p.filter(i=>i.name!==c.name):[...p,c])} className={`w-8 h-8 rounded-full border-2 ${selectedColors.some(i=>i.name===c.name)?'border-white':'border-transparent'}`} style={{backgroundColor:c.hex}}/>)}</div>
             </div>

             <motion.button onClick={handleUpload} disabled={loading} whileTap={{scale:0.95}} className={`w-full py-4 rounded-xl font-bold flex justify-center gap-2 ${loading?'bg-slate-700':'bg-gradient-to-r from-pink-500 to-purple-600'}`}>
                <Package /> {loading ? 'Saving...' : 'Add Stock'}
             </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default InventoryPage;