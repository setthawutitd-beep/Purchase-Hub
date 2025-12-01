import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient'; // เชื่อมต่อ Database
import { 
  LayoutDashboard, Plus, Package, CheckCircle, Clock, 
  FileText, Search, User, LogOut, ChevronRight, 
  ShoppingCart, Truck, AlertCircle, Paperclip,
  HardHat, Briefcase, Building, ShieldCheck, BadgeCheck,
  UploadCloud, FileCheck, Sparkles, X, MessageSquare, History, Store, Mail, Trash2, FileInput,
  Save, Edit, RotateCcw, Send, AlertTriangle, Bell, Pencil, Box, Filter, RefreshCw, ArrowRight, List, ClipboardList, ArrowLeftRight, Monitor, Smartphone, Tag, Wrench, ArrowUpDown, Download, Image as ImageIcon, Eye, XCircle, Camera, Paperclip as AttachmentIcon, Info, Briefcase as BriefcaseIcon, Printer
} from 'lucide-react';

// --- Constants ---
const ROLES = {
  ADMIN: 'Admin (ผู้ดูแลระบบ)',
  USER: 'User (ผู้ขอซื้อ)',
  DEPT_HEAD: 'หัวหน้าแผนกฝ่ายจัดซื้อ (Level 1)',
  PM: 'ผู้จัดการโครงการ (Level 2)',
  PURCHASING: 'ฝ่ายจัดซื้อ (HO & Local Buyer)',
  STORE: 'Store Keeper (ผู้ดูแลคลัง)'
};

const STATUS_LABELS = {
  'Draft': 'แบบร่าง (Draft)',
  'Pending Head': 'รอหัวหน้าแผนกตรวจสอบ',
  'Pending PM': 'รอ PM อนุมัติ',
  'Approved': 'อนุมัติแล้ว (รอดำเนินการ)',
  'Ordered': 'สั่งซื้อแล้ว (รอรับของ)',
  'Pending Check': 'รอฝ่ายจัดซื้อตรวจสอบ',
  'PR Issued': 'ออกใบขอซื้อ (PR) แล้ว',
  'PO Issued': 'ออกใบสั่งซื้อ (PO) แล้ว',
  'Shipping': 'กำลังจัดส่ง',
  'Ready to Disburse': 'รอจ่ายของ (เบิก/ยืม)',
  'Completed': 'ได้รับของแล้ว/จบงาน',
  'Returned': 'คืนของแล้ว (Returned)',
  'Rejected': 'ไม่อนุมัติ (Rejected)'
};

const STATUS_STEPS_LOCAL = ['Pending Head', 'Pending PM', 'Approved', 'Ordered', 'Completed'];
const STATUS_STEPS_HO = ['Pending Check', 'PR Issued', 'PO Issued', 'Shipping', 'Completed'];
const STATUS_STEPS_WITHDRAW = ['Pending Head', 'Approved', 'Ready to Disburse', 'Completed'];
const STATUS_STEPS_BORROW = ['Pending Head', 'Approved', 'Ready to Disburse', 'Completed', 'Returned'];

// --- Helper Functions ---
const createLog = (action, user, note = '', images = []) => ({ 
  date: new Date().toLocaleString('th-TH'), 
  action, 
  user, 
  note,
  images: images || [] 
});

const generateDocId = (type, index) => {
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const runNo = (index + 1).toString().padStart(3, '0');
    switch(type) {
        case 'Local': return `LPO-${year}${month}-${runNo}`;
        case 'HO': return `HPO-${year}${month}-${runNo}`;
        case 'Withdraw': return `WID-${year}${month}-${runNo}`;
        case 'Borrow': return `BOR-${year}${month}-${runNo}`;
        default: return `DOC-${year}${month}-${runNo}`;
    }
};

// --- Sub-Components ---
const StatusBadge = ({ status }) => {
  let color = 'bg-gray-100 text-gray-800';
  if (status === 'Draft') color = 'bg-gray-200 text-gray-600 border border-gray-300';
  else if (status.includes('Pending') || status === 'PR Issued') color = 'bg-amber-100 text-amber-800';
  else if (status === 'Approved') color = 'bg-cyan-100 text-cyan-800';
  else if (status === 'Ready to Disburse') color = 'bg-purple-100 text-purple-800';
  else if (['Ordered', 'PO Issued', 'Shipping'].includes(status)) color = 'bg-blue-100 text-blue-800';
  else if (status === 'Completed') color = 'bg-green-100 text-green-800';
  else if (status === 'Returned') color = 'bg-teal-100 text-teal-800';
  else if (status === 'Rejected') color = 'bg-red-100 text-red-800';
  return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${color}`}>{STATUS_LABELS[status] || status}</span>;
};

const DocIdBadge = ({ type, id }) => {
    if (!id) return null;
    let color = 'bg-gray-100 text-gray-600 border-gray-200';
    let icon = <FileText className="w-3 h-3"/>;
    if (type === 'Local') { color = 'bg-orange-50 text-orange-700 border-orange-200'; icon = <HardHat className="w-3 h-3"/>; }
    else if (type === 'HO') { color = 'bg-indigo-50 text-indigo-700 border-indigo-200'; icon = <Building className="w-3 h-3"/>; }
    else if (type === 'Withdraw') { color = 'bg-pink-50 text-pink-700 border-pink-200'; icon = <Package className="w-3 h-3"/>; }
    else if (type === 'Borrow') { color = 'bg-blue-50 text-blue-700 border-blue-200'; icon = <Monitor className="w-3 h-3"/>; }
    return <span className={`text-xs px-2 py-0.5 rounded border flex items-center gap-1 font-bold ${color}`}>{icon} {id}</span>;
};

const ProgressBar = ({ request }) => {
  let steps = STATUS_STEPS_LOCAL;
  if (request.type === 'HO') steps = STATUS_STEPS_HO;
  if (request.type === 'Withdraw') steps = STATUS_STEPS_WITHDRAW;
  if (request.type === 'Borrow') steps = STATUS_STEPS_BORROW;
  
  const currentIndex = steps.indexOf(request.status);
  return (
    <div className="w-full mt-3 mb-4">
      <div className="flex justify-between mb-2">{steps.map((step, idx) => (<div key={step} className={`text-[10px] flex flex-col items-center ${idx <= currentIndex ? 'text-blue-600 font-bold' : 'text-gray-300'}`}><div className={`w-2 h-2 rounded-full mb-1 ${idx <= currentIndex ? 'bg-blue-600' : 'bg-gray-200'}`}></div><span className="hidden sm:inline">{STATUS_LABELS[step]?.split(' ')[0] || step}</span></div>))}</div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden flex">{steps.map((step, idx) => (<div key={step} className={`h-full border-r border-white last:border-0 transition-all duration-500 ${idx <= currentIndex ? 'bg-blue-500' : 'bg-transparent'}`} style={{ width: `${100 / steps.length}%` }} />))}</div>
    </div>
  );
};

// --- Mock Inventory (Simulated Local Only for now) ---
const INITIAL_INVENTORY = [
  { id: 'INV-001', name: 'Safety Helmet', qty: 50, unit: 'ใบ', minStock: 10, price: 450, lastUpdated: '20/06/2024 09:00', image: null },
  { id: 'INV-002', name: 'ถุงมือผ้า', qty: 200, unit: 'คู่', minStock: 50, price: 25, lastUpdated: '20/06/2024 09:00', image: null },
];
const INITIAL_ASSETS = [
  { id: 'AST-001', name: 'สว่านไร้สาย Bosch', serial: 'SN-88421', status: 'Available', condition: 'Good', holder: '-', currentRequestId: null, price: 4500, image: 'drill.jpg', lastUpdated: '20/06/2024 10:00' },
];

const App = () => {
  const [currentUserRole, setCurrentUserRole] = useState(ROLES.USER);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [requests, setRequests] = useState([]); // Start empty, load from DB
  const [isLoading, setIsLoading] = useState(true);
  
  const [inventory, setInventory] = useState(INITIAL_INVENTORY);
  const [assets, setAssets] = useState(INITIAL_ASSETS);
  const [invLogs, setInvLogs] = useState([]);
  
  // Dashboard & Filter States
  const [dashboardView, setDashboardView] = useState('Purchase');
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [invSearch, setInvSearch] = useState('');
  const [assetSearch, setAssetSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilterItem, setHistoryFilterItem] = useState(null);
  const [invSort, setInvSort] = useState({ key: 'id', direction: 'asc' });
  const [assetSort, setAssetSort] = useState({ key: 'id', direction: 'asc' });
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPRModal, setShowPRModal] = useState(false);
  const [showPOModal, setShowPOModal] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showReceiveGoodsModal, setShowReceiveGoodsModal] = useState(false);
  const [showDisburseModal, setShowDisburseModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showItemDetailModal, setShowItemDetailModal] = useState(false);
  const [showPOPreviewModal, setShowPOPreviewModal] = useState(false); 
  const [viewingItem, setViewingItem] = useState(null);
  const [previewImage, setPreviewImage] = useState(null); 
  const [showAddInvModal, setShowAddInvModal] = useState(false);
  const [showEditInvModal, setShowEditInvModal] = useState(false);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showEditAssetModal, setShowEditAssetModal] = useState(false);
  const [showReturnAssetModal, setShowReturnAssetModal] = useState(false);
  
  const [editingStockItem, setEditingStockItem] = useState(null);
  const [editingAssetItem, setEditingAssetItem] = useState(null);
  const [returnAssetData, setReturnAssetData] = useState({ id: '', condition: 'Good', note: '', images: [] });
  const [disburseData, setDisburseData] = useState({ requestId: null, note: '', images: [] });
  const [rejectData, setRejectData] = useState({ requestId: null, reason: '' });
  const [newStockItem, setNewStockItem] = useState({ name: '', qty: 0, unit: 'ชิ้น', minStock: 0, price: 0, images: [] });
  const [newAssetItem, setNewAssetItem] = useState({ id: '', name: '', serial: '', status: 'Available', condition: 'Good', price: 0, images: [] });
  
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [receiveItems, setReceiveItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [newOrderMeta, setNewOrderMeta] = useState({ type: 'Local', job: '', dateRequired: '', attachment: null });
  const [tempItem, setTempItem] = useState({ name: '', qty: 1, unitPrice: 0, images: [] });
  const [orderItems, setOrderItems] = useState([]);
  
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [stockSuggestion, setStockSuggestion] = useState(null);
  const [prData, setPrData] = useState({ requestId: null, file: null, prNumber: '' });
  const [poData, setPoData] = useState({ requestId: null, file: null, poNumber: '' });

  // --- SUPABASE FETCH DATA ---
  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      // ดึงข้อมูลจากตาราง requests เรียงตาม ID ล่าสุด
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .order('id', { ascending: false });
        
      if (error) throw error;
      
      // แปลงข้อมูลให้เข้ากับ format ของ App (Mapping DB columns to App state)
      const formattedData = data.map(item => ({
        id: item.request_id, // ใช้ request_id เป็น id หลักใน App
        db_id: item.id,      // เก็บ id จริงของ DB ไว้ใช้อ้างอิงตอน update
        type: item.type,
        items: item.items || [],
        job: item.job,
        requester: item.requester,
        status: item.status,
        dateRequired: item.date_required,
        created: item.created,
        docNumber: item.doc_number,
        history: item.history || [],
        comments: []
      }));
      
      setRequests(formattedData);
    } catch (error) {
      console.error('Error fetching data:', error.message);
      showToast('ไม่สามารถดึงข้อมูลจาก Database ได้: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // --- Logic ---
  const filteredRequests = useMemo(() => {
    let data = requests;
    if (searchQuery) {
        const lowerQ = searchQuery.toLowerCase();
        data = data.filter(r => r.id.toLowerCase().includes(lowerQ) || r.items.some(i => i.name.toLowerCase().includes(lowerQ)) || (r.docNumber && r.docNumber.toLowerCase().includes(lowerQ)));
    }
    if (typeFilter !== 'All') data = data.filter(r => r.type === typeFilter);
    if (statusFilter !== 'All') data = data.filter(r => r.status === statusFilter);

    switch (currentUserRole) {
        case ROLES.USER:
            // For Demo: Show all created by 'Current User' or 'Somsak'
            data = data.filter(r => r.requester === 'Current User' || r.requester === 'Somsak');
            break;
        case ROLES.DEPT_HEAD: data = data.filter(r => r.status === 'Pending Head'); break;
        case ROLES.PM: data = data.filter(r => r.status === 'Pending PM'); break;
        case ROLES.PURCHASING:
            data = data.filter(r => {
                if (r.type === 'Local') return ['Approved', 'Ordered'].includes(r.status);
                if (r.type === 'HO') return ['Pending Check', 'PR Issued', 'PO Issued', 'Shipping'].includes(r.status);
                return false;
            });
            break;
        case ROLES.STORE: data = data.filter(r => ['Withdraw', 'Borrow'].includes(r.type) && ['Ready to Disburse', 'Pending Head', 'Approved'].includes(r.status)); break;
    }
    return data;
  }, [requests, searchQuery, typeFilter, statusFilter, currentUserRole]);

  const dashboardStats = useMemo(() => {
    const activeRequests = requests.filter(r => r.status !== 'Draft');
    const calcStats = (typeFilterFn) => {
        const reqs = activeRequests.filter(typeFilterFn);
        return {
            total: reqs.length,
            pending: reqs.filter(r => r.status.includes('Pending') || r.status === 'PR Issued' || r.status === 'Approved').length,
            processing: reqs.filter(r => ['Ordered', 'PO Issued', 'Shipping', 'Ready to Disburse'].includes(r.status)).length,
            ready: reqs.filter(r => r.status === 'Ready to Disburse').length,
            completed: reqs.filter(r => r.status === 'Completed' || r.status === 'Returned').length
        };
    };
    return {
      purchase: calcStats(r => r.type === 'Local' || r.type === 'HO'),
      withdraw: calcStats(r => r.type === 'Withdraw' || r.type === 'Borrow')
    };
  }, [requests]);

  // --- Handlers ---
  const handleCreateOrder = async (e, isDraft = false) => {
    e.preventDefault();
    if (orderItems.length === 0) { showToast("กรุณาเพิ่มรายการ", 'error'); return; }
    
    let nextStatus = 'Draft';
    if (!isDraft) {
        if (newOrderMeta.type === 'HO') nextStatus = 'Pending Check';
        else nextStatus = 'Pending Head';
    }

    // Generate Temporary ID for Display (Real ID handled by logic or DB)
    const newReqId = `REQ-${Date.now().toString().slice(-6)}`;
    const createdDate = new Date().toLocaleString('th-TH');
    const historyLog = [createLog(isDraft ? 'บันทึกแบบร่าง' : 'สร้างคำขอ', 'Current User')];

    try {
        // Insert into Supabase
        const { data, error } = await supabase
            .from('requests')
            .insert([
                {
                    request_id: newReqId,
                    type: newOrderMeta.type,
                    status: nextStatus,
                    requester: 'Current User',
                    job: newOrderMeta.job,
                    items: orderItems, // Send JSON
                    history: historyLog, // Send JSON
                    date_required: newOrderMeta.dateRequired,
                    created: createdDate
                }
            ])
            .select();

        if (error) throw error;

        // Add to local state immediately (Optimistic UI) or Fetch again
        fetchRequests(); 
        
        showToast(isDraft ? 'บันทึกแบบร่างแล้ว' : 'ส่งคำขอเรียบร้อย');
        handleCloseCreateModal();

    } catch (err) {
        console.error(err);
        showToast('บันทึกข้อมูลล้มเหลว: ' + err.message, 'error');
    }
  };

  const handleUpdateStatus = async (id, newStatus, note = '', images = []) => {
    // Find local item first
    const target = requests.find(r => r.id === id);
    if (!target) return;

    let updatePayload = { status: newStatus };
    const newHistoryEntry = createLog(STATUS_LABELS[newStatus], currentUserRole, note, images);
    const updatedHistory = [...target.history, newHistoryEntry];
    
    updatePayload.history = updatedHistory;

    // Generate Doc ID Logic
    if (!target.docNumber && ['Ordered', 'PR Issued', 'Ready to Disburse', 'Approved'].includes(newStatus)) {
        const shouldGenerate = 
           (target.type === 'Local' && newStatus === 'Ordered') ||
           (target.type === 'HO' && newStatus === 'PO Issued') ||
           (target.type === 'Withdraw' && newStatus === 'Ready to Disburse') ||
           (target.type === 'Borrow' && newStatus === 'Ready to Disburse');

        if (shouldGenerate) {
            // Count existing docs of this type to run number (Client-side estimation or Server-side better)
            const count = requests.filter(req => req.docNumber && req.type === target.type).length;
            updatePayload.doc_number = generateDocId(target.type, count);
        }
    }

    try {
        const { error } = await supabase
            .from('requests')
            .update(updatePayload)
            .eq('request_id', id); // Use request_id as key

        if (error) throw error;

        // Update Local State
        setRequests(prev => prev.map(r => {
            if (r.id === id) {
                const updated = { 
                    ...r, 
                    status: newStatus, 
                    history: updatedHistory,
                    docNumber: updatePayload.doc_number || r.docNumber
                };
                if (selectedRequest && selectedRequest.id === id) setSelectedRequest(updated);
                return updated;
            }
            return r;
        }));
        
        showToast(`อัปเดตสถานะเป็น ${STATUS_LABELS[newStatus]} เรียบร้อย`);

    } catch (err) {
        console.error(err);
        showToast('อัปเดตสถานะล้มเหลว', 'error');
    }
  };

  // --- Other Handlers (Simplified for Persistence Demo) ---
  const handleCloseCreateModal = () => {
      setShowCreateModal(false);
      setEditingId(null);
      setOrderItems([]);
      setNewOrderMeta({ type: 'Local', job: '', dateRequired: '', attachment: null });
      setTempItem({ name: '', qty: 1, unitPrice: 0, images: [] });
  };

  const handleAddItem = () => {
    if (!tempItem.name) return;
    const itemQty = newOrderMeta.type === 'Borrow' ? 1 : tempItem.qty;
    setOrderItems([...orderItems, { ...tempItem, qty: itemQty }]);
    setTempItem({ name: '', qty: 1, unitPrice: 0, images: [] });
    setStockSuggestion(null);
    setShowSuggestions(false);
  };

  const handleRemoveItem = (index) => {
      const newItems = [...orderItems];
      newItems.splice(index, 1);
      setOrderItems(newItems);
  };

  // --- Render (Simplified for Briefness, keeping main structure) ---
  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-800 overflow-hidden relative print:bg-white print:h-auto print:overflow-visible">
      
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col shadow-lg z-20 no-print">
        <div className="p-6 border-b border-gray-100"><h1 className="text-2xl font-bold text-blue-700 flex items-center gap-2"><Package className="w-8 h-8" /> Purchase<span className="text-gray-800">Hub</span> <span className="text-[10px] bg-green-100 text-green-800 px-1 rounded">DB</span></h1></div>
        <nav className="flex-1 p-4 space-y-1">
          <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}><LayoutDashboard className="w-5 h-5" /> ภาพรวม (Dashboard)</button>
          <button onClick={() => setActiveTab('orders')} className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === 'orders' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}><ShoppingCart className="w-5 h-5" /> รายการสั่งซื้อ/เบิก</button>
        </nav>
        <div className="p-4 bg-gray-50 m-4 rounded-xl border border-gray-200"><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1"><User className="w-3 h-3"/> จำลองผู้ใช้งาน (Role)</p><select value={currentUserRole} onChange={(e) => setCurrentUserRole(e.target.value)} className="w-full p-2 text-sm border-gray-300 rounded-md focus:ring-blue-500 bg-white shadow-sm cursor-pointer">{Object.entries(ROLES).map(([key, role]) => <option key={key} value={role}>{role}</option>)}</select></div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative no-print">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-10">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
             {isLoading && <RefreshCw className="w-4 h-4 animate-spin text-blue-600"/>}
             {activeTab === 'dashboard' && 'ภาพรวมระบบ'}
             {activeTab === 'orders' && `รายการที่ต้องทำ`}
          </h2>
          <button onClick={() => { handleCloseCreateModal(); setShowCreateModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-md"><Plus className="w-4 h-4" /> สร้างคำสั่งซื้อ/เบิก/ยืม</button>
        </header>

        <div className="flex-1 overflow-auto p-6 bg-slate-50">
          {/* Notification Toast */}
          {notification && (
            <div className="absolute top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 bg-gray-900 text-white animate-in slide-in-from-top-5 no-print">
               {notification.type === 'error' ? <AlertCircle className="w-5 h-5"/> : <Bell className="w-5 h-5"/>}
               <p className="text-sm font-medium">{notification.message}</p>
            </div>
          )}

          {/* DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-6 bg-blue-50 rounded-2xl border border-blue-200"><h3 className="text-3xl font-bold text-blue-600">{dashboardStats.purchase.total}</h3><p className="text-sm text-gray-500">ใบขอซื้อทั้งหมด</p></div>
                  <div className="p-6 bg-pink-50 rounded-2xl border border-pink-200"><h3 className="text-3xl font-bold text-pink-600">{dashboardStats.withdraw.total}</h3><p className="text-sm text-gray-500">ใบเบิกทั้งหมด</p></div>
              </div>
            </div>
          )}

          {/* ORDERS LIST */}
          {activeTab === 'orders' && (
            <div className="space-y-6 max-w-7xl mx-auto">
               <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="divide-y divide-gray-100">
                    {filteredRequests.map(req => (
                        <div key={req.id} className="p-5 hover:bg-slate-50 transition-colors group">
                           <div className="flex justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${req.type === 'Local' ? 'bg-orange-50 text-orange-700' : 'bg-purple-50 text-purple-700'}`}>{req.type}</span>
                                    <span className="text-xs text-gray-400">{req.id}</span>
                                    <DocIdBadge type={req.type} id={req.docNumber} />
                                    <h4 className="font-bold text-gray-900 text-sm">{req.items[0]?.name} {req.items.length > 1 && `+${req.items.length-1}`}</h4>
                                </div>
                                <StatusBadge status={req.status} />
                            </div>
                            <div className="mt-2 flex justify-end gap-2">
                                {/* Action Buttons Logic */}
                                {(currentUserRole === ROLES.DEPT_HEAD || currentUserRole === ROLES.ADMIN) && req.status === 'Pending Head' && (
                                    <button onClick={() => handleUpdateStatus(req.id, (req.type === 'Withdraw' || req.type === 'Borrow') ? 'Ready to Disburse' : 'Pending PM')} className="px-3 py-1 bg-orange-600 text-white text-xs rounded shadow-sm">อนุมัติ (Head)</button>
                                )}
                                {(currentUserRole === ROLES.PM || currentUserRole === ROLES.ADMIN) && req.status === 'Pending PM' && (
                                    <button onClick={() => handleUpdateStatus(req.id, 'Approved')} className="px-3 py-1 bg-green-600 text-white text-xs rounded shadow-sm">อนุมัติ (PM)</button>
                                )}
                                {(currentUserRole === ROLES.PURCHASING || currentUserRole === ROLES.ADMIN) && req.status === 'Approved' && req.type === 'Local' && (
                                    <button onClick={() => handleUpdateStatus(req.id, 'Ordered')} className="px-3 py-1 bg-blue-600 text-white text-xs rounded shadow-sm">สั่งซื้อแล้ว</button>
                                )}
                                <button onClick={() => { setSelectedRequest(req); setShowDetailModal(true); }} className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200">ดูรายละเอียด</button>
                            </div>
                        </div>
                    ))}
                    {filteredRequests.length === 0 && <div className="p-10 text-center text-gray-400">ไม่มีรายการ</div>}
                  </div>
               </div>
            </div>
          )}
        </div>
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h3 className="font-bold text-xl mb-4">สร้างใบขอซื้อ/เบิกใหม่</h3>
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                    {['Local', 'HO', 'Withdraw', 'Borrow'].map(t => (
                        <button key={t} onClick={() => setNewOrderMeta({...newOrderMeta, type: t})} className={`p-2 border rounded ${newOrderMeta.type === t ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : ''}`}>{t}</button>
                    ))}
                </div>
                <input type="text" placeholder="รหัสงาน (Job No.)" className="w-full border p-2 rounded" value={newOrderMeta.job} onChange={e => setNewOrderMeta({...newOrderMeta, job: e.target.value})} />
                
                <div className="border p-3 rounded bg-gray-50">
                    <p className="text-xs font-bold mb-2">เพิ่มรายการสินค้า</p>
                    <div className="flex gap-2 mb-2">
                        <input type="text" placeholder="ชื่อสินค้า..." className="flex-1 border p-1 text-sm rounded" value={tempItem.name} onChange={e => setTempItem({...tempItem, name: e.target.value})} />
                        <input type="number" placeholder="Qty" className="w-16 border p-1 text-sm rounded" value={tempItem.qty} onChange={e => setTempItem({...tempItem, qty: parseInt(e.target.value)})} />
                        <button onClick={handleAddItem} className="bg-blue-600 text-white px-2 rounded text-sm">+</button>
                    </div>
                    <ul className="text-xs space-y-1">
                        {orderItems.map((item, idx) => <li key={idx} className="flex justify-between bg-white p-1 border rounded"><span>{item.name}</span><span>x{item.qty} <button onClick={() => handleRemoveItem(idx)} className="text-red-500 ml-2">x</button></span></li>)}
                    </ul>
                </div>

                <div className="flex gap-2 mt-4">
                    <button onClick={handleCloseCreateModal} className="flex-1 py-2 border rounded">ยกเลิก</button>
                    <button onClick={(e) => handleCreateOrder(e)} className="flex-1 py-2 bg-blue-600 text-white rounded font-bold">บันทึก</button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedRequest && (
          <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                  <div className="flex justify-between mb-4">
                      <h3 className="font-bold text-lg">รายละเอียด: {selectedRequest.id}</h3>
                      <button onClick={() => setShowDetailModal(false)}>X</button>
                  </div>
                  <div className="space-y-2 mb-4">
                      <p><strong>Job:</strong> {selectedRequest.job}</p>
                      <p><strong>Status:</strong> <StatusBadge status={selectedRequest.status}/></p>
                      <div className="border p-2 rounded">
                          {selectedRequest.items.map((i, idx) => <div key={idx} className="flex justify-between border-b last:border-0 p-1"><span>{i.name}</span><span>x{i.qty}</span></div>)}
                      </div>
                  </div>
                  <div>
                      <h4 className="font-bold text-sm mb-2">ประวัติ (History Log)</h4>
                      <ul className="text-xs space-y-1 text-gray-500">
                          {selectedRequest.history.map((h, idx) => (
                              <li key={idx}>[{h.date}] {h.action} โดย {h.user} {h.note && `(${h.note})`}</li>
                          ))}
                      </ul>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default App;