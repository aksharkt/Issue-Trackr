import React, { useState, useEffect, useMemo, useRef, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    EmailAuthProvider,
    reauthenticateWithCredential,
    GoogleAuthProvider,
    signInWithPopup,
    updateEmail,
    updatePassword,
    sendPasswordResetEmail
} from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    doc, 
    updateDoc, 
    deleteDoc,
    query,
    serverTimestamp,
    setLogLevel,
    writeBatch,
    getDoc,
    setDoc
} from 'firebase/firestore';
import { 
    ArrowUpDown, PlusCircle, Search, Trash2, Edit, X, PieChart, List, FileDown, Users, Eye, Mail, Phone, Upload, LogOut, Lock, Sun, Moon, AlertTriangle, CheckCircle, Info, Clock, ArchiveRestore, UserCircle, MessageSquare, AtSign, Hash, Check, Flag
} from 'lucide-react';

// --- Firebase Configuration --- (No changes)
const firebaseConfig = {
  apiKey: "AIzaSyDwfLf1G-3N_fXgXNNAKdhBYm9zTUOsjxA",
  authDomain: "issue-trackr-98ebd.firebaseapp.com",
  projectId: "issue-trackr-98ebd",
  storageBucket: "issue-trackr-98ebd.firebasestorage.app",
  messagingSenderId: "778691816102",
  appId: "1:778691816102:web:e1069414122ba5f0242267",
  measurementId: "G-LG2J8B5VVH"
};
const appId = firebaseConfig.projectId;

// --- Helper Functions and Components ---

const formatDuration = (start, end) => {
    if (!start) return "Awaiting Start...";
    const endTime = end || new Date(); 
    const diffMs = new Date(endTime) - new Date(start);

    if (diffMs < 0) return "—";

    let totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    totalSeconds %= 86400;
    const hours = Math.floor(totalSeconds / 3600);
    totalSeconds %= 3600;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    
    if (end) return parts.join(' ');
    if (!end && diffMs < 1000) return "Starting...";

    return parts.join(' ');
};

const LoadingSpinner = () => <div className="flex justify-center items-center py-20"><div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div></div>;

const Toast = ({ type, message, onClose }) => {
    const icons = { success: CheckCircle, error: AlertTriangle, info: Info };
    const colors = { success: 'bg-green-50 dark:bg-green-900/20 border-green-400', error: 'bg-red-50 dark:bg-red-900/20 border-red-400', info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-400' };
    const Icon = icons[type];
    return (
        <div className={`fixed top-5 right-5 z-50 max-w-sm w-full shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden ${colors[type]}`}>
            <div className="p-4">
                <div className="flex items-start">
                    <div className="flex-shrink-0"><Icon className={`w-5 h-5 ${type === 'success' ? 'text-green-500' : type === 'error' ? 'text-red-500' : 'text-blue-500'}`} /></div>
                    <div className="ml-3 w-0 flex-1 pt-0.5"><p className="text-sm font-medium text-gray-900 dark:text-white">{message}</p></div>
                    <div className="ml-4 flex-shrink-0 flex">
                        <button onClick={onClose} className="inline-flex rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"><span className="sr-only">Close</span><X className="h-5 w-5" /></button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Theme Context for Dark/Light Mode --- (No changes)
const ThemeContext = createContext();
const useTheme = () => useContext(ThemeContext);

const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState('light');
    useEffect(() => {
        const storedTheme = localStorage.getItem('theme') || 'light';
        setTheme(storedTheme);
    }, []);
    useEffect(() => {
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(theme);
        localStorage.setItem('theme', theme);
    }, [theme]);
    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };
    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

// --- Main App Component (Authentication Router) --- (No changes)
export default function App() {
    return (
        <ThemeProvider>
            <AuthRouter />
        </ThemeProvider>
    );
}

const AuthRouter = () => {
    const [user, setUser] = useState(null);
    const [auth, setAuth] = useState(null);
    const [db, setDb] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    
    useEffect(() => {
        try {
            const app = initializeApp(firebaseConfig);
            const firebaseAuth = getAuth(app);
            const firestoreDb = getFirestore(app);
            setAuth(firebaseAuth);
            setDb(firestoreDb);
            setLogLevel('debug');

            const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                if (user) {
                    const userDocRef = doc(firestoreDb, `/artifacts/${appId}/public/data/users`, user.uid);
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists()) {
                        setUser({ ...user, ...userDoc.data() });
                    } else {
                        setUser({ ...user, role: 'user', name: user.displayName || user.email });
                    }
                } else {
                    setUser(null);
                }
                setIsLoading(false);
            });
            return () => unsubscribe();
        } catch (e) {
            console.error("Firebase initialization error:", e);
            setError("Could not connect to the application services. Please check your Firebase configuration.");
            setIsLoading(false);
        }
    }, []);

    if (isLoading) {
        return <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900"><LoadingSpinner /></div>;
    }

    if (error) {
        return <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4"><Toast type="error" message={error} /></div>
    }

    return user ? <IssueTrackerApp user={user} auth={auth} db={db} /> : <LoginScreen auth={auth} db={db} />;
}


// --- Login Screen Component --- (No changes)
const LoginScreen = ({ auth, db }) => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleAuthAction = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSuccess('');
        try {
            if (isLoginView) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, { displayName: name });
                const userDocRef = doc(db, `/artifacts/${appId}/public/data/users`, userCredential.user.uid);
                await setDoc(userDocRef, { role: 'user', email: userCredential.user.email, name: name, phone: '', employeeId: '' });
            }
        } catch (error) {
            setError(error.message.replace('Firebase: ', ''));
        } finally {
            setIsLoading(false);
        }
    };
    
    const handlePasswordReset = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSuccess('');
        try {
            await sendPasswordResetEmail(auth, email);
            setSuccess('Password reset email sent! Please check your inbox.');
        } catch (error) {
            setError(error.message.replace('Firebase: ', ''));
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        setError('');
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            
            const userDocRef = doc(db, `/artifacts/${appId}/public/data/users`, user.uid);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) {
                await setDoc(userDocRef, { 
                    role: 'user', 
                    email: user.email, 
                    name: user.displayName,
                    phone: '',
                    employeeId: ''
                });
            }
        } catch (error) {
            setError(error.message.replace('Firebase: ', ''));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col justify-center items-center p-4">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AGS Tracker</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">
                        {isForgotPassword ? 'Reset your password' : (isLoginView ? 'Sign in to your account' : 'Create a new account')}
                    </p>
                </div>
                
                {isForgotPassword ? (
                    <form onSubmit={handlePasswordReset} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email address</label>
                            <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"/>
                        </div>
                        {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 p-3 rounded-md">{error}</p>}
                        {success && <p className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 p-3 rounded-md">{success}</p>}
                        <div>
                            <button type="submit" disabled={isLoading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300">
                                {isLoading ? 'Sending...' : 'Send Reset Email'}
                            </button>
                        </div>
                        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
                            <button type="button" onClick={() => setIsForgotPassword(false)} className="font-medium text-blue-600 hover:text-blue-500">
                                Back to Sign in
                            </button>
                        </p>
                    </form>
                ) : (
                    <>
                        <button type="button" onClick={handleGoogleSignIn} disabled={isLoading} className="w-full flex items-center justify-center py-2.5 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                            <svg className="w-5 h-5 mr-2" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 21.2 177.2 56.5L357 154.4c-21.3-20.2-52.4-33.5-97.2-33.5-73 0-132.3 59.2-132.3 132.3s59.2 132.3 132.3 132.3c76.9 0 111.3-44.4 115.8-68.2H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path></svg>
                            Sign in with Google
                        </button>

                        <div className="my-6 flex items-center">
                            <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                            <span className="flex-shrink mx-4 text-gray-400 dark:text-gray-500 text-sm">Or</span>
                            <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                        </div>

                        <form onSubmit={handleAuthAction} className="space-y-6">
                            {!isLoginView && (
                                <div>
                                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                                    <input id="name" name="name" type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"/>
                                </div>
                            )}
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email address</label>
                                <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"/>
                            </div>
                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                                <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"/>
                            </div>
                            {isLoginView && (
                                <div className="text-sm">
                                    <button type="button" onClick={() => setIsForgotPassword(true)} className="font-medium text-blue-600 hover:text-blue-500">
                                        Forgot your password?
                                    </button>
                                </div>
                            )}
                            {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 p-3 rounded-md">{error}</p>}
                            <div>
                                <button type="submit" disabled={isLoading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300">
                                    {isLoading ? 'Processing...' : (isLoginView ? 'Sign in with Email' : 'Sign up with Email')}
                                </button>
                            </div>
                        </form>
                        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
                            {isLoginView ? "Don't have an account?" : "Already have an account?"}
                            <button onClick={() => { setIsLoginView(!isLoginView); setError(''); }} className="font-medium text-blue-600 hover:text-blue-500 ml-1">
                                {isLoginView ? 'Sign up' : 'Sign in'}
                            </button>
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};


// --- Main Issue Tracker Application ---
function IssueTrackerApp({ user, auth, db }) {
    const [tickets, setTickets] = useState([]);
    const [trashedTickets, setTrashedTickets] = useState([]);
    const [dataLoaded, setDataLoaded] = useState({ tickets: false, trash: false });
    const [isUploading, setIsUploading] = useState(false);
    const [toast, setToast] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [ticketsToDelete, setTicketsToDelete] = useState([]);
    const [isPermanentDelete, setIsPermanentDelete] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [selectedTickets, setSelectedTickets] = useState([]);
    const [selectedTrashedTickets, setSelectedTrashedTickets] = useState([]);
    const [view, setView] = useState('list');
    const [librariesLoaded, setLibrariesLoaded] = useState({ pdf: false, csv: false });
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'descending' });
    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
    const [ticketToClose, setTicketToClose] = useState(null);
    const [clientFilter, setClientFilter] = useState('All');
    const [siteFilter, setSiteFilter] = useState('All');

    const isLoading = (view === 'list' && !dataLoaded.tickets) || 
                      (view === 'trash' && !dataLoaded.trash) ||
                      (view === 'dashboard' && !dataLoaded.tickets);

    const clientOptions = useMemo(() => {
        if (tickets.length === 0) return [];
        const uniqueClients = [...new Set(tickets.map(t => t.clientName).filter(Boolean))];
        return ['All', ...uniqueClients.sort()];
    }, [tickets]);
    
    const siteOptions = useMemo(() => {
        if (tickets.length === 0) return [];
        const uniqueSites = [...new Set(tickets.map(t => t.siteName).filter(Boolean))];
        return ['All', ...uniqueSites.sort()];
    }, [tickets]);
    
    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    };

    useEffect(() => {
        const loadScript = (src, onDone, onError) => {
            const script = document.createElement('script');
            script.src = src; script.async = true; script.onload = onDone; script.onerror = onError;
            document.body.appendChild(script); return script;
        };
        const scriptErrorHandler = (scriptName) => (e) => { console.error(`Failed to load ${scriptName}.`, e); showToast("error", `Failed to load ${scriptName} library.`); };
        const jspdfScript = loadScript('https://unpkg.com/jspdf@latest/dist/jspdf.umd.min.js', () => { loadScript('https://unpkg.com/jspdf-autotable@3.5.23/dist/jspdf.plugin.autotable.js', () => setLibrariesLoaded(prev => ({...prev, pdf: true})), scriptErrorHandler('jsPDF-AutoTable')); }, scriptErrorHandler('jsPDF'));
        const papaparseScript = loadScript('https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.2/papaparse.min.js', () => setLibrariesLoaded(prev => ({...prev, csv: true})), scriptErrorHandler('PapaParse'));
        return () => { document.body.removeChild(jspdfScript); const autotable = document.querySelector('script[src*="autotable"]'); if(autotable) document.body.removeChild(autotable); document.body.removeChild(papaparseScript); };
    }, []);

    useEffect(() => {
        if (db) {
            const ticketsCollectionPath = `/artifacts/${appId}/public/data/tickets`;
            const trashCollectionPath = `/artifacts/${appId}/public/data/trash`;
            
            const ticketsQuery = query(collection(db, ticketsCollectionPath));
            const trashQuery = query(collection(db, trashCollectionPath));

            const unsubTickets = onSnapshot(ticketsQuery, (snapshot) => {
                const ticketsData = snapshot.docs.map(doc => {
                    const data = doc.data();
                    const safeGetDate = (fieldValue) => fieldValue?.toDate ? fieldValue.toDate() : null;
                    return { 
                        id: doc.id, 
                        ...data, 
                        timestamp: safeGetDate(data.timestamp), 
                        issueStartTime: safeGetDate(data.issueStartTime), 
                        issueEndTime: safeGetDate(data.issueEndTime),
                        actualClosedAt: safeGetDate(data.actualClosedAt)
                    };
                });
                setTickets(ticketsData);
                setDataLoaded(prev => ({...prev, tickets: true}));
            }, (err) => { console.error("Firestore snapshot error (tickets):", err); showToast("error", "Failed to fetch tickets."); });

            const unsubTrash = onSnapshot(trashQuery, (snapshot) => {
                const trashedData = snapshot.docs.map(doc => {
                    const data = doc.data();
                    const safeGetDate = (fieldValue) => fieldValue?.toDate ? fieldValue.toDate() : null;
                    return { id: doc.id, ...data, deletedAt: safeGetDate(data.deletedAt) };
                });
                setTrashedTickets(trashedData);
                setDataLoaded(prev => ({...prev, trash: true}));
            }, (err) => { console.error("Firestore snapshot error (trash):", err); showToast("error", "Failed to fetch trashed tickets."); });

            return () => { unsubTickets(); unsubTrash(); };
        }
    }, [db]);

    useEffect(() => {
        setSelectedTickets([]);
        setSelectedTrashedTickets([]);
    }, [view]);

    const filteredAndSortedTickets = useMemo(() => {
        const source = view === 'trash' ? trashedTickets : tickets;
        let processedTickets = [...source];
        processedTickets = processedTickets.filter(ticket => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = ['clientName', 'description', 'siteName', 'teamMember'].some(field => ticket[field]?.toLowerCase().includes(searchLower));
            const matchesStatus = statusFilter === 'All' || ticket.status === statusFilter;
            const matchesClient = clientFilter === 'All' || ticket.clientName === clientFilter;
            const matchesSite = siteFilter === 'All' || ticket.siteName === siteFilter;
            return matchesSearch && matchesClient && matchesSite && (view === 'trash' || matchesStatus);
        });
        if (sortConfig.key) {
            processedTickets.sort((a, b) => {
                const key = sortConfig.key;
                const aValue = a[key]; const bValue = b[key];
                if (aValue === null || aValue === undefined) return 1; if (bValue === null || bValue === undefined) return -1;
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return processedTickets;
    }, [tickets, trashedTickets, searchTerm, statusFilter, clientFilter, siteFilter, sortConfig, view]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') { direction = 'descending'; }
        setSortConfig({ key, direction });
    };

    const openEditModal = (ticket = null) => { setSelectedTicket(ticket); setIsEditModalOpen(true); };
    const closeEditModal = () => { setIsEditModalOpen(false); setSelectedTicket(null); };
    const openDetailModal = (ticket) => { setSelectedTicket(ticket); setIsDetailModalOpen(true); };
    const closeDetailModal = () => { setIsDetailModalOpen(false); setSelectedTicket(null); };
    const openDeleteModal = (ticketIds, isPermanent = false) => {
        setTicketsToDelete(Array.isArray(ticketIds) ? ticketIds : [ticketIds]);
        setIsPermanentDelete(isPermanent);
        setIsDeleteModalOpen(true);
    };
    const closeDeleteModal = () => {
        setIsDeleteModalOpen(false);
        setTicketsToDelete([]);
    };
    
    const openCloseModal = (ticket) => { 
        if (!ticket.issueEndTime) {
            showToast('error', 'Please edit the issue and add a manual "Issue End Time" before closing.');
            return;
        }
        setTicketToClose(ticket); 
        setIsCloseModalOpen(true); 
    };
    const closeCloseModal = () => { setIsCloseModalOpen(false); setTicketToClose(null); };

    const handleSelectTicket = (ticketId) => {
        const targetState = view === 'trash' ? setSelectedTrashedTickets : setSelectedTickets;
        targetState(prev => 
            prev.includes(ticketId) ? prev.filter(id => id !== ticketId) : [...prev, ticketId]
        );
    };

    const handleSelectAllTickets = () => {
        const targetStateSetter = view === 'trash' ? setSelectedTrashedTickets : setSelectedTickets;
        const selectedState = view === 'trash' ? selectedTrashedTickets : selectedTickets;
        if (selectedState.length === filteredAndSortedTickets.length) {
            targetStateSetter([]);
        } else {
            targetStateSetter(filteredAndSortedTickets.map(t => t.id));
        }
    };

    const handleSaveTicket = async (formData) => {
        if (!db) return showToast("error", "Database not connected.");
        
        const dataToSave = {
            ...formData,
            issueStartTime: formData.issueStartTime ? new Date(formData.issueStartTime) : serverTimestamp(),
            issueEndTime: formData.issueEndTime ? new Date(formData.issueEndTime) : null,
        };
        
        if (dataToSave.status === 'Closed' && !selectedTicket?.actualClosedAt) {
            dataToSave.actualClosedAt = serverTimestamp();
            if (!dataToSave.closedByName) {
                dataToSave.closedByName = user.name || user.email;
                dataToSave.closedByUid = user.uid;
            }
        }
        
        // CHANGE 1: Clear "Closed By" info when a ticket is reopened.
        if (selectedTicket?.status === 'Closed' && dataToSave.status !== 'Closed') {
            dataToSave.actualClosedAt = null;
            dataToSave.closedByName = null;
            dataToSave.closedByUid = null;
        }

        const path = `/artifacts/${appId}/public/data/tickets`;
        try {
            if (selectedTicket) {
                const ref = doc(db, path, selectedTicket.id);
                delete dataToSave.timestamp; 
                await updateDoc(ref, dataToSave);
                showToast("success", "Issue updated successfully!");
            } else {
                await addDoc(collection(db, path), { ...dataToSave, timestamp: serverTimestamp(), authorId: user.uid, authorEmail: user.email });
                showToast("success", "Issue created successfully!");
            }
            closeEditModal();
        } catch (e) { console.error(e); showToast("error", "Failed to save issue."); }
    };
    
    const handleConfirmClose = async (password) => {
        if (!ticketToClose) return showToast("error", "No issue selected.");
        
        const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
        try {
            await reauthenticateWithCredential(auth.currentUser, credential);
            
            const ticketRef = doc(db, `/artifacts/${appId}/public/data/tickets`, ticketToClose.id);
            await updateDoc(ticketRef, { 
                status: 'Closed', 
                actualClosedAt: serverTimestamp(), 
                closedByUid: user.uid, 
                closedByName: user.name || user.email 
            });

            showToast("success", `Issue #${ticketToClose.id.substring(0,5)}... closed successfully!`);
            closeCloseModal();

        } catch (error) {
            console.error("Reauthentication/Closing failed:", error);
            showToast("error", "Incorrect password. Issue was not closed.");
            throw error;
        }
    };

    const handleConfirmDelete = async (password) => {
        if (user.role !== 'admin') { showToast("error", "Insufficient permissions."); return; }
        const credential = EmailAuthProvider.credential(user.email, password);
        try {
            await reauthenticateWithCredential(auth.currentUser, credential);
            if (isPermanentDelete) {
                await handlePermanentDelete();
            } else {
                await handleSoftDelete();
            }
        } catch (error) {
            console.error("Reauthentication failed:", error);
            showToast("error", "Incorrect password. Deletion cancelled.");
        }
    };

    const handleSoftDelete = async () => {
        const batch = writeBatch(db);
        const ticketsCollectionPath = `/artifacts/${appId}/public/data/tickets`;
        const trashCollectionPath = `/artifacts/${appId}/public/data/trash`;

        ticketsToDelete.forEach(ticketId => {
            const originalDocRef = doc(db, ticketsCollectionPath, ticketId);
            const ticketToMove = tickets.find(t => t.id === ticketId);
            if (ticketToMove) {
                const trashDocRef = doc(db, trashCollectionPath, ticketId);
                batch.set(trashDocRef, { ...ticketToMove, deletedAt: serverTimestamp() });
                batch.delete(originalDocRef);
            }
        });

        try {
            await batch.commit();
            showToast("info", `${ticketsToDelete.length} issue(s) moved to trash.`);
            closeDeleteModal();
            setSelectedTickets([]);
        } catch (e) {
            console.error("Error moving issues to trash:", e);
            showToast("error", "Failed to move issues to trash.");
        }
    };
    
    const handlePermanentDelete = async () => {
        const batch = writeBatch(db);
        const trashCollectionPath = `/artifacts/${appId}/public/data/trash`;
        ticketsToDelete.forEach(ticketId => {
            const trashDocRef = doc(db, trashCollectionPath, ticketId);
            batch.delete(trashDocRef);
        });
        try {
            await batch.commit();
            showToast("success", `${ticketsToDelete.length} issue(s) permanently deleted.`);
            closeDeleteModal();
            setSelectedTrashedTickets([]);
        } catch (e) {
            console.error("Error permanently deleting issues:", e);
            showToast("error", "Failed to permanently delete issues.");
        }
    };

    const handleRestoreTicket = async (ticketId) => {
        const batch = writeBatch(db);
        const ticketsCollectionPath = `/artifacts/${appId}/public/data/tickets`;
        const trashCollectionPath = `/artifacts/${appId}/public/data/trash`;
        const trashDocRef = doc(db, trashCollectionPath, ticketId);
        const ticketToRestore = trashedTickets.find(t => t.id === ticketId);

        if (ticketToRestore) {
            const newTicketRef = doc(db, ticketsCollectionPath, ticketId);
            const { deletedAt, ...restoredData } = ticketToRestore;
            batch.set(newTicketRef, restoredData);
            batch.delete(trashDocRef);
            try {
                await batch.commit();
                showToast("success", "Issue restored successfully.");
            } catch (e) {
                console.error("Error restoring issue:", e);
                showToast("error", "Failed to restore issue.");
            }
        }
    };

    const handleImport = (file) => {
        showToast("info", "CSV import feature is not yet implemented.");
    };

    return (
        <div className="bg-gray-100 dark:bg-gray-900 min-h-screen font-sans text-gray-800 dark:text-gray-200">
            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
                <Header onNewTicket={() => openEditModal()} user={user} auth={auth} setView={setView} />
                {isUploading && <div className="fixed top-4 right-4 bg-blue-500 text-white p-3 rounded-lg shadow-lg z-50 flex items-center"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>Importing...</div>}
                
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg mt-6">
                    <Toolbar 
                        view={view} 
                        setView={setView} 
                        tickets={filteredAndSortedTickets} 
                        librariesLoaded={librariesLoaded} 
                        onImport={handleImport}
                        user={user}
                        selectedTickets={selectedTickets}
                        selectedTrashedTickets={selectedTrashedTickets}
                        onBulkDelete={() => openDeleteModal(selectedTickets, false)}
                        onBulkPermanentDelete={() => openDeleteModal(selectedTrashedTickets, true)}
                        showToast={showToast}
                    />
                    {view !== 'dashboard' && view !== 'profile' && 
                        <FilterControls 
                            searchTerm={searchTerm} setSearchTerm={setSearchTerm} 
                            statusFilter={statusFilter} setStatusFilter={setStatusFilter} 
                            clientFilter={clientFilter} setClientFilter={setClientFilter} clientOptions={clientOptions}
                            siteFilter={siteFilter} setSiteFilter={setSiteFilter} siteOptions={siteOptions}
                            view={view} 
                        />
                    }
                    <main className="p-4 md:p-6">
                        {isLoading ? <LoadingSpinner /> : (
                            view === 'dashboard' ? <Dashboard tickets={tickets} /> :
                            view === 'list' ?
                            <TicketList 
                                tickets={filteredAndSortedTickets} 
                                user={user} 
                                onEdit={openEditModal} 
                                onDelete={(id) => openDeleteModal(id, false)} 
                                onViewDetails={openDetailModal} 
                                requestSort={requestSort} 
                                sortConfig={sortConfig}
                                selectedTickets={selectedTickets}
                                onSelectTicket={handleSelectTicket}
                                onSelectAllTickets={handleSelectAllTickets}
                                onCloseTicket={openCloseModal}
                            /> :
                            view === 'trash' ?
                            <TrashList 
                                tickets={filteredAndSortedTickets}
                                onRestore={handleRestoreTicket}
                                onPermanentDelete={(id) => openDeleteModal(id, true)}
                                selectedTickets={selectedTrashedTickets}
                                onSelectTicket={handleSelectTicket}
                                onSelectAllTickets={handleSelectAllTickets}
                            /> :
                            <ProfilePage user={user} auth={auth} db={db} showToast={showToast} />
                        )}
                    </main>
                </div>

                {isEditModalOpen && <TicketForm isOpen={isEditModalOpen} onClose={closeEditModal} onSave={handleSaveTicket} ticket={selectedTicket} user={user} showToast={showToast} />}
                {isDetailModalOpen && <TicketDetailModal isOpen={isDetailModalOpen} onClose={closeDetailModal} ticket={selectedTicket} />}
                {isDeleteModalOpen && <DeleteConfirmationModal isOpen={isDeleteModalOpen} onClose={closeDeleteModal} onConfirm={handleConfirmDelete} count={ticketsToDelete.length} isPermanent={isPermanentDelete} />}
                {isCloseModalOpen && <CloseConfirmationModal isOpen={isCloseModalOpen} onClose={closeCloseModal} onConfirm={handleConfirmClose} ticket={ticketToClose} />}
            </div>
        </div>
    );
}

// --- Sub-components ---
const Header = ({ onNewTicket, user, auth, setView }) => {
    const { theme, toggleTheme } = useTheme();
    return (
    <header className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">AGS Tracker</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Your shared workspace for managing support issues.</p>
            </div>
            <div className="flex items-center mt-4 sm:mt-0">
                <button onClick={toggleTheme} className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors mr-4" title="Toggle Theme">
                    {theme === 'light' ? <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300"/> : <Sun className="w-5 h-5 text-gray-600 dark:text-gray-300"/>}
                </button>
                <div className="text-right mr-4">
                    <button onClick={() => setView('profile')} className="text-sm font-medium text-gray-800 dark:text-gray-100 hover:underline">{user.name || user.email}</button>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user.role}</p>
                </div>
                <button onClick={() => signOut(auth)} className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors mr-4" title="Sign Out"><LogOut className="w-5 h-5 text-gray-600 dark:text-gray-300"/></button>
                <button onClick={onNewTicket} className="flex items-center justify-center bg-blue-600 text-white font-semibold py-2 px-5 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition-all transform hover:scale-105">
                    <PlusCircle className="w-5 h-5 mr-2" /> New Issue
                </button>
            </div>
        </div>
         <div className="mt-5 bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-400 text-purple-900 dark:text-purple-300 p-3.5 rounded-r-lg flex items-center text-sm shadow-sm">
            <Lock className="w-6 h-6 mr-4 flex-shrink-0 text-purple-500" />
            <p><span className="font-semibold">Security Notice:</span> For production use, ensure you have configured Firestore Security Rules on your Firebase backend to prevent unauthorized data access.</p>
        </div>
    </header>
);
};

const Toolbar = ({ view, setView, tickets, librariesLoaded, onImport, user, selectedTickets, selectedTrashedTickets, onBulkDelete, onBulkPermanentDelete, showToast }) => {
    const importInputRef = useRef(null);
    
    const exportToCSV = () => {
        if (!librariesLoaded.csv || !window.Papa) return showToast('error', 'CSV library not ready.');
        if (tickets.length === 0) return showToast('info', 'No data to export.');
        const headers = ['Client Name', 'Site Name', 'Description', 'Status', 'Priority', 'Team Member', 'Issue Start Time', 'Issue End Time', 'Closed By', 'POS Ticket', 'Sungrow Ticket'];
        const data = tickets.map(t => ({ 'Client Name': t.clientName, 'Site Name': t.siteName, 'Description': t.description, 'Status': t.status, 'Priority': t.priority, 'Team Member': t.teamMember, 'Issue Start Time': t.issueStartTime?.toLocaleString() || 'N/A', 'Issue End Time': t.issueEndTime?.toLocaleString() || 'N/A', 'Closed By': t.closedByName || '', 'POS Ticket': t.pcsTicket || '', 'Sungrow Ticket': t.sungrowTicket || '' }));
        const csv = window.Papa.unparse({ fields: headers, data });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", `issues-export-${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        showToast('success', 'CSV export started.');
    };

    const exportToPDF = () => {
        if (!librariesLoaded.pdf || !window.jspdf) return showToast('error', 'PDF library not ready.');
        if (tickets.length === 0) return showToast('info', 'No data to export.');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.autoTable({
            head: [['Client', 'Site', 'Description', 'Status', 'Priority', 'Issue Start']],
            body: tickets.map(t => [ t.clientName, t.siteName, t.description.substring(0, 40) + '...', t.status, t.priority, t.issueStartTime?.toLocaleDateString() || 'N/A' ]),
            startY: 20,
        });
        doc.text("AGS Tracker Issues", 14, 15);
        doc.save(`issues-export-${new Date().toISOString().split('T')[0]}.pdf`);
        showToast('success', 'PDF export started.');
    };
    
    const handleImportClick = () => { importInputRef.current.click(); };
    const handleFileChange = (event) => { const file = event.target.files[0]; onImport(file); event.target.value = null; };

    return (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center bg-gray-50/50 dark:bg-gray-800/20 rounded-t-xl">
            <div className="flex items-center space-x-1 bg-gray-200 dark:bg-gray-700 p-1 rounded-lg mb-3 sm:mb-0">
                <button onClick={() => setView('dashboard')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${view === 'dashboard' ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-600/50'}`}><PieChart className="w-4 h-4 inline-block mr-2"/>Dashboard</button>
                <button onClick={() => setView('list')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${view === 'list' ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-600/50'}`}><List className="w-4 h-4 inline-block mr-2"/>Issue List</button>
                {user.role === 'admin' && <button onClick={() => setView('trash')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${view === 'trash' ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-600/50'}`}><Trash2 className="w-4 h-4 inline-block mr-2"/>Trash</button>}
            </div>
            <div className="flex items-center space-x-3">
                {user.role === 'admin' && selectedTickets.length > 0 && view === 'list' && (
                    <button onClick={onBulkDelete} className="flex items-center text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 bg-red-100 dark:bg-red-900/20 px-3 py-1.5 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4 mr-1.5"/>Delete Selected ({selectedTickets.length})
                    </button>
                )}
                 {user.role === 'admin' && selectedTrashedTickets.length > 0 && view === 'trash' && (
                    <button onClick={onBulkPermanentDelete} className="flex items-center text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 bg-red-100 dark:bg-red-900/20 px-3 py-1.5 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4 mr-1.5"/>Delete Permanently ({selectedTrashedTickets.length})
                    </button>
                )}
                <input type="file" ref={importInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
                <button onClick={handleImportClick} disabled={!librariesLoaded.csv} className="flex items-center text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><Upload className="w-4 h-4 mr-1.5"/>Import CSV</button>
                <button onClick={exportToCSV} disabled={!librariesLoaded.csv} className="flex items-center text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><FileDown className="w-4 h-4 mr-1.5"/>Export CSV</button>
                <button onClick={exportToPDF} disabled={!librariesLoaded.pdf} className="flex items-center text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><FileDown className="w-4 h-4 mr-1.5"/>Export PDF</button>
            </div>
        </div>
    );
};

const FilterControls = ({ searchTerm, setSearchTerm, statusFilter, setStatusFilter, clientFilter, setClientFilter, clientOptions, siteFilter, setSiteFilter, siteOptions, view }) => (
    <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 border-b border-gray-200 dark:border-gray-700">
        <div className="relative md:col-span-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" placeholder="Search issues..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-white"/></div>
        {view === 'list' && (
            <>
                <div><select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="w-full py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-white"><option value="All">All Clients</option>{clientOptions.slice(1).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <div><select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)} className="w-full py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-white"><option value="All">All Sites</option>{siteOptions.slice(1).map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                <div>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-white">
                        <option value="All">All Statuses</option>
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Closed">Closed</option>
                    </select>
                </div>
            </>
        )}
    </div>
);
const Dashboard = ({ tickets }) => {
    const stats = useMemo(() => {
        const total = tickets.length;
        const open = tickets.filter(t => t.status === 'Open' || t.status === 'In Progress').length;
        const closed = tickets.filter(t => t.status === 'Closed').length;
        const highPriority = tickets.filter(t => t.priority === 'High' && t.status !== 'Closed').length;
        const byStatus = tickets.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {});
        const byPriority = tickets.reduce((acc, t) => { acc[t.priority] = (acc[t.priority] || 0) + 1; return acc; }, {});
        return { total, open, closed, highPriority, byStatus, byPriority };
    }, [tickets]);
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6"><StatCard title="Total Issues" value={stats.total} /><StatCard title="Open Issues" value={stats.open} /><StatCard title="Closed Issues" value={stats.closed} /><StatCard title="Urgent Open" value={stats.highPriority} /></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><ChartCard title="Issues by Status" data={stats.byStatus} /><ChartCard title="Issues by Priority" data={stats.byPriority} /></div>
        </div>
    );
};

const StatCard = ({ title, value }) => (<div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-sm"><p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p><p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value}</p></div>);
const ChartCard = ({ title, data }) => {
    const total = Object.values(data).reduce((sum, val) => sum + val, 0);
    const colors = { 'Open': 'bg-blue-400', 'In Progress': 'bg-yellow-400', 'Closed': 'bg-gray-400', 'High': 'bg-red-400', 'Medium': 'bg-orange-400', 'Low': 'bg-teal-400' };
    return (<div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-sm"><h3 className="font-semibold text-gray-800 dark:text-white mb-4">{title}</h3><div className="space-y-3">{Object.entries(data).map(([key, value]) => (<div key={key}><div className="flex justify-between text-sm mb-1"><span className="font-medium text-gray-600 dark:text-gray-300">{key}</span><span className="text-gray-500 dark:text-gray-400">{value}</span></div><div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5"><div className={`${colors[key] || 'bg-gray-500'} h-2.5 rounded-full`} style={{ width: `${total > 0 ? (value / total) * 100 : 0}%` }}></div></div></div>))}</div></div>);
};

const TicketList = ({ tickets, user, onEdit, onDelete, onViewDetails, requestSort, sortConfig, selectedTickets, onSelectTicket, onSelectAllTickets, onCloseTicket }) => {
    if (tickets.length === 0) return <p className="text-center py-16 text-gray-500 dark:text-gray-400">No issues found.</p>;
    const getSortIndicator = (key) => { if (sortConfig.key === key) return sortConfig.direction === 'ascending' ? '▲' : '▼'; return <ArrowUpDown className="w-4 h-4 inline-block ml-1 text-gray-400" />; };
    return (<div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-700"><tr>{user.role === 'admin' && <th className="px-6 py-3 text-left"><input type="checkbox" className="rounded dark:bg-gray-900 dark:border-gray-600" onChange={onSelectAllTickets} checked={tickets.length > 0 && selectedTickets.length === tickets.length} /></th>}<th onClick={() => requestSort('clientName')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer">Issue Details {getSortIndicator('clientName')}</th><th onClick={() => requestSort('status')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer">Status {getSortIndicator('status')}</th><th onClick={() => requestSort('priority')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer">Priority {getSortIndicator('priority')}</th><th onClick={() => requestSort('issueStartTime')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Issue Start Time {getSortIndicator('issueStartTime')}</th><th onClick={() => requestSort('issueEndTime')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Issue End Time {getSortIndicator('issueEndTime')}</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Response Time</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th></tr></thead><tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">{tickets.map(ticket => <TicketRow key={ticket.id} ticket={ticket} user={user} onEdit={onEdit} onDelete={onDelete} onViewDetails={onViewDetails} isSelected={selectedTickets.includes(ticket.id)} onSelectTicket={onSelectTicket} onCloseTicket={onCloseTicket} />)}</tbody></table></div>);
};

const TicketRow = ({ ticket, user, onEdit, onDelete, onViewDetails, isSelected, onSelectTicket, onCloseTicket }) => {
    const canEdit = user.role === 'admin' || user.uid === ticket.authorId;
    const canDelete = user.role === 'admin';
    const canClose = ticket.status !== 'Closed';

    const statusColor = { 
        'Open': 'text-red-700 dark:text-red-400 font-semibold', 
        'In Progress': 'text-blue-700 dark:text-blue-400', 
        'Closed': 'text-green-700 dark:text-green-500 font-semibold' 
    };
    const priorityColor = { 
        'Urgent': 'text-red-800 dark:text-red-500 font-bold',
        'High': 'text-orange-600 dark:text-orange-400 font-semibold',
        'Medium': 'text-yellow-800 dark:text-yellow-500',
        'Low': 'text-green-700 dark:text-green-500'
    };
    
    return (<tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
        {user.role === 'admin' && <td className="px-6 py-4"><input type="checkbox" className="rounded dark:bg-gray-900 dark:border-gray-600" checked={isSelected} onChange={() => onSelectTicket(ticket.id)} /></td>}
        <td className="px-6 py-4 max-w-sm">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">{ticket.clientName} - {ticket.siteName}</div>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{ticket.description}</p>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm"><span className={statusColor[ticket.status] || ''}>{ticket.status}</span></td>
        <td className="px-6 py-4 whitespace-nowrap text-sm"><span className={priorityColor[ticket.priority] || ''}>{ticket.priority}</span></td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{ticket.issueStartTime ? new Date(ticket.issueStartTime).toLocaleString() : 'N/A'}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{ticket.issueEndTime ? new Date(ticket.issueEndTime).toLocaleString() : '—'}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{formatDuration(ticket.issueStartTime, ticket.issueEndTime)}</td>
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <button onClick={() => onViewDetails(ticket)} className="text-gray-500 hover:text-blue-700 dark:hover:text-blue-400 mr-4 transition-colors" title="View Details"><Eye className="w-5 h-5"/></button>
            {canEdit && <button onClick={() => onEdit(ticket)} className="text-indigo-600 hover:text-indigo-900 dark:hover:text-indigo-400 mr-4 transition-colors" title="Edit Issue"><Edit className="w-5 h-5"/></button>}
            {canClose && <button onClick={() => onCloseTicket(ticket)} className="text-green-600 hover:text-green-900 dark:hover:text-green-400 mr-4 transition-colors" title="Close Issue"><CheckCircle className="w-5 h-5"/></button>}
            {canDelete && <button onClick={() => onDelete(ticket.id)} className="text-red-600 hover:text-red-900 dark:hover:text-red-400 transition-colors" title="Delete Issue"><Trash2 className="w-5 h-5"/></button>}
        </td>
    </tr>);
};

const formatDateForInput = (date) => {
    if (!date) return "";
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
};

const TicketForm = ({ isOpen, onClose, onSave, ticket, user, showToast }) => {
    // CHANGE 2: Removed "Cleve Hill" and "Whirlbush" from the client list.
    const clientList = ['Metlen', 'Amresco', 'Puresky', 'Clean Leaf'];
    const initialState = { teamMember: user.name || user.email, siteName: 'Defford', status: 'Open', description: '', updatedInTeams: 'No', updatedViaEmail: 'No', fiixTicket: '', pcsTicket: '', sungrowTicket: '', emailed: 'No', additionalNotes: '', clientName: 'Metlen', priority: 'Medium', issueStartTime: '', issueEndTime: '' };
    const [formData, setFormData] = useState(initialState);
    
    useEffect(() => {
        if (ticket) {
            setFormData({ 
                ...initialState, 
                ...ticket,
                issueStartTime: formatDateForInput(ticket.issueStartTime),
                issueEndTime: formatDateForInput(ticket.issueEndTime),
            });
        } else {
            setFormData(initialState);
        }
    }, [ticket, user]);

    const handleChange = (e) => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));
    
    const handleSubmit = (e) => { 
        e.preventDefault(); 
        
        if (formData.status === 'Closed' && !formData.issueEndTime) {
            showToast('error', 'Please provide a manual "Issue End Time" before closing the issue.');
            return;
        }
        
        onSave(formData); 
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 transition-opacity">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-full overflow-y-auto transform transition-all scale-95 opacity-0 animate-fade-in-up">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 sm:p-8">
                        <div className="flex justify-between items-start"><h2 className="text-2xl font-bold text-gray-900 dark:text-white">{ticket ? 'Edit Issue' : 'Create New Issue'}</h2><button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-6 h-6" /></button></div>
                        <div className="mt-6 space-y-6">
                            <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6 border p-4 rounded-lg dark:border-gray-700">
                                <legend className="text-sm font-medium text-gray-600 dark:text-gray-400 px-2">Client Details</legend>
                                <div>
                                    <label htmlFor="clientName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Client Name</label>
                                    <select name="clientName" value={formData.clientName} onChange={handleChange} required className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white">
                                        {clientList.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div><label htmlFor="siteName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Site Name</label><select name="siteName" value={formData.siteName} onChange={handleChange} required className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white">{['Defford', 'Whirlbush', 'Cleve Hill'].map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                            </fieldset>
                            
                            <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6 border p-4 rounded-lg dark:border-gray-700">
                                <legend className="text-sm font-medium text-gray-600 dark:text-gray-400 px-2">Issue Details</legend>
                                <div className="md:col-span-2"><label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label><textarea name="description" rows="3" value={formData.description} onChange={handleChange} required className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"></textarea></div>
                                
                                <div><label htmlFor="issueStartTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Issue Start Time (Manual)</label><input type="datetime-local" name="issueStartTime" value={formData.issueStartTime} onChange={handleChange} required className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"/></div>
                                <div><label htmlFor="issueEndTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Issue End Time (Manual)</label><input type="datetime-local" name="issueEndTime" value={formData.issueEndTime} onChange={handleChange} className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"/></div>

                                <div><label htmlFor="teamMember" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Team Member</label><input type="text" name="teamMember" value={formData.teamMember} onChange={handleChange} required className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-gray-100 dark:bg-gray-600" readOnly /></div>
                                <div><label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label><select name="priority" value={formData.priority} onChange={handleChange} required className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white">{['Low', 'Medium', 'High', 'Urgent'].map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className={`${(formData.status === 'Closed' && ticket?.closedByName) ? 'col-span-1' : 'col-span-2'}`}><label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label><select name="status" value={formData.status} onChange={handleChange} required className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white">{['Open', 'In Progress', 'Closed'].map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                                    {/* CHANGE 1: "Closed By" field now only shows if the status in the form is "Closed". */}
                                    {(formData.status === 'Closed' && ticket?.closedByName) && ( <div className="col-span-1"><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Closed By</label><div className="mt-1 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 truncate" title={ticket.closedByName}>{ticket.closedByName}</div></div> )}
                                </div>
                                
                                {formData.siteName === 'Defford' ? ( <div><label htmlFor="pcsTicket" className="block text-sm font-medium text-gray-700 dark:text-gray-300">POS Ticket</label><input type="text" name="pcsTicket" value={formData.pcsTicket} onChange={handleChange} required className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white" /></div> ) : ( <div><label htmlFor="sungrowTicket" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sungrow Ticket</label><input type="text" name="sungrowTicket" value={formData.sungrowTicket} onChange={handleChange} required className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white" /></div> )}

                                <div><label htmlFor="fiixTicket" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fixx Ticket</label><input type="text" name="fiixTicket" value={formData.fiixTicket} onChange={handleChange} required className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white" /></div>
                                <div><label htmlFor="updatedInTeams" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Updated in Teams</label><select name="updatedInTeams" value={formData.updatedInTeams} onChange={handleChange} required className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"><option>Yes</option><option>No</option></select></div>
                                
                                <div><label htmlFor="updatedViaEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Updated Via Email</label><select name="updatedViaEmail" value={formData.updatedViaEmail} onChange={handleChange} required className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"><option>Yes</option><option>No</option></select></div>

                                <div className="md:col-span-2"><label htmlFor="additionalNotes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Additional Notes</label><textarea name="additionalNotes" rows="3" value={formData.additionalNotes} onChange={handleChange} className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"></textarea></div>
                            </fieldset>
                        </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 flex justify-end space-x-3 rounded-b-xl"><button type="button" onClick={onClose} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Cancel</button><button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Save Issue</button></div>
                </form>
            </div>
            <style>{`@keyframes fade-in-up { from { opacity: 0; transform: scale(0.95) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } } .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }`}</style>
        </div>
    );
};

const LiveDuration = ({ startTime, endTime }) => {
    const [duration, setDuration] = useState(() => formatDuration(startTime, endTime));
    
    useEffect(() => {
        if (endTime) {
            setDuration(formatDuration(startTime, endTime));
            return;
        }
        const timer = setInterval(() => {
            setDuration(formatDuration(startTime, null));
        }, 1000); 

        return () => clearInterval(timer);
    }, [startTime, endTime]);

    return <span className="font-mono text-base">{duration}</span>;
};


const TicketDetailModal = ({ isOpen, onClose, ticket }) => {
    if (!isOpen) return null;

    const DetailItem = ({ icon, label, value, children, className = '' }) => (
        <div className={`flex items-start ${className}`}>
            <div className="flex-shrink-0 w-6 text-center">
                {icon && React.createElement(icon, { className: 'w-4 h-4 text-gray-400 dark:text-gray-500 mt-1' })}
            </div>
            <div className="ml-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">{label}</p>
                <div className="text-gray-900 dark:text-white text-sm mt-0.5">{children || value || '—'}</div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 transition-opacity">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col transform transition-all scale-95 opacity-0 animate-fade-in-up">
                <div className="p-6 border-b dark:border-gray-700 flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Issue Details</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">ID: {ticket.id}</p>
                    </div>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-6 h-6" /></button>
                </div>
                
                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Core Details Section */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 border-b dark:border-gray-600 pb-2">Core Information</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-5 gap-x-4">
                            <DetailItem icon={Users} label="Client & Site" value={`${ticket.clientName} - ${ticket.siteName}`} />
                            <DetailItem icon={CheckCircle} label="Status" value={ticket.status} />
                            <DetailItem icon={Flag} label="Priority" value={ticket.priority} />
                            <DetailItem icon={UserCircle} label="Team Member" value={ticket.teamMember} />
                            {ticket.closedByName && <DetailItem icon={Lock} label="Closed By" value={ticket.closedByName} />}
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                             <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 border-b dark:border-gray-600 pb-2 mb-2">Issue Description</h3>
                             <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg text-sm">{ticket.description}</p>
                        </div>
                        {ticket.additionalNotes && (
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 border-b dark:border-gray-600 pb-2 mb-2">Additional Notes</h3>
                                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg text-sm">{ticket.additionalNotes}</p>
                            </div>
                        )}
                    </div>
                    
                     {/* Timestamps Section */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 border-b dark:border-gray-600 pb-2">Timestamps & Duration</h3>
                         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-5 gap-x-4">
                            <DetailItem icon={Clock} label="Manual Start Time" value={ticket.issueStartTime ? new Date(ticket.issueStartTime).toLocaleString() : 'N/A'} />
                            <DetailItem icon={Clock} label="Manual End Time" value={ticket.issueEndTime ? new Date(ticket.issueEndTime).toLocaleString() : 'N/A'} />
                            <DetailItem icon={Clock} label="Manual Response Time" value={formatDuration(ticket.issueStartTime, ticket.issueEndTime)} />
                            <DetailItem icon={Clock} label="System Create Time" value={ticket.timestamp ? new Date(ticket.timestamp).toLocaleString() : 'N/A'} />
                            <DetailItem icon={Clock} label="System Close Time" value={ticket.actualClosedAt ? new Date(ticket.actualClosedAt).toLocaleString() : 'N/A'} />
                            <DetailItem icon={Clock} label="System Duration"><LiveDuration startTime={ticket.timestamp} endTime={ticket.actualClosedAt} /></DetailItem>
                        </div>
                    </div>

                    {/* Communication & External Tickets */}
                     <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 border-b dark:border-gray-600 pb-2">Tracking & Communication</h3>
                         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-5 gap-x-4">
                            <DetailItem icon={Check} label="Updated in Teams" value={ticket.updatedInTeams} />
                            <DetailItem icon={Mail} label="Updated via Email" value={ticket.updatedViaEmail} />
                            {ticket.siteName === 'Defford' ? (
                                <DetailItem label="POS Ticket #" value={ticket.pcsTicket} />
                            ) : (
                                <DetailItem label="Sungrow Ticket #" value={ticket.sungrowTicket} />
                            )}
                            <DetailItem label="Fixx Ticket #" value={ticket.fiixTicket} />
                        </div>
                    </div>

                </div>

                <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 flex justify-end rounded-b-xl border-t dark:border-gray-700 mt-auto">
                    <button type="button" onClick={onClose} className="bg-blue-600 text-white py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Close</button>
                </div>
            </div>
            <style>{`@keyframes fade-in-up { from { opacity: 0; transform: scale(0.95) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } } .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }`}</style>
        </div>
    );
};


// --- Remaining components (CloseConfirmationModal, DeleteConfirmationModal, etc.) ---
// --- These are unchanged but included for completeness. ---

const CloseConfirmationModal = ({ isOpen, onClose, onConfirm, ticket }) => {
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            await onConfirm(password);
        } catch (e) {
            setError(e.message.includes('wrong-password') ? 'Incorrect password. Please try again.' : 'An error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 transition-opacity">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md transform transition-all scale-95 opacity-0 animate-fade-in-up">
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <div className="text-center">
                            <Lock className="mx-auto h-12 w-12 text-blue-500" />
                            <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">Confirm Close Issue</h3>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                You are about to close the issue for client: <span className="font-semibold">{ticket?.clientName}</span>.
                            </p>
                            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Please enter your password to confirm this action.</p>
                        </div>
                        <div className="mt-4">
                            <label htmlFor="password-close" className="sr-only">Password</label>
                            <input type="password" name="password" id="password-close" value={password} onChange={(e) => setPassword(e.target.value)} required className="block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white" placeholder="Enter your password"/>
                        </div>
                        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-3 flex justify-end space-x-3 rounded-b-xl">
                        <button type="button" onClick={onClose} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600">Cancel</button>
                        <button type="submit" disabled={isLoading} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300">
                            {isLoading ? 'Closing...' : 'Confirm Close'}
                        </button>
                    </div>
                </form>
            </div>
             <style>{`@keyframes fade-in-up { from { opacity: 0; transform: scale(0.95) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } } .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }`}</style>
        </div>
    );
};

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, count, isPermanent }) => {
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            await onConfirm(password);
        } catch (e) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 transition-opacity">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md transform transition-all scale-95 opacity-0 animate-fade-in-up">
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <div className="text-center">
                            <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
                            <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">Confirm Deletion</h3>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                You are about to {isPermanent ? 'permanently delete' : 'move to trash'} {count} issue(s). 
                                {isPermanent && <span className="font-bold"> This action cannot be undone.</span>}
                            </p>
                            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Please enter your password to confirm.</p>
                        </div>
                        <div className="mt-4">
                            <label htmlFor="password-confirm" className="sr-only">Password</label>
                            <input type="password" name="password" id="password-confirm" value={password} onChange={(e) => setPassword(e.target.value)} required className="block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500 bg-white dark:bg-gray-700 dark:text-white" placeholder="Enter your password"/>
                        </div>
                        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-3 flex justify-end space-x-3 rounded-b-xl">
                        <button type="button" onClick={onClose} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600">Cancel</button>
                        <button type="submit" disabled={isLoading} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-red-300">
                            {isLoading ? 'Deleting...' : 'Confirm Delete'}
                        </button>
                    </div>
                </form>
            </div>
             <style>{`@keyframes fade-in-up { from { opacity: 0; transform: scale(0.95) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } } .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }`}</style>
        </div>
    );
};

const TrashList = ({ tickets, onRestore, onPermanentDelete, selectedTickets, onSelectTicket, onSelectAllTickets }) => {
    if (tickets.length === 0) return <p className="text-center py-16 text-gray-500 dark:text-gray-400">The trash bin is empty.</p>;
    return (<div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="px-6 py-3 text-left"><input type="checkbox" className="rounded dark:bg-gray-900 dark:border-gray-600" onChange={onSelectAllTickets} checked={tickets.length > 0 && selectedTickets.length === tickets.length} /></th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Issue Details</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Deleted At</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th></tr></thead><tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">{tickets.map(ticket => <TrashRow key={ticket.id} ticket={ticket} onRestore={onRestore} onPermanentDelete={onPermanentDelete} isSelected={selectedTickets.includes(ticket.id)} onSelectTicket={onSelectTicket} />)}</tbody></table></div>);
};

const TrashRow = ({ ticket, onRestore, onPermanentDelete, isSelected, onSelectTicket }) => (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
        <td className="px-6 py-4"><input type="checkbox" className="rounded dark:bg-gray-900 dark:border-gray-600" checked={isSelected} onChange={() => onSelectTicket(ticket.id)} /></td>
        <td className="px-6 py-4 max-w-sm"><div className="text-sm font-semibold text-gray-900 dark:text-white">{ticket.clientName}</div><p className="text-sm text-gray-500 dark:text-gray-400 truncate">{ticket.description}</p></td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{ticket.deletedAt ? new Date(ticket.deletedAt).toLocaleString() : 'N/A'}</td>
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <button onClick={() => onRestore(ticket.id)} className="text-green-600 hover:text-green-900 dark:hover:text-green-400 mr-4 transition-colors"><ArchiveRestore className="w-5 h-5"/></button>
            <button onClick={() => onPermanentDelete(ticket.id)} className="text-red-600 hover:text-red-900 dark:hover:text-red-400 transition-colors"><Trash2 className="w-5 h-5"/></button>
        </td>
    </tr>
);

const ProfilePage = ({ user, auth, db, showToast }) => {
    const [name, setName] = useState(user.name || '');
    const [phone, setPhone] = useState(user.phone || '');
    const [employeeId, setEmployeeId] = useState(user.employeeId || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await updateProfile(auth.currentUser, { displayName: name });
            const userDocRef = doc(db, `/artifacts/${appId}/public/data/users`, user.uid);
            await updateDoc(userDocRef, { name, phone, employeeId });
            showToast('success', 'Profile updated successfully!');
        } catch (error) {
            console.error("Error updating profile:", error);
            showToast('error', 'Failed to update profile.');
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">My Profile</h2>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border dark:border-gray-700">
                <form onSubmit={handleProfileUpdate} className="space-y-4">
                    <div>
                        <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                        <input id="profile-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white" />
                    </div>
                     <div>
                        <label htmlFor="profile-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                        <input id="profile-email" type="email" value={user.email} disabled className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-gray-100 dark:bg-gray-700 dark:text-gray-400" />
                    </div>
                     <div>
                        <label htmlFor="profile-phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone Number</label>
                        <input id="profile-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white" />
                    </div>
                     <div>
                        <label htmlFor="profile-employeeId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Employee ID</label>
                        <input id="profile-employeeId" type="text" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white" />
                    </div>
                    <div className="flex justify-end">
                        <button type="submit" disabled={isSaving} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400">
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
