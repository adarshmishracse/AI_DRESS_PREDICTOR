import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, ArrowRight, LogOut, User, Package, Trash2 } from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { auth, db } from './firebaseConfig';
import { signOut } from 'firebase/auth';
import { collection, query, getDocs, deleteDoc, doc } from 'firebase/firestore';

const Dashboard = () => {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState("Guest");
  
  // Data State (Only Inventory now)
  const [inventory, setInventory] = useState([]);

  // --- 1. FETCH DATA ---
  useEffect(() => {
    if (auth.currentUser) {
      setUserEmail(auth.currentUser.email);
      fetchInventory();
    }
  }, []);

  const fetchInventory = async () => {
    try {
      // Fetch ALL inventory items
      const q = query(collection(db, "inventory")); 
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInventory(items);
    } catch (error) {
      console.error("Error fetching inventory:", error);
    }
  };

  // --- 2. DELETE ITEM (SOLD OUT) ---
  const handleDeleteItem = async (itemId) => {
    if (window.confirm("Mark this item as Sold Out? It will be removed from inventory.")) {
      try {
        await deleteDoc(doc(db, "inventory", itemId));
        // Update UI immediately without refresh
        setInventory(prev => prev.filter(item => item.id !== itemId));
      } catch (error) {
        alert("Failed to delete item: " + error.message);
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  // --- 3. SCROLL FUNCTION ---
  const scrollToCategories = () => {
    const section = document.getElementById('category-section');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  const categories = [
    { title: 'Men', img: 'men.jpeg', desc: 'Suits, Casual & Streetwear' },
    { title: 'Women', img: 'women.jpeg', desc: 'Dresses, Tops & Ethnic' },
    { title: 'Boy', img: 'boy.jpeg', desc: 'Cool & Playful Styles' },
    { title: 'Girl', img: 'girl.jpeg', desc: 'Cute & Trendy Outfits' }
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans">
      
      {/* Navbar */}
      <nav className="fixed w-full z-50 bg-slate-900/80 backdrop-blur-md border-b border-white/10 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-pink-500 to-purple-600 rounded-lg flex items-center justify-center font-bold">S</div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-500">StyleAI</h1>
          </div>

          <div className="flex items-center space-x-6">
            <div className="hidden md:flex items-center gap-2 text-slate-300 text-sm bg-slate-800 py-1 px-3 rounded-full border border-slate-700">
              <User size={14} /> <span>{userEmail}</span>
            </div>

            {/* Inventory Button */}
            <button onClick={() => navigate('/inventory')} className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors font-medium text-sm">
              <Package size={20} /> <span className="hidden sm:inline">Stock</span>
            </button>
            
            <button onClick={handleLogout} className="flex items-center gap-2 text-pink-400 hover:text-pink-300 transition-colors font-medium text-sm">
              <LogOut size={20} /> <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative h-[60vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 to-slate-900 z-10"></div>
        <img src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover opacity-60 " alt="Fashion Hero" />
        <div className="relative z-20 text-center max-w-3xl px-4">
          <motion.h1 initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8 }} className="text-5xl md:text-7xl font-extrabold mb-6 tracking-tight">
            Find Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-500">Perfect Fit</span>
          </motion.h1>
          
          <button onClick={scrollToCategories} className="px-8 py-4 bg-white text-slate-900 rounded-full font-bold flex items-center mx-auto space-x-3 hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.3)]">
            <Camera size={20} className="text-purple-600"/> <span>Start Scan</span>
          </button>
        </div>
      </div>
      
      {/* Categories Grid */}
      <div id="category-section" className="max-w-7xl mx-auto py-12 px-4">
        <h2 className="text-3xl font-bold mb-10 text-center">Select Category</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((cat, index) => (
            <motion.div key={cat.title} onClick={() => navigate('/selection', { state: { category: cat.title } })}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} whileHover={{ y: -10 }}
              className="group relative h-80 rounded-3xl overflow-hidden cursor-pointer shadow-lg border border-white/5">
              <img src={cat.img} alt={cat.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent opacity-90"></div>
              <div className="absolute bottom-0 left-0 p-6 w-full">
                <h3 className="text-2xl font-bold mb-1">{cat.title}</h3>
                <div className="flex items-center justify-between border-t border-white/10 pt-4">
                  <span className="text-pink-400 font-semibold text-sm">Explore</span>
                  <div className="bg-white/10 p-2 rounded-full group-hover:bg-pink-500 transition-colors"><ArrowRight size={16} /></div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* --- INVENTORY SECTION (PERMANENT) --- */}
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between border-b border-slate-700 pb-4 mb-8">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="text-purple-400" /> Store Inventory
          </h2>
          <button onClick={() => navigate('/inventory')} className="text-sm bg-purple-600 px-4 py-2 rounded-full font-bold hover:bg-purple-500 transition-colors">
            + Add New
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {inventory.length === 0 ? (
            <div className="text-slate-500 bg-slate-800/50 p-12 rounded-2xl text-center border border-dashed border-slate-700 col-span-3">
              <p className="text-lg">No items in stock.</p>
              <button onClick={() => navigate('/inventory')} className="mt-4 text-purple-400 underline font-bold">Add your first product</button>
            </div>
          ) : (
            inventory.map((item) => (
              <motion.div key={item.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 group relative shadow-lg">
                <div className="h-48 overflow-hidden bg-black">
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                </div>
                
                <div className="p-4">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-lg truncate">{item.name}</h3>
                    <div className="w-4 h-4 rounded-full border border-white/50 shadow-sm" style={{backgroundColor: item.colorHex}}></div>
                  </div>
                  
                  <div className="flex justify-between items-center mt-2 text-sm">
                    <span className="text-slate-400">{item.fitType} Fit</span>
                    <span className="text-green-400 font-bold">₹{item.basePrice}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1">
                      {item.sizes && item.sizes.map(s => (
                        <span key={s} className="text-[10px] bg-slate-700 px-2 py-1 rounded text-slate-300 font-mono">{s}</span>
                      ))}
                  </div>
                </div>

                {/* DELETE BUTTON */}
                <button 
                  onClick={() => handleDeleteItem(item.id)} 
                  className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 hover:scale-110 shadow-lg"
                  title="Mark Sold Out"
                >
                  <Trash2 size={16} />
                </button>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;