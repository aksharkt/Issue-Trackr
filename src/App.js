import React, { useState, useEffect, useMemo, useRef } from 'react';
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
    onSnapshot, 
    doc, 
    updateDoc, 
    deleteDoc,
    query,
    serverTimestamp,
    setLogLevel,
    writeBatch
} from 'firebase/firestore';
import { ArrowUpDown, PlusCircle, Search, Trash2, Edit, X, User, Clipboard, PieChart, List, FileDown, Sparkles, BrainCircuit, Users, Eye, Mail, Phone, Upload } from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyDwfLf1G-3N_fXgXNNAKdhBYm9zTUOsjxA",
    authDomain: "issue-trackr-98ebd.firebaseapp.com",
    projectId: "issue-trackr-98ebd",
    storageBucket: "issue-trackr-98ebd.appspot.com",
    messagingSenderId: "778691816102",
    appId: "1:778691816102:web:2ae1571d67c694a7242267",
    measurementId: "G-EDL36NWN7R"
  };
  
  // This line is important for the database path
  const appId = firebaseConfig.projectId;

// --- Main App Component ---
export default function App() {
    // --- State Management ---
    const [tickets, setTickets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [view, setView] = useState('dashboard'); // 'dashboard' or 'list'
    const [librariesLoaded, setLibrariesLoaded] = useState({ pdf: false, csv: false });
    
    // Firebase state
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    // Filtering and Sorting State
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [priorityFilter, setPriorityFilter] = useState('All');
    const [sortConfig, setSortConfig] = useState({ key: 'dateRaised', direction: 'descending' });

    // --- Dynamic Script Loading ---
    useEffect(() => {
        const loadScript = (src, onDone, onError) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = onDone;
            script.onerror = onError;
            document.body.appendChild(script);
            return script;
        };
        
        const scriptErrorHandler = (scriptName) => (e) => {
            console.error(`Failed to load ${scriptName} library.`, e);
            setError(prev => prev ? `${prev} | ${scriptName} features may not work.` : `Failed to load ${scriptName} library.`);
        };

        // Load PDF libraries
        const jspdfScript = loadScript('https://unpkg.com/jspdf@latest/dist/jspdf.umd.min.js', () => {
             loadScript('https://unpkg.com/jspdf-autotable@3.5.23/dist/jspdf.plugin.autotable.js', 
                () => setLibrariesLoaded(prev => ({...prev, pdf: true})), 
                scriptErrorHandler('jsPDF-AutoTable')
            );
        }, scriptErrorHandler('jsPDF'));

        // Load CSV parsing library
        const papaparseScript = loadScript('https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.2/papaparse.min.js', 
            () => setLibrariesLoaded(prev => ({...prev, csv: true})), 
            scriptErrorHandler('PapaParse')
        );

        return () => {
            document.body.removeChild(jspdfScript);
            const autotable = document.querySelector('script[src*="autotable"]');
            if(autotable) document.body.removeChild(autotable);
            document.body.removeChild(papaparseScript);
        };
    }, []);


    // --- Firebase Initialization and Authentication ---
    useEffect(() => {
        try {
            if (Object.keys(firebaseConfig).length > 0) {
                const app = initializeApp(firebaseConfig);
                const firestoreDb = getFirestore(app);
                const firebaseAuth = getAuth(app);
                
                setDb(firestoreDb);
                setAuth(firebaseAuth);
                setLogLevel('debug');

                const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                    if (user) {
                        setUserId(user.uid);
                    } else {
                        try {
                            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                                await signInWithCustomToken(firebaseAuth, __initial_auth_token);
                            } else {
                                await signInAnonymously(firebaseAuth);
                            }
                        } catch (authError) {
                            console.error("Authentication error:", authError);
                            setError("Failed to authenticate. Please refresh the page.");
                        }
                    }
                    setIsAuthReady(true);
                });
                return () => unsubscribe();
            } else {
                setError("Firebase configuration is missing.");
                setIsLoading(false);
            }
        } catch (e) {
            console.error("Firebase initialization error:", e);
            setError("Could not connect to the database.");
            setIsLoading(false);
        }
    }, []);

    // --- Firestore Data Fetching ---
    useEffect(() => {
        if (isAuthReady && db) {
            setIsLoading(true);
            const ticketsCollectionPath = `/artifacts/${appId}/public/data/tickets`;
            const ticketsQuery = query(collection(db, ticketsCollectionPath));

            const unsubscribe = onSnapshot(ticketsQuery, (snapshot) => {
                const ticketsData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    dateRaised: doc.data().dateRaised?.toDate(),
                    dateClosed: doc.data().dateClosed?.toDate(),
                }));
                setTickets(ticketsData);
                setIsLoading(false);
            }, (err) => {
                console.error("Firestore snapshot error:", err);
                setError("Failed to fetch tickets.");
                setIsLoading(false);
            });

            return () => unsubscribe();
        }
    }, [isAuthReady, db]);

    // --- Filtering and Sorting Logic ---
    const filteredAndSortedTickets = useMemo(() => {
        let processedTickets = [...tickets];
        processedTickets = processedTickets.filter(ticket => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = ticket.clientName?.toLowerCase().includes(searchLower) ||
                                  ticket.issueDescription?.toLowerCase().includes(searchLower) ||
                                  ticket.customTicketNumber?.toLowerCase().includes(searchLower) ||
                                  ticket.id?.toLowerCase().includes(searchLower) ||
                                  ticket.assignedTechnicianName?.toLowerCase().includes(searchLower);
            const matchesStatus = statusFilter === 'All' || ticket.status === statusFilter;
            const matchesPriority = priorityFilter === 'All' || ticket.priority === priorityFilter;
            return matchesSearch && matchesStatus && matchesPriority;
        });
        if (sortConfig.key) {
            processedTickets.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return processedTickets;
    }, [tickets, searchTerm, statusFilter, priorityFilter, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    // --- Modal Handling ---
    const openEditModal = (ticket = null) => {
        setSelectedTicket(ticket);
        setIsEditModalOpen(true);
    };
    const closeEditModal = () => {
        setIsEditModalOpen(false);
        setSelectedTicket(null);
    };
    const openDetailModal = (ticket) => {
        setSelectedTicket(ticket);
        setIsDetailModalOpen(true);
    };
    const closeDetailModal = () => {
        setIsDetailModalOpen(false);
        setSelectedTicket(null);
    };

    // --- CRUD Operations ---
    const handleSaveTicket = async (ticketData) => {
        if (!db) { setError("Database not connected."); return; }
        const ticketsCollectionPath = `/artifacts/${appId}/public/data/tickets`;
        try {
            if (selectedTicket) {
                const ticketRef = doc(db, ticketsCollectionPath, selectedTicket.id);
                const updatedData = { ...ticketData };
                if (ticketData.status === 'Closed' && !selectedTicket.dateClosed) {
                    updatedData.dateClosed = serverTimestamp();
                } else if (ticketData.status !== 'Closed') {
                    updatedData.dateClosed = null;
                }
                await updateDoc(ticketRef, updatedData);
            } else {
                await addDoc(collection(db, ticketsCollectionPath), {
                    ...ticketData,
                    dateRaised: serverTimestamp(),
                    dateClosed: null,
                    authorId: userId,
                });
            }
            closeEditModal();
        } catch (e) { console.error("Error saving ticket:", e); setError("Failed to save ticket."); }
    };

    const handleDeleteTicket = async (ticketId) => {
        if (!db) { setError("Database not connected."); return; }
        const isConfirmed = window.confirm("Are you sure you want to delete this ticket?");
        if (isConfirmed) {
            try {
                const ticketsCollectionPath = `/artifacts/${appId}/public/data/tickets`;
                await deleteDoc(doc(db, ticketsCollectionPath, ticketId));
            } catch (e) { console.error("Error deleting ticket:", e); setError("Failed to delete ticket."); }
        }
    };
    
    const handleImport = (file) => {
        if (!file) return;
        if (!window.Papa) {
            setError("CSV parsing library not ready. Please try again in a moment.");
            return;
        }
        setIsUploading(true);
        setError(null);
        setSuccessMessage(null);

        window.Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                if(results.errors.length > 0){
                    console.error("CSV Parsing errors:", results.errors);
                    setError(`Error parsing CSV: ${results.errors[0].message}`);
                    setIsUploading(false);
                    return;
                }
                
                const ticketsCollectionPath = `/artifacts/${appId}/public/data/tickets`;
                const batch = writeBatch(db);
                
                results.data.forEach(row => {
                    const newTicketRef = doc(collection(db, ticketsCollectionPath));
                    const newTicketData = {
                        customTicketNumber: row.customTicketNumber || '',
                        clientName: row.clientName || '',
                        issueDescription: row.issueDescription || '',
                        status: row.status || 'New',
                        priority: row.priority || 'Medium',
                        assignedTechnicianName: row.assignedTechnicianName || '',
                        assignedTechnicianEmail: row.assignedTechnicianEmail || '',
                        assignedTechnicianPhone: row.assignedTechnicianPhone || '',
                        resolutionNotes: '',
                        dateRaised: serverTimestamp(),
                        dateClosed: null,
                        authorId: userId,
                    };
                    batch.set(newTicketRef, newTicketData);
                });

                try {
                    await batch.commit();
                    setSuccessMessage(`Successfully imported ${results.data.length} tickets!`);
                } catch (e) {
                    console.error("Firestore batch write error:", e);
                    setError("Failed to import tickets to the database.");
                } finally {
                    setIsUploading(false);
                }
            },
            error: (error) => {
                console.error("CSV Parsing error:", error);
                setError("Failed to parse CSV file.");
                setIsUploading(false);
            }
        });
    };

    // --- Render ---
    return (
        <div className="bg-gray-100 min-h-screen font-sans text-gray-800">
            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                <Header onNewTicket={() => openEditModal()} />
                {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
                {successMessage && <SuccessMessage message={successMessage} onClose={() => setSuccessMessage(null)} />}
                {isUploading && <div className="fixed top-4 right-4 bg-blue-500 text-white p-3 rounded-lg shadow-lg z-50 flex items-center"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>Importing...</div>}
                
                <div className="bg-white rounded-xl shadow-lg mt-6">
                    <Toolbar view={view} setView={setView} tickets={filteredAndSortedTickets} librariesLoaded={librariesLoaded} onImport={handleImport} />
                    {view === 'list' && <FilterControls searchTerm={searchTerm} setSearchTerm={setSearchTerm} statusFilter={statusFilter} setStatusFilter={setStatusFilter} priorityFilter={priorityFilter} setPriorityFilter={setPriorityFilter} />}
                    <main className="p-4 md:p-6">
                        {isLoading ? <LoadingSpinner /> : (
                            view === 'dashboard' ? <Dashboard tickets={tickets} /> :
                            <TicketList tickets={filteredAndSortedTickets} onEdit={openEditModal} onDelete={handleDeleteTicket} onViewDetails={openDetailModal} requestSort={requestSort} sortConfig={sortConfig} />
                        )}
                    </main>
                </div>

                {isEditModalOpen && <TicketForm isOpen={isEditModalOpen} onClose={closeEditModal} onSave={handleSaveTicket} ticket={selectedTicket} />}
                {isDetailModalOpen && <TicketDetailModal isOpen={isDetailModalOpen} onClose={closeDetailModal} ticket={selectedTicket} />}
            </div>
        </div>
    );
}

// --- Sub-components ---

const Header = ({ onNewTicket }) => (
    <header className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">AI-Powered Issue Tracker</h1>
                <p className="text-gray-600 mt-1">Your shared workspace for managing support tickets with Gemini.</p>
            </div>
            <button onClick={onNewTicket} className="mt-4 sm:mt-0 flex items-center justify-center bg-blue-600 text-white font-semibold py-2 px-5 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition-all transform hover:scale-105">
                <PlusCircle className="w-5 h-5 mr-2" /> New Ticket
            </button>
        </div>
         <div className="mt-5 bg-teal-50/70 border-l-4 border-teal-400 text-teal-900 p-3.5 rounded-r-lg flex items-center text-sm shadow-sm">
            <Users className="w-6 h-6 mr-4 flex-shrink-0 text-teal-500" />
            <p><span className="font-semibold">Multi-User Ready:</span> This app is collaborative. Changes made by you or your team will appear in real-time.</p>
        </div>
        <div className="mt-3 bg-purple-50/70 border-l-4 border-purple-400 text-purple-900 p-3.5 rounded-r-lg flex items-center text-sm shadow-sm">
            <Upload className="w-6 h-6 mr-4 flex-shrink-0 text-purple-500" />
            <p><span className="font-semibold">CSV Import:</span> Use the Import button in the toolbar to upload tickets from a CSV file.</p>
        </div>
    </header>
);

const Toolbar = ({ view, setView, tickets, librariesLoaded, onImport }) => {
    const importInputRef = useRef(null);

    const exportToCSV = () => {
        const headers = ['customTicketNumber', 'clientName', 'issueDescription', 'status', 'priority', 'assignedTo', 'assignedTechnicianName', 'assignedTechnicianEmail', 'assignedTechnicianPhone', 'dateRaised', 'dateClosed', 'resolutionNotes'];
        const rows = tickets.map(ticket => headers.map(header => {
            let value = ticket[header];
            if (value instanceof Date) value = value.toLocaleString();
            const stringValue = String(value || '').replace(/"/g, '""');
            return `"${stringValue}"`;
        }).join(','));
        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "tickets.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportToPDF = () => {
        if (window.jspdf && window.jspdf.jsPDF) {
            const doc = new window.jspdf.jsPDF();
            doc.text("Issue Tracker Tickets", 14, 16);
            doc.autoTable({
                head: [['Ticket #', 'Client', 'Status', 'Priority', 'Technician', 'Date Raised']],
                body: tickets.map(t => [t.customTicketNumber, t.clientName, t.status, t.priority, t.assignedTechnicianName, t.dateRaised ? t.dateRaised.toLocaleDateString() : 'N/A']),
                startY: 20,
            });
            doc.save('tickets.pdf');
        } else {
            console.error("jsPDF or jsPDF-AutoTable not found. PDF export failed.");
        }
    };

    const handleImportClick = () => {
        importInputRef.current.click();
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        onImport(file);
        event.target.value = null; // Reset input
    };

    return (
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center bg-gray-50/50 rounded-t-xl">
            <div className="flex items-center space-x-1 bg-gray-200 p-1 rounded-lg mb-3 sm:mb-0">
                <button onClick={() => setView('dashboard')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${view === 'dashboard' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:bg-gray-200/50'}`}><PieChart className="w-4 h-4 inline-block mr-2"/>Dashboard</button>
                <button onClick={() => setView('list')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${view === 'list' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:bg-gray-200/50'}`}><List className="w-4 h-4 inline-block mr-2"/>Ticket List</button>
            </div>
            <div className="flex items-center space-x-3">
                <input type="file" ref={importInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
                <button onClick={handleImportClick} disabled={!librariesLoaded.csv} className="flex items-center text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <Upload className="w-4 h-4 mr-1.5"/>Import CSV
                </button>
                <button onClick={exportToCSV} className="flex items-center text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"><FileDown className="w-4 h-4 mr-1.5"/>Export CSV</button>
                <button onClick={exportToPDF} disabled={!librariesLoaded.pdf} className="flex items-center text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <FileDown className="w-4 h-4 mr-1.5"/>Export PDF
                </button>
            </div>
        </div>
    );
};

const FilterControls = ({ searchTerm, setSearchTerm, statusFilter, setStatusFilter, priorityFilter, setPriorityFilter }) => (
    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-gray-200">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" placeholder="Search tickets..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
        <div><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"><option value="All">All Statuses</option><option value="New">New</option><option value="In Progress">In Progress</option><option value="Solved">Solved</option><option value="Closed">Closed</option></select></div>
        <div><select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"><option value="All">All Priorities</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select></div>
    </div>
);

const Dashboard = ({ tickets }) => {
    const stats = useMemo(() => {
        const total = tickets.length;
        const open = tickets.filter(t => t.status === 'New' || t.status === 'In Progress').length;
        const closed = tickets.filter(t => t.status === 'Closed' || t.status === 'Solved').length;
        const highPriority = tickets.filter(t => t.priority === 'High' && (t.status === 'New' || t.status === 'In Progress')).length;
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

const StatCard = ({ title, value }) => (<div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm"><p className="text-sm font-medium text-gray-500">{title}</p><p className="text-3xl font-bold text-gray-900 mt-1">{value}</p></div>);
const ChartCard = ({ title, data }) => {
    const total = Object.values(data).reduce((sum, val) => sum + val, 0);
    const colors = { 'New': 'bg-blue-400', 'In Progress': 'bg-yellow-400', 'Solved': 'bg-green-400', 'Closed': 'bg-gray-400', 'High': 'bg-red-400', 'Medium': 'bg-orange-400', 'Low': 'bg-teal-400' };
    return (<div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm"><h3 className="font-semibold text-gray-800 mb-4">{title}</h3><div className="space-y-3">{Object.entries(data).map(([key, value]) => (<div key={key}><div className="flex justify-between text-sm mb-1"><span className="font-medium text-gray-600">{key}</span><span className="text-gray-500">{value}</span></div><div className="w-full bg-gray-200 rounded-full h-2.5"><div className={`${colors[key] || 'bg-gray-500'} h-2.5 rounded-full`} style={{ width: `${total > 0 ? (value / total) * 100 : 0}%` }}></div></div></div>))}</div></div>);
};

const TicketList = ({ tickets, onEdit, onDelete, onViewDetails, requestSort, sortConfig }) => {
    if (tickets.length === 0) return <p className="text-center py-16 text-gray-500">No tickets match the current filters.</p>;
    const getSortIndicator = (key) => { if (sortConfig.key === key) return sortConfig.direction === 'ascending' ? '▲' : '▼'; return <ArrowUpDown className="w-4 h-4 inline-block ml-1 text-gray-400" />; };
    return (<div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th onClick={() => requestSort('customTicketNumber')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">Ticket # {getSortIndicator('customTicketNumber')}</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th><th onClick={() => requestSort('status')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">Status {getSortIndicator('status')}</th><th onClick={() => requestSort('priority')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">Priority {getSortIndicator('priority')}</th><th onClick={() => requestSort('assignedTechnicianName')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">Assigned Tech {getSortIndicator('assignedTechnicianName')}</th><th onClick={() => requestSort('dateRaised')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">Date Raised {getSortIndicator('dateRaised')}</th><th onClick={() => requestSort('dateClosed')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">Date Closed {getSortIndicator('dateClosed')}</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{tickets.map(ticket => <TicketRow key={ticket.id} ticket={ticket} onEdit={onEdit} onDelete={onDelete} onViewDetails={onViewDetails} />)}</tbody></table></div>);
};

const TicketRow = ({ ticket, onEdit, onDelete, onViewDetails }) => {
    const statusColor = { 'New': 'bg-blue-100 text-blue-800', 'In Progress': 'bg-yellow-100 text-yellow-800', 'Solved': 'bg-green-100 text-green-800', 'Closed': 'bg-gray-100 text-gray-800' };
    const priorityColor = { 'High': 'text-red-600', 'Medium': 'text-yellow-600', 'Low': 'text-green-600' };
    return (<tr className="hover:bg-gray-50 transition-colors">
        <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-semibold text-gray-900">{ticket.customTicketNumber || 'N/A'}</div><div className="text-xs text-gray-400 font-mono truncate" title={ticket.id}>ID: {ticket.id.substring(0,6)}...</div></td>
        <td className="px-6 py-4 max-w-sm"><div className="text-sm font-medium text-gray-900">{ticket.clientName}</div><p className="text-sm text-gray-500 truncate">{ticket.issueDescription}</p></td>
        <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor[ticket.status] || 'bg-gray-100'}`}>{ticket.status}</span></td>
        <td className="px-6 py-4 whitespace-nowrap"><span className={`font-semibold ${priorityColor[ticket.priority] || ''}`}>{ticket.priority}</span></td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{ticket.assignedTechnicianName || '—'}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ticket.dateRaised ? new Date(ticket.dateRaised).toLocaleString() : 'N/A'}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ticket.dateClosed ? new Date(ticket.dateClosed).toLocaleString() : '—'}</td>
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <button onClick={() => onViewDetails(ticket)} className="text-gray-500 hover:text-blue-700 mr-4 transition-colors"><Eye className="w-5 h-5"/></button>
            <button onClick={() => onEdit(ticket)} className="text-indigo-600 hover:text-indigo-900 mr-4 transition-colors"><Edit className="w-5 h-5"/></button>
            <button onClick={() => onDelete(ticket.id)} className="text-red-600 hover:text-red-900 transition-colors"><Trash2 className="w-5 h-5"/></button>
        </td>
    </tr>);
};

const TicketForm = ({ isOpen, onClose, onSave, ticket }) => {
    const [formData, setFormData] = useState({ clientName: '', issueDescription: '', status: 'New', priority: 'Medium', assignedTo: '', resolutionNotes: '', customTicketNumber: '', assignedTechnicianName: '', assignedTechnicianEmail: '', assignedTechnicianPhone: '' });
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiError, setAiError] = useState(null);

    useEffect(() => {
        if (ticket) {
            setFormData({ clientName: ticket.clientName || '', issueDescription: ticket.issueDescription || '', status: ticket.status || 'New', priority: ticket.priority || 'Medium', assignedTo: ticket.assignedTo || '', resolutionNotes: ticket.resolutionNotes || '', customTicketNumber: ticket.customTicketNumber || '', assignedTechnicianName: ticket.assignedTechnicianName || '', assignedTechnicianEmail: ticket.assignedTechnicianEmail || '', assignedTechnicianPhone: ticket.assignedTechnicianPhone || '' });
        } else {
             setFormData({ clientName: '', issueDescription: '', status: 'New', priority: 'Medium', assignedTo: '', resolutionNotes: '', customTicketNumber: '', assignedTechnicianName: '', assignedTechnicianEmail: '', assignedTechnicianPhone: '' });
        }
    }, [ticket]);

    const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
    const handleSubmit = (e) => { e.preventDefault(); onSave(formData); };

    const callGeminiAPI = async (prompt) => {
        setIsGenerating(true);
        setAiError(null);
        try {
            const apiKey = ""; // Environment will provide this
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error(`API call failed with status: ${response.status}`);
            const result = await response.json();
            if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
                return result.candidates[0].content.parts[0].text;
            } else { throw new Error("Invalid response structure from Gemini API."); }
        } catch (error) {
            console.error("Gemini API error:", error);
            setAiError(error.message);
            return null;
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSuggestResolution = async () => {
        if (!formData.issueDescription) { setAiError("Please provide an issue description first."); return; }
        const prompt = `Based on the following customer issue, provide a concise set of troubleshooting steps or a potential resolution. Format it as a clear note for a support agent.\n\nIssue: "${formData.issueDescription}"`;
        const suggestion = await callGeminiAPI(prompt);
        if (suggestion) { setFormData(prev => ({ ...prev, resolutionNotes: suggestion })); }
    };

    const handleDraftReply = async () => {
        if (!formData.resolutionNotes) { setAiError("Please provide resolution notes first."); return; }
        const prompt = `Rewrite the following internal resolution notes into a polite, professional, and easy-to-understand email reply for a customer. Do not include a greeting or signature, just the body of the reply.\n\nInternal Notes: "${formData.resolutionNotes}"`;
        const reply = await callGeminiAPI(prompt);
        if (reply) { setFormData(prev => ({ ...prev, resolutionNotes: reply })); }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 transition-opacity">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-full overflow-y-auto transform transition-all scale-95 opacity-0 animate-fade-in-up">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 sm:p-8">
                        <div className="flex justify-between items-start"><h2 className="text-2xl font-bold text-gray-900">{ticket ? 'Edit Ticket' : 'Create New Ticket'}</h2><button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button></div>
                        <div className="mt-6 space-y-6">
                            <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6 border p-4 rounded-lg"><legend className="text-sm font-medium text-gray-600 px-2">Ticket & Client Info</legend>
                                <div><label htmlFor="customTicketNumber" className="block text-sm font-medium text-gray-700">Custom Ticket #</label><input type="text" name="customTicketNumber" id="customTicketNumber" value={formData.customTicketNumber} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" /></div>
                                <div><label htmlFor="clientName" className="block text-sm font-medium text-gray-700">Client Name</label><input type="text" name="clientName" id="clientName" value={formData.clientName} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" /></div>
                            </fieldset>
                             <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6 border p-4 rounded-lg"><legend className="text-sm font-medium text-gray-600 px-2">Assignment Details</legend>
                                <div><label htmlFor="assignedTechnicianName" className="block text-sm font-medium text-gray-700">Technician Name</label><input type="text" name="assignedTechnicianName" id="assignedTechnicianName" value={formData.assignedTechnicianName} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" /></div>
                                <div><label htmlFor="assignedTechnicianEmail" className="block text-sm font-medium text-gray-700">Technician Email</label><input type="email" name="assignedTechnicianEmail" id="assignedTechnicianEmail" value={formData.assignedTechnicianEmail} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" /></div>
                                <div className="md:col-span-2"><label htmlFor="assignedTechnicianPhone" className="block text-sm font-medium text-gray-700">Technician Phone</label><input type="tel" name="assignedTechnicianPhone" id="assignedTechnicianPhone" value={formData.assignedTechnicianPhone} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" /></div>
                            </fieldset>
                            <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-6 border p-4 rounded-lg"><legend className="text-sm font-medium text-gray-600 px-2">Status & Priority</legend>
                                <div><label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label><select id="status" name="status" value={formData.status} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"><option>New</option><option>In Progress</option><option>Solved</option><option>Closed</option></select></div>
                                <div><label htmlFor="priority" className="block text-sm font-medium text-gray-700">Priority</label><select id="priority" name="priority" value={formData.priority} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"><option>High</option><option>Medium</option><option>Low</option></select></div>
                            </fieldset>
                            <div className="md:col-span-2"><label htmlFor="issueDescription" className="block text-sm font-medium text-gray-700">Issue Description</label><textarea id="issueDescription" name="issueDescription" rows="4" value={formData.issueDescription} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"></textarea></div>
                            <div className="md:col-span-2">
                                <div className="flex justify-between items-center mb-1">
                                    <label htmlFor="resolutionNotes" className="block text-sm font-medium text-gray-700">Resolution Notes</label>
                                    <div className="flex space-x-2">
                                        <button type="button" onClick={handleSuggestResolution} disabled={isGenerating} className="flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-wait"><Sparkles className="w-4 h-4 mr-1"/>Suggest</button>
                                        <button type="button" onClick={handleDraftReply} disabled={isGenerating} className="flex items-center text-xs font-semibold text-purple-600 hover:text-purple-800 disabled:opacity-50 disabled:cursor-wait"><Sparkles className="w-4 h-4 mr-1"/>Draft Reply</button>
                                    </div>
                                </div>
                                <textarea id="resolutionNotes" name="resolutionNotes" rows="5" value={formData.resolutionNotes} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" placeholder={isGenerating ? 'Gemini is thinking...' : 'Enter resolution notes or use AI assist...'}></textarea>
                                {aiError && <p className="text-red-500 text-xs mt-1">{aiError}</p>}
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 rounded-b-xl"><button type="button" onClick={onClose} className="bg-white py-2 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Cancel</button><button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Save Ticket</button></div>
                </form>
            </div>
            <style>{`@keyframes fade-in-up { from { opacity: 0; transform: scale(0.95) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } } .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }`}</style>
        </div>
    );
};

const TicketDetailModal = ({ isOpen, onClose, ticket }) => {
    if (!isOpen) return null;

    const DetailItem = ({ label, value, children }) => (
        <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{label}</p>
            <div className="text-gray-900 text-sm mt-1">{children || value || '—'}</div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 transition-opacity">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-full overflow-y-auto transform transition-all scale-95 opacity-0 animate-fade-in-up">
                <div className="p-6 sm:p-8">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Ticket Details</h2>
                            <p className="text-sm text-gray-500 mt-1">Ticket #{ticket.customTicketNumber || ticket.id}</p>
                        </div>
                        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
                    </div>

                    <div className="mt-6 space-y-6">
                        <div className="border-b pb-4">
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">{ticket.clientName}</h3>
                            <p className="text-gray-700 whitespace-pre-wrap">{ticket.issueDescription}</p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <DetailItem label="Status"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${ { 'New': 'bg-blue-100 text-blue-800', 'In Progress': 'bg-yellow-100 text-yellow-800', 'Solved': 'bg-green-100 text-green-800', 'Closed': 'bg-gray-100 text-gray-800' }[ticket.status] || 'bg-gray-100'}`}>{ticket.status}</span></DetailItem>
                            <DetailItem label="Priority"><span className={`font-semibold ${{ 'High': 'text-red-600', 'Medium': 'text-yellow-600', 'Low': 'text-green-600' }[ticket.priority] || ''}`}>{ticket.priority}</span></DetailItem>
                            <DetailItem label="Date Raised" value={ticket.dateRaised ? new Date(ticket.dateRaised).toLocaleString() : 'N/A'} />
                            <DetailItem label="Date Closed" value={ticket.dateClosed ? new Date(ticket.dateClosed).toLocaleString() : 'Not Closed'} />
                        </div>
                        
                        <div className="border-t pt-4">
                            <h4 className="text-md font-semibold text-gray-700 mb-3">Assigned Technician</h4>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <DetailItem label="Name" value={ticket.assignedTechnicianName} />
                                <DetailItem label="Email">
                                    {ticket.assignedTechnicianEmail && <a href={`mailto:${ticket.assignedTechnicianEmail}`} className="text-blue-600 hover:underline flex items-center"><Mail className="w-4 h-4 mr-2"/>{ticket.assignedTechnicianEmail}</a>}
                                </DetailItem>
                                <DetailItem label="Phone">
                                    {ticket.assignedTechnicianPhone && <a href={`tel:${ticket.assignedTechnicianPhone}`} className="text-blue-600 hover:underline flex items-center"><Phone className="w-4 h-4 mr-2"/>{ticket.assignedTechnicianPhone}</a>}
                                </DetailItem>
                             </div>
                        </div>

                        {ticket.resolutionNotes && <div className="border-t pt-4">
                            <h4 className="text-md font-semibold text-gray-700 mb-2">Resolution Notes</h4>
                            <p className="text-gray-700 whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded-lg">{ticket.resolutionNotes}</p>
                        </div>}
                    </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 flex justify-end rounded-b-xl">
                    <button type="button" onClick={onClose} className="bg-blue-600 text-white py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Close</button>
                </div>
            </div>
            <style>{`@keyframes fade-in-up { from { opacity: 0; transform: scale(0.95) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } } .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }`}</style>
        </div>
    );
};

const LoadingSpinner = () => <div className="flex justify-center items-center py-20"><div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div></div>;
const ErrorMessage = ({ message, onClose }) => <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 my-4 rounded-lg flex justify-between items-center"><p>{message}</p><button onClick={onClose} className="text-red-500 hover:text-red-700"><X className="w-5 h-5" /></button></div>;
const SuccessMessage = ({ message, onClose }) => <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 my-4 rounded-lg flex justify-between items-center"><p>{message}</p><button onClick={onClose} className="text-green-500 hover:text-green-700"><X className="w-5 h-5" /></button></div>;
