import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  Timestamp,
  getDocFromServer,
  doc
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';
import { auth, db } from './firebase';
import { 
  Heart, 
  History, 
  BookOpen, 
  PlusCircle, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  LogOut, 
  LogIn,
  Wind,
  Zap,
  Thermometer,
  Search,
  Smile,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

// --- Types ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
  };
}

interface Session {
  id?: string;
  userId: string;
  timestamp: Timestamp;
  emotion: string;
  intensity: number;
  reflection: string;
  skillUsed: string;
}

interface Skill {
  id: string;
  title: string;
  category: 'Regulate' | 'Ground' | 'Reflect' | 'Support';
  description: string;
  icon: React.ReactNode;
}

// --- Constants ---
const EMOTIONS = [
  'Anxious', 'Angry', 'Sad', 'Overwhelmed', 'Frustrated', 
  'Lonely', 'Fearful', 'Ashamed', 'Numb', 'Confused'
];

const SKILLS: Skill[] = [
  {
    id: 'breathing',
    title: 'Diaphragmatic Breathing',
    category: 'Regulate',
    description: 'Place one hand on your belly. Inhale deeply through your nose for 4 counts, feeling your belly expand. Hold for 2. Exhale slowly through pursed lips for 6 counts. Repeat 5 times.',
    icon: <Wind className="w-6 h-6" />
  },
  {
    id: 'grounding',
    title: '5-4-3-2-1 Grounding',
    category: 'Ground',
    description: 'Acknowledge: \n- 5 things you see\n- 4 things you can touch\n- 3 things you hear\n- 2 things you can smell\n- 1 thing you can taste',
    icon: <Search className="w-6 h-6" />
  },
  {
    id: 'temperature',
    title: 'Temperature Change',
    category: 'Regulate',
    description: 'Splash cold water on your face or hold an ice cube in your hand. The sudden temperature shift can help trigger the "dive reflex" and slow your heart rate.',
    icon: <Thermometer className="w-6 h-6" />
  },
  {
    id: 'facts',
    title: 'Check the Facts',
    category: 'Reflect',
    description: 'Ask yourself: \n1. What is the event triggering my emotion?\n2. What are my interpretations/thoughts about it?\n3. Does my emotion fit the actual facts of the situation?',
    icon: <Zap className="w-6 h-6" />
  },
  {
    id: 'compassion',
    title: 'Self-Compassion Break',
    category: 'Support',
    description: '1. Acknowledge: "This is a moment of suffering."\n2. Remind yourself: "Suffering is a part of life."\n3. Be kind: "May I be kind to myself in this moment."',
    icon: <Smile className="w-6 h-6" />
  }
];

// --- Error Handling ---
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email || undefined,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Error Boundary ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#f5f5f0]">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-red-100">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-serif font-bold text-gray-800 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-6">We encountered an error. Please try refreshing the page.</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-[#5A5A40] text-white px-8 py-3 rounded-full hover:bg-[#4A4A30] transition-colors"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Context ---
const AuthContext = createContext<{ user: User | null, loading: boolean }>({ user: null, loading: true });

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// --- Components ---

const Navbar = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) => {
  const { user } = useContext(AuthContext);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActiveTab('home');
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-gray-100 px-6 py-4 flex justify-around items-center z-50 md:top-0 md:bottom-auto md:border-t-0 md:border-b">
      <button 
        onClick={() => setActiveTab('home')}
        className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'home' ? 'text-[#5A5A40]' : 'text-gray-400'}`}
      >
        <Heart className="w-6 h-6" />
        <span className="text-[10px] uppercase tracking-widest font-medium">Home</span>
      </button>
      <button 
        onClick={() => setActiveTab('flow')}
        className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'flow' ? 'text-[#5A5A40]' : 'text-gray-400'}`}
      >
        <PlusCircle className="w-6 h-6" />
        <span className="text-[10px] uppercase tracking-widest font-medium">Check</span>
      </button>
      <button 
        onClick={() => setActiveTab('history')}
        className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'history' ? 'text-[#5A5A40]' : 'text-gray-400'}`}
      >
        <History className="w-6 h-6" />
        <span className="text-[10px] uppercase tracking-widest font-medium">History</span>
      </button>
      <button 
        onClick={() => setActiveTab('skills')}
        className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'skills' ? 'text-[#5A5A40]' : 'text-gray-400'}`}
      >
        <BookOpen className="w-6 h-6" />
        <span className="text-[10px] uppercase tracking-widest font-medium">Skills</span>
      </button>
      
      <div className="hidden md:block border-l border-gray-200 h-8 mx-4" />
      
      {user ? (
        <button onClick={handleLogout} className="flex flex-col items-center gap-1 text-gray-400 hover:text-red-500 transition-colors">
          <LogOut className="w-6 h-6" />
          <span className="text-[10px] uppercase tracking-widest font-medium">Logout</span>
        </button>
      ) : (
        <button onClick={handleLogin} className="flex flex-col items-center gap-1 text-gray-400 hover:text-[#5A5A40] transition-colors">
          <LogIn className="w-6 h-6" />
          <span className="text-[10px] uppercase tracking-widest font-medium">Login</span>
        </button>
      )}
    </nav>
  );
};

const Home = ({ onStart }: { onStart: () => void }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center min-h-[80vh] text-center px-6"
  >
    <div className="w-24 h-24 bg-[#5A5A40]/10 rounded-full flex items-center justify-center mb-8">
      <Heart className="w-12 h-12 text-[#5A5A40]" />
    </div>
    <h1 className="text-5xl font-serif font-bold text-gray-800 mb-4">Attunement Checker</h1>
    <p className="text-xl text-gray-500 italic mb-12 max-w-md">
      Pause. Reflect. Regulate. <br />
      Gain clarity when emotionally heightened.
    </p>
    <button 
      onClick={onStart}
      className="bg-[#5A5A40] text-white px-10 py-4 rounded-full text-lg font-medium shadow-lg hover:bg-[#4A4A30] transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
    >
      Start New Check
      <ChevronRight className="w-5 h-5" />
    </button>
    <p className="mt-8 text-sm text-gray-400 max-w-xs">
      "Feelings are always real. They’re not always right."
    </p>
  </motion.div>
);

const Flow = ({ onComplete }: { onComplete: () => void }) => {
  const { user } = useContext(AuthContext);
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    emotion: '',
    intensity: 5,
    reflection: '',
    skillUsed: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const sessionData = {
        userId: user.uid,
        timestamp: Timestamp.now(),
        ...data
      };
      await addDoc(collection(db, 'sessions'), sessionData);
      onComplete();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sessions');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <h2 className="text-3xl font-serif font-bold text-gray-800">This might be what's happening...</h2>
            <p className="text-gray-500">Does one of these feel close?</p>
            <div className="grid grid-cols-2 gap-4">
              {EMOTIONS.map(e => (
                <button
                  key={e}
                  onClick={() => { setData({ ...data, emotion: e }); nextStep(); }}
                  className={`p-6 rounded-3xl border-2 transition-all text-left ${data.emotion === e ? 'border-[#5A5A40] bg-[#5A5A40]/5' : 'border-gray-100 hover:border-gray-200'}`}
                >
                  <span className="text-lg font-medium text-gray-700">{e}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div 
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-12"
          >
            <h2 className="text-3xl font-serif font-bold text-gray-800">How intense is this feeling?</h2>
            <div className="space-y-6">
              <input 
                type="range" 
                min="1" 
                max="10" 
                value={data.intensity}
                onChange={(e) => setData({ ...data, intensity: parseInt(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#5A5A40]"
              />
              <div className="flex justify-between text-4xl font-serif font-bold text-[#5A5A40]">
                <span>1</span>
                <span>{data.intensity}</span>
                <span>10</span>
              </div>
              <p className="text-center text-gray-500 italic">
                {data.intensity <= 3 ? "Mild - manageable" : data.intensity <= 7 ? "Moderate - challenging" : "High - overwhelming"}
              </p>
            </div>
            <div className="flex gap-4">
              <button onClick={prevStep} className="flex-1 py-4 rounded-full border border-gray-200 text-gray-500 font-medium">Back</button>
              <button onClick={nextStep} className="flex-1 py-4 rounded-full bg-[#5A5A40] text-white font-medium">Next</button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div 
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <h2 className="text-3xl font-serif font-bold text-gray-800">What's on your mind?</h2>
            <p className="text-gray-500">Briefly describe the situation or thoughts triggering this.</p>
            <textarea 
              value={data.reflection}
              onChange={(e) => setData({ ...data, reflection: e.target.value })}
              placeholder="I'm feeling this because..."
              className="w-full h-48 p-6 rounded-3xl border-2 border-gray-100 focus:border-[#5A5A40] outline-none transition-all resize-none text-gray-700"
            />
            <div className="flex gap-4">
              <button onClick={prevStep} className="flex-1 py-4 rounded-full border border-gray-200 text-gray-500 font-medium">Back</button>
              <button onClick={nextStep} className="flex-1 py-4 rounded-full bg-[#5A5A40] text-white font-medium">Next</button>
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div 
            key="step4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <h2 className="text-3xl font-serif font-bold text-gray-800">Choose a regulation skill</h2>
            <p className="text-gray-500">Try one of these to find some balance.</p>
            <div className="space-y-4">
              {SKILLS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setData({ ...data, skillUsed: s.title })}
                  className={`w-full p-6 rounded-3xl border-2 transition-all flex items-center gap-4 text-left ${data.skillUsed === s.title ? 'border-[#5A5A40] bg-[#5A5A40]/5' : 'border-gray-100 hover:border-gray-200'}`}
                >
                  <div className="p-3 bg-white rounded-2xl shadow-sm text-[#5A5A40]">
                    {s.icon}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest font-bold text-[#5A5A40]/60">{s.category}</div>
                    <div className="text-lg font-medium text-gray-800">{s.title}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-4">
              <button onClick={prevStep} className="flex-1 py-4 rounded-full border border-gray-200 text-gray-500 font-medium">Back</button>
              <button 
                onClick={handleSave} 
                disabled={!data.skillUsed || isSaving}
                className={`flex-1 py-4 rounded-full bg-[#5A5A40] text-white font-medium flex items-center justify-center gap-2 ${(!data.skillUsed || isSaving) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSaving ? "Saving..." : "Complete Check"}
                <CheckCircle2 className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const HistoryView = () => {
  const { user } = useContext(AuthContext);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'sessions'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
      setSessions(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sessions');
    });

    return unsubscribe;
  }, [user]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <LogIn className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-2xl font-serif font-bold text-gray-800 mb-2">Login to see history</h2>
        <p className="text-gray-500">Your emotional processing history will appear here once you sign in.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-[#5A5A40] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
      <h1 className="text-4xl font-serif font-bold text-gray-800">History</h1>
      {sessions.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
          <p className="text-gray-400">No sessions yet. Start your first check-in!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sessions.map(s => (
            <motion.div 
              key={s.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-1">
                    {s.timestamp.toDate().toLocaleDateString()} at {s.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <h3 className="text-2xl font-serif font-bold text-gray-800">{s.emotion}</h3>
                </div>
                <div className="w-12 h-12 bg-[#5A5A40]/10 rounded-full flex items-center justify-center text-[#5A5A40] font-bold">
                  {s.intensity}
                </div>
              </div>
              {s.reflection && (
                <p className="text-gray-600 italic border-l-2 border-gray-100 pl-4 py-1">
                  "{s.reflection}"
                </p>
              )}
              <div className="flex items-center gap-2 text-sm text-[#5A5A40] font-medium bg-[#5A5A40]/5 px-4 py-2 rounded-full w-fit">
                <Wind className="w-4 h-4" />
                Skill: {s.skillUsed}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

const SkillsLibrary = () => {
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
      <h1 className="text-4xl font-serif font-bold text-gray-800">Skills Library</h1>
      <p className="text-gray-500">Tap a skill to see exactly how to practice it.</p>
      
      <div className="grid gap-4">
        {SKILLS.map(s => (
          <button
            key={s.id}
            onClick={() => setSelectedSkill(s)}
            className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4 text-left hover:border-[#5A5A40]/30 transition-all"
          >
            <div className="p-3 bg-[#5A5A40]/10 rounded-2xl text-[#5A5A40]">
              {s.icon}
            </div>
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-widest font-bold text-[#5A5A40]/60">{s.category}</div>
              <div className="text-lg font-medium text-gray-800">{s.title}</div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </button>
        ))}
      </div>

      <AnimatePresence>
        {selectedSkill && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-4"
            onClick={() => setSelectedSkill(null)}
          >
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="bg-white w-full max-w-lg rounded-t-[40px] md:rounded-[40px] p-8 space-y-6 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-start">
                <div className="p-4 bg-[#5A5A40]/10 rounded-3xl text-[#5A5A40]">
                  {selectedSkill.icon}
                </div>
                <button 
                  onClick={() => setSelectedSkill(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <ChevronLeft className="w-6 h-6 text-gray-400" />
                </button>
              </div>
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-widest font-bold text-[#5A5A40]">{selectedSkill.category}</div>
                <h2 className="text-3xl font-serif font-bold text-gray-800">{selectedSkill.title}</h2>
              </div>
              <div className="prose prose-stone max-w-none text-gray-600 leading-relaxed">
                <ReactMarkdown>{selectedSkill.description}</ReactMarkdown>
              </div>
              <button 
                onClick={() => setSelectedSkill(null)}
                className="w-full py-4 bg-[#5A5A40] text-white rounded-full font-medium shadow-lg"
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-[#5A5A40]/5 p-8 rounded-[40px] border border-[#5A5A40]/10">
        <h3 className="text-lg font-serif font-bold text-[#5A5A40] mb-2">Remember:</h3>
        <p className="text-[#5A5A40]/80 italic">
          Practicing these skills when you are calm makes them more accessible when you are stressed.
        </p>
      </div>
    </div>
  );
};

const AppContent = () => {
  const [activeTab, setActiveTab] = useState('home');
  const { user, loading } = useContext(AuthContext);

  // Test connection to Firestore
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0]">
        <div className="w-12 h-12 border-4 border-[#5A5A40] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f0] pb-24 md:pt-24 md:pb-0">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="container mx-auto max-w-4xl">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && <Home key="home" onStart={() => setActiveTab('flow')} />}
          {activeTab === 'flow' && <Flow key="flow" onComplete={() => setActiveTab('history')} />}
          {activeTab === 'history' && <HistoryView key="history" />}
          {activeTab === 'skills' && <SkillsLibrary key="skills" />}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
