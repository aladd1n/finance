import React, { useState, useMemo, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { 
  Users, 
  Receipt, 
  Plus, 
  Trash2, 
  Beer, 
  Coffee, 
  Utensils, 
  ChevronRight, 
  ChevronDown,
  CheckCircle2,
  XCircle,
  Calculator,
  Share2,
  Upload,
  Download,
  Save,
  Trash,
  FileText,
  CheckCircle,
  DollarSign,
  Cloud,
  CloudOff,
  RefreshCw,
  Camera,
  Moon,
  Sun,
  LogOut,
  LogIn,
  Shield,
  Calendar,
  Edit,
  Eye
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://finance.psszdh.workers.dev';

const App = () => {
  // --- State ---
  const appRef = useRef(null);
  const [user, setUser] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [billId, setBillId] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null); // 'syncing', 'synced', 'error' or null
  const [participants, setParticipants] = useState([]);
  const [newName, setNewName] = useState('');
  const [csvInput, setCsvInput] = useState('');
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [allEvents, setAllEvents] = useState([]);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [loadingEventData, setLoadingEventData] = useState(false);
  
  const [items, setItems] = useState([]);
  const [itemsExpanded, setItemsExpanded] = useState(true);
  const [receiptScanning, setReceiptScanning] = useState(false);
  const [extractedItems, setExtractedItems] = useState([]);
  const [showExtractedPreview, setShowExtractedPreview] = useState(false);

  const [taxPercent, setTaxPercent] = useState(10);
  const [tipPercent, setTipPercent] = useState(15);
  const [activeTab, setActiveTab] = useState('items'); // 'people', 'items', 'summary', 'dashboard'
  const [lastSaved, setLastSaved] = useState(null);

  const isAdmin = user?.role === 'admin';

  // --- API Functions ---
  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    ...(sessionId && { 'Authorization': `Bearer ${sessionId}` })
  });

  const handleLogin = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/google`);
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      setUser(null);
      setSessionId(null);
      localStorage.removeItem('sessionId');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const checkSession = async (sid) => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${sid}`
        }
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Session check error:', error);
      return false;
    }
  };

  const saveBillToServer = async (billData) => {
    if (!user) return null;
    try {
      setSyncStatus('syncing');
      
      // Include event_id in the bill data
      const dataWithEvent = {
        ...billData,
        event_id: currentEvent?.id || null
      };
      
      const response = billId 
        ? await fetch(`${API_URL}/api/bills/${billId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(dataWithEvent)
          })
        : await fetch(`${API_URL}/api/bills`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(dataWithEvent)
          });
      
      if (response.ok) {
        const savedBill = await response.json();
        if (!billId) setBillId(savedBill.id);
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus(null), 2000);
        return savedBill;
      } else {
        throw new Error('Cloudflare D1 save failed');
      }
    } catch (error) {
      console.error('Failed to save to Cloudflare D1:', error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus(null), 3000);
      return null;
    }
  };

  const loadBillFromServer = async (id) => {
    try {
      const response = await fetch(`${API_URL}/api/bills/${id}`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const bill = await response.json();
        return bill;
      }
    } catch (error) {
      console.error('Failed to load from Cloudflare D1:', error);
    }
    return null;
  };

  const loadLatestBillFromServer = async () => {
    try {
      const eventParam = currentEvent?.id ? `?event_id=${currentEvent.id}` : '';
      const response = await fetch(`${API_URL}/api/bills${eventParam}`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const bills = await response.json();
        if (bills.length > 0) {
          return bills[bills.length - 1];
        }
      }
    } catch (error) {
      console.error('Failed to load latest bill from Cloudflare D1:', error);
    }
    return null;
  };

  // --- Event Management Functions ---
  const loadEvents = async () => {
    if (!user) return;
    try {
      const response = await fetch(`${API_URL}/api/events`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const events = await response.json();
        setAllEvents(events);
      }
    } catch (error) {
      console.error('Failed to load events:', error);
    }
  };

  const createEvent = async () => {
    if (!isAdmin || !newEventTitle.trim()) return;
    try {
      const response = await fetch(`${API_URL}/api/events`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: newEventTitle,
          event_date: newEventDate || null
        })
      });
      if (response.ok) {
        const event = await response.json();
        setAllEvents([...allEvents, event]);
        setNewEventTitle('');
        setNewEventDate('');
      }
    } catch (error) {
      console.error('Failed to create event:', error);
    }
  };

  const deleteEvent = async (eventId) => {
    if (!isAdmin) return;
    if (!confirm('Delete this event? All associated bills will also be deleted.')) return;
    try {
      const response = await fetch(`${API_URL}/api/events/${eventId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (response.ok) {
        setAllEvents(allEvents.filter(e => e.id !== eventId));
        if (currentEvent?.id === eventId) {
          setCurrentEvent(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete event:', error);
    }
  };

  const enterEvent = async (event) => {
    setLoadingEventData(true);
    setCurrentEvent(event);
    setActiveTab('items');
    
    // Load bills for this event first
    try {
      const response = await fetch(`${API_URL}/api/bills?event_id=${event.id}`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const bills = await response.json();
        if (bills.length > 0) {
          // Load existing data
          const latestBill = bills[0];
          setParticipants(latestBill.participants || []);
          setItems(latestBill.items || []);
          setTaxPercent(latestBill.taxPercent !== undefined ? latestBill.taxPercent : 10);
          setTipPercent(latestBill.tipPercent !== undefined ? latestBill.tipPercent : 15);
          setBillId(latestBill.id || null);
        } else {
          // No existing data, start fresh
          setParticipants([]);
          setItems([]);
          setBillId(null);
          setTaxPercent(10);
          setTipPercent(15);
        }
      } else {
        // Error or no data, start fresh
        setParticipants([]);
        setItems([]);
        setBillId(null);
        setTaxPercent(10);
        setTipPercent(15);
      }
      setExtractedItems([]);
      setShowExtractedPreview(false);
    } catch (error) {
      console.error('Failed to load event bills:', error);
      // On error, start fresh
      setParticipants([]);
      setItems([]);
      setBillId(null);
      setTaxPercent(10);
      setTipPercent(15);
    } finally {
      setLoadingEventData(false);
    }
  };

  const exitEvent = () => {
    setCurrentEvent(null);
    loadEvents();
  };

  // --- Check authentication on mount ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionParam = params.get('session');
    
    if (sessionParam) {
      // Clear session parameter from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      setSessionId(sessionParam);
      localStorage.setItem('sessionId', sessionParam);
      checkSession(sessionParam);
    } else {
      const storedSession = localStorage.getItem('sessionId');
      if (storedSession) {
        setSessionId(storedSession);
        checkSession(storedSession);
      }
    }
  }, []);

  // --- Load events on login ---
  useEffect(() => {
    if (!user) return;
    loadEvents();
  }, [user]);

  useEffect(() => {
    // Only admins can auto-save bills and only within an event
    if (!isAdmin || !currentEvent || loadingEventData) return;
    
    // Skip saving on initial mount (before data is loaded from server)
    if (billId === null && participants.length === 0 && items.length === 0) {
      return;
    }

    const data = {
      participants,
      items,
      taxPercent,
      tipPercent,
      timestamp: new Date().toISOString()
    };
    
    // Save to Cloudflare D1 database (admin only)
    const timeoutId = setTimeout(() => {
      saveBillToServer(data);
      setLastSaved(new Date());
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [participants, items, taxPercent, tipPercent, currentEvent, loadingEventData]);

  // --- Logic ---
  
  const addParticipant = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const nextId = Math.random().toString(36).substr(2, 9);
    setParticipants([...participants, { id: nextId, name: newName.trim(), paid: false, amountPaid: 0 }]);
    setNewName('');
  };

  const importCsv = (e) => {
    e.preventDefault();
    if (!csvInput.trim()) return;
    
    const names = csvInput.split(',').map(n => n.trim()).filter(n => n.length > 0);
    const existingNames = new Set(participants.map(p => p.name.toLowerCase()));
    const newParticipants = names
      .filter(name => !existingNames.has(name.toLowerCase()))
      .map(name => ({
        id: Math.random().toString(36).substr(2, 9),
        name: name,
        paid: false,
        amountPaid: 0
      }));
    
    if (newParticipants.length > 0) {
      setParticipants([...participants, ...newParticipants]);
      setCsvInput('');
      setShowCsvImport(false);
    }
  };

  const clearAllParticipants = () => {
    if (window.confirm('Bütün iştirakçıları silmək istəyirsiniz? Bu, məhsul təyinatlarını da təmizləyəcək.')) {
      setParticipants([]);
      setItems(items.map(item => ({ ...item, participants: [] })));
    }
  };

  const togglePaid = (id) => {
    setParticipants(participants.map(p => 
      p.id === id ? { ...p, paid: !p.paid } : p
    ));
  };

  const updateAmountPaid = (id, amount) => {
    setParticipants(participants.map(p => 
      p.id === id ? { ...p, amountPaid: amount === '' ? 0 : parseFloat(amount) || 0 } : p
    ));
  };

  const removeParticipant = (id) => {
    setParticipants(participants.filter(p => p.id !== id));
    // Also remove from all item participation
    setItems(items.map(item => ({
      ...item,
      participants: item.participants.filter(pId => pId !== id)
    })));
  };

  const addItem = () => {
    const newItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'New Item',
      price: 0,
      category: 'food',
      participants: participants.map(p => p.id), // Default all included
      paidBy: {} // Nobody paid yet
    };
    setItems([...items, newItem]);
  };

  const clearAllItems = () => {
    if (window.confirm('Bütün məhsulları silmək istəyirsiniz?')) {
      setItems([]);
    }
  };

  const duplicateItem = (item) => {
    const newItem = {
      ...item,
      id: Math.random().toString(36).substr(2, 9),
      name: item.name + ' (Copy)'
    };
    setItems([...items, newItem]);
  };

  // Receipt scanning function
  const handleReceiptUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setReceiptScanning(true);
    setExtractedItems([]);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Image = event.target.result.split(',')[1];
        
        const response = await fetch(`${API_URL}/api/scan-receipt`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ image: base64Image })
        });

        if (!response.ok) {
          throw new Error('Failed to scan receipt');
        }

        const data = await response.json();
        setExtractedItems(data.items || []);
        setShowExtractedPreview(true);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Receipt scanning error:', error);
      alert('Qəbzi skan edərkən xəta baş verdi');
    } finally {
      setReceiptScanning(false);
    }
  };

  // Add extracted items to the list
  const addExtractedItems = () => {
    const newItems = extractedItems.map(item => ({
      id: Math.random().toString(36).substr(2, 9),
      name: item.name,
      price: parseFloat(item.price) || 0,
      category: 'food',
      participants: [],
      paidBy: {}
    }));
    setItems([...items, ...newItems]);
    setShowExtractedPreview(false);
    setExtractedItems([]);
  };

  const exportToCSV = () => {
    let csv = 'Person,Amount,Status\n';
    participants.forEach(p => {
      csv += `${p.name},${(totals.finalShares[p.id] || 0).toFixed(2)},${p.paid ? 'Paid' : 'Pending'}\n`;
    });
    csv += `\nTotal,${totals.grandTotal.toFixed(2)}\n`;
    csv += `\nItem,Price,Category,Shared By\n`;
    items.forEach(item => {
      const sharedBy = item.participants.map(pid => {
        const p = participants.find(p => p.id === pid);
        return p ? p.name : '';
      }).join('; ');
      csv += `${item.name},${item.price},${item.category},"${sharedBy}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bill-split-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const exportToJSON = () => {
    const data = {
      participants,
      items,
      taxPercent,
      tipPercent,
      totals,
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bill-split-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const exportAsImage = async () => {
    if (!appRef.current) return;
    
    try {
      // Hide the floating save indicator temporarily
      const floatingElement = document.querySelector('.fixed.bottom-6');
      const originalDisplay = floatingElement ? floatingElement.style.display : null;
      if (floatingElement) floatingElement.style.display = 'none';

      const canvas = await html2canvas(appRef.current, {
        backgroundColor: '#f8fafc',
        scale: 2,
        logging: false,
        useCORS: true
      });

      // Restore the floating element
      if (floatingElement && originalDisplay !== null) {
        floatingElement.style.display = originalDisplay;
      }

      canvas.toBlob((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `hesab-${new Date().toISOString().split('T')[0]}.png`;
        a.click();
        window.URL.revokeObjectURL(url);
      });
    } catch (error) {
      console.error('Şəkil ixracında xəta:', error);
      alert('Şəkil ixracında xəta baş verdi!');
    }
  };

  const resetAll = () => {
    if (window.confirm('Hər şeyi sıfırlamaq istəyirsiniz? Bu, bütün məlumatları təmizləyəcək.')) {
      setParticipants([]);
      setItems([]);
      setTaxPercent(10);
      setTipPercent(15);
      setBillId(null);
      // Clear from server by saving empty state
      const emptyData = {
        participants: [],
        items: [],
        taxPercent: 10,
        tipPercent: 15,
        timestamp: new Date().toISOString()
      };
      saveBillToServer(emptyData);
    }
  };

  const updateItem = (id, field, value) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const toggleParticipation = (itemId, personId) => {
    setItems(items.map(item => {
      if (item.id !== itemId) return item;
      const isParticipating = item.participants.includes(personId);
      return {
        ...item,
        participants: isParticipating 
          ? item.participants.filter(id => id !== personId)
          : [...item.participants, personId]
      };
    }));
  };

  // Helper function to calculate total amount paid
  const getTotalPaid = (paidByObj) => {
    return Object.values(paidByObj || {}).reduce((sum, amt) => sum + Number(amt), 0);
  };

  const togglePaidBy = (itemId, personId) => {
    setItems(items.map(item => {
      if (item.id !== itemId) return item;
      const paidByObj = item.paidBy || {};
      const isPayer = paidByObj.hasOwnProperty(personId);
      
      if (isPayer) {
        // Remove this person from payers
        const { [personId]: removed, ...rest } = paidByObj;
        return { ...item, paidBy: rest };
      } else {
        // Add this person as a payer with default amount (equal split of remaining)
        const currentTotal = getTotalPaid(paidByObj);
        const remaining = Math.max(0, Number(item.price) - currentTotal);
        return { 
          ...item, 
          paidBy: { ...paidByObj, [personId]: remaining } 
        };
      }
    }));
  };

  const updatePaidAmount = (itemId, personId, amount) => {
    setItems(items.map(item => {
      if (item.id !== itemId) return item;
      const paidByObj = item.paidBy || {};
      return {
        ...item,
        paidBy: {
          ...paidByObj,
          [personId]: amount === '' ? 0 : parseFloat(amount) || 0
        }
      };
    }));
  };

  // --- Calculations ---

  const totals = useMemo(() => {
    const personShares = {};
    participants.forEach(p => { personShares[p.id] = 0; });

    let subtotal = 0;

    items.forEach(item => {
      subtotal += Number(item.price);
      if (item.participants.length === 0) return;
      
      const perPerson = Number(item.price) / item.participants.length;
      item.participants.forEach(pId => {
        if (personShares[pId] !== undefined) {
          personShares[pId] += perPerson;
        }
      });
    });

    const taxAmount = subtotal * (taxPercent / 100);
    const tipAmount = subtotal * (tipPercent / 100);
    const grandTotal = subtotal + taxAmount + tipAmount;

    // Distribute Tax & Tip proportionally based on subtotal share
    const finalShares = {};
    participants.forEach(p => {
      const shareRatio = subtotal > 0 ? personShares[p.id] / subtotal : 0;
      finalShares[p.id] = personShares[p.id] + (taxAmount * shareRatio) + (tipAmount * shareRatio);
    });

    return { subtotal, taxAmount, tipAmount, grandTotal, finalShares };
  }, [items, participants, taxPercent, tipPercent]);

  // Settlement calculations - who owes whom
  const settlements = useMemo(() => {
    const balances = {}; // Positive = owed money, Negative = owes money
    participants.forEach(p => { balances[p.id] = 0; });

    items.forEach(item => {
      const price = Number(item.price);
      if (price === 0 || item.participants.length === 0) return;

      const perPerson = price / item.participants.length;
      const paidByObj = item.paidBy || {};
      const payers = Object.keys(paidByObj);
      
      if (payers.length === 0) return; // Nobody paid, skip settlement

      // People who paid get credited with their actual payment
      payers.forEach(payerId => {
        if (balances[payerId] !== undefined) {
          balances[payerId] += Number(paidByObj[payerId]);
        }
      });

      // People who consumed get debited
      item.participants.forEach(consumerId => {
        if (balances[consumerId] !== undefined) {
          balances[consumerId] -= perPerson;
        }
      });
    });

    // Create settlement transactions (who pays whom)
    const transactions = [];
    const creditors = participants.filter(p => balances[p.id] > 0.01).sort((a, b) => balances[b.id] - balances[a.id]);
    const debtors = participants.filter(p => balances[p.id] < -0.01).sort((a, b) => balances[a.id] - balances[b.id]);

    let i = 0, j = 0;
    while (i < creditors.length && j < debtors.length) {
      const creditor = creditors[i];
      const debtor = debtors[j];
      const amount = Math.min(balances[creditor.id], -balances[debtor.id]);

      if (amount > 0.01) {
        transactions.push({
          from: debtor.id,
          fromName: debtor.name,
          to: creditor.id,
          toName: creditor.name,
          amount: amount
        });

        balances[creditor.id] -= amount;
        balances[debtor.id] += amount;
      }

      if (Math.abs(balances[creditor.id]) < 0.01) i++;
      if (Math.abs(balances[debtor.id]) < 0.01) j++;
    }

    return { balances, transactions };
  }, [items, participants]);

  // --- Components ---

  const CategoryIcon = ({ category }) => {
    switch (category) {
      case 'alcohol': return <Beer className="w-4 h-4 text-amber-500" />;
      case 'tea': return <Coffee className="w-4 h-4 text-emerald-500" />;
      default: return <Utensils className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-slate-50 text-slate-900'} font-sans transition-colors duration-200`}>
        {!user ? (
          // Login Screen
          <div className="min-h-screen flex items-center justify-center p-4">
            <div className={`max-w-md w-full ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-8 text-center`}>
              <Calculator className="w-16 h-16 mx-auto mb-4 text-blue-600" />
              <h1 className="text-3xl font-bold mb-2">SplitIt Pro</h1>
              <p className={`mb-8 ${darkMode ? 'text-gray-400' : 'text-slate-600'}`}>
                Qrup xərclərini asanlıqla bölüşdürün
              </p>
              <button
                onClick={handleLogin}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition"
              >
                <LogIn size={20} />
                Google ilə daxil ol
              </button>
            </div>
          </div>
        ) : (
        <div ref={appRef}>
          {/* Header */}
          <header className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-b'} sticky top-0 z-10 p-4 shadow-sm`}>
            <div className="max-w-2xl mx-auto flex justify-between items-center">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Calculator className="text-blue-600" /> SplitIt Pro
                </h1>
                {isAdmin && (
                  <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full flex items-center gap-1">
                    <Shield size={12} /> Admin
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-slate-500'} uppercase font-bold`}>Ümumi Hesab</div>
                  <div className="text-lg font-black text-blue-600">₼{totals.grandTotal.toFixed(2)}</div>
                </div>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-slate-100 hover:bg-slate-200'} transition`}
                  title={darkMode ? 'İşıqlı rejim' : 'Qaranlıq rejim'}
                >
                  {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>
                <button
                  onClick={handleLogout}
                  className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-slate-100 hover:bg-slate-200'} transition`}
                  title="Çıxış"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </div>
          </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        
        {/* Dashboard - Event Management */}
        {!currentEvent && (
          <div className="space-y-6">
            {/* Welcome Header */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-6 shadow-lg`}>
              <h2 className="text-2xl font-bold mb-2">Tədbirlər Paneli</h2>
              <p className={`${darkMode ? 'text-gray-400' : 'text-slate-600'}`}>
                Tədbirlərinizi idarə edin və hər bir tədbir üçün xərcləri bölüşdürün
              </p>
            </div>

            {/* Create Event (Admin Only) */}
            {isAdmin && (
              <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-6 shadow-lg`}>
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Plus className="text-blue-600" /> Yeni Tədbir Yarat
                </h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Tədbir adı (məs. Doğum günü 2024)"
                    className={`w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none ${darkMode ? 'bg-gray-700 text-gray-100 border-gray-600' : 'bg-white text-gray-900 border-gray-300'}`}
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                  />
                  <input
                    type="date"
                    className={`w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none ${darkMode ? 'bg-gray-700 text-gray-100 border-gray-600' : 'bg-white text-gray-900 border-gray-300'}`}
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                  />
                  <button
                    onClick={createEvent}
                    disabled={!newEventTitle.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition"
                  >
                    <Plus size={20} /> Tədbir Yarat
                  </button>
                </div>
              </div>
            )}

            {/* Events List */}
            <div>
              <h3 className="font-bold text-lg mb-4">Tədbirlər ({allEvents.length})</h3>
              {allEvents.length === 0 ? (
                <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-8 shadow-lg text-center`}>
                  <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p className={`${darkMode ? 'text-gray-400' : 'text-slate-600'}`}>
                    Hələ heç bir tədbir yoxdur
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allEvents.map(event => (
                    <div 
                      key={event.id}
                      className={`${darkMode ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white hover:bg-gray-50'} rounded-2xl p-4 shadow-lg cursor-pointer transition group`}
                      onClick={() => enterEvent(event)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-bold text-lg">{event.title}</h4>
                          {event.event_date && (
                            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-slate-600'}`}>
                              {new Date(event.event_date).toLocaleDateString('az-AZ')}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {isAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteEvent(event.id);
                              }}
                              className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-red-600' : 'bg-slate-100 hover:bg-red-600'} text-red-500 hover:text-white transition`}
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                          <ChevronRight className="text-blue-600 group-hover:translate-x-1 transition" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bill Management - shown when event is selected */}
        {currentEvent && (
          <>
            {/* Back to Dashboard Button */}
            <button
              onClick={exitEvent}
              className={`${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'} rounded-xl p-3 shadow flex items-center gap-2 font-medium transition`}
            >
              <ChevronRight className="rotate-180" size={20} />
              Tədbirlərə qayıt
            </button>

            {/* Current Event Header */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-4 shadow-lg`}>
              <div className="flex items-center gap-3">
                <Calendar className="text-blue-600" size={24} />
                <div>
                  <h2 className="text-xl font-bold">{currentEvent.title}</h2>
                  {currentEvent.event_date && (
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-slate-600'}`}>
                      {new Date(currentEvent.event_date).toLocaleDateString('az-AZ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
        
        {/* Navigation Tabs */}
        <div className="flex bg-slate-200 p-1 rounded-xl gap-1">
          <button 
            onClick={() => setActiveTab('people')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'people' ? 'bg-white shadow text-blue-600' : 'text-slate-600'}`}
          >
            <Users size={16} /> İştirakçılar ({participants.length})
          </button>
          <button 
            onClick={() => setActiveTab('items')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'items' ? 'bg-white shadow text-blue-600' : 'text-slate-600'}`}
          >
            <Receipt size={16} /> Məhsullar ({items.length})
          </button>
          <button 
            onClick={() => setActiveTab('summary')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'summary' ? 'bg-white shadow text-blue-600' : 'text-slate-600'}`}
          >
            <Share2 size={16} /> Xülasə
          </button>
        </div>

        {/* Section: People Management */}
        {activeTab === 'people' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            {/* Single Add */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3">
              <div className="text-xs font-bold text-blue-700 mb-2">Cəmi: {participants.length} nəfər</div>
            </div>
            <form onSubmit={addParticipant} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Ad (məs. Əli)" 
                className={`flex-1 p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none ${darkMode ? 'bg-gray-700 text-gray-100 border-gray-600' : 'bg-white text-gray-900 border-gray-300'}`}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <button type="submit" className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition">
                <Plus />
              </button>
            </form>

            {/* Bulk Actions */}
            <div className="flex gap-2">
              <button 
                onClick={() => setShowCsvImport(!showCsvImport)}
                className="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 transition flex items-center justify-center gap-2 text-sm font-medium"
              >
                <Upload size={16} /> Toplu İdxal (CSV)
              </button>
              {participants.length > 0 && (
                <button 
                  onClick={clearAllParticipants}
                  className="bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 transition flex items-center gap-2 text-sm font-medium"
                >
                  <Trash size={16} /> Hamısını Təmizlə
                </button>
              )}
            </div>

            {/* CSV Import Section */}
            {showCsvImport && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-blue-900">Çoxlu Ad İdxal Et</h3>
                  <button onClick={() => setShowCsvImport(false)} className="text-blue-600 hover:text-blue-800">
                    <XCircle size={20} />
                  </button>
                </div>
                <p className="text-xs text-blue-700">Vergüllə ayrılmış adları daxil edin (məs. Əli, Vəli, Kamran)</p>
                <form onSubmit={importCsv} className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Əli, Vəli, Kamran, Elçin..." 
                    className={`flex-1 p-3 rounded-xl border-2 focus:ring-2 focus:ring-blue-500 outline-none ${darkMode ? 'bg-gray-700 text-gray-100 border-gray-600' : 'bg-white text-gray-900 border-blue-300'}`}
                    value={csvInput}
                    onChange={(e) => setCsvInput(e.target.value)}
                  />
                  <button type="submit" className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition font-medium">
                    İdxal
                  </button>
                </form>
              </div>
            )}
            
            {/* Participants List */}
            <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-2xl shadow-sm border overflow-hidden`}>
              {participants.map((p, idx) => (
                <div key={p.id} className={`p-4 ${idx !== participants.length - 1 ? 'border-b' : ''} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <button 
                        onClick={() => togglePaid(p.id)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${
                          p.paid ? 'bg-green-500 border-green-500' : 'border-slate-300 hover:border-green-400'
                        }`}
                      >
                        {p.paid && <CheckCircle size={16} className="text-white" />}
                      </button>
                      <div>
                        <span className={`font-medium ${p.paid ? 'line-through text-slate-400' : ''}`}>{p.name}</span>
                        {p.paid && <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Ödənildi</span>}
                      </div>
                    </div>
                    <button onClick={() => removeParticipant(p.id)} className="text-slate-400 hover:text-red-500 p-1 transition">
                      <Trash2 size={18} />
                    </button>
                  </div>
                  
                  {/* Payment Amount Input */}
                  <div className="ml-9 flex items-center gap-2">
                    <label className="text-xs text-slate-500 whitespace-nowrap">Ödənilən məbləğ:</label>
                    <div className="flex-1 relative">
                      <span className="absolute left-2 top-1.5 text-slate-400 text-sm">₼</span>
                      <input 
                        type="number"
                        step="0.01"
                        min="0"
                        className={`w-full pl-6 pr-2 py-1.5 rounded-lg border text-sm ${darkMode ? 'bg-gray-700 text-gray-100 border-gray-600' : 'bg-slate-50 text-gray-900 border-gray-300'}`}
                        value={p.amountPaid ?? ''}
                        onChange={(e) => updateAmountPaid(p.id, e.target.value)}
                        placeholder="0.00"
                        disabled={!isAdmin}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {participants.length === 0 && (
                <div className="p-8 text-center text-slate-400 italic">Hələ heç kim əlavə edilməyib. Yuxarıda əlavə edin və ya toplu idxal istifadə edin!</div>
              )}
            </div>
          </div>
        )}

        {/* Section: Items Management */}
        {activeTab === 'items' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-3 flex justify-between items-center">
              <div className="text-xs font-bold text-emerald-700">Cəmi: {items.length} məhsul</div>
              <button 
                onClick={() => setItemsExpanded(!itemsExpanded)}
                className="text-emerald-700 hover:text-emerald-900 transition"
              >
                {itemsExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </button>
            </div>
            {itemsExpanded && (
            <div className="max-h-[600px] overflow-y-auto space-y-4 pr-2">
            {items.map((item) => (
              <div key={item.id} className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-2xl shadow-sm border p-4 space-y-4`}>
                <div className="flex gap-3 items-start">
                  <div className="flex-1 space-y-3">
                    <input 
                      className={`text-lg font-bold w-full bg-transparent border-b focus:border-blue-200 outline-none ${darkMode ? 'text-gray-100 border-gray-700' : 'text-gray-900 border-transparent'}`}
                      value={item.name}
                      onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                      placeholder="Məhsulun Adı"
                      disabled={!isAdmin}
                    />
                    <div className="flex gap-4">
                      <div className="flex-1 relative">
                        <span className={`absolute left-3 top-2 ${darkMode ? 'text-gray-400' : 'text-slate-400'}`}>₼</span>
                        <input 
                          type="number"
                          className={`w-full pl-7 pr-3 py-2 rounded-lg border text-sm ${darkMode ? 'bg-gray-700 text-gray-100 border-gray-600' : 'bg-slate-50 text-gray-900 border-gray-300'}`}
                          value={item.price}
                          onChange={(e) => updateItem(item.id, 'price', e.target.value)}
                          disabled={!isAdmin}
                        />
                      </div>
                      <select 
                        className={`border rounded-lg px-2 text-sm ${darkMode ? 'bg-gray-700 text-gray-100 border-gray-600' : 'bg-slate-50 text-gray-900 border-gray-300'}`}
                        value={item.category}
                        onChange={(e) => updateItem(item.id, 'category', e.target.value)}
                        disabled={!isAdmin}
                      >
                        <option value="food">Yemək</option>
                        <option value="alcohol">Alkoqol</option>
                        <option value="tea">Çay/Alkoqolsuz</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => duplicateItem(item)} 
                      className="text-slate-400 hover:text-blue-500 transition"
                      title="Duplicate item"
                    >
                      <FileText size={18} />
                    </button>
                    <button 
                      onClick={() => setItems(items.filter(i => i.id !== item.id))} 
                      className="text-slate-300 hover:text-red-500 transition"
                      title="Delete item"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Users size={12}/> İştirak ({item.participants.length})
                    </h4>
                    <button 
                      onClick={() => updateItem(item.id, 'participants', item.participants.length === participants.length ? [] : participants.map(p => p.id))}
                      className="text-xs text-blue-600 font-medium"
                    >
                      {item.participants.length === participants.length ? 'Hamısını Təmizlə' : 'Hamısını Seç'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {participants.map(p => {
                      const isActive = item.participants.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => toggleParticipation(item.id, p.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition flex items-center gap-1.5
                            ${isActive ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500'}
                          `}
                        >
                          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-blue-500' : 'bg-slate-300'}`} />
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                  {item.participants.length > 0 && (
                    <div className="mt-3 text-[10px] text-slate-400 text-right italic">
                      Hər biri ödəyir: ₼{(item.price / item.participants.length).toFixed(2)}
                    </div>
                  )}
                </div>

                {/* Who Paid Section */}
                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                      <DollarSign size={12}/> Kim Ödədi? ({Object.keys(item.paidBy || {}).length})
                    </h4>
                    <button 
                      onClick={() => {
                        const allPaid = Object.keys(item.paidBy || {}).length === participants.length;
                        if (allPaid) {
                          updateItem(item.id, 'paidBy', {});
                        } else {
                          // Split equally among all participants
                          const perPerson = item.price / participants.length;
                          const newPaidBy = {};
                          participants.forEach(p => {
                            newPaidBy[p.id] = perPerson;
                          });
                          updateItem(item.id, 'paidBy', newPaidBy);
                        }
                      }}
                      className="text-xs text-emerald-600 font-medium"
                    >
                      {Object.keys(item.paidBy || {}).length === participants.length ? 'Hamısını Təmizlə' : 'Hamısını Seç'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {participants.map(p => {
                      const paidByObj = item.paidBy || {};
                      const isPayer = paidByObj.hasOwnProperty(p.id);
                      const amount = isPayer ? paidByObj[p.id] : 0;
                      
                      return (
                        <div key={p.id} className="flex items-center gap-2">
                          <button
                            onClick={() => togglePaidBy(item.id, p.id)}
                            className={`flex-shrink-0 w-5 h-5 rounded-full border-2 transition flex items-center justify-center
                              ${isPayer ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'}
                            `}
                          >
                            {isPayer && (
                              <CheckCircle size={12} className="text-white" strokeWidth={3} />
                            )}
                          </button>
                          <span className={`flex-1 text-sm font-medium ${isPayer ? 'text-slate-700' : 'text-slate-400'}`}>
                            {p.name}
                          </span>
                          {isPayer && (
                            <div className="flex items-center gap-1">
                              <span className="text-slate-500 text-xs">₼</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={amount === 0 ? '0' : amount || ''}
                                onChange={(e) => updatePaidAmount(item.id, p.id, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-20 px-2 py-1 text-sm border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-emerald-50"
                                placeholder="0.00"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {Object.keys(item.paidBy || {}).length > 0 && (
                    <div className="mt-3 text-[10px] text-slate-400 text-right italic">
                      Cəmi ödənildi: ₼{getTotalPaid(item.paidBy).toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            ))}
            </div>
            )}

            {isAdmin && (
            <div className="space-y-4">
              {/* Receipt Scanner */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-purple-900 flex items-center gap-2">
                      <Camera size={18} /> Qəbz Skaner
                    </h3>
                    <p className="text-xs text-purple-600 mt-1">Qəbz şəklini yükləyin və məhsullar avtomatik əlavə edilsin</p>
                  </div>
                </div>
                <label className="flex items-center justify-center gap-2 py-3 px-4 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition cursor-pointer font-medium">
                  <Camera size={18} /> {receiptScanning ? 'Yüklənir...' : 'Qəbz Şəkli Seç'}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleReceiptUpload}
                    className="hidden"
                    disabled={receiptScanning}
                  />
                </label>
              </div>

              {/* Extracted Items Preview */}
              {showExtractedPreview && extractedItems.length > 0 && (
                <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-green-900">Tapılan Məhsullar ({extractedItems.length})</h3>
                    <button onClick={() => setShowExtractedPreview(false)} className="text-green-600 hover:text-green-800">
                      <XCircle size={20} />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {extractedItems.map((item, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-3 flex justify-between items-center">
                        <span className="font-medium text-gray-800">{item.name}</span>
                        <span className="text-green-700 font-bold">₼{item.price}</span>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={addExtractedItems}
                    className="w-full py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition font-medium flex items-center justify-center gap-2"
                  >
                    <Plus size={18} /> Hamısını Əlavə Et
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <button 
                  onClick={addItem}
                  className="flex-1 py-4 border-2 border-dashed border-slate-300 rounded-2xl text-slate-500 font-medium hover:border-blue-400 hover:text-blue-500 transition flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> Yeni Məhsul Əlavə Et
                </button>
                {items.length > 0 && (
                  <button 
                    onClick={clearAllItems}
                    className="bg-red-600 text-white px-6 py-4 rounded-2xl hover:bg-red-700 transition flex items-center gap-2"
                  >
                    <Trash size={18} /> Hamısını Təmizlə
                  </button>
                )}
              </div>
            </div>
            )}
          </div>
        )}

        {/* Section: Summary & Global Settings */}
        {activeTab === 'summary' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            
            {/* Global Modifiers */}
            <div className="bg-white rounded-2xl border p-4 grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Vergi %</label>
                <input 
                  type="number" 
                  className="w-full p-2 bg-slate-50 border rounded-lg"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Xidmət Haqqı %</label>
                <input 
                  type="number" 
                  className="w-full p-2 bg-slate-50 border rounded-lg"
                  value={tipPercent}
                  onChange={(e) => setTipPercent(e.target.value)}
                />
              </div>
            </div>

            {/* Individual Shares */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-700 uppercase text-xs tracking-wider">Son Bölgü</h3>
                <span className="text-[10px] text-slate-500 italic">Vergi və xidmət haqqı daxildir</span>
              </div>
              {participants.map((p, idx) => (
                <div key={p.id} className={`p-4 flex justify-between items-center ${idx !== participants.length - 1 ? 'border-b' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                      p.paid ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {p.paid ? <CheckCircle size={18} /> : p.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${p.paid ? 'text-slate-400 line-through' : ''}`}>{p.name}</span>
                        {p.paid && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Ödənildi</span>}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {items.filter(i => i.participants.includes(p.id)).length} məhsul
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-black ${p.paid ? 'text-slate-400' : 'text-slate-900'}`}>₼{(totals.finalShares[p.id] || 0).toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Settlements Section - Who Owes Whom */}
            {settlements.transactions.length > 0 && (
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="p-4 border-b bg-emerald-50 flex justify-between items-center">
                  <h3 className="font-bold text-emerald-700 uppercase text-xs tracking-wider flex items-center gap-2">
                    <Calculator size={14}/> Hesablaşma
                  </h3>
                  <span className="text-[10px] text-emerald-600 italic">Kim kimə borcludur</span>
                </div>
                <div className="p-4 space-y-3">
                  {settlements.transactions.map((transaction, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs">
                          {transaction.fromName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-sm">{transaction.fromName}</div>
                          <div className="text-[10px] text-slate-500">ödəməlidir</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ChevronRight className="text-slate-400" size={16} />
                      </div>
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-bold text-sm text-right">{transaction.toName}</div>
                          <div className="text-[10px] text-slate-500 text-right">almalıdır</div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                          {transaction.toName.charAt(0)}
                        </div>
                      </div>
                      <div className="ml-4 text-right">
                        <div className="font-black text-emerald-600">₼{transaction.amount.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bill Summary */}
            <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-3">
              <div className="flex justify-between text-slate-400 text-sm">
                <span>Ara Cəm</span>
                <span>₼{totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400 text-sm">
                <span>Vergi ({taxPercent}%)</span>
                <span>₼{totals.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400 text-sm">
                <span>Xidmət Haqqı ({tipPercent}%)</span>
                <span>₼{totals.tipAmount.toFixed(2)}</span>
              </div>
              <div className="h-px bg-slate-700 my-2" />
              <div className="flex justify-between text-lg font-bold">
                <span>Ödəniləcək Məbləğ</span>
                <span className="text-blue-400">₼{totals.grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => {
                  const text = participants.map(p => `${p.name}: ₼${totals.finalShares[p.id].toFixed(2)}${p.paid ? ' ✓' : ''}`).join('\n');
                  navigator.clipboard.writeText(`Hesab Xülasəsi:\n${text}\nCəmi: ₼${totals.grandTotal.toFixed(2)}`);
                  alert('Buferə köçürüldü!');
                }}
                className="col-span-2 bg-blue-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-95 transition"
              >
                <Share2 size={20} /> Buferə Köçür
              </button>
              
              <button 
                onClick={exportAsImage}
                className="bg-pink-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-pink-700 transition"
              >
                <Camera size={18} /> Şəkil Çək
              </button>
              
              <button 
                onClick={exportToCSV}
                className="bg-emerald-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-emerald-700 transition"
              >
                <Download size={18} /> CSV İxrac Et
              </button>
              
              <button 
                onClick={exportToJSON}
                className="bg-purple-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-purple-700 transition"
              >
                <Download size={18} /> JSON İxrac Et
              </button>
            </div>

            {/* Payment Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-4 border-2 border-blue-100">
              <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                <DollarSign size={16} className="text-blue-600" /> Ödəniş Statusu
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-slate-500 text-xs">Ödənildi</div>
                  <div className="text-lg font-black text-green-600">
                    {participants.filter(p => p.paid).length}/{participants.length}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-xs">Qalıq</div>
                  <div className="text-lg font-black text-orange-600">
                    ₼{participants.filter(p => !p.paid).reduce((sum, p) => sum + (totals.finalShares[p.id] || 0), 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Reset Button */}
            <button 
              onClick={resetAll}
              className="w-full bg-red-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-red-700 transition"
            >
              <Trash size={18} /> Hər Şeyi Sıfırla
            </button>
          </div>
        )}

          </>
        )}
      </main>

      {/* Floating Action Hint */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-full shadow-lg border text-xs font-medium text-slate-500 flex items-center gap-2">
        {syncStatus === 'syncing' && (
          <>
            <RefreshCw size={14} className="animate-spin text-blue-500" />
            <span>Cloudflare D1-ə göndərilir...</span>
          </>
        )}
        {syncStatus === 'synced' && (
          <>
            <Cloud size={14} className="text-green-500" />
            <span>Cloudflare D1-də saxlanıldı ✓</span>
          </>
        )}
        {syncStatus === 'error' && (
          <>
            <CloudOff size={14} className="text-red-500" />
            <span>Cloudflare D1 xətası</span>
          </>
        )}
        {(syncStatus === 'local' || !syncStatus) && (
          <>
            <Cloud size={14} className="text-blue-500" />
            {lastSaved ? `Son saxlanma: ${lastSaved.toLocaleTimeString()}` : 'Avtomatik saxlanır...'}
          </>
        )}
      </div>
      </div>
      )}
    </div>
    </div>
  );
};

export default App;