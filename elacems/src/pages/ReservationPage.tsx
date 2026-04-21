// src/pages/ReservationPage.tsx
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  Container,
  Card,
  Typography,
  Box,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  IconButton,
  Tooltip,
  TablePagination,
  InputAdornment,
  Backdrop,
  CircularProgress,
  Badge,
  Snackbar
} from '@mui/material';
import MuiAlert from '@mui/material/Alert';
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import SearchIcon from "@mui/icons-material/Search";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import WarningIcon from "@mui/icons-material/Warning";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import FilterListIcon from "@mui/icons-material/FilterList";
import ChatBubbleIcon from "@mui/icons-material/ChatBubble";
import SendIcon from "@mui/icons-material/Send";
import CancelIcon from '@mui/icons-material/Cancel';
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import AddIcon from "@mui/icons-material/Add";
import axios from 'axios';
import { alpha, useTheme } from '@mui/material/styles';
import Checkbox from '@mui/material/Checkbox';

const API_BASE_URL = "https://elams.sit.ubaguio.edu/api";

interface RequestedItem {
  item_name: string;
  quantity: number;
  item_type: 'consumable' | 'non-consumable';
}

interface AssignedItem {
  requested_item_index: number;
  item_id: string;
  item_name: string;
  item_type: 'consumable' | 'non-consumable';
  quantity: number;
  preAssigned?: boolean; // <-- new flag to mark already-assigned rows
}

interface Reservation {
  _id: string;
  reservation_code: string;
  subject: string;
  instructor: string;
  instructor_email: string;
  course: string;
  room: string;
  schedule: string;
  startTime?: string;
  endTime?: string;
  group_count: number;
  needsItems: boolean;
  requested_items: RequestedItem[];
  assigned_items: AssignedItem[];
  status: string;
  date_created?: string;
  date_approved?: string;
  date_assigned?: string;
  notes?: string;
  messages?: Array<{ sender: string; message: string; timestamp: string }>;
  edits?: any[]; // optional edit history stored by server
}

interface InventoryItem {
  _id?: string;
  num: string;
  equipment_name: string;
  available: number;
  identifiers?: string[];
  is_consumable?: boolean;
}

export default function ReservationPage() {
  const theme = useTheme();
  const brandRed = "#b91c1c";

  // --- NEW: unified action button styles (neutral grey, UB red on hover) ---
  const ubRed = "#B71C1C";
  const actionBtnSx = {
    minWidth: 0,
    bgcolor: "grey.100",
    color: "text.primary",
    borderRadius: 2,
    p: 1,
    transition: "all 180ms ease",
    boxShadow: "none",
    "&:hover": {
      bgcolor: ubRed,
      color: "#fff",
      transform: "translateY(-2px)",
      boxShadow: "0 8px 20px rgba(183,28,28,0.12)",
    },
  };
  const actionIconBtnSx = {
    ...actionBtnSx,
    width: 40,
    height: 40,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  // current user role — Student Assistant must not access some actions
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const currentRole = currentUser?.role || '';
  const isStudentAssistant = currentRole === 'Student Assistant';
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignmentData, setAssignmentData] = useState<AssignedItem[]>([]);
  const [search, setSearch] = useState('');
  const [itemSearch, setItemSearch] = useState<{ [key: number]: string }>({});
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState('All');
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedReservationDetails, setSelectedReservationDetails] = useState<Reservation | null>(null);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [selectedReservationForChat, setSelectedReservationForChat] = useState<Reservation | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatRefreshInterval, setChatRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [selectedReservations, setSelectedReservations] = useState<string[]>([]);
  // AI / Report state (new)
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [reportText, setReportText] = useState("");
  const [reportTable, setReportTable] = useState<{ columns: string[]; rows: string[][] } | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [availableFields, setAvailableFields] = useState<{ field: string; label: string; type: 'string'|'number'|'date' }[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [reportFilters, setReportFilters] = useState<{ field: string; operator: string; value: string }[]>([]);

  // ref for messages container to auto-scroll
  const messageListRef = useRef<HTMLDivElement | null>(null);
  // anchor for last message
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const COMPOSER_HEIGHT = 96;

  const scrollToBottom = () => {
    try {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        return;
      }
      if (messageListRef.current) {
        setTimeout(() => {
          messageListRef.current!.scrollTop = messageListRef.current!.scrollHeight;
        }, 50);
      }
    } catch (e) {}
  };

  // Fetch reservations from server
  const fetchReservations = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/reservations`);
      setReservations(response.data);
    } catch (error) {
      console.error('Fetch reservations error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch combined inventory
  const fetchInventory = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/inventory`);
      setInventory(response.data);
    } catch (error) {
      console.error('Fetch inventory error:', error);
    }
  };

  useEffect(() => {
    fetchReservations();
    fetchInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (messageDialogOpen && selectedReservationForChat) {
      scrollToBottom();
    }
  }, [messageDialogOpen, selectedReservationForChat?.messages?.length]);

  const handleAssign = (reservation: Reservation) => {
    setSelectedReservation(reservation);

    // Build initial assignment rows, but populate rows that are already assigned
    const existingAssigned = Array.isArray(reservation.assigned_items) ? reservation.assigned_items : [];

    const initialAssignment: AssignedItem[] = reservation.requested_items.map((item, index) => {
      const assigned = existingAssigned.find(ai => ai.requested_item_index === index);
      if (assigned) {
        return {
          requested_item_index: index,
          item_id: assigned.item_id,
          item_name: assigned.item_name,
          item_type: assigned.item_type as 'consumable' | 'non-consumable',
          quantity: assigned.quantity,
          preAssigned: true
        };
      }
      return {
        requested_item_index: index,
        item_id: '',
        item_name: item.item_name,
        item_type: item.item_type,
        quantity: item.quantity,
        preAssigned: false
      };
    });

    setAssignmentData(initialAssignment);
    setItemSearch({});
    setAssignDialogOpen(true);
  };

  const handleView = (reservation: Reservation) => {
    setSelectedReservationDetails(reservation);
    setViewDialogOpen(true);
  };

  const handleItemAssignment = (index: number, itemId: string) => {
    setAssignmentData(prev =>
      prev.map((item, i) =>
        i === index
          ? { ...item, item_id: item.preAssigned ? item.item_id : itemId, item_name: item.preAssigned ? item.item_name : (inventory.find(inv => inv.num === itemId)?.equipment_name || item.item_name) }
          : item
      )
    );
  };

  const handleItemSearchChange = (index: number, searchTerm: string) => {
    setItemSearch(prev => ({
      ...prev,
      [index]: searchTerm
    }));
  };

  const handleSubmitAssignment = async () => {
    if (!selectedReservation) return;

    // Only validate rows that are not preAssigned
    const newAssignments = assignmentData.filter(a => !a.preAssigned);
    if (newAssignments.length > 0 && newAssignments.some(item => !item.item_id)) {
      alert('Please assign all unassigned items before submitting');
      return;
    }

    setProcessing(true);
    try {
      // Combine existing assigned_items on reservation (if any) with new assignments
      const existingAssigned = Array.isArray(selectedReservation.assigned_items) ? selectedReservation.assigned_items : [];

      // Normalize newAssignments shape to sent format (ensure requested_item_index, item_id, item_name, item_type, quantity)
      const normalizedNew = newAssignments.map(a => ({
        requested_item_index: a.requested_item_index,
        item_id: a.item_id,
        item_name: a.item_name,
        item_type: a.item_type,
        quantity: a.quantity
      }));

      // Merge while avoiding duplicate requested_item_index entries (prefer existing if preAssigned)
      const merged = [...existingAssigned.filter(e => !normalizedNew.some(n => n.requested_item_index === e.requested_item_index)), ...normalizedNew];

      await axios.post(`${API_BASE_URL}/reservations/${selectedReservation._id}/assign`, {
        assigned_items: merged,
        assigned_by: JSON.parse(localStorage.getItem('user') || '{}').email || 'Unknown'
      });

      await fetchReservations();
      setAssignDialogOpen(false);
      setSelectedReservation(null);
      setItemSearch({});
      setSnackbar({ open: true, message: "Items assigned", severity: "success" });
    } catch (error) {
      setSnackbar({ open: true, message: "Failed to assign items", severity: "error" });
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveReservation = async (reservation: Reservation) => {
    // guard by role
    if (isStudentAssistant) {
      alert('You are not allowed to approve reservations.');
      return;
    }
    if (reservation.status !== 'Pending') {
      alert('Only Pending reservations can be approved');
      return;
    }
    setProcessing(true);
    try {
      await axios.post(`${API_BASE_URL}/reservations/${reservation._id}/approve`, {
        approved_by: currentUser.email || 'Unknown'
      });
      await fetchReservations();
      setSnackbar({ open: true, message: "Reservation approved successfully", severity: "success" });
    } catch (error) {
      setSnackbar({ open: true, message: "Failed to approve reservation", severity: "error" });
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectReservation = async (reservation: Reservation) => {
    // role guard + status guard
    if (isStudentAssistant) {
      alert('You are not allowed to reject reservations.');
      return;
    }
    if (reservation.status !== 'Pending') {
      alert('Only Pending reservations can be rejected.');
      return;
    }
    const reason = window.prompt('Enter rejection reason (optional):', '');
    if (reason === null) return; // cancelled
    try {
      await axios.post(`${API_BASE_URL}/reservations/${reservation._id}/reject`, {
        reason,
        rejected_by: currentUser.email || currentUser.name || 'Unknown',
        rejected_name: currentUser.name || currentUser.firstname || currentUser.email
      });
      await fetchReservations();
      setSnackbar({ open: true, message: "Reservation rejected", severity: "success" });
    } catch (err) {
      setSnackbar({ open: true, message: "Failed to reject reservation", severity: "error" });
    }
  };

  // helper: count unseen messages for current user
  const unseenCount = (reservation: Reservation) => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const email = (user && (user.email || user.name)) || '';
      if (!email) return 0;
      return (reservation.messages || []).filter(m => !(m as any).seen_by || !(m as any).seen_by.includes(email)).length;
    } catch (e) {
      return 0;
    }
  };

  const handleOpenChat = async (reservation: Reservation) => {
    if (isStudentAssistant) {
      alert('You are not allowed to open reservation messages.');
      return;
    }
    setSelectedReservationForChat(reservation);
    setMessageDialogOpen(true);
    setMessageText('');

    // mark messages seen and fetch updated reservation
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const userEmail = user.email || user.name || 'Unknown';
      await axios.post(`${API_BASE_URL}/reservations/${reservation._id}/messages-seen`, {
        user_email: userEmail
      });
      const resp = await axios.get(`${API_BASE_URL}/reservations/${reservation._id}`);
      const updatedRes = resp.data as Reservation;

      // update states (replace or append)
      setSelectedReservationForChat(updatedRes);
      setReservations(prev => {
        const exists = prev.some(r => r._id === updatedRes._id);
        return exists ? prev.map(r => r._id === updatedRes._id ? updatedRes : r) : [updatedRes, ...prev];
      });

      // ensure scroll after DOM update
      setTimeout(() => {
        try { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); } catch(e){}
      }, 50);
    } catch (err) {
      console.error('Mark messages seen error:', err);
    }
  
    // start polling (or SSE if you later switch)
    startChatPolling(reservation._id);
  };

  const handleSendMessage = async () => {
    if (!selectedReservationForChat || !messageText.trim()) return;

    setSendingMessage(true);
    try {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const userIdentifier = currentUser.email || currentUser.name || 'Unknown';
      const userName = currentUser.name || userIdentifier;

      const resp = await axios.post(`${API_BASE_URL}/reservations/${selectedReservationForChat._id}/message`, {
        sender: userIdentifier,
        sender_name: userName,
        message: messageText
      });

      const updated = resp.data as Reservation;

      // mark seen (best-effort)
      try {
        await axios.post(`${API_BASE_URL}/reservations/${selectedReservationForChat._id}/messages-seen`, {
          user_email: userIdentifier
        });
      } catch (e) {}

      // update local state immediately
      setSelectedReservationForChat(updated);

      // ensure polling continues
      startChatPolling(updated._id);

      setMessageText('');
      setTimeout(() => {
        try { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); } catch(e){}
      }, 50);
    } catch (error) {
      console.error('Send message error:', error);
      alert('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  // Polling helpers for real-time updates
  const startChatPolling = (reservationId: string) => {
    stopChatPolling();
    const interval = setInterval(async () => {
      try {
        const resp = await axios.get(`${API_BASE_URL}/reservations/${reservationId}`);
        const updated = resp.data as Reservation;
        setReservations(prev => prev.map(r => r._id === updated._id ? updated : r));
        setSelectedReservationForChat(prev => prev && prev._id === updated._id ? updated : prev);
      } catch (err) {
        console.error('Chat polling error:', err);
      }
    }, 1000); // faster polling
    setChatRefreshInterval(interval as unknown as NodeJS.Timeout);
  };

  const stopChatPolling = () => {
    if (chatRefreshInterval) {
      clearInterval(chatRefreshInterval as unknown as any);
      setChatRefreshInterval(null);
    }
  };

  // Confirmation modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [onConfirm, setOnConfirm] = useState<(() => void) | null>(null);

  // Snackbar state
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  // Helper for confirmation modal
  const showConfirm = (title: string, message: string, onYes: () => void) => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setOnConfirm(() => onYes);
    setConfirmOpen(true);
  };

  const handleDeleteReservation = async (reservation: Reservation) => {
    if (isStudentAssistant) {
      setSnackbar({ open: true, message: "You are not allowed to delete reservations.", severity: "error" });
      return;
    }
    showConfirm(
      "Delete Reservation",
      `Are you sure you want to delete reservation ${reservation.reservation_code}?`,
      async () => {
        setConfirmOpen(false);
        setProcessing(true);
        try {
          await axios.delete(`${API_BASE_URL}/reservations/${reservation._id}`);
          await fetchReservations();
          setSnackbar({ open: true, message: "Reservation deleted", severity: "success" });
        } catch (error) {
          setSnackbar({ open: true, message: "Failed to delete reservation", severity: "error" });
        } finally {
          setProcessing(false);
        }
      }
    );
  };

  // Bulk delete handler
  const handleDeleteSelected = async () => {
    if (selectedReservations.length === 0) return;
    const codes = selectedReservations
      .map(id => reservations.find(r => r._id === id)?.reservation_code || id)
      .join('\n');
    showConfirm(
      "Delete Selected Reservations",
      `Are you sure you want to delete the following reservations?\n\n${codes}`,
      async () => {
        setConfirmOpen(false);
        setProcessing(true);
        try {
          await Promise.all(selectedReservations.map(id => axios.delete(`${API_BASE_URL}/reservations/${id}`)));
          setSelectedReservations([]);
          await fetchReservations();
          setSnackbar({ open: true, message: "Selected reservations deleted", severity: "success" });
        } catch (err) {
          setSnackbar({ open: true, message: "Failed to delete selected reservations", severity: "error" });
        } finally {
          setProcessing(false);
        }
      }
    );
  }

  // Filter then sort by date_created descending (newest first)
  const filteredReservations = reservations
    .filter(reservation => {
      const matchesSearch = 
        reservation.reservation_code.toLowerCase().includes(search.toLowerCase()) ||
        reservation.subject.toLowerCase().includes(search.toLowerCase()) ||
        reservation.instructor.toLowerCase().includes(search.toLowerCase()) ||
        reservation.course.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === 'All' || reservation.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const da = a.date_created ? new Date(a.date_created).getTime() : 0;
      const db = b.date_created ? new Date(b.date_created).getTime() : 0;
      return db - da; // descending
    });

  const getAvailableItems = (requestedType: 'consumable' | 'non-consumable', searchTerm: string = '') => {
    return inventory
      .filter(item => {
        const matchesType = requestedType === 'consumable' ? item.is_consumable : !item.is_consumable;
        const hasAvailability = item.available > 0;
        
        if (searchTerm.trim()) {
          const matchesSearch = item.equipment_name.toLowerCase().includes(searchTerm.toLowerCase());
          return matchesType && hasAvailability && matchesSearch;
        }
        
        return matchesType && hasAvailability;
      })
      .sort((a, b) => a.equipment_name.localeCompare(b.equipment_name));
  };

  const calculateTotalQuantityNeeded = (quantityPerGroup: number, groupCount: number) => {
    return quantityPerGroup * groupCount;
  };

  const getAvailabilityInfo = (inventoryItem: InventoryItem, quantityPerGroup: number, groupCount: number) => {
    const totalNeeded = calculateTotalQuantityNeeded(quantityPerGroup, groupCount);
    const hasEnough = inventoryItem.available >= totalNeeded;
    
    return {
      hasEnough,
      totalNeeded,
      available: inventoryItem.available,
      message: hasEnough 
        ? `✓ Enough stock (${inventoryItem.available} available, ${totalNeeded} needed)`
        : `⚠ Insufficient stock (${inventoryItem.available} available, ${totalNeeded} needed)`
    };
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getStatusCount = (status: string) => {
    return reservations.filter(r => r.status === status).length;
  };

  // Checkbox helpers
  const allVisibleCount = filteredReservations.length;
  const headerChecked = allVisibleCount > 0 && selectedReservations.length === allVisibleCount;
  const headerIndeterminate = selectedReservations.length > 0 && selectedReservations.length < allVisibleCount;

  // Available fields for reservation reports
  const getAvailableFields = (): { field: string; label: string; type: 'string' | 'number' | 'date' }[] => [
    { field: 'reservation_code', label: 'Reservation Code', type: 'string' },
    { field: 'subject', label: 'Subject', type: 'string' },
    { field: 'instructor', label: 'Instructor', type: 'string' },
    { field: 'course', label: 'Course', type: 'string' },
    { field: 'room', label: 'Room', type: 'string' },
    { field: 'schedule', label: 'Schedule', type: 'string' },
    { field: 'startTime', label: 'Start Time', type: 'string' },
    { field: 'endTime', label: 'End Time', type: 'string' },
    { field: 'status', label: 'Status', type: 'string' },
    { field: 'date_created', label: 'Date Created', type: 'date' },
    { field: 'date_approved', label: 'Date Approved', type: 'date' },
    { field: 'date_assigned', label: 'Date Assigned', type: 'date' },
    { field: 'date_completed', label: 'Date Completed', type: 'date' },
    { field: 'group_count', label: 'Group Count', type: 'number' },
    { field: 'items_count', label: 'Requested Items Count', type: 'number' },
    { field: 'total_requested_quantity', label: 'Total Requested Quantity', type: 'number' }
  ];
 
  useEffect(() => {
    setAvailableFields(getAvailableFields());
  }, []);

  const handleFieldSelection = (field: string) => {
    setSelectedFields(prev => prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]);
  };
  const addFilter = () => setReportFilters(prev => [...prev, { field: '', operator: 'equals', value: '' }]);
  const removeFilter = (i:number) => setReportFilters(prev => prev.filter((_,idx)=>idx!==i));
  const updateFilter = (i:number, updates: Partial<{ field:string; operator:string; value:string }>) =>
    setReportFilters(prev => prev.map((f,idx)=> idx===i ? { ...f, ...updates } : f));

  const getOperatorsForField = (type:string) => type === 'number'
    ? [{value:'equals',label:'Equals'},{value:'greaterThan',label:'Greater Than'},{value:'lessThan',label:'Less Than'}]
    : [{value:'equals',label:'Equals'},{value:'contains',label:'Contains'}];

  // Generate a custom table from current reservations using selectedFields & reportFilters
  const generateCustomReport = () => {
    const data = reservations.map(r => ({
      ...r,
      items_count: (r.requested_items||[]).length,
      total_requested_quantity: (r.requested_items||[]).reduce((s, it) => s + (it.quantity||0), 0)
    }));

    const filtered = data.filter(rec =>
      reportFilters.every(filter => {
        if (!filter.field || !filter.value) return true;
        const val = String((rec as any)[filter.field] ?? '').toLowerCase();
        const fval = filter.value.toLowerCase();
        switch (filter.operator) {
          case 'equals': return val === fval;
          case 'contains': return val.includes(fval);
          case 'greaterThan': return Number((rec as any)[filter.field]||0) > Number(filter.value);
          case 'lessThan': return Number((rec as any)[filter.field]||0) < Number(filter.value);
          default: return true;
        }
      })
    );

    const columns = selectedFields.map(f => availableFields.find(a=>a.field===f)?.label || f);
    const rows = filtered.map(rec => selectedFields.map(f => {
      const v = (rec as any)[f];
      return v === null || v === undefined ? '' : String(v);
    }));
    setReportTable({ columns, rows });
    setReportDialogOpen(false);
    setTimeout(() => handleGeneratePDF(), 400);
  };

  // AI report (calls server /ai-report)
  const handleGenerateReport = async () => {
    if (!question.trim()) { setReportText("Please enter a question."); return; }
    setLoading(true);
    setReportText("");
    setReportTable(null);
    try {
      const res = await axios.post(`${API_BASE_URL}/ai-report`, { question, itemType: "Reservation" }, { timeout: 30000 });
      const data = res.data;
      if (data.success) {
        if (typeof data.data === 'string') setReportText(data.data);
        else if (data.data?.table) { setReportTable({ columns: data.data.table.columns||[], rows: data.data.table.rows||[] }); setReportText(data.data.summary||''); }
        else if (data.data?.columns && data.data?.rows) setReportTable({ columns: data.data.columns, rows: data.data.rows });
        else setReportText(JSON.stringify(data.data, null, 2));
      } else {
        setReportText(`Error: ${data.error || 'AI failed'}`);
      }
    } catch (err:any) {
      console.error('AI report error', err);
      if (err.response) setReportText(`Server Error: ${err.response.data?.error || err.response.statusText}`);
      else if (err.request) setReportText('Network error: no response from server');
      else setReportText(String(err.message));
    } finally { setLoading(false); }
  };

  const handleGeneratePDF = () => {
    if (!reportTable) return;
    const html = `
      <html><head><title>Reservation Report</title><style>body{font-family:Arial;margin:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f2f2f2}</style></head>
      <body><h1>Reservation Report</h1><p>Generated: ${new Date().toLocaleString()}</p>
      <table><thead><tr>${reportTable.columns.map(c=>`<th>${c}</th>`).join('')}</tr></thead>
      <tbody>${reportTable.rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Backdrop
        sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.modal + 1 }}
        open={processing}
      >
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={60} thickness={4} sx={{ color: theme.palette.primary.main }} />
          <Typography variant="h6" sx={{ color: "#fff" }}>
            Processing...
          </Typography>
        </Stack>
      </Backdrop>

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" color={brandRed} gutterBottom>
          Reservation Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage and assign equipment to faculty reservations
        </Typography>
      </Box>

      {/* Summary Cards */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={3} mb={4}>
        <Card sx={{ 
          flex: 1, 
          p: 3, 
          borderRadius: 3, 
          display: "flex", 
          alignItems: "center", 
          gap: 2,
          background: `linear-gradient(135deg, rgba(185,28,28,0.1) 0%, rgba(185,28,28,0.2) 100%)`,
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)"
        }}>
          <Box sx={{ 
            p: 1.5, 
            borderRadius: "50%", 
            bgcolor: "rgba(185,28,28,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <AssignmentTurnedInIcon sx={{ fontSize: 30, color: brandRed }} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight="medium">
              Total Reservations
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: "bold", color: brandRed }}>
              {reservations.length}
            </Typography>
          </Box>
        </Card>

        <Card sx={{ 
          flex: 1, 
          p: 3, 
          borderRadius: 3, 
          display: "flex", 
          alignItems: "center", 
          gap: 2,
          background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)} 0%, ${alpha(theme.palette.warning.main, 0.2)} 100%)`,
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)"
        }}>
          <Box sx={{ 
            p: 1.5, 
            borderRadius: "50%", 
            bgcolor: alpha(theme.palette.warning.main, 0.1),
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <WarningIcon sx={{ fontSize: 30, color: theme.palette.warning.main }} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight="medium">
              Pending
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: "bold", color: theme.palette.warning.main }}>
              {getStatusCount('Pending')}
            </Typography>
          </Box>
        </Card>

        <Card sx={{ 
          flex: 1, 
          p: 3, 
          borderRadius: 3, 
          display: "flex", 
          alignItems: "center", 
          gap: 2,
          background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.main, 0.2)} 100%)`,
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)"
        }}>
          <Box sx={{ 
            p: 1.5, 
            borderRadius: "50%", 
            bgcolor: alpha(theme.palette.success.main, 0.1),
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <CheckCircleIcon sx={{ fontSize: 30, color: theme.palette.success.main }} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight="medium">
              Assigned
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: "bold", color: theme.palette.success.main }}>
              {getStatusCount('Assigned')}
            </Typography>
          </Box>
        </Card>
      </Stack>

      {/* Action Bar */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={3} justifyContent="space-between" alignItems="center">
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" sx={{ flex: 1 }}>
          <Box sx={{ maxWidth: 400, width: "100%" }}>
            <TextField
              placeholder="Search by code, subject, instructor, or program..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              variant="outlined"
              size="small"
              fullWidth
              sx={{
              flex: 1,
              bgcolor: "background.paper",
              borderRadius: 3,
              "& .MuiOutlinedInput-root": {
                borderRadius: 3,
                "& fieldset": {
                  borderRadius: 3,
                },
                "&:hover fieldset": {
                  borderColor: "#b91c1c",
                },
                "&.Mui-focused fieldset": {
                  borderColor: "#b91c1c",
                },
              },
            }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          
          <TextField
            select
            label="Filter by Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 150 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <FilterListIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          >
            <MenuItem value="All">All Status</MenuItem>
            <MenuItem value="Pending">Pending</MenuItem>
            <MenuItem value="Approved">Approved</MenuItem>
            <MenuItem value="Assigned">Assigned</MenuItem>
            <MenuItem value="Rejected">Rejected</MenuItem>
          </TextField>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            color="error"
            disabled={selectedReservations.length === 0}
            onClick={handleDeleteSelected}
            sx={{
              borderRadius: 2,
              textTransform: "none",
              px: 3,
              fontWeight: "bold",
            }}
          >
            Delete Selected ({selectedReservations.length})
          </Button>
          {!isStudentAssistant && (
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setAiDialogOpen(true)}
              sx={{
                borderRadius: 2,
                textTransform: "none",
                px: 3,
                fontWeight: "bold",
                borderColor: "#1976d2",
                color: "#1976d2",
                "&:hover": {
                  borderColor: "#1565c0",
                  bgcolor: "rgba(25, 118, 210, 0.04)"
                }
              }}
              startIcon={<AutoAwesomeIcon />}
            >
              AI Report
            </Button>
          )}
          {!isStudentAssistant && (
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => setReportDialogOpen(true)}
              sx={{
        borderRadius: 2,
        textTransform: "none",
        px: 3,
        fontWeight: "bold",
        borderColor: theme.palette.secondary.main,
        color: theme.palette.secondary.main,
        "&:hover": {
          borderColor: theme.palette.secondary.dark,
          bgcolor: alpha(theme.palette.secondary.main, 0.04)
        }
      }}
              startIcon={<PictureAsPdfIcon />}
            >
              Generate Report
            </Button>
          )}
        </Stack>
      </Stack>

      {/* Reservations Table */}
      <Card
        sx={{
          p: 3,
          borderRadius: 3,
          backgroundColor: "background.paper",
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
            <CircularProgress />
          </Box>
        ) : filteredReservations.length === 0 ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
            <Typography variant="body2" color="text.secondary">
              No reservations found.
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer sx={{ maxHeight: 600, borderRadius: 2 }}>
              <Table stickyHeader sx={{ minWidth: 950 }}>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" sx={{ bgcolor: "grey.50" }}>
                      <Checkbox
                        indeterminate={headerIndeterminate}
                        checked={headerChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedReservations(filteredReservations.map(r => r._id));
                          } else {
                            setSelectedReservations([]);
                          }
                        }}
                        sx={{ color: brandRed }}
                      />
                    </TableCell>
                    <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Reservation Code</TableCell>
                    <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Subject</TableCell>
                    <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Instructor</TableCell>
                    <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Status</TableCell>
                    <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Date Created</TableCell>
                    <TableCell align="center" sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredReservations
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((reservation) => (
                      <TableRow key={reservation._id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedReservations.includes(reservation._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedReservations(prev => [...prev, reservation._id]);
                              } else {
                                setSelectedReservations(prev => prev.filter(id => id !== reservation._id));
                              }
                            }}
                            sx={{ color: brandRed }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography fontWeight="bold" sx={{ color: brandRed }}>
                            {reservation.reservation_code}
                          </Typography>
                        </TableCell>
                        <TableCell>{reservation.subject}</TableCell>
                        <TableCell>{reservation.instructor}</TableCell>
                        <TableCell>
                          <Chip
                            label={reservation.status}
                            size="small"
                            sx={{
                              bgcolor: reservation.status === 'Rejected' ? alpha(theme.palette.error.main, 0.08) :
                                      reservation.status === 'Pending' ? alpha(theme.palette.warning.main, 0.08) :
                                      alpha(theme.palette.success.main, 0.08),
                              color: reservation.status === 'Rejected' ? theme.palette.error.main :
                                     reservation.status === 'Pending' ? theme.palette.warning.main :
                                     theme.palette.success.main,
                              fontWeight: 'bold'
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {reservation.date_created ? new Date(reservation.date_created).toLocaleDateString() : 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} justifyContent="center">
                            <Tooltip title="View Details">
                              <IconButton
                                color="default"
                                onClick={() => handleView(reservation)}
                                sx={actionIconBtnSx}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            { /* Approve -> only if not Student Assistant */ }
                            {!isStudentAssistant && reservation.status === 'Pending' && (
                              <Tooltip title="Approve Reservation">
                                <IconButton
                                  color="success"
                                  onClick={() => handleApproveReservation(reservation)}
                                  sx={actionIconBtnSx}
                                >
                                  <CheckCircleIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}

                            {/* Reject */}
                            {!isStudentAssistant && reservation.status === 'Pending' ? (
                              <Tooltip title="Reject">
                                <IconButton
                                  color="warning"
                                  onClick={() => handleRejectReservation(reservation)}
                                  sx={actionIconBtnSx}
                                >
                                  <CancelIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <Tooltip title={isStudentAssistant ? 'Not permitted' : (reservation.status === 'Rejected' ? 'Already rejected' : 'Cannot reject once approved or assigned')}>
                                <span>
                                  <IconButton
                                    color="warning"
                                    disabled
                                    sx={{ ...actionIconBtnSx, opacity: 0.6 }}
                                  >
                                    <CancelIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            )}

                            <Tooltip title="Assign Items">
                              <IconButton
                                color="primary"
                                onClick={() => handleAssign(reservation)}
                                disabled={reservation.status !== 'Approved'}
                                sx={actionIconBtnSx}
                              >
                                <AssignmentTurnedInIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            {!isStudentAssistant ? (
                              <Tooltip title="Messages">
                                <IconButton
                                  color="info"
                                  onClick={() => handleOpenChat(reservation)}
                                  sx={actionIconBtnSx}
                                >
                                  <Badge
                                    badgeContent={unseenCount(reservation)}
                                    color="error"
                                    invisible={unseenCount(reservation) === 0}
                                  >
                                    <ChatBubbleIcon fontSize="small" />
                                  </Badge>
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <Tooltip title="Not permitted">
                                <span>
                                  <IconButton
                                    color="info"
                                    disabled
                                    sx={{ ...actionIconBtnSx, opacity: 0.6 }}
                                  >
                                    <Badge badgeContent={0} color="error" invisible>
                                      <ChatBubbleIcon fontSize="small" />
                                    </Badge>
                                  </IconButton>
                                </span>
                              </Tooltip>
                            )}

                            {!isStudentAssistant ? (
                              <Tooltip title="Delete">
                                <IconButton
                                  color="error"
                                  onClick={() => handleDeleteReservation(reservation)}
                                  sx={actionIconBtnSx}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <Tooltip title="Not permitted">
                                <span>
                                  <IconButton
                                    color="error"
                                    disabled
                                    sx={{ ...actionIconBtnSx, opacity: 0.6 }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination */}
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={filteredReservations.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              sx={{ borderTop: "1px solid", borderColor: "divider" }}
            />
          </>
        )}
      </Card>

      {/* Assignment Dialog */}
      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Inventory2Icon sx={{ color: brandRed }} />
            <Typography variant="h6" sx={{ color: brandRed }}>Assign Inventory Items</Typography>
          </Box>
          {selectedReservation && (
            <Box>
              <Typography variant="body2" color="text.secondary">
                Reservation: {selectedReservation.reservation_code} - {selectedReservation.subject}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Groups: {selectedReservation.group_count} • Program: {selectedReservation.course}
              </Typography>
            </Box>
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3}>
            {assignmentData.map((item, index) => {
              const requestedItem = selectedReservation?.requested_items[item.requested_item_index];
              const searchTerm = itemSearch[index] || '';
              const availableItems = getAvailableItems(requestedItem?.item_type || 'non-consumable', searchTerm);
              const totalNeeded = selectedReservation ? 
                calculateTotalQuantityNeeded(requestedItem?.quantity || 0, selectedReservation.group_count) : 0;
              
              return (
                <Paper key={index} sx={{ 
                  p: 2,
                  borderRadius: 2,
                  background: `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(brandRed, 0.01)} 100%)`,
                  boxShadow: "0 6px 18px rgba(0,0,0,0.04)"
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {requestedItem?.item_name}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        <Chip
                          label={`${requestedItem?.quantity} per group × ${selectedReservation?.group_count} groups = ${totalNeeded} total`}
                          size="small"
                          sx={{ borderColor: brandRed, color: brandRed }}
                        />
                        <Chip
                          label={requestedItem?.item_type}
                          size="small"
                          sx={{
                            borderColor: requestedItem?.item_type === 'consumable' ? theme.palette.success.main : brandRed,
                            color: requestedItem?.item_type === 'consumable' ? theme.palette.success.main : brandRed
                          }}
                        />
                      </Box>
                    </Box>
                    {item.item_id && (
                      <Chip 
                        label="Assigned"
                        size="small"
                        variant="filled"
                        sx={{ bgcolor: alpha(theme.palette.success.main, 0.12), color: theme.palette.success.main }}
                      />
                    )}
                  </Box>
                  
                  <Stack spacing={2}>
                    <TextField
                      placeholder={`Search ${requestedItem?.item_type} items...`}
                      value={searchTerm}
                      onChange={(e) => handleItemSearchChange(index, e.target.value)}
                      variant="outlined"
                      size="small"
                      InputProps={{
                        startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
                      }}
                    />
                    
                    <FormControl fullWidth size="small">
                      <InputLabel>Select Inventory Item</InputLabel>
                      <Select
                        value={item.item_id}
                        label="Select Inventory Item"
                        onChange={(e) => handleItemAssignment(index, e.target.value)}
                        disabled={item.preAssigned === true} // <-- disable if already assigned
                      >
                        <MenuItem value="">
                          <em>Not assigned</em>
                        </MenuItem>
                        {availableItems.length === 0 ? (
                          <MenuItem disabled>
                            No {requestedItem?.item_type} items found
                            {searchTerm && ` matching "${searchTerm}"`}
                          </MenuItem>
                        ) : (
                          availableItems.map(invItem => {
                            const availabilityInfo = getAvailabilityInfo(
                              invItem, 
                              requestedItem?.quantity || 0, 
                              selectedReservation?.group_count || 1
                            );
                            
                            return (
                              <MenuItem key={invItem.num} value={invItem.num} disabled={!availabilityInfo.hasEnough}>
                                <Box sx={{ width: '100%' }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                    <Typography variant="body2" fontWeight="medium">
                                      {invItem.equipment_name}
                                    </Typography>
                                    {availabilityInfo.hasEnough ? (
                                      <CheckCircleIcon color="success" fontSize="small" />
                                    ) : (
                                      <WarningIcon color="warning" fontSize="small" />
                                    )}
                                  </Box>
                                  <Typography 
                                    variant="caption" 
                                    color={availabilityInfo.hasEnough ? "success.main" : "warning.main"}
                                    sx={{ display: 'block' }}
                                  >
                                    {availabilityInfo.message}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                    Type: {invItem.is_consumable ? 'Consumable' : 'Non-Consumable'}
                                    {invItem.identifiers && invItem.identifiers.length > 0 && ` • ${invItem.identifiers.length} identifiers`}
                                  </Typography>
                                </Box>
                              </MenuItem>
                            );
                          })
                        )}
                      </Select>
                    </FormControl>
                  </Stack>
                  
                  {item.item_id && (
                    <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
                      ✓ Assigned: {item.item_name}
                    </Typography>
                  )}
                  
                  {availableItems.length > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Found {availableItems.length} {requestedItem?.item_type} item(s)
                      {searchTerm && ` matching "${searchTerm}"`}
                    </Typography>
                  )}
                </Paper>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialogOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleSubmitAssignment}
            disabled={assignmentData.some(item => !item.item_id)}
            sx={{
              bgcolor: brandRed,
              color: '#fff',
              textTransform: 'none',
              "&:hover": { bgcolor: "#9f1515" }
            }}
          >
            Confirm Assignment
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <VisibilityIcon sx={{ color: brandRed }} />
            <Typography variant="h6" sx={{ color: brandRed }}>Reservation Details</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedReservationDetails && (
            <Stack spacing={3}>
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Basic Information
                </Typography>
                <Stack spacing={2}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Typography variant="body2" sx={{ minWidth: 120, fontWeight: 'bold' }}>Code:</Typography>
                    <Typography variant="body2">{selectedReservationDetails.reservation_code}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Typography variant="body2" sx={{ minWidth: 120, fontWeight: 'bold' }}>Subject:</Typography>
                    <Typography variant="body2">{selectedReservationDetails.subject}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Typography variant="body2" sx={{ minWidth: 120, fontWeight: 'bold' }}>Instructor:</Typography>
                    <Typography variant="body2">{selectedReservationDetails.instructor}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Typography variant="body2" sx={{ minWidth: 120, fontWeight: 'bold' }}>Email:</Typography>
                    <Typography variant="body2">{selectedReservationDetails.instructor_email}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Typography variant="body2" sx={{ minWidth: 120, fontWeight: 'bold' }}>Program:</Typography>
                    <Typography variant="body2">{selectedReservationDetails.course}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Typography variant="body2" sx={{ minWidth: 120, fontWeight: 'bold' }}>Room:</Typography>
                    <Typography variant="body2">{selectedReservationDetails.room}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Typography variant="body2" sx={{ minWidth: 120, fontWeight: 'bold' }}>Groups:</Typography>
                    <Typography variant="body2">{selectedReservationDetails.group_count}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Typography variant="body2" sx={{ minWidth: 120, fontWeight: 'bold' }}>Schedule:</Typography>
                    <Typography variant="body2">{selectedReservationDetails.schedule}</Typography>
                  </Box>
                  {selectedReservationDetails.startTime && (
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Typography variant="body2" sx={{ minWidth: 120, fontWeight: 'bold' }}>Start Time:</Typography>
                      <Typography variant="body2">{selectedReservationDetails.startTime}</Typography>
                    </Box>
                  )}
                  {selectedReservationDetails.endTime && (
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Typography variant="body2" sx={{ minWidth: 120, fontWeight: 'bold' }}>End Time:</Typography>
                      <Typography variant="body2">{selectedReservationDetails.endTime}</Typography>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Typography variant="body2" sx={{ minWidth: 120, fontWeight: 'bold' }}>Items Needed:</Typography>
                    <Typography variant="body2">{selectedReservationDetails.needsItems ? '✓ Yes' : '○ No'}</Typography>
                  </Box>
                  {selectedReservationDetails.notes && (
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Typography variant="body2" sx={{ minWidth: 120, fontWeight: 'bold' }}>Notes:</Typography>
                      <Typography variant="body2">{selectedReservationDetails.notes}</Typography>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Typography variant="body2" sx={{ minWidth: 120, fontWeight: 'bold' }}>Status:</Typography>
                    <Chip
                      label={selectedReservationDetails.status}
                      size="small"
                      sx={{
                        bgcolor: selectedReservationDetails.status === 'Rejected' ? alpha(theme.palette.error.main, 0.08) :
                                selectedReservationDetails.status === 'Pending' ? alpha(theme.palette.warning.main, 0.08) :
                                alpha(theme.palette.success.main, 0.08),
                        color: selectedReservationDetails.status === 'Rejected' ? theme.palette.error.main :
                               selectedReservationDetails.status === 'Pending' ? theme.palette.warning.main :
                               theme.palette.success.main,
                        fontWeight: 'bold'
                      }}
                    />
                  </Box>
                </Stack>
              </Box>

              <Box>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Requested Items
                </Typography>
                <Stack spacing={2}>
                  {selectedReservationDetails.requested_items.map((item, index) => {
                    const totalNeeded = calculateTotalQuantityNeeded(item.quantity, selectedReservationDetails.group_count);
                    const assignedItem = selectedReservationDetails.assigned_items?.find(ai => ai.requested_item_index === index);
                    
                    return (
                      <Paper key={index} sx={{ p: 2, borderRadius: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box>
                            <Typography variant="body1" fontWeight="medium">
                              {item.item_name}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                              <Chip
                                label={`${item.quantity} per group × ${selectedReservationDetails.group_count} groups = ${totalNeeded} total`}
                                size="small"
                                sx={{ borderColor: brandRed, color: brandRed }}
                              />
                              <Chip
                                label={item.item_type}
                                size="small"
                                variant="outlined"
                                sx={{
                                  borderColor: item.item_type === 'consumable' ? theme.palette.success.main : brandRed,
                                  color: item.item_type === 'consumable' ? theme.palette.success.main : brandRed
                                }}
                              />
                            </Box>
                          </Box>
                          {assignedItem && (
                            <Chip 
                              label="Assigned"
                              size="small"
                              variant="filled"
                              sx={{ bgcolor: alpha(theme.palette.success.main, 0.12), color: theme.palette.success.main }}
                            />
                          )}
                        </Box>
                        {assignedItem && (
                          <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
                            ✓ Assigned: {assignedItem.item_name} (ID: {assignedItem.item_id})
                          </Typography>
                        )}
                      </Paper>
                    );
                  })}
                </Stack>
              </Box>

              {selectedReservationDetails.messages && selectedReservationDetails.messages.length > 0 && (
                <Box>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Communication History
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.info.main, 0.04), maxHeight: 300, overflowY: 'auto' }}>
                    <Stack spacing={1.5}>
                      {selectedReservationDetails.messages.map((msg, index) => (
                        <Box key={index} sx={{ pb: 1.5, borderBottom: index < selectedReservationDetails.messages!.length - 1 ? `1px solid ${alpha(theme.palette.divider, 0.5)}` : 'none' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <Typography variant="body2" fontWeight="bold" sx={{ color: theme.palette.primary.main }}>
                              {msg.sender}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(msg.timestamp).toLocaleString()}
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                            {msg.message}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Paper>
                </Box>
              )}

              {/* Edit History - new section */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">Edit History</Typography>
                {selectedReservationDetails.edits && selectedReservationDetails.edits.length > 0 ? (
                  selectedReservationDetails.edits.map((log, i) => (
                    <Paper key={i} sx={{ p: 2, mt: 1 }}>
                      <Typography variant="body2" fontWeight="bold">{log.editedName || log.editedBy} • {new Date(log.editedAt).toLocaleString()}</Typography>
                      {log.reason && <Typography variant="caption" color="text.secondary">Reason: {log.reason}</Typography>}
                      <details style={{ marginTop: 8 }}>
                        <summary style={{ cursor: 'pointer' }}>View previous snapshot</summary>
                        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(log.previous, null, 2)}</pre>
                      </details>
                    </Paper>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">No edits recorded.</Typography>
                )}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)} sx={{ textTransform: 'none' }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Message Chat Dialog */}
      <Dialog open={messageDialogOpen} onClose={() => { setMessageDialogOpen(false); stopChatPolling(); }} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ChatBubbleIcon sx={{ color: theme.palette.info.main }} />
            <Box>
              <Typography variant="h6" sx={{ color: theme.palette.info.main }}>
                Reservation Chat
              </Typography>
              {selectedReservationForChat && (
                <Typography variant="caption" color="text.secondary">
                  {selectedReservationForChat.reservation_code} - {selectedReservationForChat.subject}
                </Typography>
              )}
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedReservationForChat && (
            <Box sx={{ position: 'relative', minHeight: 400 }}>
              <Paper ref={messageListRef} sx={{
                p: 2,
                bgcolor: alpha(theme.palette.info.main, 0.04),
                overflowY: 'auto',
                maxHeight: 520,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                pb: `${COMPOSER_HEIGHT + 16}px`
              }}>
                {selectedReservationForChat.messages && selectedReservationForChat.messages.length > 0 ? (
                  selectedReservationForChat.messages.map((msg, index) => {
                    const isCurrentUser = msg.sender === JSON.parse(localStorage.getItem('user') || '{}').email;
                    return (
                      <Box key={index} sx={{ display: 'flex', justifyContent: isCurrentUser ? 'flex-end' : 'flex-start' }}>
                        <Paper sx={{ p: 1.5, maxWidth: '70%', bgcolor: isCurrentUser ? alpha(theme.palette.primary.main, 0.15) : alpha(theme.palette.grey[300], 0.5), borderRadius: 2, boxShadow: 1 }}>
                          <Typography variant="subtitle2" fontWeight="bold" sx={{ color: isCurrentUser ? theme.palette.primary.main : theme.palette.text.primary }}>{(msg as any).sender_name || msg.sender}</Typography>
                          <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>{msg.message}</Typography>
                          <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.5 }}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Typography>
                        </Paper>
                      </Box>
                    );
                  })
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
                    <Typography variant="body2" color="textSecondary">No messages yet. Start the conversation!</Typography>
                  </Box>
                )}
                <div ref={messagesEndRef} />
              </Paper>

              {/* removed inline composer here - moved to DialogActions */}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ flexDirection: 'column', gap: 1, py: 2 }}>
          <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <Paper sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 3, boxShadow: 3, width: { xs: '100%', sm: 520 } }}>
              <TextField placeholder="Type a message..." value={messageText} onChange={(e) => setMessageText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && messageText.trim()) { e.preventDefault(); handleSendMessage(); } }} multiline maxRows={4} fullWidth size="small" disabled={sendingMessage} />
              <Button variant="contained" color="info" onClick={handleSendMessage} disabled={!messageText.trim() || sendingMessage} sx={{ borderRadius: 2, minWidth: 48, minHeight: 48 }}><SendIcon /></Button>
            </Paper>
          </Box>
          <Box sx={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={() => { setMessageDialogOpen(false); stopChatPolling(); }} sx={{ textTransform: 'none' }}>Close</Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* AI Dialog */} 
      <Dialog open={aiDialogOpen} onClose={() => setAiDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <AutoAwesomeIcon color="primary" />
            <Typography variant="h6">AI Reservation Report</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Ask questions about reservations (e.g., pending, assigned, busiest instructors, etc.).
          </Typography>
          <TextField multiline rows={3} fullWidth value={question} onChange={(e)=>setQuestion(e.target.value)} placeholder="e.g., List pending reservations for this week" />
          <Box sx={{ mt:2 }}>
            <Button variant="contained" onClick={handleGenerateReport} disabled={loading || !question.trim()} startIcon={loading ? <CircularProgress size={18} /> : <AutoAwesomeIcon />}>
              {loading ? 'Generating...' : 'Generate'}
            </Button>
          </Box>
          {reportText && <Paper sx={{ p:2, mt:2 }}><Typography variant="body2" whiteSpace="pre-wrap">{reportText}</Typography></Paper>}
          {reportTable && <Box sx={{ mt:2 }}><Button startIcon={<PictureAsPdfIcon />} onClick={handleGeneratePDF}>Export PDF</Button></Box>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAiDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* Custom Report Dialog */} 
      <Dialog open={reportDialogOpen} onClose={() => setReportDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <PictureAsPdfIcon color="secondary" />
            <Typography variant="h6">Generate Reservation Report</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Select fields to include and apply filters to generate a custom report.
          </Typography>
          <Box sx={{ mb:3 }}>
            <Typography variant="subtitle1">Select Fields</Typography>
            <Paper variant="outlined" sx={{ p:2, maxHeight: 200, overflow:'auto' }}>
              <Stack spacing={1}>
                {availableFields.map(f=>(
                  <Box key={f.field} sx={{ display:'flex', alignItems:'center' }}>
                    <Checkbox checked={selectedFields.includes(f.field)} onChange={() => handleFieldSelection(f.field)} />
                    <Typography>{f.label} ({f.type})</Typography>
                  </Box>
                ))}
              </Stack>
            </Paper>
          </Box>

          <Box sx={{ mb:3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb:2 }}>
              <Typography variant="subtitle1">Filters</Typography>
              <Button variant="outlined" size="small" onClick={addFilter} startIcon={<AddIcon />}>Add Filter</Button>
            </Stack>
            <Stack spacing={2}>
              {reportFilters.map((filter, idx) => (
                <Paper key={idx} sx={{ p:2 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                      <InputLabel>Field</InputLabel>
                      <Select value={filter.field} label="Field" onChange={(e)=>updateFilter(idx, { field: e.target.value })}>
                        {availableFields.map(a=> <MenuItem key={a.field} value={a.field}>{a.label}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                      <InputLabel>Operator</InputLabel>
                      <Select value={filter.operator} label="Operator" onChange={(e)=>updateFilter(idx, { operator: e.target.value })}>
                        {(filter.field ? getOperatorsForField(availableFields.find(a=>a.field===filter.field)?.type||'string') : [{value:'equals',label:'Equals'}]).map(op=> <MenuItem key={op.value} value={op.value}>{op.label}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <TextField size="small" label="Value" value={filter.value} onChange={(e)=>updateFilter(idx, { value: e.target.value })} sx={{ flex:1 }} />
                    <IconButton onClick={() => removeFilter(idx)} color="error"><DeleteIcon /></IconButton>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={generateCustomReport} disabled={selectedFields.length===0} startIcon={<PictureAsPdfIcon />}>Generate PDF Report</Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Modal */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>{confirmTitle}</DialogTitle>
        <DialogContent>
          <Typography>{confirmMessage}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (onConfirm) onConfirm();
            }}
            color="error"
            variant="contained"
          >
            Yes, Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for alerts */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MuiAlert
          elevation={6}
          variant="filled"
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          sx={{ borderRadius: 2, fontWeight: "medium" }}
        >
          {snackbar.message}
        </MuiAlert>
      </Snackbar>
    </Container>
  );
}