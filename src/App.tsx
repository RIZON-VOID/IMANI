import * as React from 'react';
import { useState, useEffect, useRef, Component, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { 
  auth, 
  db, 
  storage, 
  googleProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  ref, 
  uploadBytes, 
  getDownloadURL, 
  serverTimestamp, 
  handleFirestoreError, 
  OperationType 
} from './firebase';
import type { FirebaseUser } from './firebase';
import { doc, setDoc, getDoc, collection, addDoc, onSnapshot, query, where, updateDoc, orderBy } from 'firebase/firestore';
import { 
  Home, 
  MessageCircle, 
  Users, 
  ShoppingBag, 
  User, 
  Plus, 
  Search, 
  Bell, 
  Menu,
  Heart,
  MessageSquare,
  Share2,
  Sparkles,
  ShieldCheck,
  Quote,
  Image as ImageIcon,
  HelpCircle,
  AlertTriangle,
  Send,
  X,
  BookOpen,
  CheckCircle,
  XCircle,
  Eye,
  LogOut,
  ExternalLink,
  Video,
  Globe,
  Users2,
  Lock,
  ChevronDown,
  Camera,
  Trash2,
  Edit2,
  Info
} from 'lucide-react';
import { Post, PostType, Product, Community, KnowledgeItem } from './types';
import { generateOrbitPost, moderateContent, searchKnowledgeBase, chatWithOrbit } from './services/geminiService';

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    (this as any).state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if ((this as any).state.hasError) {
      let errorMessage = "Something went wrong.";
      if ((this as any).state.error?.message) {
        try {
          const parsed = JSON.parse((this as any).state.error.message);
          if (parsed.error) errorMessage = `Firestore Error: ${parsed.error} (${parsed.operationType} at ${parsed.path})`;
        } catch (e) {
          errorMessage = (this as any).state.error.message;
        }
      }

      return (
        <div className="min-h-screen bg-paper flex items-center justify-center p-8">
          <div className="bg-white p-12 rounded-[3rem] shadow-2xl border border-stone-100 max-w-xl text-center">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-8">
              <AlertTriangle size={40} className="text-red-500" />
            </div>
            <h1 className="text-3xl font-serif italic font-bold text-ink mb-4">System Interruption</h1>
            <p className="text-stone-500 font-light leading-relaxed mb-8">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-primary text-white px-10 py-4 rounded-2xl font-bold shadow-xl shadow-primary/20 active:scale-95 transition-all"
            >
              Refresh Application
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// --- Types ---

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  avatar: string;
  role: 'user' | 'admin';
  badges: string[];
  isVerified: boolean;
}

interface VerificationApp {
  id: string;
  applicantUid: string;
  applicantName: string;
  badgeRequested: string;
  reason: string;
  identityLink: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
}

// --- Logo Component ---
const Logo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#10b981" />
        <stop offset="100%" stopColor="#14b8a6" />
      </linearGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    <circle cx="50" cy="50" r="45" stroke="url(#logoGradient)" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.5" />
    <circle cx="50" cy="50" r="42" stroke="url(#logoGradient)" strokeWidth="0.2" opacity="0.3" filter="url(#glow)" />
    <ellipse cx="50" cy="50" rx="35" ry="15" stroke="url(#logoGradient)" strokeWidth="2" transform="rotate(45 50 50)" opacity="0.8" />
    <ellipse cx="50" cy="50" rx="35" ry="15" stroke="url(#logoGradient)" strokeWidth="2" transform="rotate(-45 50 50)" opacity="0.8" />
    <circle cx="50" cy="50" r="10" fill="url(#logoGradient)" opacity="0.2" />
    <circle cx="50" cy="50" r="6" fill="url(#logoGradient)" filter="url(#glow)" />
    <circle cx="75" cy="25" r="1.5" fill="white" filter="url(#glow)">
      <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
    </circle>
  </svg>
);

// --- Auth Screen ---

const AuthScreen = ({ onAuthSuccess }: { onAuthSuccess: () => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getErrorMessage = (code: string) => {
    switch (code) {
      case 'auth/email-already-in-use':
        return "User already exists. Please sign in.";
      case 'auth/invalid-email':
        return "Please enter a valid email address.";
      case 'auth/weak-password':
        return "Password should be at least 6 characters.";
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return "Email or password is incorrect.";
      case 'auth/too-many-requests':
        return "Too many failed attempts. Please try again later.";
      case 'auth/network-request-failed':
        return "Network error. Please check your connection.";
      case 'auth/popup-closed-by-user':
        return "Sign-in popup was closed before completion.";
      case 'auth/cancelled-by-user':
        return "Sign-in was cancelled.";
      case 'auth/configuration-not-found':
        return "Authentication method not enabled in Firebase Console.";
      default:
        return "An error occurred during authentication. Please try again.";
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      onAuthSuccess();
    } catch (err: any) {
      console.error("Google Auth error", err);
      setError(getErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      onAuthSuccess();
    } catch (err: any) {
      console.error("Auth error", err);
      setError(getErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white w-full max-w-md p-10 rounded-[3rem] shadow-2xl border border-stone-100"
      >
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <Logo className="w-20 h-20" />
          </div>
          <h1 className="text-4xl font-serif italic text-primary font-bold mb-2">imani</h1>
          <p className="text-stone-500 font-light italic">A peaceful space for the community</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2 ml-4">Email Address</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-stone-50 border border-stone-100 rounded-2xl px-6 py-4 text-ink outline-none focus:ring-2 ring-primary/10 transition-all font-light"
              placeholder="name@example.com"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2 ml-4">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-stone-50 border border-stone-100 rounded-2xl px-6 py-4 text-ink outline-none focus:ring-2 ring-primary/10 transition-all font-light"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="p-4 bg-red-50 text-red-500 text-xs rounded-xl border border-red-100 font-medium text-center"
            >
              {error}
            </motion.div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-5 rounded-2xl font-bold shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              isLogin ? 'Sign In' : 'Sign Up'
            )}
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-stone-100"></div>
          </div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
            <span className="bg-white px-4 text-stone-400">Or continue with</span>
          </div>
        </div>

        <button 
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full bg-white border border-stone-100 text-ink py-4 rounded-2xl font-medium shadow-sm active:scale-95 transition-all flex items-center justify-center gap-3 hover:bg-stone-50"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
          <span>Google</span>
        </button>

        <div className="mt-8 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-stone-400 hover:text-primary transition-colors font-medium"
          >
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- Components ---

const Navbar = ({ onModeratorToggle, isModerator, profile }: { onModeratorToggle: () => void, isModerator: boolean, profile: UserProfile | null }) => (
  <header className="sticky top-0 z-50 bg-paper/80 backdrop-blur-xl px-8 py-6 flex items-center justify-between">
    <button className="p-3 bg-white rounded-full shadow-sm text-stone-400 hover:text-primary transition-all">
      <ChevronDown className="rotate-90" size={20} />
    </button>
    
    <div className="flex flex-col items-center">
      <Logo className="w-10 h-10 mb-1" />
      <h1 className="text-4xl font-serif italic text-primary font-medium tracking-tight">imani</h1>
    </div>

    <div className="flex items-center gap-4">
      <button className="p-3 bg-white rounded-full shadow-sm text-stone-400 hover:text-primary transition-all">
        <Search size={20} />
      </button>
      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-md">
        <img src={profile?.avatar || "https://picsum.photos/seed/user/100/100"} alt="Profile" className="w-full h-full object-cover" />
      </div>
    </div>
  </header>
);

const BottomNav = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: string) => void }) => {
  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
    { id: 'messenger', label: 'Messenger', icon: MessageCircle },
    { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[60] bg-white/90 backdrop-blur-xl border-t border-stone-100 px-6 py-4 flex items-center justify-between">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex flex-col items-center gap-1 transition-all duration-300 ${activeTab === tab.id ? 'text-primary scale-110' : 'text-stone-300 hover:text-stone-400'}`}
        >
          <tab.icon size={24} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
          <span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};

const LoginBanner = ({ onLogin }: { onLogin: () => void }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/10 p-8 rounded-[2rem] mb-8 organic-shadow relative overflow-hidden"
  >
    <div className="absolute top-0 right-0 p-8 opacity-5">
      <Sparkles size={120} className="text-primary" />
    </div>
    <div className="flex items-start gap-6 relative z-10">
      <div className="p-4 bg-primary rounded-2xl text-white shadow-lg shadow-primary/20">
        <Sparkles size={28} />
      </div>
      <div className="flex-1">
        <h3 className="font-serif italic font-bold text-ink text-xl mb-2">Join the Community</h3>
        <p className="text-sm text-stone-500 mb-6 leading-relaxed font-light">Sign in to share your thoughts, earn trust badges, and connect with a respectful Muslim community.</p>
        <button 
          onClick={onLogin}
          className="bg-primary text-white px-8 py-3.5 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all hover:bg-primary/90"
        >
          Connect with Google
        </button>
      </div>
    </div>
  </motion.div>
);

const PostComposer = ({ user, profile, onClick }: { user: FirebaseUser | null, profile: UserProfile | null, onClick: () => void }) => {
  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-[2rem] p-6 organic-shadow border border-stone-100 mb-8 cursor-pointer hover:border-primary/20 transition-all group"
    >
      <div className="flex items-center gap-5">
        <div className="relative shrink-0">
          <img 
            src={profile?.avatar || "https://picsum.photos/seed/me/100/100"} 
            alt="Me" 
            className="w-12 h-12 rounded-2xl object-cover shadow-sm border border-stone-100" 
          />
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></div>
        </div>
        <div className="flex-1 bg-stone-50 rounded-2xl px-6 py-3.5 text-stone-400 font-light text-base group-hover:bg-stone-100 transition-colors">
          Share something beneficial...
        </div>
        <div className="flex gap-2">
          <div className="p-2.5 text-secondary hover:bg-primary/5 rounded-xl transition-all">
            <ImageIcon size={20} />
          </div>
          <div className="p-2.5 text-accent hover:bg-accent/5 rounded-xl transition-all">
            <Video size={20} />
          </div>
        </div>
      </div>
    </div>
  );
};

const PostCreationModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  user, 
  profile,
  initialPost
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSubmit: (content: string, media: ({ file: File, type: 'image' | 'video' } | { url: string, type: 'image' | 'video' })[], visibility: 'public' | 'friends' | 'community') => void,
  user: FirebaseUser | null,
  profile: UserProfile | null,
  initialPost?: Post | null
}) => {
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<{ file?: File, url?: string, type: 'image' | 'video', preview: string }[]>([]);
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'community'>('public');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialPost) {
      setContent(initialPost.content);
      setVisibility(initialPost.visibility);
      setMedia(initialPost.media?.map(m => ({ url: m.url, type: m.type, preview: m.url })) || []);
    } else {
      setContent('');
      setMedia([]);
      setVisibility('public');
    }
  }, [initialPost, isOpen]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const files = e.target.files;
    if (!files) return;

    const newMedia = Array.from(files).map((file: File) => ({
      file,
      type,
      preview: URL.createObjectURL(file)
    }));

    setMedia(prev => [...prev, ...newMedia]);
  };

  const removeMedia = (index: number) => {
    setMedia(prev => {
      const updated = [...prev];
      if (updated[index].file) {
        URL.revokeObjectURL(updated[index].preview);
      }
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!content.trim() && media.length === 0) return;
    setIsUploading(true);
    try {
      const mediaToSubmit = media.map(m => m.file ? { file: m.file, type: m.type } : { url: m.url!, type: m.type });
      await onSubmit(content, mediaToSubmit as any, visibility);
      setContent('');
      setMedia([]);
      onClose();
    } catch (error) {
      console.error("Post operation failed", error);
    } finally {
      setIsUploading(false);
    }
  };

  const visibilityOptions = [
    { id: 'public', label: 'Public', icon: Globe, desc: 'Anyone on Imani' },
    { id: 'friends', label: 'Friends', icon: Users2, desc: 'Your connections' },
    { id: 'community', label: 'Community', icon: Lock, desc: 'Selected groups' }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="absolute inset-0 bg-ink/60 backdrop-blur-md"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl relative z-10 border border-stone-100 flex flex-col max-h-[90vh]"
          >
            <div className="p-6 md:p-8 border-b border-stone-100 flex items-center justify-between shrink-0">
              <h2 className="text-xl md:text-2xl font-serif italic font-bold text-ink">
                {initialPost ? 'Edit Post' : 'Create Post'}
              </h2>
              <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-xl transition-all">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
              <div className="flex gap-4">
                <img 
                  src={profile?.avatar || "https://picsum.photos/seed/me/100/100"} 
                  alt="Me" 
                  className="w-12 h-12 rounded-2xl object-cover shadow-sm border border-stone-100" 
                />
                <div className="flex-1">
                  <h4 className="font-bold text-ink text-base mb-1">{profile?.name}</h4>
                  <div className="relative inline-block">
                    <select 
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value as any)}
                      className="appearance-none bg-stone-50 border border-stone-100 rounded-lg pl-3 pr-8 py-1.5 text-[11px] font-bold text-stone-500 outline-none focus:ring-2 ring-primary/10 cursor-pointer uppercase tracking-wider"
                    >
                      <option value="public">Public</option>
                      <option value="friends">Friends</option>
                      <option value="community">Community</option>
                    </select>
                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <textarea 
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's on your mind? Share something beneficial..."
                className="w-full text-lg md:text-xl font-light text-ink outline-none resize-none min-h-[150px] placeholder:text-stone-300"
              />

              {media.length > 0 && (
                <div className={`grid gap-3 ${media.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {media.map((m, i) => (
                    <div key={i} className="relative group rounded-2xl overflow-hidden aspect-square md:aspect-video bg-stone-50 border border-stone-100">
                      {m.type === 'image' ? (
                        <img src={m.preview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <video src={m.preview} className="w-full h-full object-cover" />
                      )}
                      <button 
                        onClick={() => removeMedia(i)}
                        className="absolute top-3 right-3 p-2 bg-black/50 text-white rounded-xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 flex items-center justify-between">
                <span className="text-sm font-medium text-stone-500 ml-2">Add to your post</span>
                <div className="flex gap-2">
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={(e) => handleFileSelect(e, 'image')} 
                  />
                  <input 
                    type="file" 
                    accept="video/*" 
                    ref={videoInputRef} 
                    className="hidden" 
                    onChange={(e) => handleFileSelect(e, 'video')} 
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                    title="Add Photo"
                  >
                    <ImageIcon size={24} />
                  </button>
                  <button 
                    onClick={() => videoInputRef.current?.click()}
                    className="p-3 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                    title="Add Video"
                  >
                    <Video size={24} />
                  </button>
                  <button className="p-3 text-accent hover:bg-accent/5 rounded-xl transition-all">
                    <Quote size={24} />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8 border-t border-stone-100 shrink-0">
              <button 
                onClick={handleSubmit}
                disabled={isUploading || (!content.trim() && media.length === 0)}
                className="w-full bg-primary text-white py-4 md:py-5 rounded-2xl text-base font-bold shadow-xl shadow-primary/20 disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                {isUploading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Posting...
                  </>
                ) : (
                  'Post'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const KnowledgeBase = () => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<KnowledgeItem | null>(null);
  const [loading, setLoading] = useState(false);

  const categories = [
    { name: 'Qur’an', icon: BookOpen, color: 'bg-emerald-50 text-emerald-600' },
    { name: 'Hadith', icon: Quote, color: 'bg-blue-50 text-blue-600' },
    { name: 'Science', icon: Sparkles, color: 'bg-purple-50 text-purple-600' },
    { name: 'Life Advice', icon: HelpCircle, color: 'bg-orange-50 text-orange-600' },
  ];

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    const data = await searchKnowledgeBase(query);
    setResult(data);
    setLoading(false);
  };

  return (
    <div className="p-8 pb-32">
      <div className="flex items-center justify-between mb-10">
        <h2 className="text-3xl font-serif italic font-bold text-ink flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl">
            <BookOpen className="text-primary" size={28} />
          </div>
          Knowledge Base
        </h2>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-6 no-scrollbar mb-8">
        {categories.map((cat, i) => (
          <button key={i} className={`flex flex-col items-center gap-3 min-w-[100px] p-5 rounded-3xl transition-all hover:scale-105 active:scale-95 bg-white border border-stone-100 shadow-sm`}>
            <div className={`p-3 rounded-2xl ${cat.color}`}>
              <cat.icon size={24} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">{cat.name}</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[2rem] p-5 shadow-sm organic-shadow border border-stone-100 mb-10">
        <div className="flex gap-4">
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Quran, Hadith, or Etiquette..."
            className="flex-1 bg-stone-50 rounded-2xl px-6 py-4 text-base outline-none focus:ring-2 ring-primary/10 transition-all font-light"
          />
          <button 
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="bg-primary text-white p-4 rounded-2xl disabled:opacity-50 shadow-lg shadow-primary/20 active:scale-95 transition-all"
          >
            {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Search size={24} />}
          </button>
        </div>
      </div>

      {result && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] p-10 shadow-sm organic-shadow border border-stone-100 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
            <BookOpen size={200} className="text-primary" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-8">
              <span className="bg-primary/10 text-primary text-[10px] px-4 py-2 rounded-full font-bold uppercase tracking-[0.15em] border border-primary/10">
                {result.category}
              </span>
              <h3 className="font-serif italic font-bold text-ink text-2xl">{result.title}</h3>
            </div>
            
            <div className="bg-stone-50 p-8 rounded-3xl mb-8 italic text-ink leading-relaxed border border-stone-100 font-serif text-xl shadow-inner">
              "{result.content}"
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-[0.15em] mb-3">Source</p>
                <p className="text-sm text-stone-600 font-medium bg-stone-50/50 p-4 rounded-xl border border-stone-100">{result.source}</p>
              </div>
              
              <div>
                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-[0.15em] mb-3">Explanation</p>
                <p className="text-sm text-stone-700 leading-relaxed font-light bg-stone-50/50 p-4 rounded-xl border border-stone-100">{result.explanation}</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {!result && !loading && (
        <div className="text-center py-24 opacity-20">
          <BookOpen size={80} strokeWidth={1} className="mx-auto mb-8 text-primary" />
          <p className="text-xl font-serif italic">Seek and you shall find knowledge</p>
        </div>
      )}
    </div>
  );
};

const ModerationQueue = ({ queue, onAction }: { queue: Post[], onAction: (id: string, action: 'APPROVE' | 'REJECT') => void }) => (
  <div className="p-8 pb-32">
    <div className="flex items-center justify-between mb-10">
      <h2 className="text-3xl font-serif italic font-bold text-ink flex items-center gap-4">
        <div className="p-3 bg-red-50 rounded-2xl">
          <ShieldCheck className="text-red-500" size={28} />
        </div>
        Moderation Queue
      </h2>
      <span className="bg-red-50 text-red-600 text-[11px] px-4 py-2 rounded-full font-bold uppercase tracking-wider border border-red-100 shadow-sm">
        {queue.length} Pending
      </span>
    </div>

    {queue.length === 0 ? (
      <div className="text-center py-24 opacity-20">
        <CheckCircle size={80} strokeWidth={1} className="mx-auto mb-8 text-emerald-500" />
        <p className="text-xl font-serif italic">Queue is empty. Everything is clean!</p>
      </div>
    ) : (
      <div className="space-y-8">
        {queue.map(post => (
          <motion.div 
            key={post.id} 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2rem] p-8 shadow-sm organic-shadow border border-red-50"
          >
            <div className="flex items-center gap-5 mb-6">
              <img src={post.author.avatar} alt={post.author.name} className="w-12 h-12 rounded-2xl object-cover border border-stone-100 shadow-sm" />
              <div>
                <h4 className="text-base font-bold text-ink">{post.author.name}</h4>
                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                  {post.timestamp?.toDate ? post.timestamp.toDate().toLocaleString() : 'Just now'}
                </p>
              </div>
            </div>
            
            <div className="bg-red-50/50 p-6 rounded-2xl mb-6 text-sm text-red-800 border border-red-100">
              <p className="font-bold text-[10px] uppercase tracking-[0.15em] mb-2 text-red-400">Flagged Reason:</p>
              <p className="font-light italic leading-relaxed">{post.flagReason}</p>
            </div>
            
            <p className="text-sm text-stone-600 mb-6 line-clamp-3 leading-relaxed font-light">{post.content}</p>

            {post.media && post.media.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-8 rounded-2xl overflow-hidden shadow-sm border border-stone-100">
                {post.media.map((m, i) => (
                  <div key={i} className="aspect-square bg-stone-50">
                    {m.type === 'image' ? (
                      <img src={m.url} className="w-full h-full object-cover" />
                    ) : (
                      <video src={m.url} className="w-full h-full object-cover" />
                    )}
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex gap-4">
              <button 
                onClick={() => onAction(post.id, 'APPROVE')}
                className="flex-1 bg-emerald-500 text-white py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all hover:bg-emerald-600"
              >
                <CheckCircle size={20} />
                Approve
              </button>
              <button 
                onClick={() => onAction(post.id, 'REJECT')}
                className="flex-1 bg-red-500 text-white py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-3 shadow-lg shadow-red-500/20 active:scale-95 transition-all hover:bg-red-600"
              >
                <XCircle size={20} />
                Reject
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    )}
  </div>
);

// ... (PostCard remains mostly the same, but maybe show moderation status if moderator)

const PostCard: React.FC<{ post: Post, isModerator?: boolean, currentUser?: FirebaseUser | null, onEdit?: (post: Post) => void }> = ({ post, isModerator, currentUser, onEdit }) => {
  const isOrbit = post.type === 'ORBIT';
  const isAuthor = currentUser?.uid === post.author.uid;
  const hasMedia = post.media && post.media.length > 0;
  
  const renderMedia = () => {
    if (!post.media || post.media.length === 0) return null;
    
    const mediaCount = post.media.length;
    
    if (mediaCount === 1) {
      const m = post.media[0];
      return (
        <div className="relative h-full overflow-hidden">
          {m.type === 'image' ? (
            <img src={m.url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <video src={m.url} className="w-full h-full object-cover" controls />
          )}
        </div>
      );
    }

    return (
      <div className={`grid h-full gap-1 ${mediaCount === 2 ? 'grid-cols-2' : 'grid-cols-2 grid-rows-2'}`}>
        {post.media.slice(0, 4).map((m, i) => (
          <div key={i} className="relative overflow-hidden h-full">
            {m.type === 'image' ? (
              <img src={m.url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <video src={m.url} className="w-full h-full object-cover" />
            )}
            {i === 3 && mediaCount > 4 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-xl">
                +{mediaCount - 4}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="organic-card mb-10 group"
    >
      {/* Background Blobs for that "peaceful" look */}
      <div className="organic-blob w-64 h-64 bg-primary -top-20 -left-20" />
      <div className="organic-blob w-48 h-48 bg-accent -bottom-10 -right-10 opacity-10" />

      <div className="relative z-10 flex flex-col md:flex-row min-h-[320px]">
        {/* Content Side */}
        <div className={`flex-1 p-8 md:p-10 flex flex-col justify-between ${hasMedia ? 'bg-primary text-white' : 'bg-white text-ink'}`}>
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className={`w-12 h-12 rounded-2xl overflow-hidden border-2 ${hasMedia ? 'border-white/20' : 'border-stone-100'}`}>
                <img src={post.author.avatar} alt={post.author.name} className="w-full h-full object-cover" />
              </div>
              <div>
                <h4 className={`font-bold text-sm ${hasMedia ? 'text-white' : 'text-ink'}`}>{post.author.name}</h4>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${hasMedia ? 'text-white/60' : 'text-stone-400'}`}>
                  {post.author.badge || 'Community Member'}
                </p>
              </div>
            </div>

            <h3 className={`text-2xl md:text-3xl font-display font-bold mb-4 leading-tight ${hasMedia ? 'text-white' : 'text-primary'}`}>
              {post.type === 'ORBIT' ? 'Orbit AI Guidance' : (post.content.split('\n')[0].slice(0, 30) + (post.content.length > 30 ? '...' : ''))}
            </h3>
            <p className={`text-sm md:text-base leading-relaxed mb-6 ${hasMedia ? 'text-white/80' : 'text-stone-500'} font-light`}>
              {post.content}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className={hasMedia ? 'glass-pill' : 'bg-stone-100 text-stone-500 rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider'}>
              #Peaceful
            </div>
            <div className={hasMedia ? 'glass-pill' : 'bg-stone-100 text-stone-500 rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider'}>
              #Mindfulness
            </div>
            {isAuthor && onEdit && (
              <button 
                onClick={() => onEdit(post)}
                className={`p-2 rounded-xl transition-all ${hasMedia ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-stone-100 hover:bg-stone-200 text-stone-500'}`}
              >
                <Edit2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Media Side */}
        {hasMedia && (
          <div className="md:w-1/2 relative overflow-hidden bg-stone-100">
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-transparent md:block hidden z-10" />
            {renderMedia()}
            <button className="absolute top-6 right-6 w-12 h-12 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center text-primary shadow-lg active:scale-95 transition-all z-20">
              <Plus size={24} />
            </button>
            
            <div className="absolute bottom-6 right-6 flex gap-3 z-20">
              <button className="w-10 h-10 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center text-white hover:bg-white/40 transition-all">
                <Heart size={18} />
              </button>
              <button className="w-10 h-10 bg-white/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center text-white hover:bg-white/40 transition-all">
                <MessageSquare size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const Messenger = () => (
  <div className="p-6 pb-24">
    <div className="flex items-center justify-between mb-10">
      <h2 className="text-3xl font-serif italic font-bold text-ink flex items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-2xl">
          <MessageCircle className="text-primary" size={28} />
        </div>
        Messenger
      </h2>
      <div className="flex gap-2">
        <button className="p-3 bg-stone-100 text-stone-500 rounded-xl hover:bg-stone-200 transition-all">
          <Search size={20} />
        </button>
        <button className="p-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95">
          <Plus size={20} />
        </button>
      </div>
    </div>

    <div className="flex gap-4 overflow-x-auto pb-6 no-scrollbar mb-6">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex flex-col items-center gap-2 shrink-0">
          <div className="w-16 h-16 rounded-3xl overflow-hidden border-2 border-primary/20 p-1">
            <img src={`https://picsum.photos/seed/user${i}/100/100`} alt="User" className="w-full h-full object-cover rounded-2xl" />
          </div>
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">User {i}</span>
        </div>
      ))}
    </div>

    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map(i => (
        <motion.div 
          key={i} 
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className="flex items-center gap-5 p-5 hover:bg-white hover:shadow-xl hover:shadow-primary/5 rounded-[2rem] transition-all cursor-pointer group border border-transparent hover:border-stone-100"
        >
          <div className="relative shrink-0">
            <img src={`https://picsum.photos/seed/msg${i}/100/100`} alt="User" className="w-14 h-14 rounded-2xl object-cover shadow-sm group-hover:scale-105 transition-transform border border-stone-100" />
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-1">
              <h4 className="font-sans font-bold text-ink text-base truncate">Brother Ahmad {i}</h4>
              <span className="text-[10px] text-stone-400 font-bold tracking-wider uppercase">12:45 PM</span>
            </div>
            <p className="text-sm text-stone-500 line-clamp-1 font-light italic leading-relaxed">Assalamu Alaikum, how are you doing today?</p>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

const Communities = () => (
  <div className="p-6 pb-24">
    <h2 className="text-3xl font-serif italic font-bold text-ink mb-10 flex items-center gap-4">
      <div className="p-3 bg-primary/10 rounded-2xl">
        <Users className="text-primary" size={28} />
      </div>
      Communities
    </h2>
    <div className="grid grid-cols-1 gap-8">
      {[
        { name: 'Daily Quran Study', members: '12.4k', image: 'https://picsum.photos/seed/quran/600/300', category: 'Education' },
        { name: 'Halal Cooking Tips', members: '8.2k', image: 'https://picsum.photos/seed/food/600/300', category: 'Lifestyle' },
        { name: 'Islamic History', members: '5.1k', image: 'https://picsum.photos/seed/history/600/300', category: 'Knowledge' }
      ].map((group, i) => (
        <motion.div 
          key={i} 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white rounded-[2.5rem] overflow-hidden border border-stone-100 shadow-sm organic-shadow group cursor-pointer"
        >
          <div className="relative h-56 overflow-hidden">
            <img src={group.image} alt={group.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent"></div>
            <div className="absolute top-6 right-6">
              <span className="bg-white/20 backdrop-blur-md text-white text-[10px] px-3 py-1.5 rounded-full font-bold uppercase tracking-wider border border-white/20">
                {group.category}
              </span>
            </div>
            <div className="absolute bottom-6 left-8">
              <h4 className="font-serif italic font-bold text-white text-2xl mb-1">{group.name}</h4>
              <p className="text-white/70 text-[11px] font-bold uppercase tracking-widest">{group.members} active members</p>
            </div>
          </div>
          <div className="p-6 flex items-center justify-between bg-white">
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map(j => (
                <img key={j} src={`https://picsum.photos/seed/avatar${i}${j}/100/100`} className="w-10 h-10 rounded-xl border-2 border-white object-cover shadow-sm" />
              ))}
              <div className="w-10 h-10 rounded-xl border-2 border-white bg-stone-50 flex items-center justify-center text-[10px] font-bold text-stone-400 shadow-sm">+2k</div>
            </div>
            <button className="bg-primary text-white px-8 py-3 rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/10 active:scale-95">
              Join Circle
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

const Marketplace = () => {
  const categories = ['Books', 'Clothing', 'Islamic Art', 'Digital Services'];

  return (
    <div className="p-6 pb-24">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-serif italic font-bold text-ink flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <ShoppingBag className="text-primary" size={24} />
          </div>
          Marketplace
        </h2>
        <button className="bg-accent text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-accent/20 active:scale-95 transition-all hover:bg-accent/90">
          Sell Item
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-6 no-scrollbar mb-6">
        {categories.map((cat, i) => (
          <button key={i} className={`px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${i === 0 ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-stone-400 border border-stone-100 hover:border-primary/20'}`}>
            {cat}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[2rem] p-4 shadow-sm border border-stone-100 mb-8 flex items-center gap-3">
        <Search size={18} className="text-stone-300 ml-2" />
        <input type="text" placeholder="Search products..." className="flex-1 text-sm outline-none font-light" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { name: 'Premium Prayer Mat', price: '$25', image: 'https://picsum.photos/seed/mat/400/400', category: 'Prayer' },
          { name: 'Organic Honey', price: '$15', image: 'https://picsum.photos/seed/honey/400/400', category: 'Food' },
          { name: 'Islamic Calligraphy', price: '$40', image: 'https://picsum.photos/seed/art/400/400', category: 'Art' },
          { name: 'Modest Wear Abaya', price: '$60', image: 'https://picsum.photos/seed/dress/400/400', category: 'Fashion' }
        ].map((item, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-3xl overflow-hidden border border-stone-100 shadow-sm organic-shadow group cursor-pointer"
          >
            <div className="relative aspect-square overflow-hidden">
              <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              <div className="absolute top-3 right-3">
                <button className="p-2 bg-white/90 backdrop-blur-md rounded-lg text-stone-400 hover:text-red-400 transition-all shadow-sm">
                  <Heart size={16} />
                </button>
              </div>
              <div className="absolute bottom-3 left-3">
                <span className="bg-ink/60 backdrop-blur-md text-white text-[8px] px-2 py-0.5 rounded-md font-bold uppercase tracking-widest">
                  {item.category}
                </span>
              </div>
            </div>
            <div className="p-4">
              <h4 className="font-sans font-bold text-ink text-xs mb-1 truncate group-hover:text-primary transition-colors">{item.name}</h4>
              <div className="flex items-center justify-between">
                <p className="text-primary font-bold text-base">{item.price}</p>
                <button className="p-1.5 bg-stone-50 rounded-lg text-stone-400 hover:text-primary hover:bg-primary/5 transition-all">
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const Profile = ({ 
  user, 
  profile, 
  onLogin, 
  onLogout,
  onVerifyClick, 
  onAdminDashboardClick, 
  pendingCount 
}: { 
  user: FirebaseUser | null, 
  profile: UserProfile | null, 
  onLogin: () => void, 
  onLogout: () => void,
  onVerifyClick: () => void, 
  onAdminDashboardClick: () => void, 
  pendingCount: number 
}) => {
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkKey();
  }, []);

  const handleOpenSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  return (
    <div className="pb-24">
      <div className="relative h-64 bg-stone-100 arabic-pattern overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-paper/20 to-paper"></div>
        <div className="absolute -bottom-20 left-1/2 -translate-x-1/2">
          <div className="p-2 bg-white rounded-[3rem] shadow-2xl organic-shadow border border-white/50">
            <img 
              src={profile?.avatar || "https://picsum.photos/seed/me/400/400"} 
              alt="Me" 
              className="w-40 h-40 rounded-[2.5rem] object-cover border-4 border-white" 
            />
          </div>
        </div>
      </div>
      <div className="mt-24 px-8 text-center">
        <div className="mb-8">
          <h2 className="text-3xl font-serif italic font-bold text-ink mb-2">{profile?.name || "Omar Abdullah"}</h2>
          <p className="text-stone-500 text-sm font-light italic leading-relaxed max-w-xs mx-auto">Seeking knowledge and spreading peace through digital goodness.</p>
        </div>

        <div className="flex justify-center gap-4 mb-10">
          {!user ? (
            <button 
              onClick={onLogin}
              className="bg-primary text-white px-8 py-3.5 rounded-2xl text-sm font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all hover:bg-primary/90"
            >
              Connect with Google
            </button>
          ) : (
            <>
              <button className="bg-primary text-white px-10 py-3.5 rounded-2xl text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
                Follow
              </button>
              <button className="bg-white text-stone-500 border border-stone-100 px-10 py-3.5 rounded-2xl text-sm font-bold hover:bg-stone-50 transition-all">
                Message
              </button>
              <button 
                onClick={onLogout}
                className="bg-red-50 text-red-500 p-3.5 rounded-2xl hover:bg-red-100 transition-all shadow-sm"
              >
                <LogOut size={20} />
              </button>
            </>
          )}
        </div>

        <div className="grid grid-cols-3 gap-6 mb-12 max-w-sm mx-auto">
          <div className="text-center">
            <p className="font-sans font-bold text-2xl text-ink">1.2k</p>
            <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Followers</p>
          </div>
          <div className="text-center">
            <p className="font-sans font-bold text-2xl text-ink">450</p>
            <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Following</p>
          </div>
          <div className="text-center">
            <p className="font-sans font-bold text-2xl text-ink">85</p>
            <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Posts</p>
          </div>
        </div>

        {/* Verification Badges */}
        {profile?.isVerified && (
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {profile.badges.map(badge => (
              <span key={badge} className="bg-primary/5 text-primary text-[10px] px-4 py-2 rounded-full font-bold flex items-center gap-2 border border-primary/10 shadow-sm">
                <ShieldCheck size={14} /> {badge}
              </span>
            ))}
          </div>
        )}

        <div className="space-y-4 mb-12">
          {user && !profile?.isVerified && (
            <button 
              onClick={onVerifyClick}
              className="w-full bg-white border border-primary/10 text-primary py-5 rounded-3xl font-bold flex items-center justify-center gap-3 hover:bg-primary/5 transition-all shadow-sm group text-sm"
            >
              <ShieldCheck size={22} className="group-hover:scale-110 transition-transform" />
              Apply for Verification
            </button>
          )}
          
          {profile?.role === 'admin' && (
            <button 
              onClick={onAdminDashboardClick}
              className="w-full bg-ink text-white py-5 rounded-3xl font-bold flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all hover:bg-black text-sm"
            >
              <ShieldCheck size={22} className="text-primary" />
              Admin Dashboard ({pendingCount})
            </button>
          )}
        </div>

        <div className="bg-gradient-to-br from-primary/5 to-accent/5 p-8 rounded-[3rem] border border-primary/10 mb-12 organic-shadow relative overflow-hidden text-left">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <Sparkles size={100} className="text-primary" />
          </div>
          <div className="relative z-10">
            <h3 className="text-xl font-serif italic font-bold text-ink mb-4 flex items-center gap-3">
              <div className="p-2.5 bg-white rounded-2xl shadow-sm">
                <Sparkles size={18} className="text-primary" />
              </div>
              Orbit AI Settings
            </h3>
            <p className="text-sm text-stone-500 mb-8 leading-relaxed font-light">
              Configure your Gemini API key to enable advanced reasoning and higher rate limits for Orbit AI's guidance.
            </p>
            {!hasApiKey && (
              <div className="bg-white/50 backdrop-blur-sm border border-accent/20 p-5 rounded-2xl mb-8">
                <p className="text-xs text-accent-dark leading-relaxed italic flex items-center gap-3">
                  <AlertTriangle size={18} className="text-accent shrink-0" />
                  <span>Orbit AI currently uses the default environment key. Connect your own key for a more personalized experience.</span>
                </p>
              </div>
            )}
            <button 
              onClick={handleOpenSelectKey}
              className="w-full bg-white border border-stone-200 text-ink py-4 rounded-2xl text-sm font-bold hover:bg-stone-50 transition-all shadow-sm flex items-center justify-center gap-3 active:scale-[0.98]"
            >
              <ShieldCheck size={20} className="text-primary" />
              {hasApiKey ? 'Update API Key' : 'Configure API Key'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const VerificationModal = ({ isOpen, onClose, onSubmit }: { isOpen: boolean, onClose: () => void, onSubmit: (badge: string, reason: string, link: string) => void }) => {
  const [badge, setBadge] = useState('Verified Scholar');
  const [reason, setReason] = useState('');
  const [link, setLink] = useState('');

  const badges = ['Verified Scholar', 'Community Elder', 'Content Contributor'];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="absolute inset-0 bg-ink/60 backdrop-blur-md"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl relative z-10 border border-stone-100"
          >
            <div className="bg-primary p-8 flex items-center justify-between text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <ShieldCheck size={80} />
              </div>
              <div className="relative z-10">
                <h2 className="text-2xl font-serif italic font-bold mb-1">Verification</h2>
                <p className="text-primary-light text-xs font-light italic">Join our trusted circle of knowledge seekers.</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all relative z-10">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div>
                <label className="text-[9px] text-stone-400 font-bold uppercase tracking-widest mb-3 block ml-1">Select Badge</label>
                <div className="grid grid-cols-1 gap-2">
                  {badges.map(b => (
                    <button 
                      key={b} onClick={() => setBadge(b)}
                      className={`p-4 rounded-xl text-sm font-medium border-2 transition-all text-left flex items-center justify-between ${badge === b ? 'border-primary bg-primary/5 text-primary' : 'border-stone-100 text-stone-500 hover:border-stone-200'}`}
                    >
                      {b}
                      {badge === b && <CheckCircle size={16} className="text-primary" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[9px] text-stone-400 font-bold uppercase tracking-widest mb-3 block ml-1">Why should you be verified?</label>
                <textarea 
                  value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe your qualifications or contributions..."
                  className="w-full bg-stone-50 rounded-xl p-4 text-sm outline-none focus:ring-2 ring-primary/10 min-h-[100px] resize-none font-light leading-relaxed"
                />
              </div>

              <div>
                <label className="text-[9px] text-stone-400 font-bold uppercase tracking-widest mb-3 block ml-1">Identity Link (Optional)</label>
                <input 
                  type="text" value={link} onChange={(e) => setLink(e.target.value)}
                  placeholder="LinkedIn, Portfolio, or Website URL"
                  className="w-full bg-stone-50 rounded-xl p-4 text-sm outline-none focus:ring-2 ring-primary/10 font-light"
                />
              </div>

              <button 
                onClick={() => onSubmit(badge, reason, link)}
                disabled={!reason.trim()}
                className="w-full bg-primary text-white py-4 rounded-xl text-xs font-bold shadow-lg shadow-primary/20 disabled:opacity-50 active:scale-95 transition-all mt-2"
              >
                Submit Application
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const AdminDashboard = ({ apps, onReview, onClose }: { apps: VerificationApp[], onReview: (id: string, status: 'approved' | 'rejected', uid: string, badge: string) => void, onClose: () => void }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 bg-ink/60 backdrop-blur-md"
      onClick={onClose}
    />
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="bg-white w-full max-w-4xl h-[85vh] rounded-[2.5rem] overflow-hidden shadow-2xl relative z-10 flex flex-col border border-stone-100"
    >
      <div className="bg-ink p-8 md:p-10 flex items-center justify-between text-white relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
          <ShieldCheck size={100} className="text-primary" />
        </div>
        <div className="relative z-10">
          <h2 className="text-2xl md:text-3xl font-serif italic font-bold mb-1">Admin Dashboard</h2>
          <p className="text-stone-400 text-xs font-light italic">Maintaining the integrity of our community.</p>
        </div>
        <button onClick={onClose} className="p-2.5 hover:bg-white/10 rounded-xl transition-all relative z-10">
          <X size={20} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-stone-50/30">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-lg font-serif italic font-bold text-ink flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Users className="text-primary" size={18} />
            </div>
            Verification Requests
          </h3>
          <span className="bg-primary/10 text-primary text-[9px] px-3 py-1.5 rounded-full font-bold uppercase tracking-wider border border-primary/10">
            {apps.length} Pending
          </span>
        </div>

        {apps.length === 0 ? (
          <div className="text-center py-16 opacity-20">
            <ShieldCheck size={60} strokeWidth={1} className="mx-auto mb-6 text-primary" />
            <p className="text-base font-serif italic">No pending requests at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {apps.map(app => (
              <motion.div 
                key={app.id} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-6 shadow-sm organic-shadow border border-stone-100 group hover:border-primary/20 transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-sm font-bold text-ink mb-1">{app.applicantName}</h4>
                    <span className="text-[9px] bg-primary/5 text-primary px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border border-primary/10">{app.badgeRequested}</span>
                  </div>
                  <p className="text-[9px] text-stone-400 font-bold uppercase tracking-wider">Applied {app.createdAt?.toDate().toLocaleDateString()}</p>
                </div>
                
                <div className="bg-stone-50/50 p-4 rounded-xl mb-4 border border-stone-100">
                  <p className="text-[9px] text-stone-400 font-bold uppercase tracking-widest mb-2">Reason</p>
                  <p className="text-xs text-stone-600 leading-relaxed font-light italic">"{app.reason}"</p>
                </div>
                
                {app.identityLink && (
                  <div className="mb-6">
                    <p className="text-[9px] text-stone-400 font-bold uppercase tracking-widest mb-2">Identity Link</p>
                    <a 
                      href={app.identityLink} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="text-xs text-primary font-medium truncate bg-primary/5 p-3 rounded-lg border border-primary/10 flex items-center gap-2 hover:bg-primary/10 transition-all"
                    >
                      <ExternalLink size={14} />
                      View Credentials
                    </a>
                  </div>
                )}
                
                <div className="flex gap-3">
                  <button 
                    onClick={() => onReview(app.id, 'approved', app.applicantUid, app.badgeRequested)}
                    className="flex-1 bg-emerald-500 text-white py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all hover:bg-emerald-600"
                  >
                    <CheckCircle size={16} />
                    Approve
                  </button>
                  <button 
                    onClick={() => onReview(app.id, 'rejected', app.applicantUid, app.badgeRequested)}
                    className="flex-1 bg-red-50 text-red-500 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-all active:scale-95"
                  >
                    <XCircle size={16} />
                    Reject
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  </div>
);

const RumorCheckerModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<KnowledgeItem | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCheck = async () => {
    if (!query.trim()) return;
    setLoading(true);
    const data = await searchKnowledgeBase(`Is this true or a rumor in Islam: ${query}`);
    setResult(data);
    setLoading(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="absolute inset-0 bg-ink/60 backdrop-blur-md"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl relative z-10 border border-stone-100"
          >
            <div className="bg-red-500 p-8 flex items-center justify-between text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <AlertTriangle size={80} />
              </div>
              <div className="relative z-10">
                <h2 className="text-2xl font-serif italic font-bold mb-1">Rumor Checker</h2>
                <p className="text-red-100 text-xs font-light italic">Verifying truth in a world of whispers.</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all relative z-10">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8">
              <p className="text-sm text-stone-500 mb-6 font-light leading-relaxed">
                Paste a message or rumor you've heard. Orbit will verify it against authentic Islamic sources to ensure our community remains truthful.
              </p>
              
              <div className="space-y-6">
                <textarea 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g., 'Is it true that...'"
                  className="w-full bg-stone-50 rounded-2xl p-6 text-sm outline-none focus:ring-2 ring-red-500/10 min-h-[120px] resize-none font-light leading-relaxed"
                />
                
                <button 
                  onClick={handleCheck}
                  disabled={loading || !query.trim()}
                  className="w-full bg-red-500 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-red-500/20 disabled:opacity-50 active:scale-95 transition-all text-xs"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      Verify with Orbit AI
                    </>
                  )}
                </button>
              </div>

              {result && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8 pt-8 border-t border-stone-100"
                >
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center text-[10px] text-white font-bold shadow-sm">O</div>
                    <span className="text-xs font-bold text-ink uppercase tracking-widest">Orbit's Verdict</span>
                  </div>
                  <div className="bg-stone-50 p-6 rounded-2xl border border-stone-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
                      <Sparkles size={40} className="text-primary" />
                    </div>
                    <p className="text-sm text-stone-700 leading-relaxed font-light italic relative z-10">
                      {result.content}
                    </p>
                    <div className="mt-4 pt-4 border-t border-stone-200 relative z-10">
                      <p className="text-[8px] text-stone-400 font-bold uppercase tracking-widest mb-1">Source</p>
                      <p className="text-xs text-stone-600 italic font-medium">{result.source}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const OrbitChat = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([
    { role: 'model', text: 'Assalamu Alaikum! I am Orbit, your AI companion for spiritual growth and community guidance. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setLoading(true);

    // Format history for Gemini API
    const history = messages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));

    try {
      const response = await chatWithOrbit(userMessage, history);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: "I'm sorry, I encountered an error. Please check your connection or API configuration." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm hidden md:block"
          />
          <motion.div 
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-full h-full md:w-[95vw] md:h-[90vh] md:max-w-7xl bg-paper flex flex-col overflow-hidden md:rounded-[3.5rem] md:shadow-2xl relative z-10 border border-stone-100"
          >
            <div className="bg-primary p-8 md:p-16 flex items-center justify-between text-white relative overflow-hidden shrink-0">
              <div className="absolute top-0 right-0 p-16 opacity-10 pointer-events-none">
                <Sparkles size={200} />
              </div>
              <div className="flex items-center gap-6 md:gap-10 relative z-10">
                <div className="w-14 h-14 md:w-24 md:h-24 bg-white/20 backdrop-blur-md rounded-[1.2rem] md:rounded-[2.5rem] flex items-center justify-center shadow-inner border border-white/20">
                  <Sparkles size={32} className="text-white md:hidden" />
                  <Sparkles size={48} className="text-white hidden md:block" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-5xl font-serif italic font-bold mb-1 md:mb-3">Orbit AI</h2>
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse"></div>
                    <p className="text-primary-light text-[11px] md:text-base font-bold uppercase tracking-widest">Divine Guidance & Community Support</p>
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="p-3 md:p-6 hover:bg-white/10 rounded-2xl transition-all relative z-10 active:scale-90">
                <X size={32} />
              </button>
            </div>
            
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 md:p-20 space-y-8 md:space-y-12 bg-stone-50/30">
              {messages.map((m, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[95%] md:max-w-[80%] p-6 md:p-12 rounded-[2rem] md:rounded-[4rem] text-base md:text-xl leading-relaxed md:leading-[1.8] shadow-sm organic-shadow ${m.role === 'user' ? 'bg-primary text-white rounded-tr-none' : 'bg-white text-ink rounded-tl-none border border-stone-100 font-light'}`}>
                    {m.text}
                  </div>
                </motion.div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] rounded-tl-none border border-stone-100 shadow-sm flex gap-4">
                    <div className="w-3 h-3 bg-primary/40 rounded-full animate-bounce"></div>
                    <div className="w-3 h-3 bg-primary/40 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-3 h-3 bg-primary/40 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-8 md:p-16 bg-white border-t border-stone-100 shrink-0">
              <div className="max-w-5xl mx-auto flex gap-4 md:gap-8">
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask Orbit about Quran, Hadith, or community guidance..."
                  className="flex-1 bg-stone-50 rounded-[2rem] md:rounded-[3rem] px-8 md:px-12 py-5 md:py-8 text-base md:text-2xl outline-none focus:ring-2 ring-primary/10 transition-all font-light"
                />
                <button 
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="bg-primary text-white p-5 md:p-8 rounded-[2rem] md:rounded-[3rem] shadow-2xl shadow-primary/20 disabled:opacity-50 active:scale-95 transition-all"
                >
                  <Send size={32} />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [pendingApps, setPendingApps] = useState<VerificationApp[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Mock profile for now as requested to NOT use Firestore
        setProfile({
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          email: firebaseUser.email || '',
          avatar: firebaseUser.photoURL || `https://picsum.photos/seed/${firebaseUser.uid}/200`,
          role: 'user',
          badges: [],
          isVerified: false
        });
      } else {
        setProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Firestore logic disabled as requested
  /*
  useEffect(() => {
    if (profile?.role === 'admin') {
      const q = query(collection(db, 'applications'), where('status', '==', 'pending'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VerificationApp));
        setPendingApps(apps);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'applications');
      });
      return () => unsubscribe();
    }
  }, [profile]);
  */

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleApplyForVerification = async (badge: string, reason: string, link: string) => {
    if (!user) return;
    setNotification({ message: "Firestore is currently disabled. Application not saved.", type: 'info' });
    setIsVerificationModalOpen(false);
  };

  const handleReviewApplication = async (appId: string, status: 'approved' | 'rejected', applicantUid: string, badge: string) => {
    setNotification({ message: "Firestore is currently disabled. Action not saved.", type: 'info' });
  };
  const [posts, setPosts] = useState<Post[]>([]);
  const [moderationQueue, setModerationQueue] = useState<Post[]>([]);
  const [isRumorModalOpen, setIsRumorModalOpen] = useState(false);
  const [isOrbitChatOpen, setIsOrbitChatOpen] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [isModerator, setIsModerator] = useState(false);
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Firestore logic disabled as requested
  /*
  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      setPosts(allPosts.filter(p => p.moderationStatus === 'APPROVED' || p.type === 'ORBIT'));
      setModerationQueue(allPosts.filter(p => p.moderationStatus === 'FLAGGED'));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'posts');
    });
    return () => unsubscribe();
  }, []);
  */

  // Mock posts for now
  useEffect(() => {
    setPosts([
      {
        id: '1',
        type: 'ORBIT',
        author: { uid: 'orbit', name: 'Orbit AI', avatar: 'https://picsum.photos/seed/orbit/100/100' },
        content: 'Welcome to Imani! This is a peaceful space for the community. We are currently in a transition phase, so some features might be limited.',
        visibility: 'public',
        timestamp: { toDate: () => new Date() },
        likes: 0,
        comments: 0,
        shares: 0,
        moderationStatus: 'APPROVED'
      }
    ]);
  }, []);

  const handleSavePost = async (content: string, media: ({ file: File, type: 'image' | 'video' } | { url: string, type: 'image' | 'video' })[], visibility: 'public' | 'friends' | 'community') => {
    if (!user || !profile) return;
    setNotification({ message: "Firestore and Storage are currently disabled. Post not saved.", type: 'info' });
  };

  const handleModerationAction = async (id: string, action: 'APPROVE' | 'REJECT') => {
    setNotification({ message: "Firestore is currently disabled. Action not saved.", type: 'info' });
  };

  const renderContent = () => {
    if (isModerator) {
      return <ModerationQueue queue={moderationQueue} onAction={handleModerationAction} />;
    }

    if (showKnowledgeBase) {
      return <KnowledgeBase />;
    }

    switch (activeTab) {
      case 'admin':
        return <AdminDashboard apps={pendingApps} onReview={handleReviewApplication} onClose={() => setActiveTab('home')} />;
      case 'home':
        return (
          <div className="p-6 pb-32">
            {!user ? (
              <LoginBanner onLogin={handleLogin} />
            ) : (
              <PostComposer user={user} profile={profile} onClick={() => setIsPostModalOpen(true)} />
            )}
            <div className="space-y-6">
              {posts.map(post => (
                <PostCard 
                  key={post.id} 
                  post={post} 
                  currentUser={user}
                  onEdit={(p) => {
                    setEditingPost(p);
                    setIsPostModalOpen(true);
                  }}
                />
              ))}
            </div>
          </div>
        );
      case 'messenger':
        return <Messenger />;
      case 'communities':
        return <Communities />;
      case 'marketplace':
        return <Marketplace />;
      case 'profile':
        return (
          <Profile 
            user={user} 
            profile={profile} 
            onLogin={handleLogin} 
            onLogout={handleLogout}
            onVerifyClick={() => setIsVerificationModalOpen(true)}
            onAdminDashboardClick={() => setActiveTab('admin')}
            pendingCount={pendingApps.length}
          />
        );
      default:
        return null;
    }
  };

  return (
    <ErrorBoundary>
      {!user ? (
        <AuthScreen onAuthSuccess={() => setActiveTab('home')} />
      ) : (
        <div className="max-w-lg mx-auto min-h-screen bg-background flex flex-col shadow-2xl relative overflow-hidden">
          <div className="arabic-pattern absolute inset-0 pointer-events-none"></div>
          
          {/* Notification Toast */}
          <AnimatePresence>
            {notification && (
              <motion.div 
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -50 }}
                className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] w-full max-w-md px-4"
              >
                <div className={`p-6 rounded-2xl shadow-2xl flex items-center gap-4 border ${
                  notification.type === 'success' ? 'bg-emerald-500 text-white border-emerald-400' :
                  notification.type === 'error' ? 'bg-red-500 text-white border-red-400' :
                  'bg-blue-500 text-white border-blue-400'
                }`}>
                  {notification.type === 'success' ? <CheckCircle size={24} /> : 
                   notification.type === 'error' ? <AlertTriangle size={24} /> : <Info size={24} />}
                  <p className="text-sm font-bold">{notification.message}</p>
                  <button onClick={() => setNotification(null)} className="ml-auto p-1 hover:bg-white/10 rounded-lg transition-all">
                    <X size={18} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Navbar 
            onModeratorToggle={() => setIsModerator(!isModerator)} 
            isModerator={isModerator} 
            profile={profile}
          />
        
        <main className="flex-1 overflow-y-auto relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={isModerator ? 'mod' : (showKnowledgeBase ? 'kb' : activeTab)}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>

        {!isModerator && (
          <BottomNav 
            activeTab={showKnowledgeBase ? 'knowledge' : activeTab} 
            setActiveTab={(tab) => {
              if (tab === 'knowledge') {
                setShowKnowledgeBase(true);
              } else {
                setShowKnowledgeBase(false);
                setActiveTab(tab);
              }
            }} 
          />
        )}

        <RumorCheckerModal 
          isOpen={isRumorModalOpen} 
          onClose={() => setIsRumorModalOpen(false)} 
        />

        <VerificationModal 
          isOpen={isVerificationModalOpen} 
          onClose={() => setIsVerificationModalOpen(false)} 
          onSubmit={handleApplyForVerification} 
        />

        <OrbitChat 
          isOpen={isOrbitChatOpen} 
          onClose={() => setIsOrbitChatOpen(false)} 
        />

        <PostCreationModal 
          isOpen={isPostModalOpen}
          onClose={() => {
            setIsPostModalOpen(false);
            setEditingPost(null);
          }}
          onSubmit={handleSavePost}
          user={user}
          profile={profile}
          initialPost={editingPost}
        />

        {!isOrbitChatOpen && (
          <motion.button 
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOrbitChatOpen(true)}
            className="fixed bottom-32 right-8 w-16 h-16 bg-primary text-white rounded-[1.5rem] shadow-2xl flex items-center justify-center z-[90] ring-4 ring-white"
          >
            <Sparkles size={32} />
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white animate-pulse"></div>
          </motion.button>
        )}
      </div>
      )}
    </ErrorBoundary>
  );
}
