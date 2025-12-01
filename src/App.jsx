import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './supabaseClient'; // เชื่อมต่อ DB
import { 
  LayoutDashboard, Plus, Package, CheckCircle, Clock, 
  FileText, Search, User, LogOut, ChevronRight, 
  ShoppingCart, Truck, AlertCircle, Paperclip,
  HardHat, Briefcase, Building, ShieldCheck, BadgeCheck,
  UploadCloud, FileCheck, Sparkles, X, MessageSquare, History, Store, Mail, Trash2, FileInput,
  Save, Edit, RotateCcw, Send, AlertTriangle, Bell, Pencil, Box, Filter, RefreshCw, ArrowRight, List, ClipboardList, ArrowLeftRight, Monitor, Smartphone, Tag, Wrench, ArrowUpDown, Download, Image as ImageIcon, Eye, XCircle, Camera, Paperclip as AttachmentIcon, Info, Briefcase as BriefcaseIcon, Printer
} from 'lucide-react';

// --- Configuration & Constants ---
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
  // เก็บแค่ชื่อไฟล์เพื่อเลี่ยงปัญหา Upload (ในเวอร์ชันเริ่มต้น)
  images: images.map(img => img.name || 'image.jpg') 
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

const App = () => {
  const [currentUserRole, setCurrentUserRole] = useState(ROLES.USER);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(false);

  // Data State (Loaded from Supabase)
  const [requests, setRequests] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [assets, setAssets] = useState([]);
  const [invLogs, setInvLogs] = useState([]); // Optional: If you want to store logs in DB later

  // UI State
  const [dashboardView, setDashboardView] = useState('Purchase');
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [invSearch, setInvSearch] = useState('');
  const [assetSearch, setAssetSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [notification, setNotification] = useState(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPOPreviewModal, setShowPOPreviewModal] = useState(false);
  const [showReceiveGoodsModal, setShowReceiveGoodsModal] = useState(false);
  const [showDisburseModal, setShowDisburseModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showAddInvModal, setShowAddInvModal] = useState(false);
  const [showEditInvModal, setShowEditInvModal] = useState(false);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showEditAssetModal, setShowEditAssetModal] = useState(false);
  const [showReturnAssetModal, setShowReturnAssetModal] = useState(false);

  // Form Data
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [newOrderMeta, setNewOrderMeta] = useState({ type: 'Local', job: '', dateRequired: '', attachment: null });
  const [orderItems, setOrderItems] = useState([]);
  const [tempItem, setTempItem] = useState({ name: '', qty: 1, unitPrice: 0, images: [] });
  const [receiveItems, setReceiveItems] = useState([]);
  const [disburseData, setDisburseData] = useState({ requestId: null, note: '', images: [] });
  const [rejectData, setRejectData] = useState({ requestId: null, reason: '' });
  const [returnAssetData, setReturnAssetData] = useState({ id: '', condition: 'Good', note: '', images: [] });

  const [newStockItem, setNewStockItem] = useState({ name: '', qty: 0, unit: 'ชิ้น', minStock: 0, price: 0 });
  const [editingStockItem, setEditingStockItem] = useState(null);
  const [newAssetItem, setNewAssetItem] = useState({ id: '', name: '', serial: '', status: 'Available', condition: 'Good', price: 0 });
  const [editingAssetItem, setEditingAssetItem] = useState(null);
  
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  // --- 1. Fetch Data (Initial Load) ---
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
        const reqRes = await supabase.from('requests').select('*').order('id', { ascending: false });
        const invRes = await supabase.from('inventory').select('*').order('id', { ascending: true });
        const astRes = await supabase.from('assets').select('*').order('id', { ascending: true });

        if (reqRes.error) throw reqRes.error;
        if (invRes.error) throw invRes.error;
        if (astRes.error) throw astRes.error;

        // Map DB snake_case to App camelCase
        setRequests(reqRes.data.map(r => ({
            id: r.request_id, db_id: r.id, type: r.type, status: r.status,
            requester: r.requester, job: r.job, items: r.items || [], 
            history: r.history || [], dateRequired: r.date_required, 
            created: r.created, docNumber: r.doc_number
        })));

        setInventory(invRes.data.map(i => ({
            id: i.item_id, db_id: i.id, name: i.name, qty: i.qty, unit: i.unit,
            minStock: i.min_stock, price: i.price, lastUpdated: i.last_updated
        })));

        setAssets(astRes.data.map(a => ({
            id: a.asset_id, db_id: a.id, name: a.name, serial: a.serial,
            status: a.status, holder: a.holder, condition: a.condition,
            price: a.price, lastUpdated: a.last_updated, currentRequestId: a.current_request_id
        })));

    } catch (err) {
        showToast('โหลดข้อมูลล้มเหลว: ' + err.message, 'error');
    } finally {
        setIsLoading(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // --- 2. Action Handlers (With Supabase) ---

  const handleCreateOrder = async (e, isDraft = false) => {
    e.preventDefault();
    if (orderItems.length === 0) { showToast("กรุณาเพิ่มรายการ", 'error'); return; }
    
    let nextStatus = isDraft ? 'Draft' : (newOrderMeta.type === 'HO' ? 'Pending Check' : 'Pending Head');
    const newReqId = `REQ-${Date.now().toString().slice(-6)}`;
    
    // Remove File objects before sending to DB (Supabase JSON can't store Files directly)
    const sanitizedItems = orderItems.map(item => ({
        ...item,
        images: [] // Reset images for now (File upload is advanced)
    }));

    try {
        const { error } = await supabase.from('requests').insert([{
            request_id: newReqId, type: newOrderMeta.type, status: nextStatus,
            requester: 'Current User', job: newOrderMeta.job, items: sanitizedItems,
            history: [createLog(isDraft ? 'บันทึกแบบร่าง' : 'สร้างคำขอ', 'Current User')],
            date_required: newOrderMeta.dateRequired, created: new Date().toLocaleString('th-TH')
        }]);
        if (error) throw error;
        
        fetchAllData();
        showToast(isDraft ? 'บันทึกแบบร่างแล้ว' : 'ส่งคำขอเรียบร้อย');
        setShowCreateModal(false);
        setOrderItems([]);
        setNewOrderMeta({ type: 'Local', job: '', dateRequired: '', attachment: null });
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleUpdateStatus = async (id, newStatus, note = '') => {
      const target = requests.find(r => r.id === id);
      if (!target) return;
      
      let updatePayload = { status: newStatus };
      const updatedHistory = [...target.history, createLog(STATUS_LABELS[newStatus], currentUserRole, note)];
      updatePayload.history = updatedHistory;

      // Generate Doc ID Logic
      if (!target.docNumber && ['Ordered', 'PR Issued', 'Ready to Disburse', 'Approved'].includes(newStatus)) {
          const count = requests.filter(req => req.docNumber && req.type === target.type).length;
          updatePayload.doc_number = generateDocId(target.type, count);
      }

      try {
          const { error } = await supabase.from('requests').update(updatePayload).eq('request_id', id);
          if (error) throw error;
          
          fetchAllData();
          showToast(`อัปเดตสถานะเป็น ${STATUS_LABELS[newStatus]} เรียบร้อย`);
          
          // Close modals if open
          if (selectedRequest && selectedRequest.id === id) {
             const updatedReq = { ...selectedRequest, ...updatePayload };
             setSelectedRequest(updatedReq);
          }
          setShowRejectModal(false); 
      } catch (err) { showToast(err.message, 'error'); }
  };

  // --- Logic for Receiving Goods (Updates Stock & Request) ---
  const openReceiveModal = (req) => {
      const defaultTarget = req.type === 'HO' ? 'Asset' : 'Inventory';
      // Prepare items for receiving
      const items = req.items.map(item => ({
          ...item,
          targetType: defaultTarget,
          assetsToRegister: Array.from({ length: item.qty }, (_, i) => ({ id: '', serial: '', name: item.name }))
      }));
      setReceiveItems(items);
      setSelectedRequest(req);
      setShowReceiveGoodsModal(true);
  };

  const handleConfirmReceive = async () => {
      // 1. Process Inventory/Asset updates
      try {
          for (const item of receiveItems) {
              if (item.targetType === 'Inventory') {
                  // Check existing stock by Name
                  const existing = inventory.find(i => i.name === item.name);
                  if (existing) {
                      await supabase.from('inventory').update({
                          qty: existing.qty + item.qty, last_updated: new Date().toLocaleString('th-TH')
                      }).eq('item_id', existing.id);
                  } else {
                      const newId = `INV-${Date.now().toString().slice(-4)}`;
                      await supabase.from('inventory').insert([{
                          item_id: newId, name: item.name, qty: item.qty, unit: 'หน่วย', min_stock: 0, price: item.unitPrice, last_updated: new Date().toLocaleString('th-TH')
                      }]);
                  }
              } else {
                  // Register Assets
                  for (const [idx, assetReg] of item.assetsToRegister.entries()) {
                      const assetId = assetReg.id || `AST-AUTO-${Date.now().toString().slice(-6)}-${idx}`;
                      await supabase.from('assets').insert([{
                          asset_id: assetId, name: assetReg.name || item.name, serial: assetReg.serial || '-',
                          status: 'Available', condition: 'Good', price: item.unitPrice, holder: '-',
                          last_updated: new Date().toLocaleString('th-TH')
                      }]);
                  }
              }
          }
          
          // 2. Update Request Status
          await handleUpdateStatus(selectedRequest.id, 'Completed', 'รับของเข้าคลังเรียบร้อย');
          setShowReceiveGoodsModal(false);
          fetchAllData(); // Refresh all to see new stock
      } catch (err) {
          showToast('เกิดข้อผิดพลาดในการรับของ: ' + err.message, 'error');
      }
  };

  // --- Logic for Disburse (Cut Stock) ---
  const handleConfirmDisburse = async () => {
      const req = requests.find(r => r.id === disburseData.requestId);
      if (!req) return;

      try {
          if (req.type === 'Withdraw') {
              for (const item of req.items) {
                  const stockItem = inventory.find(i => i.name === item.name);
                  if (stockItem) {
                      // Deduct stock
                      const newQty = Math.max(0, stockItem.qty - item.qty);
                      await supabase.from('inventory').update({
                          qty: newQty, last_updated: new Date().toLocaleString('th-TH')
                      }).eq('item_id', stockItem.id);
                  }
              }
          } else if (req.type === 'Borrow') {
              for (const item of req.items) {
                   // Find available asset with similar name
                   const asset = assets.find(a => a.name.includes(item.name.split(' (')[0]) && a.status === 'Available');
                   if (asset) {
                       await supabase.from('assets').update({
                           status: 'Borrowed', holder: req.requester, current_request_id: req.id,
                           last_updated: new Date().toLocaleString('th-TH')
                       }).eq('asset_id', asset.id);
                   }
              }
          }

          await handleUpdateStatus(req.id, 'Completed', `จ่ายของ/ยืมของเรียบร้อย (${disburseData.note})`);
          setShowDisburseModal(false);
          fetchAllData();
      } catch (err) { showToast(err.message, 'error'); }
  };

  // --- Inventory/Asset Management ---
  const handleAddStock = async () => {
      const newId = `INV-${String(inventory.length + 1).padStart(3, '0')}`;
      try {
          const { error } = await supabase.from('inventory').insert([{
              item_id: newId, name: newStockItem.name, qty: newStockItem.qty, unit: newStockItem.unit,
              min_stock: newStockItem.minStock, price: newStockItem.price, last_updated: new Date().toLocaleString('th-TH')
          }]);
          if (error) throw error;
          fetchAllData(); showToast('เพิ่มสินค้าสำเร็จ'); setShowAddInvModal(false);
      } catch (err) { showToast(err.message, 'error'); }
  };
  
  const handleUpdateStock = async () => {
    if (!editingStockItem) return;
    try {
        const { error } = await supabase.from('inventory').update({
            qty: editingStockItem.qty, min_stock: editingStockItem.minStock, price: editingStockItem.price,
            last_updated: new Date().toLocaleString('th-TH')
        }).eq('item_id', editingStockItem.id);
        if (error) throw error;
        fetchAllData(); showToast('อัปเดตสต็อกสำเร็จ'); setShowEditInvModal(false);
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleReturnAsset = async () => {
      try {
          const { error } = await supabase.from('assets').update({
              status: 'Available', holder: '-', condition: returnAssetData.condition, current_request_id: null,
              last_updated: new Date().toLocaleString('th-TH')
          }).eq('asset_id', returnAssetData.id);
          if (error) throw error;
          fetchAllData(); showToast('รับคืนทรัพย์สินเรียบร้อย'); setShowReturnAssetModal(false);
      } catch (err) { showToast(err.message, 'error'); }
  };

  // --- Filtering Logic ---
  const filteredRequests = useMemo(() => {
    let data = requests;
    if (searchQuery) data = data.filter(r => r.id.toLowerCase().includes(searchQuery.toLowerCase()) || r.items.some(i => i.name.toLowerCase().includes(searchQuery)));
    if (typeFilter !== 'All') data = data.filter(r => r.type === typeFilter);
    if (statusFilter !== 'All') data = data.filter(r => r.status === statusFilter);
    return data;
  }, [requests, searchQuery, typeFilter, statusFilter]);

  const dashboardStats = useMemo(() => {
    const active = requests.filter(r => r.status !== 'Draft');
    const calc = (fn) => ({
        total: active.filter(fn).length,
        pending: active.filter(r => fn(r) && (r.status.includes('Pending') || r.status === 'Approved')).length,
        completed: active.filter(r => fn(r) && r.status === 'Completed').length
    });
    return {
      purchase: calc(r => ['Local', 'HO'].includes(r.type)),
      withdraw: calc(r => ['Withdraw', 'Borrow'].includes(r.type))
    };
  }, [requests]);

  // --- Render ---
  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-800 overflow-hidden relative print:bg-white print:h-auto print:overflow-visible">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col shadow-lg z-20 no-print">
        <div className="p-6 border-b border-gray-100"><h1 className="text-2xl font-bold text-blue-700 flex items-center gap-2"><Package className="w-8 h-8" /> Purchase<span className="text-gray-800">Hub</span> <span className="text-[10px] bg-green-100 text-green-800 px-1 rounded">PRO</span></h1></div>
        <nav className="flex-1 p-4 space-y-1">
          <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}><LayoutDashboard className="w-5 h-5" /> ภาพรวม</button>
          <button onClick={() => setActiveTab('orders')} className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === 'orders' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}><ShoppingCart className="w-5 h-5" /> รายการสั่งซื้อ/เบิก</button>
          <button onClick={() => setActiveTab('inventory')} className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === 'inventory' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}><Box className="w-5 h-5" /> คลังสินค้า</button>
          <button onClick={() => setActiveTab('assets')} className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === 'assets' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}><Monitor className="w-5 h-5" /> ทะเบียนทรัพย์สิน</button>
        </nav>
        <div className="p-4 bg-gray-50 m-4 rounded-xl border border-gray-200"><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1"><User className="w-3 h-3"/> Role</p><select value={currentUserRole} onChange={(e) => setCurrentUserRole(e.target.value)} className="w-full p-2 text-sm border-gray-300 rounded-md cursor-pointer">{Object.entries(ROLES).map(([key, role]) => <option key={key} value={role}>{role}</option>)}</select></div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative no-print">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-10">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">{isLoading && <RefreshCw className="w-4 h-4 animate-spin"/>} {activeTab.toUpperCase()}</h2>
          <button onClick={() => setShowCreateModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-md"><Plus className="w-4 h-4" /> สร้างรายการ</button>
        </header>

        <div className="flex-1 overflow-auto p-6 bg-slate-50">
           {notification && <div className="absolute top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg bg-gray-900 text-white animate-in slide-in-from-top-5">{notification.message}</div>}
           
           {/* DASHBOARD */}
           {activeTab === 'dashboard' && (
               <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                   <div className="p-6 bg-blue-50 rounded-2xl border border-blue-200"><h3 className="text-3xl font-bold text-blue-600">{dashboardStats.purchase.total}</h3><p className="text-sm text-gray-500">ใบขอซื้อทั้งหมด</p></div>
                   <div className="p-6 bg-amber-50 rounded-2xl border border-amber-200"><h3 className="text-3xl font-bold text-amber-600">{dashboardStats.purchase.pending}</h3><p className="text-sm text-gray-500">รออนุมัติ</p></div>
                   <div className="p-6 bg-pink-50 rounded-2xl border border-pink-200"><h3 className="text-3xl font-bold text-pink-600">{dashboardStats.withdraw.total}</h3><p className="text-sm text-gray-500">ใบเบิกทั้งหมด</p></div>
                   <div className="p-6 bg-green-50 rounded-2xl border border-green-200"><h3 className="text-3xl font-bold text-green-600">{dashboardStats.withdraw.completed}</h3><p className="text-sm text-gray-500">เบิกจ่ายแล้ว</p></div>
               </div>
           )}

           {/* ORDERS */}
           {activeTab === 'orders' && (
               <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                   <div className="p-4 border-b flex gap-2 flex-wrap">
                       <input type="text" placeholder="ค้นหา..." className="border p-2 rounded text-sm flex-1" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}/>
                       <select className="border p-2 rounded text-sm" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value="All">ทุกประเภท</option><option value="Local">Local</option><option value="HO">HO</option><option value="Withdraw">Withdraw</option><option value="Borrow">Borrow</option></select>
                       <select className="border p-2 rounded text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="All">ทุกสถานะ</option><option value="Draft">Draft</option><option value="Pending Head">Pending Head</option><option value="Approved">Approved</option><option value="Ordered">Ordered</option></select>
                   </div>
                   <div className="divide-y">
                       {filteredRequests.map(req => (
                           <div key={req.id} className="p-4 hover:bg-gray-50 group">
                               <div className="flex justify-between items-start mb-2">
                                   <div className="flex gap-3">
                                        <div className={`p-2 rounded-lg ${req.type === 'Local' ? 'bg-orange-100' : req.type === 'HO' ? 'bg-purple-100' : 'bg-pink-100'}`}>
                                            {req.type === 'Local' ? <HardHat className="w-5 h-5 text-orange-600"/> : <Package className="w-5 h-5 text-purple-600"/>}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2"><span className="font-bold text-sm">{req.id}</span> <DocIdBadge type={req.type} id={req.docNumber}/></div>
                                            <div className="text-sm font-medium">{req.items[0]?.name} {req.items.length > 1 && `+${req.items.length-1}`}</div>
                                        </div>
                                   </div>
                                   <StatusBadge status={req.status}/>
                               </div>
                               <ProgressBar request={req}/>
                               <div className="flex justify-end gap-2 mt-2">
                                   {/* Action Buttons */}
                                   {(req.status === 'Ordered' || req.status === 'Approved') && <button onClick={() => {setSelectedRequest(req); setShowPOPreviewModal(true);}} className="text-xs flex items-center gap-1 bg-gray-100 px-2 py-1 rounded"><Printer className="w-3 h-3"/> พิมพ์</button>}
                                   
                                   {(currentUserRole === ROLES.DEPT_HEAD || currentUserRole === ROLES.ADMIN) && req.status === 'Pending Head' && <button onClick={() => handleUpdateStatus(req.id, req.type.includes('P') ? 'Pending PM' : 'Ready to Disburse')} className="text-xs bg-orange-600 text-white px-3 py-1 rounded">อนุมัติ (Head)</button>}
                                   
                                   {(currentUserRole === ROLES.PM || currentUserRole === ROLES.ADMIN) && req.status === 'Pending PM' && <button onClick={() => handleUpdateStatus(req.id, 'Approved')} className="text-xs bg-green-600 text-white px-3 py-1 rounded">อนุมัติ (PM)</button>}
                                   
                                   {(currentUserRole === ROLES.PURCHASING || currentUserRole === ROLES.ADMIN) && req.status === 'Approved' && req.type === 'Local' && <button onClick={() => handleUpdateStatus(req.id, 'Ordered')} className="text-xs bg-blue-600 text-white px-3 py-1 rounded">สั่งซื้อแล้ว</button>}
                                   
                                   {(currentUserRole === ROLES.STORE || currentUserRole === ROLES.ADMIN) && req.status === 'Ready to Disburse' && <button onClick={() => {setDisburseData({requestId: req.id, note: '', images: []}); setShowDisburseModal(true);}} className="text-xs bg-teal-600 text-white px-3 py-1 rounded">จ่ายของ/ตัดสต็อก</button>}
                                   
                                   {(currentUserRole === ROLES.PURCHASING || currentUserRole === ROLES.ADMIN) && req.status === 'Ordered' && <button onClick={() => openReceiveModal(req)} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded">รับของเข้าคลัง</button>}
                                   
                                   {(req.status.includes('Pending')) && <button onClick={() => {setRejectData({requestId: req.id}); setShowRejectModal(true);}} className="text-xs border border-red-200 text-red-600 px-2 py-1 rounded">ไม่อนุมัติ</button>}
                                   
                                   <button onClick={() => {setSelectedRequest(req); setShowDetailModal(true);}} className="text-xs bg-gray-200 px-3 py-1 rounded">รายละเอียด</button>
                               </div>
                           </div>
                       ))}
                   </div>
               </div>
           )}

           {/* INVENTORY */}
           {activeTab === 'inventory' && (
               <div className="bg-white rounded-xl border shadow-sm p-4">
                   <div className="flex justify-between mb-4">
                       <input type="text" placeholder="ค้นหาสินค้า..." className="border p-2 rounded text-sm" onChange={e => setInvSearch(e.target.value)}/>
                       <button onClick={() => setShowAddInvModal(true)} className="bg-green-600 text-white px-3 py-1 rounded text-sm">+ เพิ่มสินค้า</button>
                   </div>
                   <table className="w-full text-sm">
                       <thead className="bg-gray-100 text-left"><tr><th className="p-2">ID</th><th className="p-2">Name</th><th className="p-2">Qty</th><th className="p-2">Action</th></tr></thead>
                       <tbody>
                           {inventory.filter(i => i.name.toLowerCase().includes(invSearch)).map(inv => (
                               <tr key={inv.id} className="border-b hover:bg-gray-50">
                                   <td className="p-2">{inv.id}</td><td className="p-2 font-bold">{inv.name}</td>
                                   <td className={`p-2 ${inv.qty <= inv.minStock ? 'text-red-600' : 'text-green-600'}`}>{inv.qty} {inv.unit}</td>
                                   <td className="p-2"><button onClick={() => {setEditingStockItem(inv); setShowEditInvModal(true);}} className="text-blue-600">แก้ไข</button></td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
               </div>
           )}

            {/* ASSETS */}
           {activeTab === 'assets' && (
               <div className="bg-white rounded-xl border shadow-sm p-4">
                   <div className="flex justify-between mb-4">
                       <input type="text" placeholder="ค้นหาทรัพย์สิน..." className="border p-2 rounded text-sm" onChange={e => setAssetSearch(e.target.value)}/>
                       <button onClick={() => setShowAssetModal(true)} className="bg-indigo-600 text-white px-3 py-1 rounded text-sm">+ เพิ่มทรัพย์สิน</button>
                   </div>
                   <table className="w-full text-sm">
                       <thead className="bg-gray-100 text-left"><tr><th className="p-2">ID</th><th className="p-2">Name</th><th className="p-2">Status</th><th className="p-2">Holder</th><th className="p-2">Action</th></tr></thead>
                       <tbody>
                           {assets.filter(a => a.name.toLowerCase().includes(assetSearch)).map(ast => (
                               <tr key={ast.id} className="border-b hover:bg-gray-50">
                                   <td className="p-2">{ast.id}</td><td className="p-2">{ast.name} <span className="text-xs text-gray-400">({ast.serial})</span></td>
                                   <td className="p-2"><span className={`text-xs px-2 py-1 rounded ${ast.status === 'Available' ? 'bg-green-100' : 'bg-orange-100'}`}>{ast.status}</span></td>
                                   <td className="p-2">{ast.holder}</td>
                                   <td className="p-2">
                                       {ast.status === 'Borrowed' && <button onClick={() => {setReturnAssetData({...returnAssetData, id: ast.id}); setShowReturnAssetModal(true);}} className="text-teal-600 mr-2">รับคืน</button>}
                                       <button onClick={() => {setEditingAssetItem(ast); setShowEditAssetModal(true);}} className="text-blue-600">แก้ไข</button>
                                   </td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
               </div>
           )}
        </div>
      </main>

      {/* --- MODALS --- */}
      
      {/* 1. Create Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <h3 className="font-bold text-lg mb-4">สร้างรายการใหม่</h3>
                <div className="space-y-4">
                    <div className="flex gap-2">
                        {['Local', 'HO', 'Withdraw', 'Borrow'].map(t => <button key={t} onClick={() => setNewOrderMeta({...newOrderMeta, type: t})} className={`px-3 py-2 border rounded text-xs font-bold ${newOrderMeta.type === t ? 'bg-blue-600 text-white' : ''}`}>{t}</button>)}
                    </div>
                    <input type="text" placeholder="Job No." className="w-full border p-2 rounded" value={newOrderMeta.job} onChange={e => setNewOrderMeta({...newOrderMeta, job: e.target.value})}/>
                    <div className="border p-3 rounded bg-gray-50">
                        <div className="flex gap-2 mb-2">
                            <input type="text" placeholder="รายการ..." className="flex-1 border p-2 rounded text-sm" value={tempItem.name} onChange={e => setTempItem({...tempItem, name: e.target.value})}/>
                            <input type="number" placeholder="Qty" className="w-20 border p-2 rounded text-sm" value={tempItem.qty} onChange={e => setTempItem({...tempItem, qty: parseInt(e.target.value)})}/>
                            <button onClick={() => {setOrderItems([...orderItems, tempItem]); setTempItem({name:'', qty:1, unitPrice:0, images:[]});}} className="bg-green-600 text-white px-3 rounded">+</button>
                        </div>
                        <ul className="text-xs space-y-1">{orderItems.map((i, idx) => <li key={idx} className="flex justify-between border-b p-1"><span>{i.name}</span><span>x{i.qty}</span></li>)}</ul>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={(e) => handleCreateOrder(e, false)} className="flex-1 bg-blue-600 text-white py-2 rounded font-bold">บันทึก & ส่ง</button>
                        <button onClick={e => handleCreateOrder(e, true)} className="flex-1 border border-gray-300 py-2 rounded">บันทึก Draft</button>
                        <button onClick={() => setShowCreateModal(false)} className="px-4 border py-2 rounded">ปิด</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* 2. Receive Goods Modal */}
      {showReceiveGoodsModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
                  <h3 className="font-bold text-lg mb-4">รับของเข้าคลัง: {selectedRequest?.id}</h3>
                  {receiveItems.map((item, idx) => (
                      <div key={idx} className="mb-4 border p-3 rounded bg-gray-50">
                          <p className="font-bold text-sm mb-2">{item.name} (Qty: {item.qty})</p>
                          <div className="flex gap-2 mb-2">
                              <button onClick={() => {const ni=[...receiveItems]; ni[idx].targetType='Inventory'; setReceiveItems(ni);}} className={`text-xs px-3 py-1 rounded border ${item.targetType==='Inventory'?'bg-blue-600 text-white':'bg-white'}`}>เข้า Stock</button>
                              <button onClick={() => {const ni=[...receiveItems]; ni[idx].targetType='Asset'; setReceiveItems(ni);}} className={`text-xs px-3 py-1 rounded border ${item.targetType==='Asset'?'bg-indigo-600 text-white':'bg-white'}`}>ลงทะเบียน Asset</button>
                          </div>
                          {item.targetType === 'Asset' && item.assetsToRegister.map((ast, i) => (
                              <div key={i} className="flex gap-2 mb-1">
                                  <input type="text" placeholder="Asset ID" className="border p-1 text-xs w-1/3" value={ast.id} onChange={e => {const ni=[...receiveItems]; ni[idx].assetsToRegister[i].id=e.target.value; setReceiveItems(ni);}}/>
                                  <input type="text" placeholder="Serial" className="border p-1 text-xs w-1/3" value={ast.serial} onChange={e => {const ni=[...receiveItems]; ni[idx].assetsToRegister[i].serial=e.target.value; setReceiveItems(ni);}}/>
                              </div>
                          ))}
                      </div>
                  ))}
                  <button onClick={handleConfirmReceive} className="w-full bg-teal-600 text-white py-2 rounded">ยืนยันรับของ</button>
                  <button onClick={() => setShowReceiveGoodsModal(false)} className="w-full mt-2 text-gray-500 text-sm">ยกเลิก</button>
              </div>
          </div>
      )}

      {/* 3. Disburse Modal */}
      {showDisburseModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 w-full max-w-sm">
                  <h3 className="font-bold mb-4">จ่ายของ / ตัดสต็อก</h3>
                  <textarea className="w-full border p-2 rounded mb-4" placeholder="หมายเหตุ..." value={disburseData.note} onChange={e => setDisburseData({...disburseData, note: e.target.value})}></textarea>
                  <button onClick={handleConfirmDisburse} className="w-full bg-teal-600 text-white py-2 rounded">ยืนยันจ่ายของ</button>
                  <button onClick={() => setShowDisburseModal(false)} className="w-full mt-2 text-gray-500">ยกเลิก</button>
              </div>
          </div>
      )}

      {/* 4. PO Print Preview Modal */}
      {showPOPreviewModal && selectedRequest && (
        <div className="fixed inset-0 bg-gray-900/80 flex items-start justify-center z-[100] p-4 overflow-y-auto">
           <div className="bg-white shadow-2xl w-[210mm] min-h-[297mm] mx-auto my-4 print-container relative">
              <div className="flex justify-between items-center p-4 border-b bg-gray-50 no-print rounded-t-lg">
                  <h3 className="font-bold text-gray-700">ใบขอเบิก-สั่งซื้อ (Print Preview)</h3>
                  <div className="flex gap-2">
                      <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Print</button>
                      <button onClick={() => setShowPOPreviewModal(false)} className="bg-white border text-gray-700 px-4 py-2 rounded text-sm">Close</button>
                  </div>
              </div>
              <div className="p-[15mm] text-gray-900 print-only">
                  <div className="text-center mb-6"><h1 className="text-2xl font-bold border-b-2 border-black inline-block pb-1">ใบขอเบิก-สั่งซื้อวัสดุอุปกรณ์</h1></div>
                  <div className="flex justify-between mb-4 text-sm">
                      <div><p><strong>Job:</strong> {selectedRequest.job}</p><p><strong>Requester:</strong> {selectedRequest.requester}</p></div>
                      <div className="text-right"><p><strong>Doc No:</strong> {selectedRequest.docNumber || '-'}</p><p><strong>Date:</strong> {selectedRequest.created}</p></div>
                  </div>
                  <table className="w-full border-collapse border border-black mb-6 text-sm">
                      <thead><tr className="bg-gray-200"><th className="border border-black p-2">No.</th><th className="border border-black p-2 text-left">Description</th><th className="border border-black p-2">Qty</th></tr></thead>
                      <tbody>
                          {selectedRequest.items.map((item, idx) => (
                              <tr key={idx}><td className="border border-black p-2 text-center">{idx + 1}</td><td className="border border-black p-2">{item.name}</td><td className="border border-black p-2 text-center">{item.qty}</td></tr>
                          ))}
                      </tbody>
                  </table>
                  <div className="grid grid-cols-3 gap-4 mt-12 text-center text-sm pt-10">
                      <div><div className="border-b border-black mb-2 h-10"></div>ผู้ขอเบิก</div>
                      <div><div className="border-b border-black mb-2 h-10"></div>ผู้รับของ</div>
                      <div><div className="border-b border-black mb-2 h-10"></div>ผู้อนุมัติ</div>
                  </div>
              </div>
           </div>
        </div>
      )}
      
      {/* 5. Reject Modal */}
      {showRejectModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 w-full max-w-sm">
                  <h3 className="font-bold mb-4 text-red-600">ไม่อนุมัติรายการ</h3>
                  <textarea className="w-full border p-2 rounded mb-4" placeholder="ระบุเหตุผล..." value={rejectData.reason} onChange={e => setRejectData({...rejectData, reason: e.target.value})}></textarea>
                  <button onClick={() => handleUpdateStatus(rejectData.requestId, 'Rejected', rejectData.reason)} className="w-full bg-red-600 text-white py-2 rounded">ยืนยัน</button>
                  <button onClick={() => setShowRejectModal(false)} className="w-full mt-2 text-gray-500">ยกเลิก</button>
              </div>
          </div>
      )}

      {/* 6. Inventory & Asset Modals (Simple Forms) */}
      {showAddInvModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white p-6 rounded w-80 space-y-3"><h3 className="font-bold">เพิ่มสินค้า</h3><input className="border w-full p-2" placeholder="ชื่อ" onChange={e=>setNewStockItem({...newStockItem, name:e.target.value})}/><input className="border w-full p-2" type="number" placeholder="Qty" onChange={e=>setNewStockItem({...newStockItem, qty:parseInt(e.target.value)})}/><button onClick={handleAddStock} className="bg-green-600 text-white w-full py-2 rounded">Save</button><button onClick={()=>setShowAddInvModal(false)} className="w-full py-2">Cancel</button></div></div>}
      
      {showEditInvModal && editingStockItem && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white p-6 rounded w-80 space-y-3"><h3 className="font-bold">แก้สต็อก</h3><input className="border w-full p-2" type="number" value={editingStockItem.qty} onChange={e=>setEditingStockItem({...editingStockItem, qty:parseInt(e.target.value)})}/><button onClick={handleUpdateStock} className="bg-blue-600 text-white w-full py-2 rounded">Update</button><button onClick={()=>setShowEditInvModal(false)} className="w-full py-2">Cancel</button></div></div>}
      
      {showAssetModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white p-6 rounded w-80 space-y-3"><h3 className="font-bold">เพิ่มทรัพย์สิน</h3><input className="border w-full p-2" placeholder="ID (AST-XXX)" onChange={e=>setNewAssetItem({...newAssetItem, id:e.target.value})}/><input className="border w-full p-2" placeholder="Name" onChange={e=>setNewAssetItem({...newAssetItem, name:e.target.value})}/><button onClick={handleAddAsset} className="bg-indigo-600 text-white w-full py-2 rounded">Save</button><button onClick={()=>setShowAssetModal(false)} className="w-full py-2">Cancel</button></div></div>}

      {showReturnAssetModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white p-6 rounded w-80 space-y-3"><h3 className="font-bold">คืนทรัพย์สิน</h3><select className="border w-full p-2" onChange={e=>setReturnAssetData({...returnAssetData, condition:e.target.value})}><option value="Good">Good</option><option value="Broken">Broken</option></select><button onClick={handleReturnAsset} className="bg-teal-600 text-white w-full py-2 rounded">Confirm Return</button><button onClick={()=>setShowReturnAssetModal(false)} className="w-full py-2">Cancel</button></div></div>}

      {/* 7. General Detail Modal */}
      {showDetailModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between mb-4"><h3 className="font-bold text-lg">รายละเอียด: {selectedRequest.id}</h3><button onClick={()=>setShowDetailModal(false)}>X</button></div>
                <div className="space-y-2 mb-4">
                    <p><strong>Status:</strong> {selectedRequest.status}</p>
                    <div className="border p-2 rounded bg-gray-50">{selectedRequest.items.map((i, idx)=><div key={idx} className="flex justify-between border-b p-1"><span>{i.name}</span><span>x{i.qty}</span></div>)}</div>
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                    <p className="font-bold">History:</p>
                    {selectedRequest.history.map((h, i)=><p key={i}>[{h.date}] {h.action} by {h.user} {h.note && `(${h.note})`}</p>)}
                </div>
            </div>
        </div>
      )}
      
      {/* Print Styles */}
      <style>{`@media print { .no-print { display: none !important; } .print-only { display: block !important; } body { background: white; } } .print-only { display: none; }`}</style>
    </div>
  );
};

export default App;