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
  RefreshCw
} from 'lucide-react';

const API_URL = 'http://localhost:3001/api';

const App = () => {
  // --- State ---
  const appRef = useRef(null);
  const [billId, setBillId] = useState(null);
  const [syncStatus, setSyncStatus] = useState('local'); // 'local', 'syncing', 'synced', 'error'
  const [participants, setParticipants] = useState([
    { id: '1', name: 'Alex', paid: false },
    { id: '2', name: 'Jordan', paid: false },
    { id: '3', name: 'Taylor', paid: false }
  ]);
  const [newName, setNewName] = useState('');
  const [csvInput, setCsvInput] = useState('');
  const [showCsvImport, setShowCsvImport] = useState(false);
  
  const [items, setItems] = useState([
    { id: 'i1', name: 'Craft Beer Tray', price: 120, category: 'alcohol', participants: ['1', '2'] },
    { id: 'i2', name: 'Green Tea Pot', price: 15, category: 'tea', participants: ['3'] },
    { id: 'i3', name: 'Platter of Food', price: 200, category: 'food', participants: ['1', '2', '3'] }
  ]);

  const [taxPercent, setTaxPercent] = useState(10);
  const [tipPercent, setTipPercent] = useState(15);
  const [activeTab, setActiveTab] = useState('items'); // 'people', 'items', 'summary'
  const [lastSaved, setLastSaved] = useState(null);

  // --- API Functions ---
  const saveBillToServer = async (billData) => {
    try {
      setSyncStatus('syncing');
      const response = billId 
        ? await fetch(`${API_URL}/bills/${billId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(billData)
          })
        : await fetch(`${API_URL}/bills`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(billData)
          });
      
      if (response.ok) {
        const savedBill = await response.json();
        if (!billId) setBillId(savedBill.id);
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus('local'), 2000);
        return savedBill;
      } else {
        throw new Error('Server save failed');
      }
    } catch (error) {
      console.error('Failed to save to server:', error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('local'), 3000);
      return null;
    }
  };

  const loadBillFromServer = async (id) => {
    try {
      const response = await fetch(`${API_URL}/bills/${id}`);
      if (response.ok) {
        const bill = await response.json();
        return bill;
      }
    } catch (error) {
      console.error('Failed to load from server:', error);
    }
    return null;
  };

  const loadLatestBillFromServer = async () => {
    try {
      const response = await fetch(`${API_URL}/bills`);
      if (response.ok) {
        const bills = await response.json();
        if (bills.length > 0) {
          return bills[bills.length - 1];
        }
      }
    } catch (error) {
      console.error('Failed to load latest bill:', error);
    }
    return null;
  };

  // --- Local Storage & Server Sync ---
  useEffect(() => {
    const loadData = async () => {
      // First try to load from localStorage
      const saved = localStorage.getItem('billSplitterData');
      let localData = null;
      
      if (saved) {
        try {
          localData = JSON.parse(saved);
        } catch (e) {
          console.error('Failed to load saved data:', e);
        }
      }

      // Try to load from server
      const serverBill = await loadLatestBillFromServer();
      
      // Use server data if available and more recent
      const dataToUse = serverBill && (!localData || new Date(serverBill.updatedAt) > new Date(localData.timestamp))
        ? serverBill
        : localData;

      if (dataToUse) {
        if (dataToUse.participants) setParticipants(dataToUse.participants);
        if (dataToUse.items) setItems(dataToUse.items);
        if (dataToUse.taxPercent !== undefined) setTaxPercent(dataToUse.taxPercent);
        if (dataToUse.tipPercent !== undefined) setTipPercent(dataToUse.tipPercent);
        if (dataToUse.id) setBillId(dataToUse.id);
        setLastSaved(new Date(dataToUse.timestamp || dataToUse.updatedAt));
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    // Skip saving on initial mount
    if (participants.length === 0 && items.length === 0) {
      return;
    }

    const data = {
      participants,
      items,
      taxPercent,
      tipPercent,
      timestamp: new Date().toISOString()
    };
    
    // Save to localStorage
    localStorage.setItem('billSplitterData', JSON.stringify(data));
    setLastSaved(new Date());
    
    // Debounce server save
    const timeoutId = setTimeout(() => {
      saveBillToServer(data);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [participants, items, taxPercent, tipPercent, billId]);

  // --- Logic ---
  
  const addParticipant = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const nextId = Math.random().toString(36).substr(2, 9);
    setParticipants([...participants, { id: nextId, name: newName.trim(), paid: false }]);
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
        paid: false
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
      participants: participants.map(p => p.id) // Default all included
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
      localStorage.removeItem('billSplitterData');
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

  // --- Components ---

  const CategoryIcon = ({ category }) => {
    switch (category) {
      case 'alcohol': return <Beer className="w-4 h-4 text-amber-500" />;
      case 'tea': return <Coffee className="w-4 h-4 text-emerald-500" />;
      default: return <Utensils className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div ref={appRef} className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10 p-4 shadow-sm">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Calculator className="text-blue-600" /> SplitIt Pro
          </h1>
          <div className="text-right">
            <div className="text-xs text-slate-500 uppercase font-bold">Ümumi Hesab</div>
            <div className="text-lg font-black text-blue-600">₼{totals.grandTotal.toFixed(2)}</div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        
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
                className="flex-1 p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
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
                    className="flex-1 p-3 rounded-xl border-2 border-blue-300 focus:ring-2 focus:ring-blue-500 outline-none"
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
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              {participants.map((p, idx) => (
                <div key={p.id} className={`flex items-center justify-between p-4 ${idx !== participants.length - 1 ? 'border-b' : ''}`}>
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
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-3">
              <div className="text-xs font-bold text-emerald-700">Cəmi: {items.length} məhsul</div>
            </div>
            {items.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl shadow-sm border p-4 space-y-4">
                <div className="flex gap-3 items-start">
                  <div className="flex-1 space-y-3">
                    <input 
                      className="text-lg font-bold w-full bg-transparent border-b border-transparent focus:border-blue-200 outline-none"
                      value={item.name}
                      onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                      placeholder="Məhsulun Adı"
                    />
                    <div className="flex gap-4">
                      <div className="flex-1 relative">
                        <span className="absolute left-3 top-2 text-slate-400">₼</span>
                        <input 
                          type="number"
                          className="w-full pl-7 pr-3 py-2 bg-slate-50 rounded-lg border text-sm"
                          value={item.price}
                          onChange={(e) => updateItem(item.id, 'price', e.target.value)}
                        />
                      </div>
                      <select 
                        className="bg-slate-50 border rounded-lg px-2 text-sm"
                        value={item.category}
                        onChange={(e) => updateItem(item.id, 'category', e.target.value)}
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
              </div>
            ))}

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
      </main>

      {/* Floating Action Hint */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-full shadow-lg border text-xs font-medium text-slate-500 flex items-center gap-2">
        {syncStatus === 'syncing' && (
          <>
            <RefreshCw size={14} className="animate-spin text-blue-500" />
            <span>Server-ə göndərilir...</span>
          </>
        )}
        {syncStatus === 'synced' && (
          <>
            <Cloud size={14} className="text-green-500" />
            <span>Server-ə yadda saxlanıldı</span>
          </>
        )}
        {syncStatus === 'error' && (
          <>
            <CloudOff size={14} className="text-red-500" />
            <span>Server xətası (lokal yadda saxlanıldı)</span>
          </>
        )}
        {syncStatus === 'local' && (
          <>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {lastSaved ? `Son yadda saxlanma: ${lastSaved.toLocaleTimeString()}` : 'Avtomatik yadda saxlanılır...'}
          </>
        )}
      </div>
    </div>
  );
};

export default App;