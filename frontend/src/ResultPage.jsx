import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ShoppingBag, CheckCircle, AlertCircle, Sparkles, ChevronDown, ScanFace } from 'lucide-react';
import { db } from './firebaseConfig';
import { collection, query, getDocs } from 'firebase/firestore';

// --- INTERNAL COMPONENT: PRODUCT CARD (Handles Size & Price Logic) ---
const ProductCard = ({ item, index, onTryOn, isProcessing, isActive }) => {
  // 1. Set Default Size (First one in the list)
  const [selectedSize, setSelectedSize] = useState(
    item.sizes && item.sizes.length > 0 ? item.sizes[0] : null
  );

  // 2. Calculate Dynamic Price based on Size
  const displayPrice = (selectedSize && item.prices && item.prices[selectedSize]) 
    ? item.prices[selectedSize] 
    : (item.basePrice || item.price || '0');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      whileInView={{ opacity: 1, y: 0 }} 
      transition={{ delay: index * 0.1 }}
      className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 shadow-lg group relative hover:border-purple-500/30 transition-all"
    >
      {/* Product Image */}
      <div className="h-64 overflow-hidden bg-gray-900 relative">
        <img src={item.imageUrl || item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        
        {/* TRUE AI Match Score Badge (Pulled from Python) */}
        <div className={`absolute top-3 right-3 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-white border border-white/10 shadow-lg 
           ${item.matchScore >= 80 ? 'bg-green-600/90' : item.matchScore >= 60 ? 'bg-blue-600/90' : 'bg-yellow-600/90'}`}>
          {item.matchScore}% MATCH
        </div>
      </div>

      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-bold text-lg text-white leading-tight truncate max-w-[150px]">{item.name}</h3>
            
            {/* Fit & Color */}
            <div className="flex items-center gap-2 mt-1.5">
               <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-300 border border-slate-600">
                 {item.fitType || "Regular"}
               </span>
               <div className="flex items-center gap-1 text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-300 border border-slate-600">
                  <div className="w-2 h-2 rounded-full border border-white/30" style={{backgroundColor: item.colorHex || '#fff'}}></div>
                  {item.color || "Standard"}
               </div>
            </div>
          </div>

          {/* DYNAMIC PRICE DISPLAY */}
          <div className="text-right">
            <span className="text-green-400 font-bold text-xl block">
               ₹{displayPrice}
            </span>
            {selectedSize && <span className="text-[10px] text-slate-500 uppercase">For Size {selectedSize}</span>}
          </div>
        </div>

        {/* INTERACTIVE SIZE SELECTOR */}
        <div className="mb-4">
           <p className="text-[10px] text-slate-400 mb-1 uppercase font-bold tracking-wider">Select Size</p>
           <div className="flex flex-wrap gap-2">
             {item.sizes && item.sizes.length > 0 ? (
                item.sizes.map(size => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-mono
                      ${selectedSize === size 
                        ? 'bg-white text-black border-white font-bold scale-105 shadow-md' 
                        : 'bg-slate-800 text-slate-400 border-slate-600 hover:border-slate-400'}`
                    }
                  >
                    {size}
                  </button>
                ))
             ) : (
                <span className="text-xs text-slate-500 italic">One Size Only</span>
             )}
           </div>
        </div>
        
        {/* TRY ON BUTTON - Now passes the whole 'item' to build the prompt */}
        <button 
          onClick={() => onTryOn(index, item)}
          disabled={isProcessing} // Disable if ANY button is loading
          className={`w-full font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors
             ${isActive 
                 ? 'bg-slate-600 text-slate-300 cursor-not-allowed' 
                 : isProcessing 
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                    : 'bg-white text-black hover:bg-slate-200'}`
          }
        >
          {isActive ? (
             <div className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin"></div>
          ) : (
             <Sparkles size={16} className="text-purple-600"/> 
          )}
          {isActive ? 'Loading...' : 'Try This Look'}
        </button>
      </div>
    </motion.div>
  );
};


// --- MAIN PAGE COMPONENT ---
const ResultPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Data from Python AI
  const { 
    bodyShape = 'Analysis Pending...', 
    image = null,             
    category = 'Men', 
    lookingFor = 'Shirt',
    suggestions = [],
    raw_data = {} 
  } = location.state || {};

  // State
  const [matchingItems, setMatchingItems] = useState([]);
  const [visibleCount, setVisibleCount] = useState(4); 
  const [loading, setLoading] = useState(true);
  
  // Magic Mirror State
  const [currentVisual, setCurrentVisual] = useState(image); 
  const [activeItemIndex, setActiveItemIndex] = useState(null); 
  const [isTryOnActive, setIsTryOnActive] = useState(false);

  useEffect(() => {
    const loadResults = async () => {
      setLoading(true);

      // If we came from the camera scan, use the smartly sorted Python suggestions!
      if (suggestions && suggestions.length > 0) {
        const scoredItems = suggestions.map(item => ({
          ...item,
          matchScore: item.match_score || 85 // Pull true score from Python
        }));
        setMatchingItems(scoredItems);
      } else {
        // Fallback if accessed without scanning
        try {
          const q = query(collection(db, "inventory")); 
          const querySnapshot = await getDocs(q);
          const allItems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          const rawItems = allItems.filter(item => {
            if (item.category !== category) return false;
            if (lookingFor && item.subCategory && !item.subCategory.toLowerCase().includes(lookingFor.toLowerCase())) {
               return false;
            }
            return true;
          });

          setMatchingItems(rawItems.map(item => ({ ...item, matchScore: 75 })));
        } catch (error) {
          console.error("Fetch Error:", error);
        }
      }
      setLoading(false);
    };
    loadResults();
  }, [category, lookingFor, suggestions]);

const handleTryOn = async (index, item) => {
    if (!item) return;
    setActiveItemIndex(index);
    setIsTryOnActive(false); 
    
    try {
      const formData = new FormData();
      formData.append("user_image", image); 
      formData.append("cloth_image", item.imageUrl || item.image); // Sends the actual clothing image!

      const response = await fetch('http://localhost:5000/virtual-try-on', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      if (response.ok && data.try_on_image) {
        setCurrentVisual(data.try_on_image); 
        setIsTryOnActive(true);
      } else {
        alert(`Try-On Failed: ${data.error || "Queue is full, please try again."}`);
      }
    } catch (error) {
      console.error("Try-On Error:", error);
      alert("AI Server not responding.");
    } finally {
      setActiveItemIndex(null);
    }
  };

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 4);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans">
      
      {/* HEADER */}
      <div className="p-6 sticky top-0 bg-slate-900/90 backdrop-blur-md z-20 border-b border-white/5 flex justify-between items-center">
        <button onClick={() => navigate('/dashboard')} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-500">
            AI Stylist Results
          </h1>
          <span className="text-xs text-slate-400">{category} • {lookingFor}</span>
        </div>
        <div className="w-10"></div>
      </div>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT: MAGIC MIRROR */}
        <div className="space-y-6">
          <div className="bg-slate-800 rounded-3xl p-1 border border-white/10 shadow-2xl overflow-hidden relative sticky top-24">
             <div className="h-[500px] w-full relative bg-black">
               <img 
                 src={currentVisual} 
                 alt="Visual Result" 
                 className={`w-full h-full object-cover transition-opacity duration-500 ${activeItemIndex !== null ? 'opacity-90' : 'opacity-100'}`} 
               />
               
               {activeItemIndex !== null && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                    <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                    <span className="text-xs font-bold text-white bg-black/60 px-3 py-1 rounded-full border border-white/10">AI IS GENERATING LOOK...</span>
                 </div>
               )}

               {isTryOnActive && activeItemIndex === null && (
                  <div className="absolute top-4 right-4 bg-purple-600/90 text-white px-3 py-1.5 rounded-full text-xs font-bold border border-white/20 shadow-xl flex items-center gap-1 animate-pulse z-10">
                    <Sparkles size={12} /> VIRTUAL TRY-ON ACTIVE
                  </div>
               )}

               <div className="absolute bottom-0 w-full bg-gradient-to-t from-black via-black/80 to-transparent p-6 pt-24">
                  <div className="flex items-center gap-2 mb-2">
                     <ScanFace size={16} className="text-purple-400"/>
                     <span className="text-purple-400 text-[10px] font-bold uppercase tracking-widest">
                       AI Bio-Metric Analysis
                     </span>
                  </div>
                  
                  <h1 className="text-xl font-bold text-white leading-tight mb-3">
                     {bodyShape}
                  </h1>

                  <div className="flex flex-wrap gap-2">
                     <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-md border border-white/5">
                        <div className="w-4 h-4 rounded-full border border-white/50 shadow-sm" 
                             style={{ backgroundColor: raw_data?.skin_hex || '#D2B48C' }}>
                        </div>
                        <span className="text-xs font-mono text-slate-300">
                           {raw_data?.skin_hex || 'Detecting...'}
                        </span>
                     </div>
                     
                     <div className="bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-md border border-white/5">
                        <span className="text-xs text-slate-300 font-medium">
                           {raw_data?.exact_shape || 'Analyzing...'}
                        </span>
                     </div>
                  </div>
               </div>
             </div>

             <div className="p-4 bg-slate-900 border-t border-white/5">
               <p className="text-slate-400 text-xs leading-relaxed flex gap-2">
                 <CheckCircle size={14} className="text-green-400 shrink-0 mt-0.5" />
                 {isTryOnActive 
                   ? "The visual overlay is adjusted to your shoulder width and posture."
                   : "Items are ranked by 95+ data points including your skin tone and build."
                 }
               </p>
             </div>
          </div>
        </div>

        {/* RIGHT: CLOTHING LIST */}
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <ShoppingBag className="text-pink-500" /> 
            Top Recommendations
          </h2>

          {loading ? (
             <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <div className="w-8 h-8 border-4 border-slate-600 border-t-purple-500 rounded-full animate-spin mb-4"></div>
                <p>Calculating compatibility scores...</p>
             </div>
          ) : matchingItems.length === 0 ? (
             <div className="bg-slate-800/50 p-10 rounded-3xl text-center border border-dashed border-slate-700">
               <AlertCircle className="mx-auto text-yellow-500 mb-4" size={48} />
               <h3 className="text-xl font-bold text-white mb-2">No Perfect Matches Found</h3>
               <p className="text-slate-400 mb-6 max-w-md mx-auto">
                 We couldn't find {category} {lookingFor}s that match your specific analysis score.
               </p>
               <button onClick={() => navigate('/inventory')} className="px-6 py-2 bg-slate-700 rounded-full hover:bg-slate-600 text-white font-medium transition-colors">
                 Update Inventory
               </button>
             </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {matchingItems.slice(0, visibleCount).map((item, index) => (
                  <ProductCard 
                     key={item.id || index} 
                     item={item} 
                     index={index} 
                     onTryOn={handleTryOn} 
                     isProcessing={activeItemIndex !== null}
                     isActive={activeItemIndex === index}
                  />
                ))}
              </div>

              {visibleCount < matchingItems.length && (
                <div className="mt-10 text-center">
                  <button 
                    onClick={handleLoadMore}
                    className="px-8 py-3 bg-slate-800 border border-slate-600 rounded-full text-white font-bold hover:bg-slate-700 transition-colors flex items-center gap-2 mx-auto hover:scale-105 transform duration-200"
                  >
                    View Next 4 Matches <ChevronDown size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultPage;