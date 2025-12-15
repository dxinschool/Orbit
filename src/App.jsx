import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BookOpen, 
  Wallet, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Moon, 
  Sun, 
  Smile, 
  Frown, 
  Meh, 
  LayoutGrid,
  Trash2,
  X,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';

// --- Firebase Configuration & Initialization ---
const firebaseConfig = (typeof __firebase_config !== 'undefined') ? JSON.parse(__firebase_config) : null;
let app = null;
let auth = null;
let db = null;
const runningWithFirebase = Boolean(firebaseConfig);
if (runningWithFirebase) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error('Failed to initialize Firebase:', e);
  }
}
const appId = typeof __app_id !== 'undefined' ? __app_id : 'orbit-app';

// --- Visual & Animation Constants ---
const MOODS = [
  { id: 'great', icon: Sparkles, color: 'text-yellow-400', label: 'Great', bg: 'bg-yellow-400/20' },
  { id: 'good', icon: Smile, color: 'text-emerald-400', label: 'Good', bg: 'bg-emerald-400/20' },
  { id: 'neutral', icon: Meh, color: 'text-blue-400', label: 'Okay', bg: 'bg-blue-400/20' },
  { id: 'bad', icon: Frown, color: 'text-rose-400', label: 'Rough', bg: 'bg-rose-400/20' },
];

const CATEGORIES = [
  { id: 'food', label: 'Food & Drink', color: 'bg-orange-500' },
  { id: 'transport', label: 'Transport', color: 'bg-blue-500' },
  { id: 'shopping', label: 'Shopping', color: 'bg-purple-500' },
  { id: 'bills', label: 'Bills', color: 'bg-red-500' },
  { id: 'income', label: 'Income', color: 'bg-emerald-500' },
  { id: 'other', label: 'Other', color: 'bg-gray-500' },
];

// --- Helper Components ---

const GlassCard = ({ children, className = '', onClick }) => (
  <div 
    onClick={onClick}
    className={`
      relative overflow-hidden backdrop-blur-xl bg-slate-900/60 border border-slate-800/50 
      shadow-xl rounded-2xl transition-all duration-300 hover:shadow-2xl hover:border-slate-700/50
      ${onClick ? 'cursor-pointer hover:scale-[1.01] active:scale-[0.99]' : ''}
      ${className}
    `}
  >
    {children}
  </div>
);

const Button = ({ children, variant = 'primary', onClick, className = '', icon: Icon }) => {
  const baseStyle = "flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 active:scale-95";
  const variants = {
    primary: "bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:from-indigo-400 hover:to-violet-500",
    secondary: "bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white",
    danger: "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20",
    ghost: "bg-transparent text-slate-400 hover:text-white hover:bg-slate-800/50"
  };

  return (
    <button onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
};

const FadeIn = ({ children, delay = 0 }) => (
  <div className="animate-fade-in-up" style={{ animationDelay: `${delay}ms` }}>
    {children}
  </div>
);

// --- Main App Component ---

export default function OrbitApp() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, journal, wallet
  const [showModal, setShowModal] = useState(null); // 'journal' or 'transaction'
  
  // Data State
  const [entries, setEntries] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const LOCAL_KEY = `orbit_local_${appId}`;

  // Authentication
  useEffect(() => {
    const initAuth = async () => {
      if (!runningWithFirebase) {
        // Demo mode
        setUser({ uid: 'demo' });
        setLoading(false);
        return;
      }

      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    if (runningWithFirebase) {
      const unsubscribe = onAuthStateChanged(auth, setUser);
      return () => unsubscribe();
    }
  }, []);

  // Local storage fallback: load saved demo data when not using Firebase
  useEffect(() => {
    if (runningWithFirebase) return;
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setEntries(parsed.entries || []);
        setTransactions(parsed.transactions || []);
      }
    } catch (e) {
      console.error('Failed to load local data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Data Fetching
  useEffect(() => {
    if (!user || !db) return;

    // Fetch Journal Entries
    const qEntries = query(
      collection(db, 'artifacts', appId, 'users', user.uid, 'journal_entries'),
      orderBy('createdAt', 'desc')
    );

    // Fetch Transactions
    const qTransactions = query(
      collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'),
      orderBy('createdAt', 'desc')
    );

    const unsubEntries = onSnapshot(qEntries, (snapshot) => {
      setEntries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Entries error:", err));

    const unsubTrans = onSnapshot(qTransactions, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => console.error("Transactions error:", err));

    return () => {
      unsubEntries();
      unsubTrans();
    };
  }, [user]);

  // Derived State
  const balance = useMemo(() => {
    return transactions.reduce((acc, curr) => {
      return curr.type === 'income' ? acc + parseFloat(curr.amount) : acc - parseFloat(curr.amount);
    }, 0);
  }, [transactions]);

  const recentMood = entries.length > 0 ? entries[0].mood : 'neutral';
  
  // Handlers
  const handleDelete = async (collectionName, id) => {
    if (!user) return;
    if (!confirm('Delete this item?')) return;

    // Firestore path
    if (db) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, collectionName, id));
        return;
      } catch (e) {
        console.error('Error deleting:', e);
        return;
      }
    }

    // Local fallback
    try {
      if (collectionName === 'journal_entries') {
        setEntries(prev => {
          const next = prev.filter(i => i.id !== id);
          localStorage.setItem(LOCAL_KEY, JSON.stringify({ entries: next, transactions }));
          return next;
        });
      } else if (collectionName === 'transactions') {
        setTransactions(prev => {
          const next = prev.filter(i => i.id !== id);
          localStorage.setItem(LOCAL_KEY, JSON.stringify({ entries, transactions: next }));
          return next;
        });
      }
    } catch (e) {
      console.error('Local delete failed:', e);
    }
  };

  // Local save helpers used when no Firestore is available
  const addLocalEntry = async (entry) => {
    const id = `local-${Date.now()}-${Math.floor(Math.random()*10000)}`;
    const item = { id, ...entry, createdAt: { seconds: Math.floor(Date.now() / 1000) } };
    setEntries(prev => {
      const next = [item, ...prev];
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify({ entries: next, transactions })); } catch (e) { console.error(e); }
      return next;
    });
  };

  const addLocalTransaction = async (tx) => {
    const id = `local-${Date.now()}-${Math.floor(Math.random()*10000)}`;
    const item = { id, ...tx, createdAt: { seconds: Math.floor(Date.now() / 1000) } };
    setTransactions(prev => {
      const next = [item, ...prev];
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify({ entries, transactions: next })); } catch (e) { console.error(e); }
      return next;
    });
  };

  // Export / Import helpers
  const fileInputRef = useRef(null);

  const handleExport = () => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      const payload = {
        appId,
        exportedAt: Date.now(),
        data: raw ? JSON.parse(raw) : { entries, transactions }
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orbit-export-${appId}-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
      alert('Export failed. See console for details.');
    }
  };

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (parsed.appId && parsed.appId !== appId) {
          if (!confirm('Imported file appears to belong to a different app. Continue?')) return;
        }

        const incoming = parsed.data || parsed;
        const incomingEntries = incoming.entries || [];
        const incomingTransactions = incoming.transactions || [];

        const replace = confirm('Import: Click OK to REPLACE existing local data. Click Cancel to MERGE.');

        let finalEntries = [];
        let finalTransactions = [];

        if (replace) {
          finalEntries = incomingEntries;
          finalTransactions = incomingTransactions;
        } else {
          // Merge by id, prefer incoming entries first then existing to keep local continuity
          const byId = {};
          [...incomingEntries, ...entries].forEach(it => { if (it && it.id) byId[it.id] = it; });
          finalEntries = Object.values(byId);

          const byTx = {};
          [...incomingTransactions, ...transactions].forEach(it => { if (it && it.id) byTx[it.id] = it; });
          finalTransactions = Object.values(byTx);
        }

        try {
          localStorage.setItem(LOCAL_KEY, JSON.stringify({ entries: finalEntries, transactions: finalTransactions }));
        } catch (e) {
          console.error('Failed to write imported data to localStorage:', e);
          alert('Failed to save imported data to localStorage. See console for details.');
          return;
        }

        setEntries(finalEntries);
        setTransactions(finalTransactions);
        alert('Import complete.');
      } catch (err) {
        console.error('Import failed:', err);
        alert('Failed to parse import file. Make sure it is a valid Orbit export JSON.');
      } finally {
        // clear input so same file can be re-picked
        ev.target.value = '';
      }
    };
    reader.readAsText(f);
  };

  const currentMoodObj = MOODS.find(m => m.id === recentMood) || MOODS[2];

  // --- Render Functions ---

  const renderDashboard = () => (
    <div className="space-y-6 pb-24">
      <FadeIn delay={0}>
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Welcome Back
            </h1>
            <p className="text-slate-400 text-sm mt-1">Your orbit looks stable today.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex gap-2">
              <Button variant="ghost" onClick={triggerImport} className="text-sm">Import</Button>
              <Button variant="secondary" onClick={handleExport} className="text-sm">Export</Button>
            </div>
            <div className={`p-3 rounded-full ${currentMoodObj.bg} ${currentMoodObj.color} animate-pulse`}>
              <currentMoodObj.icon size={24} />
            </div>
          </div>
        </header>
      </FadeIn>

      <FadeIn delay={100}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GlassCard className="p-6 bg-gradient-to-br from-indigo-900/40 to-slate-900/60">
            <div className="flex items-center gap-3 mb-2 text-indigo-300">
              <Wallet size={18} />
              <span className="text-sm font-medium uppercase tracking-wider">Net Balance</span>
            </div>
            <div className="text-4xl font-bold text-white tracking-tight">
              ${balance.toFixed(2)}
            </div>
            <div className="mt-4 flex gap-2">
               <span className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
                 <TrendingUp size={12}/> 
                 Income
               </span>
               <span className="text-xs px-2 py-1 rounded bg-rose-500/10 text-rose-400 flex items-center gap-1">
                 <TrendingDown size={12}/> 
                 Expense
               </span>
            </div>
          </GlassCard>

          <GlassCard className="p-6 bg-gradient-to-br from-violet-900/40 to-slate-900/60">
             <div className="flex items-center gap-3 mb-2 text-violet-300">
              <BookOpen size={18} />
              <span className="text-sm font-medium uppercase tracking-wider">Latest Reflection</span>
            </div>
            {entries.length > 0 ? (
                <div className="relative">
                    <p className="text-slate-300 italic line-clamp-2">"{entries[0].text}"</p>
                    <p className="text-xs text-slate-500 mt-2 text-right">
                        {entries[0].createdAt?.seconds ? new Date(entries[0].createdAt.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now'}
                    </p>
                </div>
            ) : (
                <p className="text-slate-500">No entries yet. Start your journal today.</p>
            )}
          </GlassCard>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FadeIn delay={200}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">Recent Transactions</h3>
            <button onClick={() => setActiveTab('wallet')} className="text-xs text-indigo-400 hover:text-indigo-300">View All</button>
          </div>
          <div className="space-y-3">
            {transactions.slice(0, 3).map((t) => (
               <GlassCard key={t.id} className="p-4 flex justify-between items-center">
                 <div className="flex items-center gap-3">
                    <div className={`w-2 h-10 rounded-full ${t.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                    <div>
                        <p className="text-white font-medium">{t.description}</p>
                        <p className="text-xs text-slate-400 capitalize">{t.category}</p>
                    </div>
                 </div>
                 <span className={`font-mono font-bold ${t.type === 'income' ? 'text-emerald-400' : 'text-slate-200'}`}>
                    {t.type === 'income' ? '+' : '-'}${parseFloat(t.amount).toFixed(2)}
                 </span>
               </GlassCard> 
            ))}
            {transactions.length === 0 && <p className="text-center text-slate-600 py-4">No recent activity.</p>}
          </div>
        </FadeIn>
        
        <FadeIn delay={300}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">Recent Thoughts</h3>
            <button onClick={() => setActiveTab('journal')} className="text-xs text-indigo-400 hover:text-indigo-300">View All</button>
          </div>
           <div className="space-y-3">
            {entries.slice(0, 3).map((e) => {
                const MoodIcon = MOODS.find(m => m.id === e.mood)?.icon || Meh;
                return (
               <GlassCard key={e.id} className="p-4">
                 <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                        <MoodIcon size={16} className={MOODS.find(m => m.id === e.mood)?.color} />
                        <span className="text-xs text-slate-400">
                             {e.createdAt?.seconds ? new Date(e.createdAt.seconds * 1000).toLocaleDateString() : 'Today'}
                        </span>
                    </div>
                 </div>
                 <p className="text-slate-300 text-sm line-clamp-2">{e.text}</p>
               </GlassCard> 
            )})}
             {entries.length === 0 && <p className="text-center text-slate-600 py-4">The page is blank.</p>}
          </div>
        </FadeIn>
      </div>
    </div>
  );

  const renderJournal = () => (
    <div className="pb-24">
       <FadeIn>
        <header className="flex justify-between items-center mb-8 sticky top-0 z-10 bg-slate-950/80 backdrop-blur-md py-4">
            <h2 className="text-2xl font-bold text-white">Journal</h2>
            <Button icon={Plus} onClick={() => setShowModal('journal')}>New Entry</Button>
        </header>

        <div className="space-y-4">
            {entries.map((entry, idx) => {
                 const mood = MOODS.find(m => m.id === entry.mood);
                 const MoodIcon = mood?.icon || Meh;
                 return (
                    <FadeIn key={entry.id} delay={idx * 50}>
                        <GlassCard className="p-6 group relative">
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => {e.stopPropagation(); handleDelete('journal_entries', entry.id);}} className="text-slate-600 hover:text-rose-400 transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`p-2 rounded-lg ${mood?.bg || 'bg-slate-800'}`}>
                                    <MoodIcon size={20} className={mood?.color} />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                                        {entry.createdAt?.seconds ? new Date(entry.createdAt.seconds * 1000).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) : 'Just now'}
                                    </p>
                                    <p className="text-xs text-slate-600">
                                         {entry.createdAt?.seconds ? new Date(entry.createdAt.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                                    </p>
                                </div>
                            </div>
                            <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{entry.text}</p>
                        </GlassCard>
                    </FadeIn>
                 )
            })}
             {entries.length === 0 && (
                <div className="text-center py-20 opacity-50">
                    <BookOpen size={48} className="mx-auto mb-4 text-slate-600" />
                    <p className="text-slate-400">Your story begins with a single word.</p>
                </div>
            )}
        </div>
      </FadeIn>
    </div>
  );

  const renderWallet = () => (
    <div className="pb-24">
        <FadeIn>
            <header className="flex justify-between items-center mb-8 sticky top-0 z-10 bg-slate-950/80 backdrop-blur-md py-4">
                <h2 className="text-2xl font-bold text-white">Wallet</h2>
                <Button icon={Plus} onClick={() => setShowModal('transaction')}>Add Log</Button>
            </header>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
                 <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
                    <p className="text-emerald-400 text-xs font-medium uppercase mb-1">Total Income</p>
                    <p className="text-2xl font-bold text-white">
                        ${transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + parseFloat(curr.amount), 0).toFixed(2)}
                    </p>
                 </div>
                 <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4">
                    <p className="text-rose-400 text-xs font-medium uppercase mb-1">Total Expense</p>
                    <p className="text-2xl font-bold text-white">
                        ${transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + parseFloat(curr.amount), 0).toFixed(2)}
                    </p>
                 </div>
            </div>

            <div className="space-y-3">
                {transactions.map((t, idx) => (
                    <FadeIn key={t.id} delay={idx * 50}>
                        <GlassCard className="p-4 flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.type === 'income' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                    {t.type === 'income' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                                </div>
                                <div>
                                    <p className="text-white font-medium">{t.description}</p>
                                    <p className="text-xs text-slate-400">
                                        {t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000).toLocaleDateString() : 'Today'} • {t.category}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className={`font-mono font-bold ${t.type === 'income' ? 'text-emerald-400' : 'text-slate-200'}`}>
                                    {t.type === 'income' ? '+' : '-'}${parseFloat(t.amount).toFixed(2)}
                                </span>
                                <button onClick={() => handleDelete('transactions', t.id)} className="text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </GlassCard>
                    </FadeIn>
                ))}
                 {transactions.length === 0 && (
                <div className="text-center py-20 opacity-50">
                    <Wallet size={48} className="mx-auto mb-4 text-slate-600" />
                    <p className="text-slate-400">No transactions recorded yet.</p>
                </div>
            )}
            </div>
        </FadeIn>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
        <style dangerouslySetInnerHTML={{__html: `
            @keyframes fadeInUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .animate-fade-in-up {
                animation: fadeInUp 0.5s ease-out forwards;
                opacity: 0;
            }
        `}} />

      {/* Main Content Area */}
      <main className="max-w-3xl mx-auto min-h-screen p-6 md:p-8">
        {!user || loading ? (
          <div className="h-screen flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-indigo-400 font-medium animate-pulse">Initializing Orbit...</p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'journal' && renderJournal()}
            {activeTab === 'wallet' && renderWallet()}
          </>
        )}
      </main>

      {/* Bottom Navigation (Mobile & Desktop) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-950/80 backdrop-blur-xl border-t border-slate-800 z-50 pb-safe">
        <div className="max-w-3xl mx-auto flex justify-around p-4">
          <NavButton 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
            icon={LayoutGrid} 
            label="Home" 
          />
          <NavButton 
            active={activeTab === 'wallet'} 
            onClick={() => setActiveTab('wallet')} 
            icon={Wallet} 
            label="Wallet" 
          />
          <NavButton 
            active={activeTab === 'journal'} 
            onClick={() => setActiveTab('journal')} 
            icon={BookOpen} 
            label="Journal" 
          />
        </div>
      </nav>

      {/* Modals */}
      {/* Hidden import file input */}
      <input type="file" accept="application/json" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImportFile} />
      {showModal === 'journal' && (
        <EntryModal 
            onClose={() => setShowModal(null)} 
            type="journal"
            userId={user?.uid}
            onLocalSave={addLocalEntry}
            useLocal={!runningWithFirebase}
        />
      )}
      {showModal === 'transaction' && (
        <EntryModal 
            onClose={() => setShowModal(null)} 
            type="transaction"
            userId={user?.uid}
            onLocalSave={addLocalTransaction}
            useLocal={!runningWithFirebase}
        />
      )}
    </div>
  );
}

// --- Sub-components ---

const NavButton = ({ active, onClick, icon: Icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-300 ${active ? 'text-indigo-400 scale-110' : 'text-slate-600 hover:text-slate-400'}`}
  >
    <Icon size={24} className={active ? 'drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]' : ''} />
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);

const EntryModal = ({ onClose, type, userId, onLocalSave, useLocal = false }) => {
  // Common State
  const [loading, setLoading] = useState(false);

  // Journal State
  const [text, setText] = useState('');
  const [mood, setMood] = useState('good');

  // Transaction State
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [transType, setTransType] = useState('expense');
  const [category, setCategory] = useState('food');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId) return;
    setLoading(true);

    try {
      if (type === 'journal') {
        if (!useLocal && db) {
          await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'journal_entries'), {
            text,
            mood,
            createdAt: serverTimestamp()
          });
        } else if (onLocalSave) {
          await onLocalSave({ text, mood });
        }
      } else {
        if (!useLocal && db) {
          await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'transactions'), {
            amount: parseFloat(amount),
            description: desc,
            type: transType,
            category,
            createdAt: serverTimestamp()
          });
        } else if (onLocalSave) {
          await onLocalSave({ amount: parseFloat(amount), description: desc, type: transType, category });
        }
      }
        onClose();
    } catch (err) {
        console.error("Error adding doc:", err);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in-up">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl ring-1 ring-white/10">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
           <h3 className="font-bold text-white text-lg capitalize">{type === 'journal' ? 'New Reflection' : 'Log Transaction'}</h3>
           <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
             <X size={20} />
           </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
            
            {/* Journal Form */}
            {type === 'journal' && (
                <>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase">How do you feel?</label>
                        <div className="flex gap-4">
                            {MOODS.map(m => (
                                <button 
                                    key={m.id}
                                    type="button"
                                    onClick={() => setMood(m.id)}
                                    className={`flex-1 p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${mood === m.id ? `${m.bg} ${m.color} border-${m.color.split('-')[1]}-500/50` : 'bg-slate-800/50 border-transparent text-slate-500 hover:bg-slate-800'}`}
                                >
                                    <m.icon size={24} />
                                    <span className="text-[10px]">{m.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                         <label className="text-xs font-semibold text-slate-500 uppercase">Your thoughts</label>
                         <textarea 
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            required
                            placeholder="What's on your mind today?"
                            className="w-full h-32 bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none placeholder:text-slate-700"
                         />
                    </div>
                </>
            )}

            {/* Transaction Form */}
            {type === 'transaction' && (
                <>
                    <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800">
                        <button type="button" onClick={() => setTransType('expense')} className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${transType === 'expense' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'text-slate-500 hover:text-slate-300'}`}>Expense</button>
                        <button type="button" onClick={() => setTransType('income')} className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${transType === 'income' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-slate-300'}`}>Income</button>
                    </div>

                    <div className="space-y-2">
                         <label className="text-xs font-semibold text-slate-500 uppercase">Amount</label>
                         <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                            <input 
                                type="number" 
                                step="0.01" 
                                value={amount} 
                                onChange={(e) => setAmount(e.target.value)}
                                required
                                placeholder="0.00"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 pl-8 text-white text-xl font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-slate-700"
                            />
                         </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Description</label>
                        <input 
                            type="text" 
                            value={desc} 
                            onChange={(e) => setDesc(e.target.value)}
                            required
                            placeholder="What is this for?"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder:text-slate-700"
                        />
                    </div>

                    {transType === 'expense' && (
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase">Category</label>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORIES.map(cat => (
                                    <button 
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setCategory(cat.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${category === cat.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-transparent text-slate-400 hover:text-slate-300'}`}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            <Button className="w-full" disabled={loading}>
                {loading ? 'Saving...' : 'Save Entry'}
            </Button>
        </form>
      </div>
    </div>
  );
};
