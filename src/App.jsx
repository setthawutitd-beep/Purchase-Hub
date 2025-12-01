import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
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

const App = () => {
  // State
  const [currentUserRole, setCurrentUserRole] = useState(ROLES.USER);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Data State
  const [requests, setRequests] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [assets, setAssets] = useState([]);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [invSearch, setInvSearch] = useState('');
  const [assetSearch, setAssetSearch] = useState('');

  // Modals State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAddInvModal, setShowAddInvModal] = useState(false);
  const [showEditInvModal, setShowEditInvModal] = useState(false);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showEditAssetModal, setShowEditAssetModal] = useState(false);
  
  // Form Data State
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [newOrderMeta, setNewOrderMeta] = useState({ type: 'Local', job: '', dateRequired: '', attachment: null });
  const [orderItems, setOrderItems] = useState([]);
  const [tempItem, setTempItem] = useState({ name: '', qty: 1, unitPrice: 0 });
  
  const [newStockItem, setNewStockItem] = useState({ name: '', qty: 0, unit: 'ชิ้น', minStock: 0, price: 0 });
  const [editingStockItem, setEditingStockItem] = useState(null);
  const [newAssetItem, setNewAssetItem] = useState({ id: '', name: '', serial: '', status: 'Available', condition: 'Good', price: 0 });
  const [editingAssetItem, setEditingAssetItem] = useState(null);

  // --- Initial Fetch ---
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const reqRes = await supabase.from('requests').select('*').order('id', { ascending: false });
      const invRes = await supabase.from('inventory').select('*').order('id', { ascending: true });
      const astRes = await supabase.from('assets').select('*').order('id', { ascending: true });

      if (reqRes.error) throw reqRes.error;
      if (invRes.error) throw invRes.error;
      if (astRes.error) throw astRes.error;

      // Map Requests
      setRequests(reqRes.data.map(item => ({
        id: item.request_id, db_id: item.id, type: item.type, items: item.items || [],
        job: item.job, requester: item.requester, status: item.status,
        dateRequired: item.date_required, created: item.created, docNumber: item.doc_number,
        history: item.history || []
      })));

      // Map Inventory
      setInventory(invRes.data.map(item => ({
        id: item.item_id, db_id: item.id, name: item.name, qty: item.qty,
        unit: item.unit, minStock: item.min_stock, price: item.price,
        lastUpdated: item.last_updated
      })));

      // Map Assets
      setAssets(astRes.data.map(item => ({
        id: item.asset_id, db_id: item.id, name: item.name, serial: item.serial,
        status: item.status, holder: item.holder, condition: item.condition,
        price: item.price, lastUpdated: item.last_updated
      })));

    } catch (error) {
      console.error(error);
      showToast('Error loading data: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // --- Handlers: Requests ---
  const handleCreateOrder = async () => {
    if (orderItems.length === 0) { showToast("เพิ่มรายการก่อนครับ", 'error'); return; }
    
    const newReqId = `REQ-${Date.now().toString().slice(-6)}`;
    const nextStatus = newOrderMeta.type === 'HO' ? 'Pending Check' : 'Pending Head';
    
    try {
        const { error } = await supabase.from('requests').insert([{
            request_id: newReqId, type: newOrderMeta.type, status: nextStatus,
            requester: 'Current User', job: newOrderMeta.job, items: orderItems,
            history: [createLog('สร้างคำขอ', 'Current User')],
            date_required: newOrderMeta.dateRequired, created: new Date().toLocaleString('th-TH')
        }]);
        if (error) throw error;
        
        fetchData();
        showToast('สร้างใบขอซื้อสำเร็จ');
        setShowCreateModal(false);
        setOrderItems([]);
        setNewOrderMeta({ type: 'Local', job: '', dateRequired: '', attachment: null });
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleUpdateStatus = async (id, newStatus) => {
      // Simplified status update
      const target = requests.find(r => r.id === id);
      if (!target) return;
      
      const updatedHistory = [...target.history, createLog(STATUS_LABELS[newStatus], currentUserRole)];
      let updatePayload = { status: newStatus, history: updatedHistory };
      
      // Auto Generate Doc ID logic simplified
      if (!target.docNumber && ['Ordered', 'Approved'].includes(newStatus)) {
          const count = requests.filter(r => r.docNumber && r.type === target.type).length;
          updatePayload.doc_number = generateDocId(target.type, count);
      }

      try {
          const { error } = await supabase.from('requests').update(updatePayload).eq('request_id', id);
          if (error) throw error;
          fetchData();
          showToast(`อัปเดตสถานะเป็น ${newStatus} เรียบร้อย`);
          setShowDetailModal(false);
      } catch (err) { showToast(err.message, 'error'); }
  };

  // --- Handlers: Inventory ---
  const handleAddStock = async () => {
      const newId = `INV-${String(inventory.length + 1).padStart(3, '0')}`;
      try {
          const { error } = await supabase.from('inventory').insert([{
              item_id: newId, name: newStockItem.name, qty: newStockItem.qty,
              unit: newStockItem.unit, min_stock: newStockItem.minStock, price: newStockItem.price,
              last_updated: new Date().toLocaleString('th-TH')
          }]);
          if (error) throw error;
          fetchData();
          showToast('เพิ่มสินค้าใหม่แล้ว');
          setShowAddInvModal(false);
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
          fetchData();
          showToast('แก้ไขสต็อกเรียบร้อย');
          setShowEditInvModal(false);
      } catch (err) { showToast(err.message, 'error'); }
  };

  // --- Handlers: Assets ---
  const handleAddAsset = async () => {
      const newId = newAssetItem.id || `AST-${String(assets.length + 1).padStart(3, '0')}`;
      try {
          const { error } = await supabase.from('assets').insert([{
              asset_id: newId, name: newAssetItem.name, serial: newAssetItem.serial,
              status: 'Available', condition: 'Good', price: newAssetItem.price, holder: '-',
              last_updated: new Date().toLocaleString('th-TH')
          }]);
          if (error) throw error;
          fetchData();
          showToast('เพิ่มทรัพย์สินแล้ว');
          setShowAssetModal(false);
      } catch (err) { showToast(err.message, 'error'); }
  };

  const handleUpdateAsset = async () => {
      if (!editingAssetItem) return;
      try {
          const { error } = await supabase.from('assets').update({
              status: editingAssetItem.status, condition: editingAssetItem.condition, holder: editingAssetItem.holder,
              last_updated: new Date().toLocaleString('th-TH')
          }).eq('asset_id', editingAssetItem.id);
          if (error) throw error;
          fetchData();
          showToast('แก้ไขทรัพย์สินเรียบร้อย');
          setShowEditAssetModal(false);
      } catch (err) { showToast(err.message, 'error'); }
  };

  // --- Filter Logic ---
  const filteredRequests = useMemo(() => {
      let data = requests;
      if (searchQuery) data = data.filter(r => r.id.toLowerCase().includes(searchQuery.toLowerCase()) || r.items[0]?.name.includes(searchQuery));
      if (typeFilter !== 'All') data = data.filter(r => r.type === typeFilter);
      return data;
  }, [requests, searchQuery, typeFilter]);

  const filteredInventory = useMemo(() => {
      if (!invSearch) return inventory;
      return inventory.filter(i => i.name.toLowerCase().includes(invSearch.toLowerCase()));
  }, [inventory, invSearch]);

  const filteredAssets = useMemo(() => {
      if (!assetSearch) return assets;
      return assets.filter(a => a.name.toLowerCase().includes(assetSearch.toLowerCase()) || a.id.toLowerCase().includes(assetSearch.toLowerCase()));
  }, [assets, assetSearch]);

  // --- Render ---
  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-800 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col shadow-lg z-20">
        <div className="p-6 border-b border-gray-100"><h1 className="text-2xl font-bold text-blue-700 flex items-center gap-2"><Package className="w-8 h-8" /> Purchase<span className="text-gray-800">Hub</span></h1></div>
        <nav className="flex-1 p-4 space-y-1">
          <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}><LayoutDashboard className="w-5 h-5" /> ภาพรวม (Dashboard)</button>
          <button onClick={() => setActiveTab('orders')} className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === 'orders' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}><ShoppingCart className="w-5 h-5" /> ใบขอซื้อ/เบิก</button>
          <button onClick={() => setActiveTab('inventory')} className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === 'inventory' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}><Box className="w-5 h-5" /> คลังสินค้า (Stock)</button>
          <button onClick={() => setActiveTab('assets')} className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors font-medium ${activeTab === 'assets' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}><Monitor className="w-5 h-5" /> ทะเบียนทรัพย์สิน</button>
        </nav>
        <div className="p-4 bg-gray-50 m-4 rounded-xl border border-gray-200"><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1"><User className="w-3 h-3"/> Role</p><select value={currentUserRole} onChange={(e) => setCurrentUserRole(e.target.value)} className="w-full p-2 text-sm border-gray-300 rounded-md cursor-pointer">{Object.entries(ROLES).map(([key, role]) => <option key={key} value={role}>{role}</option>)}</select></div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-10">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">{isLoading && <RefreshCw className="w-4 h-4 animate-spin"/>} {activeTab.toUpperCase()}</h2>
          <button onClick={() => setShowCreateModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-md"><Plus className="w-4 h-4" /> สร้างรายการ</button>
        </header>

        <div className="flex-1 overflow-auto p-6 bg-slate-50">
           {notification && <div className="absolute top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg bg-gray-900 text-white animate-in slide-in-from-top-5">{notification.message}</div>}
           
           {/* DASHBOARD */}
           {activeTab === 'dashboard' && (
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <div className="p-6 bg-white rounded-xl border shadow-sm"><h3 className="text-3xl font-bold text-blue-600">{requests.length}</h3><p className="text-gray-500">ใบขอซื้อทั้งหมด</p></div>
                   <div className="p-6 bg-white rounded-xl border shadow-sm"><h3 className="text-3xl font-bold text-green-600">{inventory.length}</h3><p className="text-gray-500">รายการสินค้าในคลัง</p></div>
                   <div className="p-6 bg-white rounded-xl border shadow-sm"><h3 className="text-3xl font-bold text-purple-600">{assets.length}</h3><p className="text-gray-500">ทรัพย์สินทั้งหมด</p></div>
               </div>
           )}

           {/* ORDERS */}
           {activeTab === 'orders' && (
               <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                   <div className="p-4 border-b flex gap-2">
                       <input type="text" placeholder="ค้นหา..." className="border p-2 rounded text-sm" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}/>
                       <select className="border p-2 rounded text-sm" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value="All">ทุกประเภท</option><option value="Local">Local</option><option value="HO">HO</option></select>
                   </div>
                   <div className="divide-y">
                       {filteredRequests.map(req => (
                           <div key={req.id} className="p-4 hover:bg-gray-50 flex justify-between items-center cursor-pointer" onClick={() => {setSelectedRequest(req); setShowDetailModal(true);}}>
                               <div>
                                   <div className="flex items-center gap-2"><span className="text-xs font-bold bg-gray-100 px-2 rounded">{req.type}</span> <span className="text-sm font-bold">{req.id}</span> <DocIdBadge type={req.type} id={req.docNumber}/></div>
                                   <div className="text-sm">{req.items[0]?.name} (x{req.items[0]?.qty})</div>
                               </div>
                               <StatusBadge status={req.status}/>
                           </div>
                       ))}
                   </div>
               </div>
           )}

           {/* INVENTORY */}
           {activeTab === 'inventory' && (
               <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                   <div className="p-4 border-b flex justify-between">
                       <input type="text" placeholder="ค้นหาสินค้า..." className="border p-2 rounded text-sm" value={invSearch} onChange={e => setInvSearch(e.target.value)}/>
                       {(currentUserRole === ROLES.STORE || currentUserRole === ROLES.ADMIN) && <button onClick={() => setShowAddInvModal(true)} className="text-sm bg-green-600 text-white px-3 py-1 rounded">เพิ่มสินค้า</button>}
                   </div>
                   <table className="w-full text-sm text-left">
                       <thead className="bg-gray-100"><tr><th className="p-3">ID</th><th className="p-3">ชื่อสินค้า</th><th className="p-3">คงเหลือ</th><th className="p-3">จัดการ</th></tr></thead>
                       <tbody>
                           {filteredInventory.map(inv => (
                               <tr key={inv.id} className="border-b hover:bg-gray-50">
                                   <td className="p-3">{inv.id}</td><td className="p-3 font-bold">{inv.name}</td>
                                   <td className={`p-3 ${inv.qty <= inv.minStock ? 'text-red-600 font-bold' : 'text-green-600'}`}>{inv.qty} {inv.unit}</td>
                                   <td className="p-3">
                                       {(currentUserRole === ROLES.STORE || currentUserRole === ROLES.ADMIN) && 
                                       <button onClick={() => {setEditingStockItem(inv); setShowEditInvModal(true);}} className="text-blue-600 hover:underline">แก้ไข</button>}
                                   </td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
               </div>
           )}

           {/* ASSETS */}
           {activeTab === 'assets' && (
               <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                   <div className="p-4 border-b flex justify-between">
                       <input type="text" placeholder="ค้นหาทรัพย์สิน..." className="border p-2 rounded text-sm" value={assetSearch} onChange={e => setAssetSearch(e.target.value)}/>
                       {(currentUserRole === ROLES.STORE || currentUserRole === ROLES.ADMIN) && <button onClick={() => setShowAssetModal(true)} className="text-sm bg-indigo-600 text-white px-3 py-1 rounded">เพิ่มทรัพย์สิน</button>}
                   </div>
                   <table className="w-full text-sm text-left">
                       <thead className="bg-gray-100"><tr><th className="p-3">ID</th><th className="p-3">ชื่อทรัพย์สิน</th><th className="p-3">สถานะ</th><th className="p-3">ผู้ถือครอง</th><th className="p-3">จัดการ</th></tr></thead>
                       <tbody>
                           {filteredAssets.map(ast => (
                               <tr key={ast.id} className="border-b hover:bg-gray-50">
                                   <td className="p-3">{ast.id}</td><td className="p-3">{ast.name} <span className="text-xs text-gray-400">({ast.serial})</span></td>
                                   <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs ${ast.status === 'Available' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>{ast.status}</span></td>
                                   <td className="p-3">{ast.holder}</td>
                                   <td className="p-3">
                                       {(currentUserRole === ROLES.STORE || currentUserRole === ROLES.ADMIN) && 
                                       <button onClick={() => {setEditingAssetItem(ast); setShowEditAssetModal(true);}} className="text-blue-600 hover:underline">แก้ไข</button>}
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
      
      {/* Create Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg">
                <h3 className="font-bold text-lg mb-4">สร้างรายการใหม่</h3>
                <div className="space-y-3">
                    <div className="flex gap-2">
                        {['Local', 'HO'].map(t => <button key={t} onClick={() => setNewOrderMeta({...newOrderMeta, type: t})} className={`px-4 py-2 border rounded ${newOrderMeta.type === t ? 'bg-blue-600 text-white' : ''}`}>{t}</button>)}
                    </div>
                    <input type="text" placeholder="Job No." className="w-full border p-2 rounded" value={newOrderMeta.job} onChange={e => setNewOrderMeta({...newOrderMeta, job: e.target.value})}/>
                    <div className="border p-3 rounded bg-gray-50">
                        <div className="flex gap-2 mb-2">
                            <input type="text" placeholder="รายการ..." className="flex-1 border p-2 rounded text-sm" value={tempItem.name} onChange={e => setTempItem({...tempItem, name: e.target.value})}/>
                            <input type="number" placeholder="Qty" className="w-20 border p-2 rounded text-sm" value={tempItem.qty} onChange={e => setTempItem({...tempItem, qty: parseInt(e.target.value)})}/>
                            <button onClick={() => {setOrderItems([...orderItems, tempItem]); setTempItem({name:'', qty:1, unitPrice:0});}} className="bg-green-600 text-white px-3 rounded">+</button>
                        </div>
                        {orderItems.map((i, idx) => <div key={idx} className="text-sm border-b p-1 flex justify-between"><span>{i.name}</span><span>x{i.qty}</span></div>)}
                    </div>
                    <button onClick={handleCreateOrder} className="w-full bg-blue-600 text-white py-2 rounded font-bold">บันทึก</button>
                    <button onClick={() => setShowCreateModal(false)} className="w-full border py-2 rounded">ยกเลิก</button>
                </div>
            </div>
        </div>
      )}

      {/* Add Inventory Modal */}
      {showAddInvModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 w-full max-w-sm">
                  <h3 className="font-bold mb-4">เพิ่มสินค้าใหม่</h3>
                  <div className="space-y-3">
                      <input type="text" placeholder="ชื่อสินค้า" className="w-full border p-2 rounded" onChange={e => setNewStockItem({...newStockItem, name: e.target.value})}/>
                      <div className="flex gap-2">
                        <input type="number" placeholder="จำนวน" className="w-full border p-2 rounded" onChange={e => setNewStockItem({...newStockItem, qty: parseInt(e.target.value)})}/>
                        <input type="text" placeholder="หน่วย" className="w-full border p-2 rounded" onChange={e => setNewStockItem({...newStockItem, unit: e.target.value})}/>
                      </div>
                      <input type="number" placeholder="Min Stock" className="w-full border p-2 rounded" onChange={e => setNewStockItem({...newStockItem, minStock: parseInt(e.target.value)})}/>
                      <button onClick={handleAddStock} className="w-full bg-green-600 text-white py-2 rounded">ยืนยัน</button>
                      <button onClick={() => setShowAddInvModal(false)} className="w-full border py-2 rounded">ยกเลิก</button>
                  </div>
              </div>
          </div>
      )}

      {/* Edit Inventory Modal */}
      {showEditInvModal && editingStockItem && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 w-full max-w-sm">
                  <h3 className="font-bold mb-4">แก้ไข: {editingStockItem.name}</h3>
                  <div className="space-y-3">
                      <label className="text-sm text-gray-500">จำนวนคงเหลือ</label>
                      <input type="number" className="w-full border p-2 rounded font-bold text-lg" value={editingStockItem.qty} onChange={e => setEditingStockItem({...editingStockItem, qty: parseInt(e.target.value)})}/>
                      <button onClick={handleUpdateStock} className="w-full bg-blue-600 text-white py-2 rounded">บันทึก</button>
                      <button onClick={() => setShowEditInvModal(false)} className="w-full border py-2 rounded">ยกเลิก</button>
                  </div>
              </div>
          </div>
      )}

      {/* Add Asset Modal */}
      {showAssetModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 w-full max-w-sm">
                  <h3 className="font-bold mb-4">เพิ่มทรัพย์สิน</h3>
                  <div className="space-y-3">
                      <input type="text" placeholder="รหัส (AST-XXX)" className="w-full border p-2 rounded" onChange={e => setNewAssetItem({...newAssetItem, id: e.target.value})}/>
                      <input type="text" placeholder="ชื่อทรัพย์สิน" className="w-full border p-2 rounded" onChange={e => setNewAssetItem({...newAssetItem, name: e.target.value})}/>
                      <input type="text" placeholder="Serial No." className="w-full border p-2 rounded" onChange={e => setNewAssetItem({...newAssetItem, serial: e.target.value})}/>
                      <button onClick={handleAddAsset} className="w-full bg-indigo-600 text-white py-2 rounded">ยืนยัน</button>
                      <button onClick={() => setShowAssetModal(false)} className="w-full border py-2 rounded">ยกเลิก</button>
                  </div>
              </div>
          </div>
      )}

      {/* Edit Asset Modal */}
      {showEditAssetModal && editingAssetItem && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 w-full max-w-sm">
                  <h3 className="font-bold mb-4">สถานะ: {editingAssetItem.name}</h3>
                  <div className="space-y-3">
                      <select className="w-full border p-2 rounded" value={editingAssetItem.status} onChange={e => setEditingAssetItem({...editingAssetItem, status: e.target.value})}>
                          <option value="Available">Available</option>
                          <option value="Borrowed">Borrowed</option>
                          <option value="Broken">Broken</option>
                      </select>
                      <input type="text" placeholder="ผู้ถือครอง" className="w-full border p-2 rounded" value={editingAssetItem.holder} onChange={e => setEditingAssetItem({...editingAssetItem, holder: e.target.value})}/>
                      <button onClick={handleUpdateAsset} className="w-full bg-blue-600 text-white py-2 rounded">บันทึก</button>
                      <button onClick={() => setShowEditAssetModal(false)} className="w-full border py-2 rounded">ยกเลิก</button>
                  </div>
              </div>
          </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedRequest && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 w-full max-w-lg">
                  <div className="flex justify-between mb-4"><h3 className="font-bold text-lg">{selectedRequest.id}</h3><button onClick={() => setShowDetailModal(false)}>X</button></div>
                  <div className="space-y-2 text-sm mb-4">
                      <p><strong>Job:</strong> {selectedRequest.job}</p>
                      <p><strong>Status:</strong> {selectedRequest.status}</p>
                      <div className="border p-2 rounded bg-gray-50">{selectedRequest.items.map((i, idx) => <div key={idx} className="flex justify-between p-1 border-b last:border-0"><span>{i.name}</span><span>x{i.qty}</span></div>)}</div>
                  </div>
                  {/* Action Buttons */}
                  <div className="flex justify-end gap-2">
                      {currentUserRole === ROLES.PM && selectedRequest.status === 'Pending PM' && <button onClick={() => handleUpdateStatus(selectedRequest.id, 'Approved')} className="bg-green-600 text-white px-4 py-2 rounded">อนุมัติ</button>}
                      {currentUserRole === ROLES.PURCHASING && selectedRequest.status === 'Approved' && <button onClick={() => handleUpdateStatus(selectedRequest.id, 'Ordered')} className="bg-blue-600 text-white px-4 py-2 rounded">สั่งซื้อแล้ว</button>}
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default App;