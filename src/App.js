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
    ArrowUpDown, PlusCircle, Search, Trash2, Edit, X, PieChart, List, FileDown, Users, Eye, Mail, Phone, Upload, LogOut, Lock, Sun, Moon, AlertTriangle, CheckCircle, Info, Clock, ArchiveRestore, UserCircle, MoreVertical, Ticket, FolderOpen, Hash
} from 'lucide-react';

// --- Firebase Configuration ---
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
    const toggleTheme = () => setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
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
            setLogLevel('error');

            const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                if (user) {
                    const userDocRef = doc(firestoreDb, `/artifacts/${appId}/public/data/users`, user.uid);
                    const userDoc = await getDoc(userDocRef);
                    setUser(userDoc.exists() ? { ...user, ...userDoc.data() } : { ...user, role: 'user', name: user.displayName || user.email });
                } else {
                    setUser(null);
                }
                setIsLoading(false);
            });
            return () => unsubscribe();
        } catch (e) {
            console.error("Firebase initialization error:", e);
            setError("Could not connect to services.");
            setIsLoading(false);
        }
    }, []);

    if (isLoading) {
        return <div className="flex justify-center items-center min-h-screen bg-slate-100 dark:bg-slate-900"><LoadingSpinner /></div>;
    }

    if (error) {
        return <div className="flex justify-center items-center min-h-screen bg-slate-100 dark:bg-slate-900 p-4"><Toast type="error" message={error} /></div>
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
        e.preventDefault(); setIsLoading(true); setError(''); setSuccess('');
        try {
            if (isLoginView) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, { displayName: name });
                const userDocRef = doc(db, `/artifacts/${appId}/public/data/users`, userCredential.user.uid);
                await setDoc(userDocRef, { role: 'user', email: userCredential.user.email, name: name, phone: '', employeeId: '' });
            }
        } catch (err) { setError(err.message.replace('Firebase: ', '')); } finally { setIsLoading(false); }
    };
    
    const handlePasswordReset = async (e) => {
        e.preventDefault(); setIsLoading(true); setError(''); setSuccess('');
        try {
            await sendPasswordResetEmail(auth, email);
            setSuccess('Password reset email sent! Please check your inbox.');
        } catch (err) { setError(err.message.replace('Firebase: ', '')); } finally { setIsLoading(false); }
    };

    const handleGoogleSignIn = async () => {
        setIsLoading(true); setError(''); const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            const userDocRef = doc(db, `/artifacts/${appId}/public/data/users`, user.uid);
            const userDoc = await getDoc(userDocRef);
            if (!userDoc.exists()) {
                await setDoc(userDocRef, { role: 'user', email: user.email, name: user.displayName, phone: '', employeeId: '' });
            }
        } catch (err) { setError(err.message.replace('Firebase: ', '')); } finally { setIsLoading(false); }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-100 dark:from-slate-900 dark:via-slate-800 dark:to-blue-900/20 flex flex-col justify-center items-center p-4">
            <div className="max-w-md w-full bg-white dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-2xl shadow-blue-500/10 p-8">
                <div className="text-center mb-8">
                    <h1 className="text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-500 pb-2">Issue Tracker</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">
                        {isForgotPassword ? 'Reset your password' : (isLoginView ? 'Welcome back!' : 'Create your account')}
                    </p>
                </div>
                
                {isForgotPassword ? (
                     <form onSubmit={handlePasswordReset} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email address</label>
                            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-white dark:bg-slate-700 dark:text-white transition"/>
                        </div>
                        {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 p-3 rounded-md">{error}</p>}
                        {success && <p className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 p-3 rounded-md">{success}</p>}
                        <div>
                            <button type="submit" disabled={isLoading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 transition-all transform hover:scale-105">
                                {isLoading ? 'Sending...' : 'Send Reset Email'}
                            </button>
                        </div>
                        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
                            <button type="button" onClick={() => setIsForgotPassword(false)} className="font-medium text-blue-600 hover:text-blue-500 transition">
                                Back to Sign in
                            </button>
                        </p>
                    </form>
                ) : (
                    <>
                        <button type="button" onClick={handleGoogleSignIn} disabled={isLoading} className="w-full flex items-center justify-center py-2.5 px-4 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all transform hover:scale-105">
                            <svg className="w-5 h-5 mr-3" aria-hidden="true" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 21.2 177.2 56.5L357 154.4c-21.3-20.2-52.4-33.5-97.2-33.5-73 0-132.3 59.2-132.3 132.3s59.2 132.3 132.3 132.3c76.9 0 111.3-44.4 115.8-68.2H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path></svg>
                            Sign in with Google
                        </button>

                        <div className="my-6 flex items-center"><div className="flex-grow border-t border-slate-300 dark:border-slate-600"></div><span className="flex-shrink mx-4 text-slate-400 dark:text-slate-500 text-sm">OR</span><div className="flex-grow border-t border-slate-300 dark:border-slate-600"></div></div>

                        <form onSubmit={handleAuthAction} className="space-y-6">
                            {!isLoginView && (
                                <div><label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label><input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-white dark:bg-slate-700 dark:text-white transition"/></div>
                            )}
                            <div><label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email address</label><input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-white dark:bg-slate-700 dark:text-white transition"/></div>
                            <div><label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label><input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-white dark:bg-slate-700 dark:text-white transition"/></div>
                            
                            {isLoginView && <div className="text-sm"><button type="button" onClick={() => setIsForgotPassword(true)} className="font-medium text-blue-600 hover:text-blue-500 transition">Forgot your password?</button></div>}
                            {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 p-3 rounded-md">{error}</p>}
                            
                            <div><button type="submit" disabled={isLoading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 transition-all transform hover:scale-105">{isLoading ? 'Processing...' : (isLoginView ? 'Sign In' : 'Sign Up')}</button></div>
                        </form>
                        <p className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
                            {isLoginView ? "Don't have an account?" : "Already have an account?"}
                            <button onClick={() => { setIsLoginView(!isLoginView); setError(''); }} className="font-semibold text-blue-600 hover:text-blue-500 ml-1 transition">
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
    const [toast, setToast] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [ticketsToDelete, setTicketsToDelete] = useState([]);
    const [isPermanentDelete, setIsPermanentDelete] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [selectedTickets, setSelectedTickets] = useState([]);
    const [selectedTrashedTickets, setSelectedTrashedTickets] = useState([]);
    const [view, setView] = useState('dashboard');
    const [librariesLoaded, setLibrariesLoaded] = useState({ pdf: false, csv: false });
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'descending' });
    
    const showToast = (type, message) => { setToast({ type, message }); setTimeout(() => setToast(null), 4000); };

    useEffect(() => {
        const loadScript = (src, onDone, onError) => {
            const script = document.createElement('script'); script.src = src; script.async = true; script.onload = onDone; script.onerror = onError; document.body.appendChild(script); return script;
        };
        const scriptErrorHandler = (name) => (e) => { console.error(`Failed to load ${name}.`, e); showToast("error", `Failed to load ${name} library.`); };
        const jspdfScript = loadScript('https://unpkg.com/jspdf@latest/dist/jspdf.umd.min.js', () => { loadScript('https://unpkg.com/jspdf-autotable@3.5.23/dist/jspdf.plugin.autotable.js', () => setLibrariesLoaded(p => ({...p, pdf: true})), scriptErrorHandler('jsPDF-AutoTable')); }, scriptErrorHandler('jsPDF'));
        const papaparseScript = loadScript('https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.2/papaparse.min.js', () => setLibrariesLoaded(p => ({...p, csv: true})), scriptErrorHandler('PapaParse'));
        return () => { document.body.removeChild(jspdfScript); const at = document.querySelector('script[src*="autotable"]'); if(at) document.body.removeChild(at); document.body.removeChild(papaparseScript); };
    }, []);

    useEffect(() => {
        if (!db) return;
        setIsLoading(true);
        const q = (path) => query(collection(db, path));
        const safeDate = (v) => v?.toDate ? v.toDate() : null;

        const unsubTickets = onSnapshot(q(`/artifacts/${appId}/public/data/tickets`), (snap) => {
            setTickets(snap.docs.map(d => ({ id: d.id, ...d.data(), timestamp: safeDate(d.data().timestamp), issueStartTime: safeDate(d.data().issueStartTime), issueEndTime: safeDate(d.data().issueEndTime) })));
            if(view !== 'trash') setIsLoading(false);
        }, (err) => { console.error(err); showToast("error", "Failed to fetch tickets."); setIsLoading(false); });

        const unsubTrash = onSnapshot(q(`/artifacts/${appId}/public/data/trash`), (snap) => {
            setTrashedTickets(snap.docs.map(d => ({ id: d.id, ...d.data(), deletedAt: safeDate(d.data().deletedAt) })));
            if(view === 'trash') setIsLoading(false);
        }, (err) => { console.error(err); showToast("error", "Failed to fetch trashed tickets."); setIsLoading(false); });

        return () => { unsubTickets(); unsubTrash(); };
    }, [db, view]);

    const filteredAndSortedTickets = useMemo(() => {
        const source = view === 'trash' ? trashedTickets : tickets;
        let processed = [...source];
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            processed = processed.filter(t => ['clientName', 'description', 'siteName', 'teamMember'].some(f => t[f]?.toLowerCase().includes(lowerSearch)));
        }
        if (view === 'list' && statusFilter !== 'All') {
            processed = processed.filter(t => t.status === statusFilter);
        }
        if (sortConfig.key) {
            processed.sort((a, b) => {
                const aVal = a[sortConfig.key]; const bVal = b[sortConfig.key];
                if (aVal === null || aVal === undefined) return 1; if (bVal === null || bVal === undefined) return -1;
                if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return processed;
    }, [tickets, trashedTickets, searchTerm, statusFilter, sortConfig, view]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
        setSortConfig({ key, direction });
    };

    const openEditModal = (ticket = null) => { setSelectedTicket(ticket); setIsEditModalOpen(true); };
    const closeEditModal = () => { setIsEditModalOpen(false); setSelectedTicket(null); };
    const openDetailModal = (ticket) => { setSelectedTicket(ticket); setIsDetailModalOpen(true); };
    const closeDetailModal = () => { setIsDetailModalOpen(false); setSelectedTicket(null); };
    const openDeleteModal = (ids, isPerm) => { setTicketsToDelete(Array.isArray(ids) ? ids : [ids]); setIsPermanentDelete(isPerm); setIsDeleteModalOpen(true); };
    const closeDeleteModal = () => { setIsDeleteModalOpen(false); setTicketsToDelete([]); };

    const handleSelectTicket = (id) => {
        const setter = view === 'trash' ? setSelectedTrashedTickets : setSelectedTickets;
        setter(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);
    };
    const handleSelectAllTickets = () => {
        const setter = view === 'trash' ? setSelectedTrashedTickets : setSelectedTickets;
        const selected = view === 'trash' ? selectedTrashedTickets : selectedTickets;
        if (selected.length === filteredAndSortedTickets.length) setter([]);
        else setter(filteredAndSortedTickets.map(t => t.id));
    };

    const handleSaveTicket = async (formData) => {
        if (!db) return showToast("error", "Database not connected.");
        
        const dataToSave = {
            ...formData,
            issueStartTime: formData.issueStartTime ? new Date(formData.issueStartTime) : serverTimestamp(),
            issueEndTime: formData.issueEndTime ? new Date(formData.issueEndTime) : null,
        };
        
        if (dataToSave.status === 'Closed' && !dataToSave.issueEndTime) {
            dataToSave.issueEndTime = serverTimestamp();
            if (!dataToSave.closedByName) {
                dataToSave.closedByName = user.name || user.email;
                dataToSave.closedByUid = user.uid;
            }
        }

        const path = `/artifacts/${appId}/public/data/tickets`;
        try {
            if (selectedTicket) {
                const ref = doc(db, path, selectedTicket.id);
                delete dataToSave.timestamp; 
                await updateDoc(ref, dataToSave);
                showToast("success", "Ticket updated successfully!");
            } else {
                await addDoc(collection(db, path), { ...dataToSave, timestamp: serverTimestamp(), authorId: user.uid, authorEmail: user.email });
                showToast("success", "Ticket created successfully!");
            }
            closeEditModal();
        } catch (e) { console.error(e); showToast("error", "Failed to save ticket."); }
    };
    
    const handleCloseTicket = async (ticketId) => {
        if (!db) return showToast("error", "Database not connected.");
        const ticketRef = doc(db, `/artifacts/${appId}/public/data/tickets`, ticketId);
        try {
            await updateDoc(ticketRef, { status: 'Closed', issueEndTime: serverTimestamp(), closedByUid: user.uid, closedByName: user.name || user.email });
            showToast("success", "Ticket closed successfully!");
        } catch (e) { console.error(e); showToast("error", "Failed to close ticket."); }
    };

    const handleConfirmDelete = async (password) => {
        if (user.role !== 'admin') return showToast("error", "Insufficient permissions.");
        const credential = EmailAuthProvider.credential(user.email, password);
        try {
            await reauthenticateWithCredential(auth.currentUser, credential);
            if (isPermanentDelete) await handlePermanentDelete(); else await handleSoftDelete();
        } catch (e) { console.error(e); showToast("error", "Incorrect password. Deletion cancelled."); }
    };

    const handleSoftDelete = async () => {
        const batch = writeBatch(db);
        const ticketsPath = `/artifacts/${appId}/public/data/tickets`;
        const trashPath = `/artifacts/${appId}/public/data/trash`;
        ticketsToDelete.forEach(id => {
            const ticket = tickets.find(t => t.id === id);
            if (ticket) {
                batch.set(doc(db, trashPath, id), { ...ticket, deletedAt: serverTimestamp() });
                batch.delete(doc(db, ticketsPath, id));
            }
        });
        try { await batch.commit(); showToast("info", `${ticketsToDelete.length} ticket(s) moved to trash.`); closeDeleteModal(); setSelectedTickets([]); }
        catch (e) { console.error(e); showToast("error", "Failed to move tickets to trash."); }
    };
    
    const handlePermanentDelete = async () => {
        const batch = writeBatch(db);
        const path = `/artifacts/${appId}/public/data/trash`;
        ticketsToDelete.forEach(id => batch.delete(doc(db, path, id)));
        try { await batch.commit(); showToast("success", `${ticketsToDelete.length} ticket(s) permanently deleted.`); closeDeleteModal(); setSelectedTrashedTickets([]); }
        catch (e) { console.error(e); showToast("error", "Failed to permanently delete tickets."); }
    };

    const handleRestoreTicket = async (id) => {
        const batch = writeBatch(db);
        const ticket = trashedTickets.find(t => t.id === id);
        if (ticket) {
            const { deletedAt, ...restoredData } = ticket;
            batch.set(doc(db, `/artifacts/${appId}/public/data/tickets`, id), restoredData);
            batch.delete(doc(db, `/artifacts/${appId}/public/data/trash`, id));
            try { await batch.commit(); showToast("success", "Ticket restored successfully."); }
            catch (e) { console.error(e); showToast("error", "Failed to restore ticket."); }
        }
    };

    return (
        <div className="bg-slate-100 dark:bg-slate-900 min-h-screen text-slate-800 dark:text-slate-200">
            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
                <Header onNewTicket={() => openEditModal()} user={user} auth={auth} setView={setView} />
                
                <div className="bg-white dark:bg-slate-800/60 rounded-2xl shadow-lg shadow-slate-300/20 dark:shadow-black/20 mt-6 ring-1 ring-slate-200 dark:ring-slate-700/50">
                    <Toolbar {...{ view, setView, tickets: filteredAndSortedTickets, librariesLoaded, user, showToast, onBulkDelete: () => openDeleteModal(selectedTickets, false), onBulkPermanentDelete: () => openDeleteModal(selectedTrashedTickets, true), selectedTickets: view === 'trash' ? selectedTrashedTickets : selectedTickets}} />
                    {view !== 'dashboard' && view !== 'profile' && <FilterControls {...{searchTerm, setSearchTerm, statusFilter, setStatusFilter, view}} />}
                    <main className="p-4 md:p-6">
                        {isLoading ? <LoadingSpinner /> : (
                            view === 'dashboard' ? <Dashboard tickets={tickets} /> :
                            view === 'list' ? <TicketList {...{ tickets: filteredAndSortedTickets, user, onEdit: openEditModal, onDelete: (id) => openDeleteModal(id, false), onViewDetails: openDetailModal, requestSort, sortConfig, selectedTickets, onSelectTicket, onSelectAllTickets, onCloseTicket: handleCloseTicket }} /> :
                            view === 'trash' ? <TrashList {...{ tickets: filteredAndSortedTickets, onRestore: handleRestoreTicket, onPermanentDelete: (id) => openDeleteModal(id, true), selectedTickets: selectedTrashedTickets, onSelectTicket, onSelectAllTickets}} /> :
                            <ProfilePage {...{user, auth, db, showToast}} />
                        )}
                    </main>
                </div>

                {isEditModalOpen && <TicketForm {...{isOpen: isEditModalOpen, onClose: closeEditModal, onSave: handleSaveTicket, ticket: selectedTicket, user}} />}
                {isDetailModalOpen && <TicketDetailModal {...{isOpen: isDetailModalOpen, onClose: closeDetailModal, ticket: selectedTicket}} />}
                {isDeleteModalOpen && <DeleteConfirmationModal {...{isOpen: isDeleteModalOpen, onClose: closeDeleteModal, onConfirm: handleConfirmDelete, count: ticketsToDelete.length, isPermanent: isPermanentDelete}} />}
            </div>
        </div>
    );
}

// --- UI Sub-components ---
const UserDropdown = ({ user, auth, setView }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);
    useEffect(() => {
        const handleClickOutside = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setIsOpen(false); };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={menuRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
                <span className="text-right text-sm font-medium text-slate-800 dark:text-slate-100">{user.name || user.email}</span>
                <UserCircle className="w-8 h-8 text-slate-500"/>
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl ring-1 ring-black ring-opacity-5 py-1 z-50">
                    <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{user.name || "User"}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user.role} Role</p>
                    </div>
                    <div className="py-1">
                        <button onClick={() => { setView('profile'); setIsOpen(false); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"><Users className="w-4 h-4 mr-2"/>My Profile</button>
                        <button onClick={() => signOut(auth)} className="w-full text-left flex items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><LogOut className="w-4 h-4 mr-2"/>Sign Out</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const Header = ({ onNewTicket, user, auth, setView }) => {
    const { theme, toggleTheme } = useTheme();
    return (
        <header>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div>
                    <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">AI Issue Tracker</h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">Your central hub for managing support tickets.</p>
                </div>
                <div className="flex items-center space-x-4 mt-4 sm:mt-0">
                    <button onClick={toggleTheme} className="p-2 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-all" title="Toggle Theme">
                        {theme === 'light' ? <Moon className="w-5 h-5"/> : <Sun className="w-5 h-5"/>}
                    </button>
                    <button onClick={onNewTicket} className="flex items-center justify-center bg-blue-600 text-white font-semibold py-2.5 px-5 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition-all transform hover:scale-105">
                        <PlusCircle className="w-5 h-5 mr-2" /> New Ticket
                    </button>
                    <UserDropdown user={user} auth={auth} setView={setView} />
                </div>
            </div>
             <div className="mt-6 bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-400 text-purple-900 dark:text-purple-300 p-4 rounded-r-lg flex items-center text-sm shadow-sm">
                <Lock className="w-6 h-6 mr-4 flex-shrink-0 text-purple-500" />
                <p><span className="font-semibold">Action Required:</span> For login to work, enable 'Email/Password' & 'Google' sign-in providers in your Firebase Authentication settings.</p>
            </div>
        </header>
    );
};

const Toolbar = ({ view, setView, tickets, librariesLoaded, user, selectedTickets, onBulkDelete, onBulkPermanentDelete, showToast }) => {
    const exportToCSV = () => {
        if (!librariesLoaded.csv || !window.Papa) return showToast('error', 'CSV library not ready.');
        if (tickets.length === 0) return showToast('info', 'No data to export.');
        const headers = ['Client Name', 'Site Name', 'Description', 'Status', 'Priority', 'Team Member', 'Created Date', 'Closed Date', 'Closed By', 'POS Ticket', 'Sungrow Ticket'];
        const data = tickets.map(t => ({ 'Client Name': t.clientName, 'Site Name': t.siteName, 'Description': t.description, 'Status': t.status, 'Priority': t.priority, 'Team Member': t.teamMember, 'Created Date': t.timestamp?.toLocaleString() || 'N/A', 'Closed Date': t.issueEndTime?.toLocaleString() || 'N/A', 'Closed By': t.closedByName || '', 'POS Ticket': t.pcsTicket || '', 'Sungrow Ticket': t.sungrowTicket || '' }));
        const csv = window.Papa.unparse({ fields: headers, data });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", `tickets-export-${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        showToast('success', 'CSV export started.');
    };

    const exportToPDF = () => {
        if (!librariesLoaded.pdf || !window.jspdf) return showToast('error', 'PDF library not ready.');
        if (tickets.length === 0) return showToast('info', 'No data to export.');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.autoTable({
            head: [['Client', 'Site', 'Description', 'Status', 'Priority', 'Created']],
            body: tickets.map(t => [ t.clientName, t.siteName, t.description.substring(0, 40) + '...', t.status, t.priority, t.timestamp?.toLocaleDateString() || 'N/A' ]),
            startY: 20,
        });
        doc.text("Issue Tracker Tickets", 14, 15);
        doc.save(`tickets-export-${new Date().toISOString().split('T')[0]}.pdf`);
        showToast('success', 'PDF export started.');
    };
    
    return (
        <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 flex flex-col sm:flex-row justify-between items-center bg-slate-50/50 dark:bg-slate-800/20 rounded-t-2xl">
            <div className="flex items-center space-x-1 bg-slate-200 dark:bg-slate-700 p-1 rounded-lg mb-3 sm:mb-0">
                <button onClick={() => setView('dashboard')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors flex items-center ${view === 'dashboard' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}><PieChart className="w-4 h-4 mr-2"/>Dashboard</button>
                <button onClick={() => setView('list')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors flex items-center ${view === 'list' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}><List className="w-4 h-4 mr-2"/>Ticket List</button>
                {user.role === 'admin' && <button onClick={() => setView('trash')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors flex items-center ${view === 'trash' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}><Trash2 className="w-4 h-4 mr-2"/>Trash</button>}
            </div>
            <div className="flex items-center space-x-3">
                {user.role === 'admin' && selectedTickets.length > 0 && view === 'list' && ( <button onClick={onBulkDelete} className="flex items-center text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 px-3 py-1.5 rounded-lg transition-colors"><Trash2 className="w-4 h-4 mr-1.5"/>Delete ({selectedTickets.length})</button> )}
                {user.role === 'admin' && selectedTickets.length > 0 && view === 'trash' && ( <button onClick={onBulkPermanentDelete} className="flex items-center text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 px-3 py-1.5 rounded-lg transition-colors"><Trash2 className="w-4 h-4 mr-1.5"/>Delete Permanently ({selectedTickets.length})</button> )}
                <button onClick={exportToCSV} disabled={!librariesLoaded.csv} className="flex items-center text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><FileDown className="w-4 h-4 mr-1.5"/>CSV</button>
                <button onClick={exportToPDF} disabled={!librariesLoaded.pdf} className="flex items-center text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><FileDown className="w-4 h-4 mr-1.5"/>PDF</button>
            </div>
        </div>
    );
};

const FilterControls = ({ searchTerm, setSearchTerm, statusFilter, setStatusFilter, view }) => (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-200 dark:border-slate-700/50">
        <div className="relative"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /><input type="text" placeholder="Search tickets..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-white dark:bg-slate-700/50 dark:text-white transition"/></div>
        {view === 'list' && <div><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full py-2.5 px-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 bg-white dark:bg-slate-700/50 dark:text-white transition"><option value="All">All Statuses</option><option>Open</option><option>In Progress</option><option>Closed</option></select></div>}
    </div>
);
const Dashboard = ({ tickets }) => {
    const stats = useMemo(() => {
        const open = tickets.filter(t => t.status === 'Open' || t.status === 'In Progress').length;
        return {
            total: tickets.length, open, closed: tickets.filter(t => t.status === 'Closed').length,
            urgent: tickets.filter(t => t.priority === 'High' && t.status !== 'Closed').length,
            byStatus: tickets.reduce((acc, t) => ({...acc, [t.status]: (acc[t.status] || 0) + 1}), {}),
            byPriority: tickets.reduce((acc, t) => ({...acc, [t.priority]: (acc[t.priority] || 0) + 1}), {}),
        };
    }, [tickets]);
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                <StatCard title="Total Tickets" value={stats.total} icon={Ticket} color="blue" />
                <StatCard title="Open Tickets" value={stats.open} icon={FolderOpen} color="yellow"/>
                <StatCard title="Closed Tickets" value={stats.closed} icon={CheckCircle} color="green"/>
                <StatCard title="Urgent & Open" value={stats.urgent} icon={AlertTriangle} color="red"/>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard title="Tickets by Status" data={stats.byStatus} />
                <ChartCard title="Tickets by Priority" data={stats.byPriority} />
            </div>
        </div>
    );
};

const StatCard = ({ title, value, icon: Icon, color }) => {
    const colors = { blue: "from-blue-500 to-indigo-500", yellow: "from-yellow-500 to-amber-500", green: "from-green-500 to-emerald-500", red: "from-red-500 to-rose-500" };
    return (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200/80 dark:border-slate-700/50 shadow-sm hover:shadow-lg transition-all transform hover:-translate-y-1">
            <div className="flex justify-between items-center">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
                <div className={`p-2 rounded-lg bg-gradient-to-br ${colors[color]} text-white shadow-lg`}><Icon className="w-5 h-5"/></div>
            </div>
            <p className="text-4xl font-bold text-slate-900 dark:text-white mt-2">{value}</p>
        </div>
    );
};

const ChartCard = ({ title, data }) => {
    const total = Object.values(data).reduce((sum, val) => sum + val, 0);
    const colors = { 'Open': 'bg-blue-500', 'In Progress': 'bg-yellow-500', 'Closed': 'bg-slate-500', 'High': 'bg-red-500', 'Medium': 'bg-orange-500', 'Low': 'bg-teal-500', 'Urgent': 'bg-rose-600' };
    return (<div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200/80 dark:border-slate-700/50 shadow-sm"><h3 className="font-semibold text-slate-800 dark:text-white mb-4 text-lg">{title}</h3><div className="space-y-4">{Object.entries(data).map(([key, value]) => (<div key={key}><div className="flex justify-between text-sm mb-1"><span className="font-medium text-slate-600 dark:text-slate-300">{key}</span><span className="text-slate-500 dark:text-slate-400">{value} / {total}</span></div><div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5"><div className={`${colors[key] || 'bg-slate-500'} h-2.5 rounded-full transition-all duration-500`} style={{ width: `${total > 0 ? (value / total) * 100 : 0}%` }}></div></div></div>))}</div></div>);
};

const ActionsMenu = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);
    useEffect(() => {
        const handleClickOutside = (event) => { if (menuRef.current && !menuRef.current.contains(event.target)) setIsOpen(false); };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={menuRef}>
            <button onClick={() => setIsOpen(p => !p)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                <MoreVertical className="w-5 h-5" />
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-800 rounded-lg shadow-xl ring-1 ring-black ring-opacity-5 py-1 z-10">
                    {React.Children.map(children, child => 
                        React.cloneElement(child, { onClick: () => { child.props.onClick(); setIsOpen(false); }})
                    )}
                </div>
            )}
        </div>
    );
};

const TicketList = ({ tickets, user, onEdit, onDelete, onViewDetails, requestSort, sortConfig, selectedTickets, onSelectTicket, onSelectAllTickets, onCloseTicket }) => {
    if (tickets.length === 0) return <p className="text-center py-16 text-slate-500 dark:text-slate-400">No tickets found.</p>;
    const getSortIndicator = (key) => { if (sortConfig.key !== key) return <ArrowUpDown className="w-4 h-4 inline-block ml-1 text-slate-400" />; return sortConfig.direction === 'ascending' ? '▲' : '▼'; };
    return (<div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700"><thead className="bg-slate-50 dark:bg-slate-700/50"><tr>{user.role === 'admin' && <th className="px-6 py-3 text-left"><input type="checkbox" className="rounded border-slate-300 dark:bg-slate-900 dark:border-slate-600 text-blue-600 focus:ring-blue-500/50" onChange={onSelectAllTickets} checked={tickets.length > 0 && selectedTickets.length === tickets.length} /></th>}
        {['clientName', 'status', 'priority', 'timestamp', 'issueEndTime'].map(key => (
            <th key={key} onClick={() => requestSort(key)} className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600/50 transition-colors">
                <span className="flex items-center">{key.replace('issueEndTime', 'Closed').replace('clientName', 'Ticket Details').replace('timestamp', 'Created')} {getSortIndicator(key)}</span>
            </th>
        ))}
        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Response Time</th>
        <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Actions</th>
    </tr></thead><tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700/80">{tickets.map(ticket => <TicketRow key={ticket.id} {...{ ticket, user, onEdit, onDelete, onViewDetails, isSelected: selectedTickets.includes(ticket.id), onSelectTicket, onCloseTicket}} />)}</tbody></table></div>);
};

const TicketRow = ({ ticket, user, onEdit, onDelete, onViewDetails, isSelected, onSelectTicket, onCloseTicket }) => {
    const canEdit = user.role === 'admin' || user.uid === ticket.authorId;
    const canDelete = user.role === 'admin';
    const canClose = !canEdit && user.role !== 'admin' && ticket.status !== 'Closed';

    const calculateResponseTime = (start, end) => {
        if (!end || !start) return <span className="text-yellow-500">In Progress</span>;
        const diffMs = new Date(end) - new Date(start);
        const d = Math.floor(diffMs / 864e5), h = Math.floor((diffMs % 864e5) / 36e5), m = Math.floor((diffMs % 36e5) / 6e4);
        return `${d > 0 ? `${d}d ` : ''}${h > 0 ? `${h}h ` : ''}${m}m`;
    };
    const statusColors = { Open: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', 'In Progress': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', Closed: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300' };
    const priorityColors = { High: 'text-red-600 dark:text-red-400', Medium: 'text-yellow-600 dark:text-yellow-400', Low: 'text-green-600 dark:text-green-400', Urgent: 'text-rose-500 font-bold' };
    
    return (<tr className={`transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
        {user.role === 'admin' && <td className="px-6 py-4"><input type="checkbox" className="rounded border-slate-300 dark:bg-slate-900 dark:border-slate-600 text-blue-600 focus:ring-blue-500/50" checked={isSelected} onChange={() => onSelectTicket(ticket.id)} /></td>}
        <td className="px-6 py-4 max-w-sm"><div className="text-sm font-semibold text-slate-900 dark:text-white">{ticket.clientName}</div><p className="text-sm text-slate-500 dark:text-slate-400 truncate">{ticket.description}</p></td>
        <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[ticket.status] || ''}`}>{ticket.status}</span></td>
        <td className="px-6 py-4 whitespace-nowrap"><span className={`font-semibold ${priorityColors[ticket.priority] || ''}`}>{ticket.priority}</span></td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{ticket.timestamp ? new Date(ticket.timestamp).toLocaleString() : 'N/A'}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{ticket.issueEndTime && ticket.status === 'Closed' ? new Date(ticket.issueEndTime).toLocaleString() : '—'}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{calculateResponseTime(ticket.issueStartTime, ticket.issueEndTime)}</td>
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <ActionsMenu>
                <button onClick={() => onViewDetails(ticket)} className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"><Eye className="w-4 h-4 mr-2"/>View</button>
                {canEdit && <button onClick={() => onEdit(ticket)} className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"><Edit className="w-4 h-4 mr-2"/>Edit</button>}
                {canClose && <button onClick={() => onCloseTicket(ticket.id)} className="w-full text-left flex items-center px-4 py-2 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"><CheckCircle className="w-4 h-4 mr-2"/>Close</button>}
                {canDelete && <button onClick={() => onDelete(ticket.id)} className="w-full text-left flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Trash2 className="w-4 h-4 mr-2"/>Delete</button>}
            </ActionsMenu>
        </td>
    </tr>);
};

// Helper to format a Date object into a `YYYY-MM-DDTHH:MM` string for datetime-local input
const formatDateForInput = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const TicketForm = ({ isOpen, onClose, onSave, ticket, user }) => {
    const initialState = { teamMember: user.name || user.email, siteName: 'Defford', inverter: '1', status: 'Open', description: '', updatedInTeams: 'No', fiixTicket: '', pcsTicket: '', sungrowTicket: '', emailed: 'No', additionalNotes: '', clientName: '', priority: 'Medium', issueStartTime: '', issueEndTime: '' };
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
    const handleSubmit = (e) => { e.preventDefault(); onSave(formData); };
    if (!isOpen) return null;

    const inputClass = "mt-1 block w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-blue-500/50 focus:border-blue-500 bg-white dark:bg-slate-700/50 dark:text-white transition";
    const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300";
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4 transition-opacity animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto transform transition-all animate-modal-pop">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 sm:p-8 sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm z-10 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-slate-900 dark:text-white">{ticket ? 'Edit Ticket' : 'Create New Ticket'}</h2><button type="button" onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><X className="w-6 h-6" /></button></div>
                    </div>
                    <div className="p-6 sm:p-8 space-y-8">
                        <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6"><legend className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2 col-span-full">Client & Site Details</legend><div><label htmlFor="clientName" className={labelClass}>Client Name</label><input type="text" name="clientName" value={formData.clientName} onChange={handleChange} required className={inputClass} /></div><div><label htmlFor="siteName" className={labelClass}>Site Name</label><select name="siteName" value={formData.siteName} onChange={handleChange} className={inputClass}>{['Defford', 'Whirlbush', 'Cleve Hill'].map(o => <option key={o}>{o}</option>)}</select></div></fieldset>
                        <fieldset><legend className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Issue Details</legend>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2"><label htmlFor="description" className={labelClass}>Description</label><textarea name="description" rows="4" value={formData.description} onChange={handleChange} className={inputClass}></textarea></div>
                                <div><label htmlFor="issueStartTime" className={labelClass}>Issue Start Time</label><input type="datetime-local" name="issueStartTime" value={formData.issueStartTime} onChange={handleChange} className={inputClass} /></div>
                                <div><label htmlFor="issueEndTime" className={labelClass}>Issue End Time</label><input type="datetime-local" name="issueEndTime" value={formData.issueEndTime} onChange={handleChange} className={inputClass} /></div>
                                <div><label htmlFor="teamMember" className={labelClass}>Team Member</label><input type="text" name="teamMember" value={formData.teamMember} required className={`${inputClass} bg-slate-100 dark:bg-slate-600/50`} readOnly /></div>
                                <div><label htmlFor="priority" className={labelClass}>Priority</label><select name="priority" value={formData.priority} onChange={handleChange} className={inputClass}>{['Low', 'Medium', 'High', 'Urgent'].map(o => <option key={o}>{o}</option>)}</select></div>
                                <div className={`grid ${ticket?.status === 'Closed' ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                                    <div><label htmlFor="status" className={labelClass}>Status</label><select name="status" value={formData.status} onChange={handleChange} className={inputClass}>{['Open', 'In Progress', 'Closed'].map(o => <option key={o}>{o}</option>)}</select></div>
                                    {ticket?.status === 'Closed' && ( <div><label className={labelClass}>Closed By</label><div className="mt-1 h-[42px] px-3 flex items-center text-sm text-slate-500 dark:text-slate-400 truncate" title={ticket.closedByName}>{ticket.closedByName || 'Creator'}</div></div> )}
                                </div>
                                <div><label htmlFor="inverter" className={labelClass}>Inverter</label><select name="inverter" value={formData.inverter} onChange={handleChange} className={inputClass}>{['1', '2A', '2B', '3A', '3C', '4', '5', '6', '7', '8', '9A', '9B'].map(o => <option key={o}>{o}</option>)}</select></div>
                                {formData.siteName === 'Defford' ? ( <div><label htmlFor="pcsTicket" className={labelClass}>POS Ticket #</label><input type="text" name="pcsTicket" value={formData.pcsTicket} onChange={handleChange} className={inputClass} /></div> ) : ( <div><label htmlFor="sungrowTicket" className={labelClass}>Sungrow Ticket #</label><input type="text" name="sungrowTicket" value={formData.sungrowTicket} onChange={handleChange} className={inputClass} /></div> )}
                                <div><label htmlFor="fiixTicket" className={labelClass}>Fix Ticket #</label><input type="text" name="fiixTicket" value={formData.fiixTicket} onChange={handleChange} className={inputClass} /></div>
                                <div><label htmlFor="updatedInTeams" className={labelClass}>Updated in Teams</label><select name="updatedInTeams" value={formData.updatedInTeams} onChange={handleChange} className={inputClass}>{['Yes', 'No'].map(o=><option key={o}>{o}</option>)}</select></div>
                                <div className="md:col-span-2"><label htmlFor="additionalNotes" className={labelClass}>Additional Notes</label><textarea name="additionalNotes" rows="3" value={formData.additionalNotes} onChange={handleChange} className={inputClass}></textarea></div>
                            </div>
                        </fieldset>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 flex justify-end space-x-3 rounded-b-2xl sticky bottom-0"><button type="button" onClick={onClose} className="py-2 px-4 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Cancel</button><button type="submit" className="py-2 px-4 border border-transparent rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors">Save Ticket</button></div>
                </form>
            </div>
            <style>{`@keyframes fade-in{from{opacity:0}to{opacity:1}} .animate-fade-in{animation:fade-in .3s ease-out forwards} @keyframes modal-pop{from{opacity:0;transform:scale(.95) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}} .animate-modal-pop{animation:modal-pop .3s ease-out forwards}`}</style>
        </div>
    );
};

const LiveDuration = ({ startTime, endTime }) => {
    const calculateDuration = (start, end) => {
        if (!start) return "00:00:00";
        const diff = new Date(end) - new Date(start);
        if (diff < 0) return "00:00:00";
        const d = Math.floor(diff / 864e5);
        const h = Math.floor((diff % 864e5) / 36e5);
        const m = Math.floor((diff % 36e5) / 6e4);
        const s = Math.floor((diff % 6e4) / 1000);
        return `${d > 0 ? `${d}d ` : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    const [duration, setDuration] = useState(() => calculateDuration(startTime, endTime || new Date()));
    useEffect(() => {
        if (endTime) { setDuration(calculateDuration(startTime, endTime)); return; }
        const timer = setInterval(() => setDuration(calculateDuration(startTime, new Date())), 1000);
        return () => clearInterval(timer);
    }, [startTime, endTime]);
    return <span className="font-mono tabular-nums">{duration}</span>;
};

const TicketDetailModal = ({ isOpen, onClose, ticket }) => {
    if (!isOpen) return null;
    const DetailItem = ({ label, value, children }) => (<div><p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">{label}</p><div className="text-slate-900 dark:text-white text-sm mt-1">{children || value || '—'}</div></div>);
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4 transition-opacity animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto transform transition-all animate-modal-pop">
                <div className="p-6 sm:p-8 sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm z-10 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-start"><div><h2 className="text-2xl font-bold text-slate-900 dark:text-white">Ticket Details</h2><p className="text-sm text-slate-500 dark:text-slate-400 mt-1">ID: {ticket.id}</p></div><button type="button" onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><X className="w-6 h-6" /></button></div>
                </div>
                <div className="p-6 sm:p-8 space-y-6">
                    <div><h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Issue Description</h3><p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">{ticket.description || "No description provided."}</p></div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
                        <DetailItem label="Created By" value={ticket.teamMember} />
                        <DetailItem label="Site Name" value={ticket.siteName} />
                        <DetailItem label="Status" value={ticket.status} />
                        <DetailItem label="Priority" value={ticket.priority} />
                        <DetailItem label="Start Time" value={ticket.issueStartTime?.toLocaleString()} />
                        <DetailItem label="End Time" value={ticket.issueEndTime?.toLocaleString()} />
                        <DetailItem label="Duration"><LiveDuration startTime={ticket.issueStartTime} endTime={ticket.issueEndTime} /></DetailItem>
                        <DetailItem label="Inverter" value={ticket.inverter} />
                        {ticket.closedByName && <DetailItem label="Closed By" value={ticket.closedByName} />}
                        {ticket.pcsTicket && <DetailItem label="POS Ticket #" value={ticket.pcsTicket} />}
                        {ticket.sungrowTicket && <DetailItem label="Sungrow Ticket #" value={ticket.sungrowTicket} />}
                    </div>
                    {ticket.additionalNotes && <div><h4 className="text-md font-semibold text-slate-700 dark:text-slate-200 mb-2">Additional Notes</h4><p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap text-sm bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">{ticket.additionalNotes}</p></div>}
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 flex justify-end rounded-b-2xl"><button type="button" onClick={onClose} className="py-2 px-5 border border-transparent rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors">Close</button></div>
            </div>
             <style>{`@keyframes fade-in{from{opacity:0}to{opacity:1}} .animate-fade-in{animation:fade-in .3s ease-out forwards} @keyframes modal-pop{from{opacity:0;transform:scale(.95) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}} .animate-modal-pop{animation:modal-pop .3s ease-out forwards}`}</style>
        </div>
    );
};

const LoadingSpinner = () => <div className="flex justify-center items-center py-20"><div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div></div>;
const Toast = ({ type, message, onClose }) => {
    const icons = { success: CheckCircle, error: AlertTriangle, info: Info };
    const colors = { success: 'bg-green-50 text-green-500 border-green-400 dark:bg-green-900/20', error: 'bg-red-50 text-red-500 border-red-400 dark:bg-red-900/20', info: 'bg-blue-50 text-blue-500 border-blue-400 dark:bg-blue-900/20' };
    const Icon = icons[type];
    return (
        <div className={`fixed top-5 right-5 z-[100] max-w-sm w-full shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden ${colors[type]}`}>
            <div className="p-4"><div className="flex items-start"><div className="flex-shrink-0"><Icon className={`w-6 h-6 ${colors[type].split(' ')[1]}`} /></div><div className="ml-3 w-0 flex-1 pt-0.5"><p className="text-sm font-medium text-slate-900 dark:text-white">{message}</p></div><div className="ml-4 flex-shrink-0 flex"><button onClick={onClose} className="inline-flex rounded-md text-slate-400 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"><X className="h-5 w-5" /></button></div></div></div>
        </div>
    );
};

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, count, isPermanent }) => {
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const handleSubmit = async (e) => { e.preventDefault(); setIsLoading(true); try { await onConfirm(password); } catch (e) { console.error(e) } finally { setIsLoading(false); } };
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4 transition-opacity animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md transform transition-all animate-modal-pop">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 text-center">
                        <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
                        <h3 className="mt-4 text-lg font-medium text-slate-900 dark:text-white">Confirm Deletion</h3>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">You are about to {isPermanent ? 'permanently delete' : 'move to trash'} {count} ticket(s). {isPermanent && <span className="font-bold"> This action cannot be undone.</span>}</p>
                        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Please enter your password to confirm.</p>
                        <div className="mt-4"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="block w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500 bg-white dark:bg-slate-700 dark:text-white transition" placeholder="Enter your password"/></div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 flex justify-end space-x-3 rounded-b-2xl">
                        <button type="button" onClick={onClose} className="py-2 px-4 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Cancel</button>
                        <button type="submit" disabled={isLoading} className="py-2 px-4 border border-transparent rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-red-400">{isLoading ? 'Deleting...' : 'Confirm'}</button>
                    </div>
                </form>
            </div>
             <style>{`@keyframes fade-in{from{opacity:0}to{opacity:1}} .animate-fade-in{animation:fade-in .3s ease-out forwards} @keyframes modal-pop{from{opacity:0;transform:scale(.95) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}} .animate-modal-pop{animation:modal-pop .3s ease-out forwards}`}</style>
        </div>
    );
};

const TrashList = ({ tickets, onRestore, onPermanentDelete, selectedTickets, onSelectTicket, onSelectAllTickets }) => {
    if (tickets.length === 0) return <p className="text-center py-16 text-slate-500 dark:text-slate-400">The trash bin is empty.</p>;
    return (<div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700"><thead className="bg-slate-50 dark:bg-slate-700/50"><tr><th className="px-6 py-3 text-left"><input type="checkbox" className="rounded dark:bg-slate-900 dark:border-slate-600" onChange={onSelectAllTickets} checked={tickets.length > 0 && selectedTickets.length === tickets.length} /></th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Ticket Details</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Deleted At</th><th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Actions</th></tr></thead><tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700/80">{tickets.map(ticket => <TrashRow key={ticket.id} {...{ticket, onRestore, onPermanentDelete, isSelected: selectedTickets.includes(ticket.id), onSelectTicket}} />)}</tbody></table></div>);
};

const TrashRow = ({ ticket, onRestore, onPermanentDelete, isSelected, onSelectTicket }) => (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
        <td className="px-6 py-4"><input type="checkbox" className="rounded dark:bg-slate-900 dark:border-slate-600" checked={isSelected} onChange={() => onSelectTicket(ticket.id)} /></td>
        <td className="px-6 py-4 max-w-sm"><div className="text-sm font-semibold text-slate-900 dark:text-white">{ticket.clientName}</div><p className="text-sm text-slate-500 dark:text-slate-400 truncate">{ticket.description}</p></td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{ticket.deletedAt ? new Date(ticket.deletedAt).toLocaleString() : 'N/A'}</td>
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
            <button onClick={() => onRestore(ticket.id)} className="p-2 rounded-full text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors" title="Restore"><ArchiveRestore className="w-5 h-5"/></button>
            <button onClick={() => onPermanentDelete(ticket.id)} className="p-2 rounded-full text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors" title="Delete Permanently"><Trash2 className="w-5 h-5"/></button>
        </td>
    </tr>
);

const ProfilePage = ({ user, auth, db, showToast }) => {
    const [name, setName] = useState(user.name || '');
    const [phone, setPhone] = useState(user.phone || '');
    const [employeeId, setEmployeeId] = useState(user.employeeId || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleProfileUpdate = async (e) => {
        e.preventDefault(); setIsSaving(true);
        try {
            await updateProfile(auth.currentUser, { displayName: name });
            const userDocRef = doc(db, `/artifacts/${appId}/public/data/users`, user.uid);
            await updateDoc(userDocRef, { name, phone, employeeId });
            showToast('success', 'Profile updated successfully!');
        } catch (error) { console.error(error); showToast('error', 'Failed to update profile.'); } finally { setIsSaving(false); }
    };
    
    const inputClass = "mt-1 block w-full border-slate-300 dark:border-slate-600 rounded-lg shadow-sm focus:ring-blue-500/50 focus:border-blue-500 bg-white dark:bg-slate-700/50 dark:text-white transition pl-11";
    const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300";

    return (
        <div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">My Profile</h2>
            <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <form onSubmit={handleProfileUpdate} className="space-y-6 max-w-lg mx-auto">
                    <div className="relative">
                        <label htmlFor="profile-name" className={labelClass}>Full Name</label>
                        <UserCircle className="w-5 h-5 absolute left-3 top-9 text-slate-400"/>
                        <input id="profile-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
                    </div>
                     <div className="relative">
                        <label htmlFor="profile-email" className={labelClass}>Email</label>
                        <Mail className="w-5 h-5 absolute left-3 top-9 text-slate-400"/>
                        <input id="profile-email" type="email" value={user.email} disabled className={`${inputClass} bg-slate-100 dark:bg-slate-700/80 dark:text-slate-400`} />
                    </div>
                     <div className="relative">
                        <label htmlFor="profile-phone" className={labelClass}>Phone Number</label>
                        <Phone className="w-5 h-5 absolute left-3 top-9 text-slate-400"/>
                        <input id="profile-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
                    </div>
                     <div className="relative">
                        <label htmlFor="profile-employeeId" className={labelClass}>Employee ID</label>
                        <Hash className="w-5 h-5 absolute left-3 top-9 text-slate-400"/>
                        <input id="profile-employeeId" type="text" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputClass} />
                    </div>
                    <div className="flex justify-end pt-4">
                        <button type="submit" disabled={isSaving} className="py-2.5 px-6 border border-transparent rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:bg-blue-400">
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
