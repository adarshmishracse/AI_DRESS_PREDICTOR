import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// --- IMPORT FIREBASE ---
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebaseConfig';

const LoginPage = () => {
  const navigate = useNavigate();
  
  // State for Real Logic
  const [isLogin, setIsLogin] = useState(true); // Toggle between Login/Signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // --- REAL AUTHENTICATION HANDLER ---
  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        // Login Existing User
        await signInWithEmailAndPassword(auth, email, password);
        console.log("✅ Logged In!");
      } else {
        // Create New User (Sign Up)
        await createUserWithEmailAndPassword(auth, email, password);
        console.log("✅ User Created!");
      }
      // If successful, go to Dashboard
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      // Clean up error message
      const cleanError = err.message.replace("Firebase: ", "").replace("auth/", "").split("-").join(" ");
      setError(cleanError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-900">
      
      {/* 1. BACKGROUND IMAGE (Added per your request) */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop" 
          alt="Fashion Background" 
          className="w-full h-full object-cover opacity-30" // Lower opacity so blobs still shine
        />
        <div className="absolute inset-0 bg-slate-900/80"></div> {/* Dark Overlay to blend it */}
      </div>

      {/* 2. BACKGROUND BLOBS (Your "Attractive" Unique Visual) */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-500 rounded-full mix-blend-screen filter blur-3xl opacity-40 animate-blob"></div>
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-yellow-500 rounded-full mix-blend-screen filter blur-3xl opacity-40 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-pink-500 rounded-full mix-blend-screen filter blur-3xl opacity-40 animate-blob animation-delay-4000"></div>
      </div>

      {/* 3. GLASS CARD */}
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 w-full max-w-md p-8 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl"
      >
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="p-3 bg-gradient-to-tr from-pink-500 to-purple-600 rounded-full shadow-lg"
            >
              <Sparkles className="w-8 h-8 text-white" />
            </motion.div>
          </div>
          <h2 className="text-3xl font-bold text-white">StyleAI</h2>
          <p className="text-slate-300 text-sm mt-2">
            {isLogin ? "Welcome back to your digital wardrobe" : "Join the future of fashion"}
          </p>
        </div>

        {/* Error Message Display */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-6 p-3 bg-red-500/20 border border-red-500/50 rounded-xl flex items-center gap-3 text-red-200 text-sm"
          >
            <AlertCircle size={18} />
            <span className="capitalize">{error}</span>
          </motion.div>
        )}

        <form onSubmit={handleAuth} className="space-y-6">
          <div className="relative group">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-pink-400 transition-colors" size={20} />
            <input 
              type="email" 
              placeholder="Email Address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/50 placeholder-slate-400 transition-all"
              required
            />
          </div>
          
          <div className="relative group">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-pink-400 transition-colors" size={20} />
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/50 placeholder-slate-400 transition-all"
              required
            />
          </div>

          <motion.button 
            whileHover={{ scale: 1.02 }} 
            whileTap={{ scale: 0.98 }} 
            disabled={loading}
            className={`w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center space-x-2 transition-opacity ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loading ? (
              <span>Processing...</span>
            ) : (
              <>
                <span>{isLogin ? "Enter Wardrobe" : "Create Account"}</span>
                <ArrowRight size={18} />
              </>
            )}
          </motion.button>
        </form>

        {/* Toggle between Login and Signup */}
        <p className="text-center mt-6 text-slate-400 text-sm">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-white font-bold hover:text-pink-400 transition-colors ml-1 underline underline-offset-4"
          >
            {isLogin ? "Sign Up" : "Log In"}
          </button>
        </p>

      </motion.div>
    </div>
  );
};

export default LoginPage;