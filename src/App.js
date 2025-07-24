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
    ArrowUpDown, PlusCircle, Search, Trash2, Edit, X, PieChart, List, FileDown, Users, Eye, Mail, Phone, Upload, LogOut, Lock, Sun, Moon, AlertTriangle, CheckCircle, Info, Clock, ArchiveRestore, UserCircle
} from 'lucide-react';

// --- Firebase Configuration ---
// IMPORTANT: Replace this with your own Firebase project configuration!
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

// --- Theme Context for Dark/Light Mode ---
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

// --- Main App Component (Authentication Router) ---
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


// --- Login Screen Component ---
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
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Issue Tracker</h1>
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
    const [isLoading, setIsLoading] = useState(true);
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
            setIsLoading(true);
            const ticketsCollectionPath = `/artifacts/${appId}/public/data/tickets`;
            const trashCollectionPath = `/artifacts/${appId}/public/data/trash`;
            
            const ticketsQuery = query(collection(db, ticketsCollectionPath));
            const trashQuery = query(collection(db, trashCollectionPath));

            const unsubTickets = onSnapshot(ticketsQuery, (snapshot) => {
                const ticketsData = snapshot.docs.map(doc => {
                    const data = doc.data();
                    const safeGetDate = (fieldValue) => fieldValue?.toDate ? fieldValue.toDate() : null;
                    return { id: doc.id, ...data, timestamp: safeGetDate(data.timestamp), issueStartTime: safeGetDate(data.issueStartTime), issueEndTime: safeGetDate(data.issueEndTime) };
                });
                setTickets(ticketsData);
                if(view !== 'trash') setIsLoading(false);
            }, (err) => { console.error("Firestore snapshot error (tickets):", err); showToast("error", "Failed to fetch tickets."); setIsLoading(false); });

            const unsubTrash = onSnapshot(trashQuery, (snapshot) => {
                const trashedData = snapshot.docs.map(doc => {
                    const data = doc.data();
                    const safeGetDate = (fieldValue) => fieldValue?.toDate ? fieldValue.toDate() : null;
                    return { id: doc.id, ...data, deletedAt: safeGetDate(data.deletedAt) };
                });
                setTrashedTickets(trashedData);
                 if(view === 'trash') setIsLoading(false);
            }, (err) => { console.error("Firestore snapshot error (trash):", err); showToast("error", "Failed to fetch trashed tickets."); setIsLoading(false); });

            return () => { unsubTickets(); unsubTrash(); };
        }
    }, [db, view]);

    const filteredAndSortedTickets = useMemo(() => {
        const source = view === 'trash' ? trashedTickets : tickets;
        let processedTickets = [...source];
        processedTickets = processedTickets.filter(ticket => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = ['clientName', 'description', 'customTicketNumber', 'technicianName', 'teamMember'].some(field => ticket[field]?.toLowerCase().includes(searchLower));
            const matchesStatus = statusFilter === 'All' || ticket.status === statusFilter;
            return matchesSearch && (view === 'trash' || matchesStatus);
        });
        if (sortConfig.key) {
            processedTickets.sort((a, b) => {
                const aValue = a[sortConfig.key]; const bValue = b[sortConfig.key];
                if (aValue === null || aValue === undefined) return 1; if (bValue === null || bValue === undefined) return -1;
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return processedTickets;
    }, [tickets, trashedTickets, searchTerm, statusFilter, sortConfig, view]);

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

    const handleSelectTicket = (ticketId) => {
        const targetState = view === 'trash' ? setSelectedTrashedTickets : setSelectedTickets;
        targetState(prev => 
            prev.includes(ticketId) ? prev.filter(id => id !== ticketId) : [...prev, ticketId]
        );
    };

    const handleSelectAllTickets = () => {
        const targetState = view === 'trash' ? setSelectedTrashedTickets : setSelectedTickets;
        const selectedState = view === 'trash' ? selectedTrashedTickets : selectedTickets;
        if (selectedState.length === filteredAndSortedTickets.length) {
            targetState([]);
        } else {
            targetState(filteredAndSortedTickets.map(t => t.id));
        }
    };

    const handleSaveTicket = async (ticketData) => {
        if (!db) { showToast("error", "Database not connected."); return; }
        const ticketsCollectionPath = `/artifacts/${appId}/public/data/tickets`;
        try {
            const dataToSave = { ...ticketData };
            if (selectedTicket) {
                const ticketRef = doc(db, ticketsCollectionPath, selectedTicket.id);
                if ((dataToSave.status === 'Closed' || dataToSave.status === 'Completed') && !selectedTicket.issueEndTime) {
                    dataToSave.issueEndTime = serverTimestamp();
                } else if (dataToSave.status === 'Open' || dataToSave.status === 'In Progress') {
                    dataToSave.issueEndTime = null;
                }
                delete dataToSave.timestamp; 
                delete dataToSave.issueStartTime;
                await updateDoc(ticketRef, dataToSave);
                showToast("success", "Ticket updated successfully!");
            } else {
                await addDoc(collection(db, ticketsCollectionPath), { ...dataToSave, timestamp: serverTimestamp(), issueStartTime: serverTimestamp(), issueEndTime: null, authorId: user.uid, authorEmail: user.email });
                showToast("success", "Ticket created successfully!");
            }
            closeEditModal();
        } catch (e) { console.error("Error saving ticket:", e); showToast("error", "Failed to save ticket."); }
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
            showToast("info", `${ticketsToDelete.length} ticket(s) moved to trash.`);
            closeDeleteModal();
            setSelectedTickets([]);
        } catch (e) {
            console.error("Error moving tickets to trash:", e);
            showToast("error", "Failed to move tickets to trash.");
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
            showToast("success", `${ticketsToDelete.length} ticket(s) permanently deleted.`);
            closeDeleteModal();
            setSelectedTrashedTickets([]);
        } catch (e) {
            console.error("Error permanently deleting tickets:", e);
            showToast("error", "Failed to permanently delete tickets.");
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
                showToast("success", "Ticket restored successfully.");
            } catch (e) {
                console.error("Error restoring ticket:", e);
                showToast("error", "Failed to restore ticket.");
            }
        }
    };

    const handleImport = (file) => { /* ... implementation ... */ };

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
                        selectedTickets={view === 'trash' ? selectedTrashedTickets : selectedTickets}
                        onBulkDelete={() => openDeleteModal(selectedTickets, false)}
                        onBulkPermanentDelete={() => openDeleteModal(selectedTrashedTickets, true)}
                        showToast={showToast}
                    />
                    {view !== 'dashboard' && view !== 'profile' && <FilterControls searchTerm={searchTerm} setSearchTerm={setSearchTerm} statusFilter={statusFilter} setStatusFilter={setStatusFilter} view={view} />}
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

                {isEditModalOpen && <TicketForm isOpen={isEditModalOpen} onClose={closeEditModal} onSave={handleSaveTicket} ticket={selectedTicket} user={user} />}
                {isDetailModalOpen && <TicketDetailModal isOpen={isDetailModalOpen} onClose={closeDetailModal} ticket={selectedTicket} />}
                {isDeleteModalOpen && <DeleteConfirmationModal isOpen={isDeleteModalOpen} onClose={closeDeleteModal} onConfirm={handleConfirmDelete} count={ticketsToDelete.length} isPermanent={isPermanentDelete} />}
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
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">AI Issue Tracker</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Your shared workspace for managing support tickets.</p>
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
                    <PlusCircle className="w-5 h-5 mr-2" /> New Ticket
                </button>
            </div>
        </div>
         <div className="mt-5 bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-400 text-purple-900 dark:text-purple-300 p-3.5 rounded-r-lg flex items-center text-sm shadow-sm">
            <Lock className="w-6 h-6 mr-4 flex-shrink-0 text-purple-500" />
            <p><span className="font-semibold">Action Required:</span> For login to work, enable 'Email/Password' in your Firebase Authentication settings.</p>
        </div>
    </header>
);
};

const Toolbar = ({ view, setView, tickets, librariesLoaded, onImport, user, selectedTickets, onBulkDelete, onBulkPermanentDelete, showToast }) => {
    const importInputRef = useRef(null);
    
    const exportToCSV = () => {
        if (!librariesLoaded.csv) {
            showToast('error', 'CSV library not loaded yet.');
            return;
        }
        if (tickets.length === 0) {
            showToast('info', 'There is no data to export.');
            return;
        }

        const headers = ['Client Name', 'Description', 'Status', 'Priority', 'Team Member', 'Created Date', 'Closed Date'];
        const data = tickets.map(t => ({
            'Client Name': t.clientName,
            'Description': t.description,
            'Status': t.status,
            'Priority': t.priority,
            'Team Member': t.teamMember,
            'Created Date': t.timestamp ? new Date(t.timestamp).toLocaleString() : 'N/A',
            'Closed Date': t.issueEndTime ? new Date(t.issueEndTime).toLocaleString() : 'N/A'
        }));

        const csv = window.Papa.unparse({ fields: headers, data: data });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "tickets.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('success', 'CSV export started.');
    };

    const exportToPDF = () => {
        if (!librariesLoaded.pdf) {
            showToast('error', 'PDF library not loaded yet.');
            return;
        }
         if (tickets.length === 0) {
            showToast('info', 'There is no data to export.');
            return;
        }

        const doc = new window.jspdf.jsPDF();
        const tableColumn = ["Client", "Description", "Status", "Priority", "Created"];
        const tableRows = [];

        tickets.forEach(ticket => {
            const ticketData = [
                ticket.clientName,
                ticket.description.substring(0, 40) + '...',
                ticket.status,
                ticket.priority,
                ticket.timestamp ? new Date(ticket.timestamp).toLocaleDateString() : 'N/A'
            ];
            tableRows.push(ticketData);
        });

        doc.autoTable(tableColumn, tableRows, { startY: 20 });
        doc.text("Issue Tracker Tickets", 14, 15);
        doc.save("tickets.pdf");
        showToast('success', 'PDF export started.');
    };

    const handleImportClick = () => { importInputRef.current.click(); };
    const handleFileChange = (event) => { const file = event.target.files[0]; onImport(file); event.target.value = null; };

    return (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center bg-gray-50/50 dark:bg-gray-800/20 rounded-t-xl">
            <div className="flex items-center space-x-1 bg-gray-200 dark:bg-gray-700 p-1 rounded-lg mb-3 sm:mb-0">
                <button onClick={() => setView('dashboard')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${view === 'dashboard' ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-600/50'}`}><PieChart className="w-4 h-4 inline-block mr-2"/>Dashboard</button>
                <button onClick={() => setView('list')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${view === 'list' ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-600/50'}`}><List className="w-4 h-4 inline-block mr-2"/>Ticket List</button>
                {user.role === 'admin' && <button onClick={() => setView('trash')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${view === 'trash' ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-600/50'}`}><Trash2 className="w-4 h-4 inline-block mr-2"/>Trash</button>}
            </div>
            <div className="flex items-center space-x-3">
                {user.role === 'admin' && selectedTickets.length > 0 && view === 'list' && (
                    <button onClick={onBulkDelete} className="flex items-center text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 bg-red-100 dark:bg-red-900/20 px-3 py-1.5 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4 mr-1.5"/>Delete Selected ({selectedTickets.length})
                    </button>
                )}
                 {user.role === 'admin' && selectedTickets.length > 0 && view === 'trash' && (
                    <button onClick={onBulkPermanentDelete} className="flex items-center text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 bg-red-100 dark:bg-red-900/20 px-3 py-1.5 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4 mr-1.5"/>Delete Permanently ({selectedTickets.length})
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

const FilterControls = ({ searchTerm, setSearchTerm, statusFilter, setStatusFilter, view }) => (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-gray-200 dark:border-gray-700">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" placeholder="Search tickets..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-white"/></div>
        {view === 'list' && <div><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-white"><option value="All">All Statuses</option><option>Open</option><option>In Progress</option><option>Closed</option></select></div>}
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6"><StatCard title="Total Tickets" value={stats.total} /><StatCard title="Open Tickets" value={stats.open} /><StatCard title="Closed Tickets" value={stats.closed} /><StatCard title="Urgent Open" value={stats.highPriority} /></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><ChartCard title="Tickets by Status" data={stats.byStatus} /><ChartCard title="Tickets by Priority" data={stats.byPriority} /></div>
        </div>
    );
};

const StatCard = ({ title, value }) => (<div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-sm"><p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p><p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{value}</p></div>);
const ChartCard = ({ title, data }) => {
    const total = Object.values(data).reduce((sum, val) => sum + val, 0);
    const colors = { 'Open': 'bg-blue-400', 'In Progress': 'bg-yellow-400', 'Closed': 'bg-gray-400', 'High': 'bg-red-400', 'Medium': 'bg-orange-400', 'Low': 'bg-teal-400' };
    return (<div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-sm"><h3 className="font-semibold text-gray-800 dark:text-white mb-4">{title}</h3><div className="space-y-3">{Object.entries(data).map(([key, value]) => (<div key={key}><div className="flex justify-between text-sm mb-1"><span className="font-medium text-gray-600 dark:text-gray-300">{key}</span><span className="text-gray-500 dark:text-gray-400">{value}</span></div><div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5"><div className={`${colors[key] || 'bg-gray-500'} h-2.5 rounded-full`} style={{ width: `${total > 0 ? (value / total) * 100 : 0}%` }}></div></div></div>))}</div></div>);
};

const TicketList = ({ tickets, user, onEdit, onDelete, onViewDetails, requestSort, sortConfig, selectedTickets, onSelectTicket, onSelectAllTickets }) => {
    if (tickets.length === 0) return <p className="text-center py-16 text-gray-500 dark:text-gray-400">No tickets found.</p>;
    const getSortIndicator = (key) => { if (sortConfig.key === key) return sortConfig.direction === 'ascending' ? '▲' : '▼'; return <ArrowUpDown className="w-4 h-4 inline-block ml-1 text-gray-400" />; };
    return (<div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-700"><tr>{user.role === 'admin' && <th className="px-6 py-3 text-left"><input type="checkbox" className="rounded dark:bg-gray-900 dark:border-gray-600" onChange={onSelectAllTickets} checked={tickets.length > 0 && selectedTickets.length === tickets.length} /></th>}<th onClick={() => requestSort('clientName')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer">Ticket Details {getSortIndicator('clientName')}</th><th onClick={() => requestSort('status')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer">Status {getSortIndicator('status')}</th><th onClick={() => requestSort('priority')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer">Priority {getSortIndicator('priority')}</th><th onClick={() => requestSort('timestamp')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Created {getSortIndicator('timestamp')}</th><th onClick={() => requestSort('issueEndTime')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Closed {getSortIndicator('issueEndTime')}</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Response Time</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th></tr></thead><tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">{tickets.map(ticket => <TicketRow key={ticket.id} ticket={ticket} user={user} onEdit={onEdit} onDelete={onDelete} onViewDetails={onViewDetails} isSelected={selectedTickets.includes(ticket.id)} onSelectTicket={onSelectTicket} />)}</tbody></table></div>);
};

const TicketRow = ({ ticket, user, onEdit, onDelete, onViewDetails, isSelected, onSelectTicket }) => {
    const canEdit = user.role === 'admin' || user.uid === ticket.authorId;
    const canDelete = user.role === 'admin';

    const calculateResponseTime = (start, end) => {
        if (!end || !start) return "In Progress";
        const diffMs = new Date(end) - new Date(start);
        const days = Math.floor(diffMs / 86400000);
        const hours = Math.floor((diffMs % 86400000) / 3600000);
        const minutes = Math.floor(((diffMs % 86400000) % 3600000) / 60000);
        const seconds = Math.round((((diffMs % 86400000) % 3600000) % 60000) / 1000);
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        if (minutes > 0) return `${minutes}m ${seconds}s`;
        return `${seconds}s`;
    };

    const statusColor = { 'Open': 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300', 'In Progress': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300', 'Closed': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' };
    const priorityColor = { 'High': 'text-red-600 dark:text-red-400', 'Medium': 'text-yellow-600 dark:text-yellow-400', 'Low': 'text-green-600 dark:text-green-400' };
    
    return (<tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
        {user.role === 'admin' && <td className="px-6 py-4"><input type="checkbox" className="rounded dark:bg-gray-900 dark:border-gray-600" checked={isSelected} onChange={() => onSelectTicket(ticket.id)} /></td>}
        <td className="px-6 py-4 max-w-sm">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">{ticket.clientName}</div>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{ticket.description}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Team Member: {ticket.teamMember || 'N/A'}</p>
        </td>
        <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor[ticket.status] || 'bg-gray-100'}`}>{ticket.status}</span></td>
        <td className="px-6 py-4 whitespace-nowrap"><span className={`font-semibold ${priorityColor[ticket.priority] || ''}`}>{ticket.priority}</span></td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{ticket.timestamp ? new Date(ticket.timestamp).toLocaleString() : 'N/A'}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{ticket.issueEndTime && ticket.status === 'Closed' ? new Date(ticket.issueEndTime).toLocaleString() : '—'}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{calculateResponseTime(ticket.issueStartTime, ticket.issueEndTime)}</td>
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <button onClick={() => onViewDetails(ticket)} className="text-gray-500 hover:text-blue-700 dark:hover:text-blue-400 mr-4 transition-colors"><Eye className="w-5 h-5"/></button>
            {canEdit && <button onClick={() => onEdit(ticket)} className="text-indigo-600 hover:text-indigo-900 dark:hover:text-indigo-400 mr-4 transition-colors"><Edit className="w-5 h-5"/></button>}
            {canDelete && <button onClick={() => onDelete(ticket.id)} className="text-red-600 hover:text-red-900 dark:hover:text-red-400 transition-colors"><Trash2 className="w-5 h-5"/></button>}
        </td>
    </tr>);
};

const TicketForm = ({ isOpen, onClose, onSave, ticket, user }) => {
    const initialState = { teamMember: user.name || user.email, inverter: '1', modules: '1', status: 'Open', description: '', updatedInTeams: '', fiixTicket: '', pcsTicket: '', emailed: 'No', additionalNotes: '', clientName: '', clientLocation: '', technicianName: '', technicianPhone: '', priority: 'Medium' };
    const [formData, setFormData] = useState(initialState);

    const inverterOptions = ['1', '2A', '2B', '3A', '3C', '4', '5', '6', '7', '8', '9A', '9B'];
    const moduleOptions = ['1', '2', '3', '4', '5', '6'];
    const statusOptions = ['Open', 'In Progress', 'Closed'];
    const priorityOptions = ['Low', 'Medium', 'High', 'Urgent'];
    const clientLocationOptions = ['Location A', 'Location B', 'Location C']; // Placeholder locations

    useEffect(() => {
        if (ticket) {
            setFormData({ ...initialState, ...ticket });
        } else {
            setFormData(initialState);
        }
    }, [ticket, user]);

    const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
    const handleSubmit = (e) => { e.preventDefault(); onSave(formData); };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 transition-opacity">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-full overflow-y-auto transform transition-all scale-95 opacity-0 animate-fade-in-up">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 sm:p-8">
                        <div className="flex justify-between items-start"><h2 className="text-2xl font-bold text-gray-900 dark:text-white">{ticket ? 'Edit Ticket' : 'Create New Ticket'}</h2><button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-6 h-6" /></button></div>
                        <div className="mt-6 space-y-6">
                            <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6 border p-4 rounded-lg dark:border-gray-700"><legend className="text-sm font-medium text-gray-600 dark:text-gray-400 px-2">Client Details</legend><div><label htmlFor="clientName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Client Name</label><input type="text" name="clientName" value={formData.clientName} onChange={handleChange} required className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white" /></div><div><label htmlFor="clientLocation" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Client Location</label><select name="clientLocation" value={formData.clientLocation} onChange={handleChange} className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white">{clientLocationOptions.map(o => <option key={o} value={o}>{o}</option>)}</select></div></fieldset>
                            <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6 border p-4 rounded-lg dark:border-gray-700"><legend className="text-sm font-medium text-gray-600 dark:text-gray-400 px-2">Technician Details</legend><div><label htmlFor="technicianName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Technician Name</label><input type="text" name="technicianName" value={formData.technicianName} onChange={handleChange} className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white" /></div><div><label htmlFor="technicianPhone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Technician Phone</label><input type="tel" name="technicianPhone" value={formData.technicianPhone} onChange={handleChange} className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white" /></div></fieldset>
                            <fieldset className="grid grid-cols-1 md:grid-cols-4 gap-6 border p-4 rounded-lg dark:border-gray-700"><legend className="text-sm font-medium text-gray-600 dark:text-gray-400 px-2">Issue Details</legend>
                                <div className="md:col-span-1"><label htmlFor="teamMember" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Team Member</label><input type="text" name="teamMember" value={formData.teamMember} onChange={handleChange} required className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-gray-100 dark:bg-gray-600" readOnly /></div>
                                <div className="md:col-span-1"><label htmlFor="inverter" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Inverter</label><select name="inverter" value={formData.inverter} onChange={handleChange} className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white">{inverterOptions.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                                <div className="md:col-span-1"><label htmlFor="modules" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Modules</label><select name="modules" value={formData.modules} onChange={handleChange} className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white">{moduleOptions.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                                <div className="md:col-span-1"><label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label><select name="priority" value={formData.priority} onChange={handleChange} className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white">{priorityOptions.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                                <div className="md:col-span-4"><label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label><select name="status" value={formData.status} onChange={handleChange} className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white">{statusOptions.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                                <div className="md:col-span-4"><label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label><textarea name="description" rows="3" value={formData.description} onChange={handleChange} className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"></textarea></div>
                                <div><label htmlFor="updatedInTeams" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Updated in Teams</label><select name="updatedInTeams" value={formData.updatedInTeams} onChange={handleChange} className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"><option>Yes</option><option>No</option></select></div>
                                <div><label htmlFor="fiixTicket" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fix Ticket</label><input type="text" name="fiixTicket" value={formData.fiixTicket} onChange={handleChange} className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white" /></div>
                                <div><label htmlFor="pcsTicket" className="block text-sm font-medium text-gray-700 dark:text-gray-300">POS Ticket</label><input type="text" name="pcsTicket" value={formData.pcsTicket} onChange={handleChange} className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white" /></div>
                                <div><label htmlFor="emailed" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Emailed</label><select name="emailed" value={formData.emailed} onChange={handleChange} className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"><option>Yes</option><option>No</option></select></div>
                                <div className="md:col-span-4"><label htmlFor="additionalNotes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Additional Notes</label><textarea name="additionalNotes" rows="3" value={formData.additionalNotes} onChange={handleChange} className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:text-white"></textarea></div>
                            </fieldset>
                        </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 flex justify-end space-x-3 rounded-b-xl"><button type="button" onClick={onClose} className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Cancel</button><button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Save Ticket</button></div>
                </form>
            </div>
            <style>{`@keyframes fade-in-up { from { opacity: 0; transform: scale(0.95) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } } .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }`}</style>
        </div>
    );
};

const LiveDuration = ({ startTime, endTime }) => {
    const calculateDuration = (start, end) => {
        if (!start) return "Not Started";
        const diffMs = new Date(end) - new Date(start);

        let totalSeconds = Math.floor(diffMs / 1000);
        const days = Math.floor(totalSeconds / 86400);
        totalSeconds %= 86400;
        const hours = Math.floor(totalSeconds / 3600);
        totalSeconds %= 3600;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        const paddedHours = String(hours).padStart(2, '0');
        const paddedMinutes = String(minutes).padStart(2, '0');
        const paddedSeconds = String(seconds).padStart(2, '0');

        let durationString = `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
        if (days > 0) {
            durationString = `${days}d ${durationString}`;
        }
        return durationString;
    };
    
    const [duration, setDuration] = useState(() => calculateDuration(startTime, endTime || new Date()));

    useEffect(() => {
        if (endTime) {
            // If the ticket is closed, set the final duration and do nothing more.
            setDuration(calculateDuration(startTime, endTime));
        } else {
            // If the ticket is open, start a live timer.
            const timer = setInterval(() => {
                setDuration(calculateDuration(startTime, new Date()));
            }, 1000);

            // Cleanup: clear the interval when the component unmounts or dependencies change.
            return () => clearInterval(timer);
        }
    }, [startTime, endTime]);

    return <span className="font-mono">{duration}</span>;
};


const TicketDetailModal = ({ isOpen, onClose, ticket }) => {
    if (!isOpen) return null;
    const DetailItem = ({ label, value, children }) => (<div><p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">{label}</p><div className="text-gray-900 dark:text-white text-sm mt-1">{children || value || '—'}</div></div>);
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 transition-opacity">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-full overflow-y-auto transform transition-all scale-95 opacity-0 animate-fade-in-up">
                <div className="p-6 sm:p-8">
                    <div className="flex justify-between items-start"><div><h2 className="text-2xl font-bold text-gray-900 dark:text-white">Ticket Details</h2><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Ticket #{ticket.customTicketNumber || ticket.id}</p></div><button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-6 h-6" /></button></div>
                    <div className="mt-6 space-y-6">
                        <div className="border-b dark:border-gray-700 pb-4"><h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Issue Description</h3><p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{ticket.description}</p></div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <DetailItem label="Team Member" value={ticket.teamMember} />
                            <DetailItem label="Inverter" value={ticket.inverter} />
                            <DetailItem label="Modules" value={ticket.modules} />
                            <DetailItem label="Status/Issue" value={ticket.status} />
                            <DetailItem label="Start Time" value={ticket.issueStartTime ? new Date(ticket.issueStartTime).toLocaleString() : 'N/A'} />
                            <DetailItem label="End Time" value={ticket.issueEndTime ? new Date(ticket.issueEndTime).toLocaleString() : 'N/A'} />
                            <DetailItem label="Duration">
                                <LiveDuration startTime={ticket.issueStartTime} endTime={ticket.issueEndTime} />
                            </DetailItem>
                        </div>
                        <div className="border-t dark:border-gray-700 pt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                           <DetailItem label="Updated in Teams" value={ticket.updatedInTeams} />
                           <DetailItem label="Fix Ticket" value={ticket.fiixTicket} />
                           <DetailItem label="POS Ticket" value={ticket.pcsTicket} />
                           <DetailItem label="Emailed" value={ticket.emailed} />
                        </div>
                        {ticket.additionalNotes && <div className="border-t dark:border-gray-700 pt-4"><h4 className="text-md font-medium text-gray-700 dark:text-gray-200 mb-2">Additional Notes</h4><p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap text-sm bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">{ticket.additionalNotes}</p></div>}
                    </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 flex justify-end rounded-b-xl"><button type="button" onClick={onClose} className="bg-blue-600 text-white py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Close</button></div>
            </div>
            <style>{`@keyframes fade-in-up { from { opacity: 0; transform: scale(0.95) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } } .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }`}</style>
        </div>
    );
};

const LoadingSpinner = () => <div className="flex justify-center items-center py-20"><div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div></div>;
const Toast = ({ type, message, onClose }) => {
    const icons = {
        success: <CheckCircle className="w-5 h-5 text-green-500" />,
        error: <AlertTriangle className="w-5 h-5 text-red-500" />,
        info: <Info className="w-5 h-5 text-blue-500" />,
    };
    const colors = {
        success: 'bg-green-50 dark:bg-green-900/20 border-green-400',
        error: 'bg-red-50 dark:bg-red-900/20 border-red-400',
        info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-400',
    };
    return (
        <div className={`fixed top-5 right-5 z-50 max-w-sm w-full shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden ${colors[type]}`}>
            <div className="p-4">
                <div className="flex items-start">
                    <div className="flex-shrink-0">{icons[type]}</div>
                    <div className="ml-3 w-0 flex-1 pt-0.5">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{message}</p>
                    </div>
                    <div className="ml-4 flex-shrink-0 flex">
                        <button onClick={onClose} className="inline-flex rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                            <span className="sr-only">Close</span>
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>
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
                                You are about to {isPermanent ? 'permanently delete' : 'move to trash'} {count} ticket(s). 
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
    return (<div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="px-6 py-3 text-left"><input type="checkbox" className="rounded dark:bg-gray-900 dark:border-gray-600" onChange={onSelectAllTickets} checked={tickets.length > 0 && selectedTickets.length === tickets.length} /></th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Ticket Details</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Deleted At</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th></tr></thead><tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">{tickets.map(ticket => <TrashRow key={ticket.id} ticket={ticket} onRestore={onRestore} onPermanentDelete={onPermanentDelete} isSelected={selectedTickets.includes(ticket.id)} onSelectTicket={onSelectTicket} />)}</tbody></table></div>);
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