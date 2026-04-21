// src/pages/BorrowPage.tsx
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import EventIcon from "@mui/icons-material/Event";
import PersonIcon from "@mui/icons-material/Person";
import SearchIcon from "@mui/icons-material/Search";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import CircularProgress from "@mui/material/CircularProgress";
import ClearIcon from '@mui/icons-material/Clear';
import GroupIcon from '@mui/icons-material/Group';
import SchoolIcon from '@mui/icons-material/School';
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import FilterListIcon from "@mui/icons-material/FilterList";
import AddIcon from '@mui/icons-material/Add';
import {
  Box,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Button,
  Card,
  List,
  Checkbox,
  Chip,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Popover,
  Paper,
  Step,
  StepLabel,
  Stepper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  DialogActions,
} from "@mui/material";
import axios from "axios";
import { useEffect, useMemo, useState, useRef } from "react";
import Loader from "../components/Loader";
import VisibilityIcon from '@mui/icons-material/Visibility';
const API_BASE_URL = "https://elams.sit.ubaguio.edu/api";
const user = JSON.parse(localStorage.getItem("user") || "{}");
const userRole = user?.role || "";

interface BorrowRecord {
  _id?: string;
  borrow_id: string;
  borrow_type: 'Walk-In' | 'Reservation';
  user_type: 'Individual' | 'Group' | 'Faculty';
  borrow_user: string;
  course: string;
  group_number?: string;
  group_leader?: string;
  group_leader_id?: string;
  instructor: string;
  subject: string;
  schedule: string;
  items: BorrowItem[];
  status: string;
  date_borrowed: string;
  date_returned?: string;
  reservation_code?: string;
  // Added to match server payload and usage in code
  group_members?: { name: string; id: string }[];
  managed_by?: string; // email or name of Student Assistant
  managed_name?: string; // display name
}

interface BorrowItem {
  _id?: string; // ADD THIS LINE
  item_id: string;
  item_name: string;
  item_type: 'consumable' | 'non-consumable';
  quantity: number;
  status: string;
  identifiers?: {
    identifier: string;
    status: string;
  }[];
  date_borrowed?: string;
  date_returned?: string;
  notes?: string;
  return_condition?: string; // ADD THIS FOR RETURN FUNCTIONALITY
  damage_report?: string; // ADD THIS FOR RETURN FUNCTIONALITY
  lacking_items?: string; // ADD THIS FOR RETURN FUNCTIONALITY
}
interface InventoryItem {
  _id?: string;
  num: string;
  equipment_name: string;
  total_qty: number;
  borrowed: number;
  available: number;
  brand_model?: string;
  location?: string;
  identifier_type?: string;
  identifiers?: string[];
  statuses?: string[];
  is_consumable?: boolean;
  description?: string;
  quantity_opened?: number;
  quantity_unopened?: number;
  item_type: 'consumable' | 'non-consumable';
}

interface SelectedItem {
  num: string;
  name: string;
  qty: number;
  available: number;
  is_consumable: boolean;
  selected_identifiers?: string[];
  identifier_type?: string;
  item_type: 'consumable' | 'non-consumable';
}

interface Reservation {
  _id: string;
  reservation_id: number;
  reservation_code: string;
  user_type: 'Individual' | 'Group' | 'Faculty';
  borrow_user: string;
  course: string;
  group_number?: string;
  group_leader?: string;
  group_leader_id?: string;
  instructor: string;
  subject: string;
  schedule: string;
  room: string;
  group_count: number;
  requested_items: {
    item_name: string;
    quantity: number;
    item_type: 'consumable' | 'non-consumable';
  }[];
  assigned_items: {
    requested_item_index: number;
    item_id: string;
    item_name: string;
    item_type: 'consumable' | 'non-consumable';
    identifier?: string;
    quantity: number;
    assigned_by: string;
    date_assigned: string;
  }[];
  status: string;
  date_created: string;
  date_approved?: string;
  date_assigned?: string;
  date_completed?: string;
  notes?: string;
  startTime?: string; // ADDITIONAL OPTIONAL FIELDS
  endTime?: string;
}

interface ReportField {
  field: string;
  label: string;
  type: 'string' | 'number' | 'date';
}

interface ReportFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual';
  value: string;
}

export default function BorrowPage() {
  const theme = useTheme();
  
  // records & inventory
  const [records, setRecords] = useState<BorrowRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [barcodeSearch, setBarcodeSearch] = useState("");
  const [reportTable, setReportTable] = useState<{ columns: string[]; rows: string[][] } | null>(null);
  const [itemType, setItemType] = useState<"all" | "non-consumable" | "consumable">("all");
  
  // selected items
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [identifierDialogOpen, setIdentifierDialogOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<InventoryItem | null>(null);
  const [selectedIdentifiers, setSelectedIdentifiers] = useState<string[]>([]);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [reportText, setReportText] = useState("");
  // dialog + stepper
  const [open, setOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [borrowType, setBorrowType] = useState<'Walk-In' | 'Reservation' | ''>('');
  const [userType, setUserType] = useState<'Individual' | 'Group' | 'Faculty' | ''>('');
  const [reservationCode, setReservationCode] = useState("");
  const [reservationLoading, setReservationLoading] = useState(false);
  const [currentReservation, setCurrentReservation] = useState<Reservation | null>(null);
  const steps = ["Select Type", "Borrower Info", "Select Item(s)", "Confirmation"];
  
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
  
  
  
  // Request form
  const [requestForm, setRequestForm] = useState({
    borrow_id: "",
    borrow_type: "",
    user_type: "",
    borrow_user: "",
    course: "",
    group_number: "",
    group_leader: "",
    group_leader_id: "",
    instructor: "",
    subject: "",
    schedule: "",
    status: "Borrowed",
    date_borrowed: new Date().toISOString(),
    reservation_code: "",
  });

  // Report Dialog State
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [reportFilters, setReportFilters] = useState<ReportFilter[]>([]);
  const [availableFields, setAvailableFields] = useState<ReportField[]>([]);

  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Date filter state
  const [dateFilterAnchor, setDateFilterAnchor] = useState<null | HTMLElement>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Add these states
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [selectedBorrowForReturn, setSelectedBorrowForReturn] = useState<BorrowRecord | null>(null);
  const [returnForm, setReturnForm] = useState<{
    items: {
      itemId: string;
      itemName: string;
      itemType: string;
      borrowedQty: number;
      returnedQty: number;
      condition: string;
      damageReport: string;
      lackingItems: string;
      notes: string;
      returnedIdentifiers?: string[];
    }[];
  }>({ items: [] });

  // Group members state & helpers (used for Group borrow/reservation flows)
  const [groupMembers, setGroupMembers] = useState<{ name: string; id: string }[]>([]);

  const addGroupMember = () => {
    setGroupMembers(prev => [...prev, { name: "", id: "" }]);
  };

  const removeGroupMember = (index: number) => {
    setGroupMembers(prev => prev.filter((_, i) => i !== index));
  };

  const updateGroupMember = (index: number, updates: Partial<{ name: string; id: string }>) => {
    setGroupMembers(prev => prev.map((m, i) => i === index ? { ...m, ...updates } : m));
  };

  // highlight newly added item (glow)
  const [newlyAddedItemNum, setNewlyAddedItemNum] = useState<string | null>(null);

  // View-only dialog state
  const [viewDialogOpenBorrow, setViewDialogOpenBorrow] = useState(false);
  const [viewBorrowRecord, setViewBorrowRecord] = useState<BorrowRecord | null>(null);

  // Add this function to handle return initiation
  const handleInitiateReturn = (record: BorrowRecord) => {
    // Only include non-consumable items for return -> consumables are not returnable.
    const nonConsumableItems = (record.items || []).filter(it => it.item_type === 'non-consumable');
    
    if (nonConsumableItems.length === 0) {
      alert('This borrow record has no non-consumable items to return. Consumable items are not returnable.');
      return;
    }

    // Ensure we use the MongoDB subdocument _id for updates.
    const returnItems = nonConsumableItems.map(item => {
      if (!item._id) {
        // If no subdocument _id, we cannot reliably update server-side item; mark for skip but still present
        console.warn('Borrow item missing _id (cannot update):', item);
      }
      return {
        itemId: item._id || '', // empty => will be skipped on submit
        itemName: item.item_name,
        itemType: item.item_type,
        borrowedQty: item.quantity,
        returnedQty: item.quantity, // default to full
        condition: item.return_condition || 'Good',
        damageReport: item.damage_report || '',
        lackingItems: item.lacking_items || '',
        notes: item.notes || '',
        returnedIdentifiers: item.identifiers?.map((id: any) => id.identifier) || []
      };
    });

    setSelectedBorrowForReturn(record);
    setReturnForm({ items: returnItems });
    setReturnDialogOpen(true);
  };

  // Add this function to handle return submission
  const handleSubmitReturn = async () => {
    try {
      if (!selectedBorrowForReturn) return;

      const updatePromises: Promise<any>[] = [];
      const skipped: string[] = [];

      for (const item of returnForm.items) {
        if (!item.itemId) {
          // cannot update items without a valid subdocument _id
          skipped.push(item.itemName);
          continue;
        }

        const status = item.returnedQty === item.borrowedQty ? 'Returned' :
                       item.returnedQty > 0 ? 'Partially Returned' : 'Borrowed';

        const payload: any = {
          status,
          condition: item.condition,
          damageReport: item.damageReport,
          lackingItems: item.lackingItems,
          notes: item.notes
        };

        if (item.returnedIdentifiers && item.returnedIdentifiers.length > 0) {
          payload.returnedIdentifiers = item.returnedIdentifiers;
        }

        // 1. Update borrow record item status
        updatePromises.push(
          axios.put(`${API_BASE_URL}/borrow-records/${selectedBorrowForReturn._id}/items/${item.itemId}`, payload)
        );

        // 2. For each returned identifier, update inventory status and borrowed count
        if (item.itemType === 'non-consumable' && item.returnedIdentifiers && item.returnedIdentifiers.length > 0) {
          for (const identifier of item.returnedIdentifiers) {
            // Update the status of the identifier in the inventory and decrement borrowed count
            updatePromises.push(
              axios.post(`${API_BASE_URL}/nc-inventory`, {
                action: "update_identifier_status_and_borrowed",
                identifier: identifier,
                status: item.condition?.toLowerCase() || "good", // e.g. "good", "damaged", etc.
                // Optionally, you can pass the item_id or equipment_num if needed for more precise update
                item_id: item.itemId
              })
            );
          }
        }
      }

      const results = await Promise.allSettled(updatePromises);
      const failed = results.filter(r => r.status === 'rejected');

      await fetchRecords();
      await fetchItems();
      setReturnDialogOpen(false);

      if (skipped.length > 0) {
        alert(`Returned processed. Note: some items were skipped because they have no server ID: ${skipped.join(', ')}`);
      } else if (failed.length > 0) {
        alert('Return processed but some updates failed. Check console for details.');
      } else {
        alert('Items returned successfully!');
      }
    } catch (err) {
      console.error('Return submission error:', err);
      alert('Failed to return items, see console for details.');
    }
  };

  // Update the condition of a specific item in return form
  const updateReturnItemCondition = (itemIndex: number, updates: any) => {
    setReturnForm(prev => ({
      items: prev.items.map((item, index) => 
        index === itemIndex ? { ...item, ...updates } : item
      )
    }));
  };

  // Fix the View function to open a read-only dialog (do not reuse the stepper)
  const handleViewBorrow = (record: BorrowRecord) => {
    setViewBorrowRecord(record);
    setViewDialogOpenBorrow(true);
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  useEffect(() => {
    if (barcodeSearch === "" && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [barcodeSearch]);

    // Get available fields for borrow records
  const getAvailableFields = (): ReportField[] => {
    return [
      { field: 'borrow_id', label: 'Borrow ID', type: 'string' },
      { field: 'borrow_type', label: 'Borrow Type', type: 'string' },
      { field: 'user_type', label: 'User Type', type: 'string' },
      { field: 'borrow_user', label: 'Borrower Name', type: 'string' },
      { field: 'course', label: 'Course', type: 'string' },
      { field: 'group_number', label: 'Group Number', type: 'string' },
      { field: 'group_leader', label: 'Group Leader', type: 'string' },
      { field: 'group_leader_id', label: 'Leader ID', type: 'string' },
      { field: 'instructor', label: 'Instructor', type: 'string' },
      { field: 'subject', label: 'Subject', type: 'string' },
      { field: 'schedule', label: 'Schedule', type: 'string' },
      { field: 'status', label: 'Status', type: 'string' },
      { field: 'date_borrowed', label: 'Date Borrowed', type: 'date' },
      { field: 'date_returned', label: 'Date Returned', type: 'date' },
      { field: 'reservation_code', label: 'Reservation Code', type: 'string' },
      { field: 'items_count', label: 'Items Count', type: 'number' },
      { field: 'total_quantity', label: 'Total Quantity', type: 'number' },
    ];
  };

  // Initialize available fields
  useEffect(() => {
    setAvailableFields(getAvailableFields());
  }, []);

  // Handle field selection
  const handleFieldSelection = (field: string) => {
    setSelectedFields(prev => 
      prev.includes(field) 
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );
  };

  // Add filter
  const addFilter = () => {
    setReportFilters(prev => [...prev, { field: '', operator: 'equals', value: '' }]);
  };

  // Remove filter
  const removeFilter = (index: number) => {
    setReportFilters(prev => prev.filter((_, i) => i !== index));
  };

  // Update filter
  const updateFilter = (index: number, updates: Partial<ReportFilter>) => {
    setReportFilters(prev => prev.map((filter, i) => 
      i === index ? { ...filter, ...updates } : filter
    ));
  };

  // Get operators for field type
  const getOperatorsForField = (fieldType: string) => {
    if (fieldType === 'number') {
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'greaterThan', label: 'Greater Than' },
        { value: 'lessThan', label: 'Less Than' },
        { value: 'greaterThanOrEqual', label: 'Greater Than or Equal' },
        { value: 'lessThanOrEqual', label: 'Less Than or Equal' }
      ];
    } else {
      return [
        { value: 'equals', label: 'Equals' },
        { value: 'contains', label: 'Contains' }
      ];
    }
  };

  // Generate custom report for borrow records
  const generateCustomReport = () => {
    let filteredData = records.map(record => ({
      ...record,
      items_count: record.items.length,
      total_quantity: record.items.reduce((sum, item) => sum + item.quantity, 0)
    }));
    
    // Apply filters
    filteredData = filteredData.filter(record => {
      return reportFilters.every(filter => {
        if (!filter.field || !filter.value) return true;
        
        const fieldValue = record[filter.field as keyof typeof record];
        const stringValue = String(fieldValue || '').toLowerCase();
        const numValue = Number(fieldValue) || 0;
        const filterValue = filter.value.toLowerCase();
        const numFilterValue = Number(filter.value) || 0;
        
        switch (filter.operator) {
          case 'equals':
            return stringValue === filterValue;
          case 'contains':
            return stringValue.includes(filterValue);
          case 'greaterThan':
            return numValue > numFilterValue;
          case 'lessThan':
            return numValue < numFilterValue;
          case 'greaterThanOrEqual':
            return numValue >= numFilterValue;
          case 'lessThanOrEqual':
            return numValue <= numFilterValue;
          default:
            return true;
        }
      });
    });

    // Select only chosen fields
    const columns = selectedFields.map(field => {
      const fieldInfo = availableFields.find(f => f.field === field);
      return fieldInfo?.label || field;
    });

    const rows = filteredData.map(record => 
      selectedFields.map(field => {
        const value = record[field as keyof typeof record];
        return value === null || value === undefined ? '' : String(value);
      })
    );

    setReportTable({ columns, rows });
    setReportDialogOpen(false);
    
    // Generate PDF automatically
    setTimeout(() => {
      handleGeneratePDF();
    }, 500);
  };


  // Add this function near your other handler functions
const handleGenerateReport = async () => {
  if (!question.trim()) {
    setReportText("Please enter a question first.");
    return;
  }

  setLoading(true);
  setReportText("");
  setReportTable(null);

  try {
    console.log("Sending AI report request for borrow records...", { question });

    const res = await axios.post(`${API_BASE_URL}/ai-report`, {
      question: question,
      itemType: "Borrow" // Specify this is for borrow records
    });

    console.log("AI report response received:", res.data);
    const responseData = res.data;

    if (responseData.success) {
      // Handle string response
      if (typeof responseData.data === 'string') {
        setReportText(responseData.data);
      } 
      // Handle table response with summary
      else if (responseData.data?.table) {
        setReportTable({
          columns: responseData.data.table.columns || [],
          rows: responseData.data.table.rows || []
        });
        setReportText(responseData.data.summary || "Data analysis completed.");
      } 
      // Handle direct table format
      else if (responseData.data?.columns && responseData.data?.rows) {
        setReportTable({
          columns: responseData.data.columns,
          rows: responseData.data.rows
        });
      }
      // Handle other object types
      else {
        setReportText(JSON.stringify(responseData.data, null, 2));
      }
    } else {
      setReportText(`Error: ${responseData.error}`);
    }

  } catch (err: any) {
    console.error("AI Report error details:", err);
    
    if (err.response) {
      // Server responded with error status
      console.error("Server error response:", err.response.data);
      setReportText(`Server Error: ${err.response.data.error || err.response.statusText}`);
    } else if (err.request) {
      // Request was made but no response received
      console.error("No response received:", err.request);
      setReportText("Network Error: Could not connect to the server. Make sure your backend is running.");
    } else {
      // Something else happened
      setReportText(`Error: ${err.message}`);
    }
  } finally {
    setLoading(false);
  }
};


const handleGeneratePDF2 = () => {
  if (!reportTable) return;
  
  const printContent = `
    <html>
      <head>
        <title>AI Borrow Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          h1 { color: #b91c1c; }
          .report-info { margin-bottom: 20px; color: #666; }
          .ai-summary { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <h1>AI Borrow Report</h1>
        <div class="report-info">
          <p>Generated on: ${new Date().toLocaleString()}</p>
          <p>Question: "${question}"</p>
        </div>
        ${reportText ? `
        <div class="ai-summary">
          <h3>AI Analysis Summary</h3>
          <p>${reportText}</p>
        </div>
        ` : ''}
        ${reportTable.columns.length > 0 ? `
        <table>
          <thead>
            <tr>
              ${reportTable.columns.map(col => `<th>${col}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${reportTable.rows.map(row => `
              <tr>
                ${row.map(cell => `<td>${cell}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : ''}
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  }
};
  // Generate PDF function
  const handleGeneratePDF = () => {
    if (!reportTable) return;
    
    const printContent = `
      <html>
        <head>
          <title>Borrow Records Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            h1 { color: #b91c1c; }
            .report-info { margin-bottom: 20px; color: #666; }
          </style>
        </head>
        <body>
          <h1>Borrow Records Report</h1>
          <div class="report-info">
            <p>Generated on: ${new Date().toLocaleString()}</p>
            <p>Total Records: ${reportTable.rows.length}</p>
          </div>
          <table>
            <thead>
              <tr>
                ${reportTable.columns.map(col => `<th>${col}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${reportTable.rows.map(row => `
                <tr>
                  ${row.map(cell => `<td>${cell}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  useEffect(() => {
    if (barcodeSearch === "" && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [barcodeSearch]);


  // Fetch borrow records from MongoDB
  const fetchRecords = async () => {
    setRecordsLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/borrow-records`);
      setRecords(res.data);
    } catch (err) {
      console.error("fetchRecords error:", err);
    } finally {
      setRecordsLoading(false);
    }
  };

  // Fetch inventory from MongoDB
  const fetchItems = async () => {
    setItemsLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/inventory`);
      setItems(res.data);
    } catch (err) {
      console.error("fetchItems error:", err);
    } finally {
      setItemsLoading(false);
    }
  };

  // Replace the existing fetchReservationByCode implementation with this (improves merging logic)
  const fetchReservationByCode = async (code: string) => {
    setReservationLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/reservations/code/${encodeURIComponent(code)}`);
      const data = res.data;

      // Normalize server shapes:
      // 1) { reservation, student_prep } OR
      // 2) reservation object at top-level (possibly with merged student_prep fields)
      let resObj: any = null;
      let sp: any = null;

      if (data && typeof data === "object") {
        if (data.reservation) {
          resObj = data.reservation;
          sp = data.student_prep || null;
        } else {
          // top-level reservation (may already include student_prep or merged fields)
          resObj = data;
          sp = data.student_prep || null;
        }
      }

      // If still no studentPrep but reservation has group_barcode, try fetching student-prep explicitly
      if (!sp && resObj && resObj.group_barcode) {
        try {
          const spResp = await axios.get(`${API_BASE_URL}/student-prep/barcode/${encodeURIComponent(String(resObj.group_barcode))}`);
          sp = spResp.data || null;
        } catch (e) {
          sp = null;
        }
      }

      // If server returned only student_prep (rare), try to load reservation from it
      if (!resObj && data && data.student_prep) {
        sp = data.student_prep;
        if (sp.reservation_code) {
          const rresp = await axios.get(`${API_BASE_URL}/reservations/code/${encodeURIComponent(sp.reservation_code)}`);
          const rdata = rresp.data;
          resObj = rdata.reservation ? rdata.reservation : rdata;
        }
      }

      if (!resObj) {
        setCurrentReservation(null);
        setError("Reservation not found");
        return null;
      }

      // --- FIX: Only allow reservations with status "Assigned" ---
      if (resObj.status !== "Assigned") {
        setCurrentReservation(null);
        setError("Reservation not found");
        return null;
      }

      // keep reservation state and studentPrep (if any)
      setCurrentReservation(resObj);
      setReservationCode(String(resObj.reservation_code || code));

      // Build merge logic safely (avoid mixing || and ??)
      setRequestForm(prev => {
        const borrowUser = prev.borrow_user || (sp && sp.borrower_name) || resObj.borrow_user || "";
        const course = prev.course || resObj.course || (sp && sp.course) || "";
        const instructor = prev.instructor || resObj.instructor || (sp && sp.instructor) || "";
        const subject = prev.subject || resObj.subject || (sp && sp.subject) || "";
        const schedule = prev.schedule || resObj.schedule || (sp && sp.schedule) || "";
        const groupNumber = prev.group_number || (sp && sp.group_number) || resObj.group_number || "";
        const groupLeader = prev.group_leader || (sp && sp.group_leader) || resObj.group_leader || "";
        const groupLeaderId = prev.group_leader_id || (sp && sp.group_leader_id) || resObj.group_leader_id || "";

        return {
          ...prev,
          reservation_code: resObj.reservation_code || prev.reservation_code,
          borrow_user: borrowUser,
          course,
          instructor,
          subject,
          schedule,
          group_number: groupNumber,
          group_leader: groupLeader,
          group_leader_id: groupLeaderId
        };
      });

      // Populate groupMembers from student_prep first, then reservation
      const members = Array.isArray(sp?.group_members) && sp.group_members.length > 0
        ? sp.group_members
        : (Array.isArray(resObj.group_members) ? resObj.group_members : []);
      setGroupMembers(members);

      // Set userType from reservation or infer from group_count
      if (resObj.user_type) {
        setUserType(resObj.user_type);
      } else if (resObj.group_count && resObj.group_count > 1) {
        setUserType('Group');
      } else {
        setUserType('Individual');
      }

      // Pre-load assigned_items into cart (if any)
      try {
        loadReservationItems(resObj);
      } catch (e) {
        console.warn("loadReservationItems failed:", e);
        setSelectedItems([]);
      }

      // Advance the stepper to Borrower Info so the pre-filled values are visible
      setActiveStep(1);
      setError(null);
      return resObj;
    } catch (err: any) {
      console.error("fetchReservation error:", err);
      if (err.response?.status === 404) {
        setError("Reservation not found");
      } else {
        setError("Failed to fetch reservation");
      }
      return null;
    } finally {
      setReservationLoading(false);
    }
  };

  // Load reservation items into selected items (one cart line per assigned inventory item)
  const loadReservationItems = (reservation: Reservation) => {
    if (!reservation || !Array.isArray(reservation.assigned_items)) {
      console.warn('No assigned_items on reservation', reservation);
      setSelectedItems([]);
      return;
    }

    const reservationItemsMap: Record<string, SelectedItem> = {};

    // Helper to normalize item_type
    const normalizeType = (t?: string) => (t === 'consumable' ? 'consumable' : 'non-consumable');

    reservation.assigned_items.forEach((assigned) => {
      const requestedQty = Number(assigned.quantity || 0);
      const assignedType = normalizeType(assigned.item_type);
      let inventoryItem: InventoryItem | undefined;

      // Prefer exact num (item_id) match first
      if (assigned.item_id) {
        inventoryItem = items.find(i => (i.num === String(assigned.item_id) || i.num === assigned.item_id) && i.item_type === assignedType);
      }

      // Fallback to name match (case-insensitive) with same type
      if (!inventoryItem && assigned.item_name) {
        inventoryItem = items.find(i =>
          i.item_type === assignedType &&
          i.equipment_name?.toLowerCase().includes(assigned.item_name.toLowerCase())
        );
      }

      // Build selected item key (use inventory num when available, else a generated key)
      const key = inventoryItem ? `${inventoryItem.num}:::${assignedType}` : `${assigned.item_id || 'temp'}:::${assigned.item_name}:::${assignedType}`;

      const selectedIdentifiers = assigned.identifier ? [assigned.identifier] : [];

      if (reservationItemsMap[key]) {
        // merge: sum qty and append identifiers (unique)
        reservationItemsMap[key].qty += requestedQty;
        reservationItemsMap[key].selected_identifiers = Array.from(new Set([...(reservationItemsMap[key].selected_identifiers || []), ...selectedIdentifiers]));
      } else {
        const sel: SelectedItem = {
          num: inventoryItem ? inventoryItem.num : (assigned.item_id ? String(assigned.item_id) : `temp-${Date.now()}-${Math.random().toString(36).slice(2,6)}`),
          name: inventoryItem ? inventoryItem.equipment_name : assigned.item_name,
          qty: requestedQty,
          available: inventoryItem ? (inventoryItem.available ?? 0) : requestedQty,
          is_consumable: assignedType === 'consumable' || Boolean(inventoryItem?.is_consumable),
          selected_identifiers: selectedIdentifiers.length > 0 ? selectedIdentifiers : undefined,
          identifier_type: inventoryItem?.identifier_type,
          item_type: assignedType
        };
        reservationItemsMap[key] = sel;
      }
    });

    const reservationItems = Object.values(reservationItemsMap);

    // Set to state and highlight last added item briefly
    setSelectedItems(reservationItems);
    if (reservationItems.length > 0) {
      const lastNum = reservationItems[reservationItems.length - 1].num;
      setNewlyAddedItemNum(lastNum);
      setTimeout(() => setNewlyAddedItemNum(null), 1600);
    }
  };

  useEffect(() => {
    fetchRecords();
    fetchItems();
  }, []);

  // Add debug useEffect for inventory items
  useEffect(() => {
    if (items.length > 0) {
      console.log('=== INVENTORY ITEMS DEBUG ===');
      console.log('Total items:', items.length);
      console.log('Non-consumable items:', items.filter(item => !item.is_consumable).length);
      console.log('Consumable items:', items.filter(item => item.is_consumable).length);
      console.log('Sample items:', items.slice(0, 5));
      console.log('=== END INVENTORY DEBUG ===');
    }
  }, [items]);

  // Add debug useEffect for selected items
  useEffect(() => {
    console.log('=== SELECTED ITEMS STATE UPDATE ===');
    console.log('Selected items:', selectedItems);
    console.log('Selected items count:', selectedItems.length);
    if (selectedItems.length > 0) {
      console.log('First item details:', selectedItems[0]);
    }
  }, [selectedItems]);

  // filter items
  const filteredItems = useMemo(
    () =>
      items.filter(item => {
        // Filter by type
        if (itemType !== "all") {
          if (itemType === "non-consumable" && item.is_consumable) return false;
          if (itemType === "consumable" && !item.is_consumable) return false;
        }

        // Filter by search
        return (
          item.equipment_name.toLowerCase().includes(search.toLowerCase()) ||
          (item.brand_model ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (item.location ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (item.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (item.identifiers?.some(id => id.toLowerCase().includes(search.toLowerCase())) ?? false)
        );
      }),
    [items, search, itemType]
  );

  // filter records
  const filteredRecords = useMemo(
    () =>
      records.filter(
        (r) =>
          (r.course?.toLowerCase().includes(search.toLowerCase()) ||
          r.group_leader?.toLowerCase().includes(search.toLowerCase()) ||
          r.instructor?.toLowerCase().includes(search.toLowerCase()) ||
          r.subject?.toLowerCase().includes(search.toLowerCase()) ||
          r.reservation_code?.toLowerCase().includes(search.toLowerCase())) &&
          // Date filter
          (!startDate || !r.date_borrowed || new Date(r.date_borrowed) >= new Date(startDate)) &&
          (!endDate || !r.date_borrowed || new Date(r.date_borrowed) <= new Date(endDate))
      ),
    [records, search, startDate, endDate]
  );

  // Apply date filter
  const applyDateFilter = () => {
    setDateFilterAnchor(null);
  };

  // Clear date filter
  const clearDateFilter = () => {
    setStartDate("");
    setEndDate("");
    setDateFilterAnchor(null);
  };

  // Open identifier selection dialog
  const handleOpenIdentifierDialog = (item: InventoryItem, preselect: string[] = []) => {
    setCurrentItem(item);
    setSelectedIdentifiers(preselect || []);
    setIdentifierDialogOpen(true);
  };

  // Add item with selected identifiers - FIXED
  const handleAddWithIdentifiers = () => {
    if (!currentItem) return;

    const newItem: SelectedItem = {
      num: currentItem.num,
      name: currentItem.equipment_name,
      qty: selectedIdentifiers.length,
      available: currentItem.available,
      is_consumable: currentItem.is_consumable || false,
      selected_identifiers: [...selectedIdentifiers],
      identifier_type: currentItem.identifier_type,
      item_type: currentItem.item_type // ADDED: Include item_type
    };

    // If item already exists in cart, update it (single-line cart per item)
    setSelectedItems(prev => {
      const exists = prev.find(i => i.num === newItem.num && i.item_type === newItem.item_type);
      if (exists) {
        return prev.map(i => (i.num === newItem.num && i.item_type === newItem.item_type)
          ? { ...i, qty: Math.max(i.qty, newItem.qty), selected_identifiers: newItem.selected_identifiers }
          : i
        );
      }
      return [...prev, newItem];
    });
    // glow indicator
    setNewlyAddedItemNum(newItem.num);
    setTimeout(() => setNewlyAddedItemNum(null), 1800);

    setIdentifierDialogOpen(false);
    setCurrentItem(null);
    setSelectedIdentifiers([]);
  };

  // Add or replace missing updateItemQty implementation
  const updateItemQty = (
    num: string,
    delta: number,
    available: number,
    name: string,
    is_consumable: boolean = false
  ) => {
    const item_type = is_consumable ? "consumable" : "non-consumable";

    setSelectedItems((prev) => {
      const existing = prev.find((i) => i.num === num && i.item_type === item_type);
      const invItem = items.find((it) => it.num === num && it.item_type === item_type);

      // If no existing cart entry
      if (!existing) {
        // If inventory item has identifiers, require identifier selection first
        if (invItem && invItem.identifiers && invItem.identifiers.length > 0) {
          handleOpenIdentifierDialog(invItem, []); // open dialog to pick identifiers
          return prev;
        }

        // Otherwise add a new item with qty 1 when delta > 0
        if (delta > 0) {
          const newItem: SelectedItem = {
            num,
            name,
            qty: 1,
            available,
            is_consumable,
            item_type,
          };
          // glow feedback
          setNewlyAddedItemNum(num);
          setTimeout(() => setNewlyAddedItemNum(null), 1800);
          return [...prev, newItem];
        }

        return prev;
      }

      // If existing and user tries to increase quantity for an item that has identifiers,
      // open identifier dialog so they can select additional identifiers.
      if (delta > 0 && invItem && invItem.identifiers && invItem.identifiers.length > 0) {
        // Preselect already chosen identifiers if any
        handleOpenIdentifierDialog(invItem, existing.selected_identifiers || []);
        return prev;
      }

      // Calculate new qty bounded by 0..available
      const newQty = Math.max(0, Math.min(existing.qty + delta, available));

      // If qty becomes zero, remove item
      if (newQty === 0) {
        return prev.filter((i) => !(i.num === num && i.item_type === item_type));
      }

      // Otherwise update qty
      return prev.map((i) =>
        i.num === num && i.item_type === item_type ? { ...i, qty: newQty } : i
      );
    });
  };

  // stepper nav
  const handleNext = async () => {
    if (activeStep === 0) {
      if (!borrowType) {
        setError("Please select borrow type");
        return;
      }
      
      if (borrowType === 'Reservation') {
        if (!reservationCode.trim()) {
          setError("Please enter reservation code");
          return;
        }

        setError(null);
        // await lookup so UI updates (requestForm/groupMembers/selectedItems) before proceeding
        const found = await fetchReservationByCode(reservationCode.trim());
        if (found) {
          // fetchReservationByCode already advances to step 1, ensure dialog open
          setOpen(true);
          return;
        } else {
          setError("Reservation not found");
          return;
        }
      } else {
        if (!userType) {
          setError("Please select user type");
          return;
        }
        setError(null);
        setActiveStep(1);
      }
    } else if (activeStep === 1) {
      const req = requestForm;
      if (
        !req.course ||
        !req.instructor ||
        !req.subject ||
        !req.schedule ||
        (userType === 'Group' && (!req.group_number || !req.group_leader || !req.group_leader_id))
      ) {
        setError("Please complete all required fields.");
        return;
      }
      setError(null);
      setActiveStep(2);
    } else if (activeStep === 2) {
      if (selectedItems.length === 0) {
        setError("Please select at least one item.");
        return;
      }

      for (const sItem of selectedItems) {
        const inv = items.find(i => i.num === sItem.num && i.item_type === sItem.item_type);
        if (inv && inv.identifiers && inv.identifiers.length > 0) {
          if (!sItem.selected_identifiers || sItem.selected_identifiers.length < sItem.qty) {
            setError(`Please select ${sItem.qty} identifier(s) for "${sItem.name}"`);
            if (inv) handleOpenIdentifierDialog(inv, sItem.selected_identifiers?.slice(0, sItem.qty) || []);
            return;
          }
        }
      }

      setError(null);
      setActiveStep(3);
    }
  };

  // Update Borrow: similar to New Borrow but populate stepper for editing - FIXED
  const handleUpdateBorrow = (record: BorrowRecord) => {
    setBorrowType(record.borrow_type);
    setUserType(record.user_type);
    setRequestForm({
      borrow_id: record._id || "",
      borrow_type: record.borrow_type,
      user_type: record.user_type,
      borrow_user: record.borrow_user,
      course: record.course,
      group_number: record.group_number || "",
      group_leader: record.group_leader || "",
      group_leader_id: record.group_leader_id || "",
      instructor: record.instructor,
      subject: record.subject,
      schedule: record.schedule,
      status: record.status,
      date_borrowed: record.date_borrowed,
      reservation_code: record.reservation_code || "",
    });

    const itemsArr = record.items.map((item) => ({
      num: item.item_id,
      name: item.item_name,
      qty: item.quantity,
      available: 999, // allow editing
      is_consumable: item.item_type === 'consumable',
      selected_identifiers: item.identifiers?.map(i => i.identifier),
      item_type: item.item_type // ADDED: Include item_type
    }));

    setSelectedItems(itemsArr);
    setGroupMembers(record.group_members || []); // ADDED: Populate group members
    setActiveStep(1); // jump to borrower info
    setOpen(true);
  };

  const handleDeleteSelected = async () => {
    if (selectedRecordIds.length === 0) return;
    if (!confirm(`Delete ${selectedRecordIds.length} borrow record(s)?`)) return;

    try {
      for (const id of selectedRecordIds) {
        await axios.delete(`${API_BASE_URL}/borrow-records/${id}`);
      }
      await fetchRecords();
      setSelectedRecordIds([]);
    } catch (err) {
      console.error("delete selected error:", err);
      alert("Failed to delete some records.");
    }
  };

  // Delete Borrow
  const handleDeleteBorrow = async (borrowId: string) => {
    if (!confirm("Are you sure you want to delete this borrow request?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/borrow-records/${borrowId}`);
      await fetchRecords();
    } catch (err) {
      console.error("deleteBorrow error:", err);
      alert("Failed to delete the record.");
    }
  };

  const handleBack = () => {
    setError(null);
    setActiveStep((s) => Math.max(0, s - 1));
  };

  const handleBarcodeSearch = (barcode: string) => {
    const searchTerm = barcode.trim();
    setBarcodeSearch(searchTerm);
    
    if (searchTerm) {
      // Find item with matching identifier (exact match)
      const foundItem = items.find(item => 
        item.identifiers?.some(identifier => 
          identifier.toLowerCase() === searchTerm.toLowerCase()
        )
      );
      
      if (foundItem) {
        // Check if item is already in cart - FIXED: Use both num and item_type
        const existingItem = selectedItems.find(i => i.num === foundItem.num && i.item_type === foundItem.item_type);
        
        if (!existingItem && foundItem.available > 0) {
          // Instead of automatically adding, open the dialog to show ALL identifiers
          setCurrentItem(foundItem);
          
          // Pre-select the scanned identifier if it exists
          const matchedIdentifier = foundItem.identifiers?.find(identifier => 
            identifier.toLowerCase() === searchTerm.toLowerCase()
          );
          
          if (matchedIdentifier) {
            setSelectedIdentifiers([matchedIdentifier]);
          } else {
            setSelectedIdentifiers([]);
          }
          
          setIdentifierDialogOpen(true);
        } else if (existingItem) {
          // Item already in cart, you could show a message or update quantity
          console.log("Item already in cart");
        }
        setBarcodeSearch(""); // Clear the search after successful match
      } else {
        // If no exact match, try partial match for manual typing
        const partiallyMatchedItem = items.find(item => 
          item.identifiers?.some(identifier => 
            identifier.toLowerCase().includes(searchTerm.toLowerCase())
          )
        );
        
        if (partiallyMatchedItem) {
          setCurrentItem(partiallyMatchedItem);
          setSelectedIdentifiers([]);
          setIdentifierDialogOpen(true);
          setBarcodeSearch(""); // Clear the search
        }
      }
    }
  };

  const resetDialog = () => {
    setOpen(false);
    setActiveStep(0);
    setBorrowType('');
    setUserType('');
    setReservationCode("");
    setCurrentReservation(null);
    setRequestForm({
      borrow_id: "",
      borrow_type: "",
      user_type: "",
      borrow_user: "",
      course: "",
      group_number: "",
      group_leader: "",
      group_leader_id: "",
      instructor: "",
      subject: "",
      schedule: "",
      status: "Borrowed",
      date_borrowed: new Date().toISOString(),
      reservation_code: "",
    });
    setSelectedItems([]);
    setGroupMembers([]); // RESET group members
    setError(null);
  };

  // save borrow
  const handleConfirmBorrow = async () => {
    if (selectedItems.length === 0) return;

    // Final validation: ensure identifiers are selected where required
    for (const sItem of selectedItems) {
      const inv = items.find(i => i.num === sItem.num && i.item_type === sItem.item_type);
      if (inv && inv.identifiers && inv.identifiers.length > 0) {
        if (!sItem.selected_identifiers || sItem.selected_identifiers.length < sItem.qty) {
          setError(`Please select ${sItem.qty} identifier(s) for "${sItem.name}" before confirming.`);
          handleOpenIdentifierDialog(inv, sItem.selected_identifiers?.slice(0, sItem.qty) || []);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
      const managed_by = currentUser.email || currentUser.name || "Unknown";
      const managed_name = currentUser.name || currentUser.firstname || currentUser.email || "Unknown";

      const borrowData = {
        ...requestForm,
        group_leader: requestForm.borrow_user,
        borrow_type: borrowType,
        user_type: userType,
        items: selectedItems.map(item => ({
          item_id: item.num,
          item_name: item.name,
          item_type: item.is_consumable ? 'consumable' : 'non-consumable',
          quantity: item.qty,
          status: 'Borrowed',
          identifiers: item.selected_identifiers ? item.selected_identifiers.map(id => ({ identifier: id, status: 'Borrowed' })) : []
        })),
        // --- FIX: Always include group_members for Group type ---
        group_members: userType === 'Group' ? groupMembers : [],
        managed_by,
        managed_name
      };

      if (requestForm.borrow_id) {
        // Update existing record
        await axios.put(`${API_BASE_URL}/borrow-records/${requestForm.borrow_id}`, borrowData);
      } else {
        // Create new record
        await axios.post(`${API_BASE_URL}/borrow-records`, borrowData);

        // Reservation: attempt to mark Completed ONLY if reservation end datetime already passed.
        if (borrowType === 'Reservation' && currentReservation) {
          try {
            const schedText = String(currentReservation.schedule || '').trim();
            let allowComplete = false;

            if (schedText) {
              const dateCandidate = new Date(schedText);
              if (!isNaN(dateCandidate.getTime())) {
                // merge endTime if available
                const endTimeStr = String(currentReservation.endTime || '').trim();
                const endDateTime = new Date(dateCandidate);
                if (endTimeStr) {
                  const [eh, em] = endTimeStr.split(':').map(Number);
                  if (!isNaN(eh)) endDateTime.setHours(eh || 0, em || 0, 0, 0);
                  else endDateTime.setHours(23, 59, 59, 0);
                } else {
                  endDateTime.setHours(23, 59, 59, 0);
                }
                if (new Date() >= endDateTime) allowComplete = true;
              } else {
                // schedule is not a single parseable date (likely recurring) => do NOT auto-complete
                allowComplete = false;
              }
            }

            if (allowComplete) {
              // best-effort; failures shouldn't break borrow creation
              await axios.put(`${API_BASE_URL}/reservations/${currentReservation._id}`, { status: 'Completed' });
            }
          } catch (resErr) {
            // log and continue — don't surface reservation update errors to the user as a fatal error
            console.warn('Could not update reservation status to Completed (non-fatal):');
          }
        }
      }

      await fetchRecords();
      await fetchItems();
      resetDialog();
    } catch (err) {
      console.error("save borrow error:", err);
      setError("Failed to save borrow record.");
      alert("Failed to save borrow record. See console for details.");
    } finally {
      setSaving(false);
    }
  };

  // summary calc
  const totalRequestedCount = records.reduce((acc, r) => {
    return acc + r.items.reduce((itemAcc, item) => itemAcc + item.quantity, 0);
  }, 0);

  

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Summary cards */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" color="#b91c1c" gutterBottom>
          Borrow Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage equipment and consumable inventory
        </Typography>
      </Box>
      
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
            <PersonIcon sx={{ fontSize: 30, color: "#b91c1c" }} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight="medium">Borrow Requests</Typography>
            <Typography variant="h4" sx={{ fontWeight: "bold", color: "#b91c1c" }}>
              {records.length}
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
            <Typography variant="caption" color="text.secondary" fontWeight="medium">Total Items Borrowed</Typography>
            <Typography variant="h4" sx={{ fontWeight: "bold", color: theme.palette.success.main }}>
              {totalRequestedCount}
            </Typography>
          </Box>
        </Card>
      </Stack>

      {/* Action Bar */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={3} justifyContent="space-between" alignItems="center">
        <Stack direction="row" spacing={1} sx={{ flex: 1, maxWidth: 600 }} alignItems="center">
          <TextField
            placeholder="Search program, leader, instructor, subject, reservation code..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            variant="outlined"
            size="small"
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
          
          {/* Date Filter Button */}
          <Button
            variant="outlined"
            onClick={(e) => setDateFilterAnchor(e.currentTarget)}
            startIcon={<FilterListIcon />}
            sx={{
              borderRadius: 3,
              textTransform: "none",
              px: 2,
              borderColor: "#b91c1c",
              color: "#b91c1c",
              "&:hover": {
                borderColor: "#b91c1c",
                bgcolor: "rgba(185, 28, 28, 0.04)"
              }
            }}
          >
            Date Filter
          </Button>

          {/* Date Filter Popover */}
          <Popover
            open={Boolean(dateFilterAnchor)}
            anchorEl={dateFilterAnchor}
            onClose={() => setDateFilterAnchor(null)}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'left',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'left',
            }}
          >
            <Box sx={{ p: 2, minWidth: 300 }}>
              <Typography variant="subtitle1" gutterBottom>
                Filter by Borrow Date
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="Start Date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
                <TextField
                  label="End Date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    onClick={applyDateFilter}
                    sx={{ flex: 1 }}
                  >
                    Apply
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={clearDateFilter}
                    sx={{ flex: 1 }}
                  >
                    Clear
                  </Button>
                </Stack>
              </Stack>
            </Box>
          </Popover>
        </Stack>
        
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button
            variant="contained"
            onClick={() => setOpen(true)}
            sx={{
              bgcolor: "#b91c1c",
              "&:hover": { bgcolor: "#b91c1c.dark" },
              borderRadius: 2,
              textTransform: "none",
              px: 3,
              fontWeight: "bold",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
            }}
          >
            + Add Borrow 
          </Button>

          {(userRole === "Custodian" || userRole === "Admin")  && (
            <Button
              variant="outlined"
              color="error"
              sx={{
                borderRadius: 2,
                textTransform: "none",
                px: 3,
                fontWeight: "bold",
              }}
              disabled={selectedRecordIds.length === 0}
              onClick={handleDeleteSelected}
            >
              Delete Selected ({selectedRecordIds.length})
            </Button>
          )}

          {/* AI Report Button - Only show for Custodian */}
          {(userRole === "Custodian" || userRole === "Admin")  && (
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

              {/* ADD THIS NEW BUTTON - Generate Report */}
          {(userRole === "Custodian" || userRole === "Admin") && (
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

      {/* Borrow Records Table */}
      <Card
        sx={{
          p: 3,
          borderRadius: 3,
          backgroundColor: "background.paper",
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        {recordsLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
            <Loader />
          </Box>
        ) : records.length === 0 ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
            <Typography variant="body2" color="text.secondary">
              No borrow records found.
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
                        indeterminate={
                          selectedRecordIds.length > 0 &&
                          selectedRecordIds.length < records.length
                        }
                        checked={
                          records.length > 0 &&
                          selectedRecordIds.length === records.length
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRecordIds(records.map((r) => r._id!));
                          } else {
                            setSelectedRecordIds([]);
                          }
                        }}
                        sx={{ color: "#b91c1c" }}
                      />
                    </TableCell>
                    <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Date</TableCell>
                    <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Type</TableCell>
                    <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Program</TableCell>
                    <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Leader</TableCell>
                    <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Instructor</TableCell>
                    <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Schedule</TableCell>
                    <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Status</TableCell>
                    <TableCell align="center" sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRecords
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((r) => (
                      <TableRow key={r._id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedRecordIds.includes(r._id!)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRecordIds((prev) => [...prev, r._id!]);
                              } else {
                                setSelectedRecordIds((prev) =>
                                  prev.filter((id) => id !== r._id)
                                );
                              }
                            }}
                            sx={{ color: "#b91c1c" }}
                          />
                        </TableCell>
                        <TableCell>
                          {r.date_borrowed
                            ? new Date(r.date_borrowed).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              })
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={`${r.borrow_type} - ${r.user_type}`} 
                            size="small" 
                            color="primary"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {r.course}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {r.group_leader || r.borrow_user}
                            </Typography>
                            {r.group_leader_id && (
                              <Typography variant="caption" color="text.secondary">
                                {r.group_leader_id}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>{r.instructor}</TableCell>
                        <TableCell>{r.schedule}</TableCell>
                      <TableCell>
  {/* Main status */}
  <Chip 
    label={r.status} 
    size="small" 
    color={r.status === "Returned" ? "success" : "error"} 
    variant={r.status === "Returned" ? "filled" : "outlined"} 
  />

  {/* Condition summary as an orange chip */}
  {(() => {
    const nonConsumableItems = (r.items || []).filter(it => it.item_type === 'non-consumable');

    const condCount: Record<string, number> = {};
    nonConsumableItems.forEach(it => {
      const cond = (it.return_condition || it.status || '').toLowerCase();
      if (cond && cond !== 'good' && cond !== 'borrowed' && cond !== 'returned') {
        condCount[cond] = (condCount[cond] || 0) + 1;
      }
    });

    const condSummary = Object.entries(condCount)
      .map(([cond, count]) => `${count} ${cond.charAt(0).toUpperCase() + cond.slice(1)}`)
      .join(', ');

    return condSummary ? (
      <Chip
        label={condSummary}
        size="small"
        color="warning"
        variant="filled"
        sx={{ mt: 0.5}}
      />
    ) : null;
  })()}
</TableCell>

                       <TableCell>
  <Stack direction="row" spacing={1} justifyContent="center">
    {/* View Button - Only for viewing */}
    <Tooltip title="View Details">
      <IconButton
        color="info"
        onClick={() => handleViewBorrow(r)}
        sx={actionIconBtnSx}
      >
         <VisibilityIcon fontSize="small" />
      </IconButton>
    </Tooltip>

    {/* Update Button - Only for Borrowed status */}
    {r.status === 'Borrowed' && (
      <Tooltip title="Update/Return">
        <IconButton
          color="primary"
          onClick={() => handleUpdateBorrow(r)}
          sx={actionIconBtnSx}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    )}

    {/* Return Button - Only for Borrowed status */}
    {r.status === 'Borrowed' && (
      <Tooltip title="Return Items">
        <IconButton
          color="success"
          onClick={() => handleInitiateReturn(r)}
           sx={actionIconBtnSx}
        >
          <CheckCircleIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    )}

    {(userRole === "Custodian" || userRole === "Admin") && (
      <Tooltip title="Delete">
        <IconButton
          color="error"
          onClick={() => handleDeleteBorrow(r._id!)}
           sx={actionIconBtnSx}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
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
              count={filteredRecords.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              sx={{ borderTop: "1px solid", borderColor: "divider" }}
            />
          </>
        )}
      </Card>

      {/* Dialog (Stepper Form) */}
      <Dialog open={open} onClose={resetDialog} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontWeight: "bold",
            color: "#b91c1c",
            bgcolor: "grey.50",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          {requestForm.borrow_id ? "Update Borrow Request" : "New Borrow"}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <EventIcon color="error" />
            <Typography variant="caption" color="text.secondary">
              Step {activeStep + 1} of {steps.length}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: "background.default" }}>
          <Box mb={3}>
            <Stepper
              activeStep={activeStep}
              sx={{
                "& .MuiStepLabel-root .Mui-active": { color: "#b91c1c" },
                "& .MuiStepLabel-root .Mui-completed": { color: "success.main" },
                "& .MuiStepConnector-root .Mui-active .MuiStepConnector-line": { borderColor: "#b91c1c" },
                "& .MuiStepConnector-root .Mui-completed .MuiStepConnector-line": { borderColor: "success.main" },
              }}
            >
              {steps.map((label) => (
                <Step key={label}>
                                                                     <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Box>

          {/* Step 0: Select Type */}
          {activeStep === 0 && (
            <Stack spacing={3}>
              <Typography variant="h6">Select Borrow Type</Typography>
              
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Button
                  variant={borrowType === 'Walk-In' ? "contained" : "outlined"}
                  onClick={() => setBorrowType('Walk-In')}
                  fullWidth
                  sx={{ height: 80 }}
                >
                  <Stack alignItems="center">
                    <PersonIcon />
                    <Typography>Walk-in</Typography>
                  </Stack>
                </Button>
                
                <Button
                  variant={borrowType === 'Reservation' ? "contained" : "outlined"}
                  onClick={() => setBorrowType('Reservation')}
                  fullWidth
                  sx={{ height: 80 }}
                >
                  <Stack alignItems="center">
                    <EventIcon />
                    <Typography>Reservation</Typography>
                  </Stack>
                </Button>
              </Stack>

              {/* Walk-In User Type Selection */}
              {borrowType === 'Walk-In' && (
                <>
                  <Typography variant="h6" sx={{ mt: 2 }}>Select User Type</Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <Button
                      variant={userType === 'Individual' ? "contained" : "outlined"}
                      onClick={() => setUserType('Individual')}
                      fullWidth
                      sx={{ height: 80 }}
                    >
                      <Stack alignItems="center">
                        <PersonIcon />
                        <Typography>Individual</Typography>
                      </Stack>
                    </Button>
                    
                    <Button
                      variant={userType === 'Group' ? "contained" : "outlined"}
                      onClick={() => setUserType('Group')}
                      fullWidth
                      sx={{ height: 80 }}
                    >
                      <Stack alignItems="center">
                        <GroupIcon />
                        <Typography>Group</Typography>
                      </Stack>
                    </Button>
                    
                    <Button
                      variant={userType === 'Faculty' ? "contained" : "outlined"}
                      onClick={() => setUserType('Faculty')}
                      fullWidth
                      sx={{ height: 80 }}
                    >
                      <Stack alignItems="center">
                        <SchoolIcon />
                        <Typography>Faculty</Typography>
                      </Stack>
                    </Button>                  </Stack>
                </>
              )}

              {/* Reservation Code Input */}
              {borrowType === 'Reservation' && (
                <Box>
                  <Typography variant="h6" sx={{ mt: 2 }}>Enter Reservation Code</Typography>
                  <TextField
                    label="Reservation Code"
                    value={reservationCode}
                    onChange={(e) => setReservationCode(e.target.value)}
                    fullWidth
                    placeholder="Enter the reservation code"
                    onKeyDown={async (e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        setReservationLoading(true);
                        try {
                          await fetchReservationByCode(String(reservationCode || "").trim());
                        } finally {
                          setReservationLoading(false);
                        }
                      }
                    }}
                    InputProps={{
                      endAdornment: reservationLoading && (
                        <InputAdornment position="end">
                          <CircularProgress size={20} />
                        </InputAdornment>
                      ),
                    }}
                  />
                  {currentReservation && (
                    <Paper sx={{ p: 2, mt: 2, bgcolor: "success.light" }}>
                      <Stack spacing={1}>
                        <Typography variant="body2" color="success.dark" fontWeight="medium">
                          ✓ Reservation Found: {currentReservation.reservation_code}
                        </Typography>
                        <Typography variant="body2" color="success.dark">
                          Program: {currentReservation.course} | Instructor: {currentReservation.instructor}
                        </Typography>
                        <Typography variant="body2" color="success.dark">
                          Items: {currentReservation.assigned_items?.length || 0} assigned items
                        </Typography>
                        <Typography variant="body2" color="success.dark">
                          Status: {currentReservation.status}
                        </Typography>
                      </Stack>
                    </Paper>
                  )}
                </Box>
              )}
            </Stack>
          )}

          {/* Step 1: Borrower Info (for Walk-In and Reservation) */}
          {activeStep === 1 && (borrowType === 'Walk-In' || borrowType === 'Reservation') && (
            <Stack spacing={2}>
              {/* Show Borrower Name only for Individual (Walk-In or Reservation) */}
              {userType !== 'Group' && (
                <TextField
                  label="Borrower Name"
                  value={requestForm.borrow_user}
                  onChange={(e) => setRequestForm({ ...requestForm, borrow_user: e.target.value })}
                  fullWidth
                  variant="outlined"
                  required
                />
              )}

              <TextField
                label="Program"
                value={requestForm.course}
                onChange={(e) => setRequestForm({ ...requestForm, course: e.target.value })}
                fullWidth
                variant="outlined"
                required
              />
              
              <TextField
                label="Instructor"
                value={requestForm.instructor}
                onChange={(e) => setRequestForm({ ...requestForm, instructor: e.target.value })}
                fullWidth
                required
              />
              
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Subject"
                  value={requestForm.subject}
                  onChange={(e) => setRequestForm({ ...requestForm, subject: e.target.value })}
                  fullWidth
                  required
                />
                <TextField
                  label="Schedule"
                  value={requestForm.schedule}
                  onChange={(e) => setRequestForm({ ...requestForm, schedule: e.target.value })}
                  fullWidth
                  required
                />
              </Stack>

              {userType === 'Group' && (
                <Stack spacing={2}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField
                      label="Group Number"
                      value={requestForm.group_number}
                      onChange={(e) => setRequestForm({ ...requestForm, group_number: e.target.value })}
                      fullWidth
                      required
                    />
                    <TextField
                      label="Leader ID"
                      value={requestForm.group_leader_id}
                      onChange={(e) => setRequestForm({ ...requestForm, group_leader_id: e.target.value })}
                      fullWidth
                      required
                    />
                    <TextField
                      label="Group Leader"
                      value={requestForm.group_leader}
                      onChange={(e) => setRequestForm({ ...requestForm, group_leader: e.target.value })}
                      fullWidth
                      required
                    />
                  </Stack>

                  {/* Group Members Section (reservation may have prefilled members) */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ mt: 1 }}>Group Members</Typography>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {groupMembers.map((gm, idx) => (
                        <Stack key={idx} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
                          <TextField
                            label={`Member Name #${idx + 1}`}
                            value={gm.name}
                            onChange={(e) => updateGroupMember(idx, { name: e.target.value })}
                            fullWidth
                            size="small"
                          />
                          <TextField
                            label="Student ID"
                            value={gm.id}
                            onChange={(e) => updateGroupMember(idx, { id: e.target.value })}
                            sx={{ width: 180 }}
                            size="small"
                          />
                          <Button color="error" onClick={() => removeGroupMember(idx)} sx={{ whiteSpace: 'nowrap' }}>Remove</Button>
                        </Stack>
                      ))}
                      <Button variant="outlined" onClick={addGroupMember} startIcon={<AddIcon />}>Add Member</Button>
                    </Stack>
                  </Box>
                </Stack>
              )}
            </Stack>
          )}

          {/* Step 2: Item Selection (Same for both Walk-In and Reservation) */}
          {activeStep === 2 && (
            <Box>
              {borrowType === 'Reservation' && currentReservation && (
                <Paper sx={{ p: 2, mb:  3, bgcolor: "success.light" }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <CheckCircleIcon color="success" />
                    <Typography variant="h6" color="success.dark">
                      Reservation Items Pre-loaded
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="success.dark" sx={{ mt: 1 }}>
                    Items from your reservation have been pre-selected. You can modify quantities or add/remove items as needed.
                  </Typography>
                </Paper>
              )}

              <Stack direction="row" spacing={2} mb={3} alignItems="center">
                {/* filters/search - unchanged */}
                <FormControl sx={{ minWidth: 180 }}>
                  <InputLabel>Filter Items</InputLabel>
                  <Select
                    value={itemType}
                    label="Filter Items"
                    onChange={(e) => setItemType(e.target.value as any)}
                  >
                    <MenuItem value="all">All Items</MenuItem>
                    <MenuItem value="non-consumable">Non-Consumable</MenuItem>
                    <MenuItem value="consumable">Consumable</MenuItem>
                  </Select>
                </FormControl>
                
                <TextField
                  placeholder="Search items..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  variant="outlined"
                  size="small"
                  sx={{ flex: 1 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Stack>

              <Box sx={{ display: 'flex', gap: 2 }}>
                {/* Left: Items list */}
                <Box sx={{ flex: 2, maxHeight: 520, overflow: 'auto' }}>
                  {/* Barcode/Search input - unchanged */}
                  <TextField
                    inputRef={barcodeInputRef}
                    placeholder="Scan barcode or type identifier..."
                    value={barcodeSearch}
                    onChange={(e) => setBarcodeSearch(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleBarcodeSearch(barcodeSearch);
                      }
                    }}
                    variant="outlined"
                    size="small"
                    fullWidth
                    sx={{ mb: 3 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon color="primary" />
                        </InputAdornment>
                      ),
                      endAdornment: barcodeSearch && (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setBarcodeSearch("")}><ClearIcon /></IconButton>
                        </InputAdornment>
                      )
                    }}
                  />

                  {itemsLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : filteredItems.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" textAlign="center" py={3}>
                      No items found
                    </Typography>
                  ) : (
                    <Stack spacing={2}>
                      {filteredItems.map((item) => {
                        const cartItem = selectedItems.find(i => i.num === item.num && i.item_type === item.item_type);
                        const currentQty = cartItem ? cartItem.qty : 0;
                        
                        return (
                          <Paper key={`${item.num}-${item.item_type}`} sx={{ p: 2 }}>
                            <Stack direction="row" spacing={2} alignItems="center">
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body1" fontWeight="medium">{item.equipment_name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {item.brand_model && `${item.brand_model} • `}
                                  {item.location && `Location: ${item.location} • `}
                                  Available: {item.available}
                                  {item.is_consumable && " • Consumable"}
                                </Typography>
                                
                                {item.identifiers && item.identifiers.length > 0 && (
                                  <Typography variant="caption" display="block" color="text.secondary">
                                    Identifiers: {item.identifiers.join(", ")}
                                  </Typography>
                                )}
                              </Box>
                              
                              <Stack direction="row" spacing={1} alignItems="center">
                                <IconButton size="small" onClick={() => updateItemQty(item.num, -1, item.available, item.equipment_name, item.is_consumable)} disabled={currentQty === 0}>-</IconButton>
                                <Typography sx={{ minWidth: 30, textAlign: 'center' }}>{currentQty}</Typography>
                                <IconButton size="small" onClick={() => updateItemQty(item.num, 1, item.available, item.equipment_name, item.is_consumable)} disabled={currentQty >= item.available}>+</IconButton>
                              </Stack>
                            </Stack>
                          </Paper>
                        );
                      })}
                    </Stack>
                  )}
                </Box>

                {/* Right: POS-style Cart */}
                <Box sx={{ width: 360, position: 'relative' }}>
                  <Paper sx={{ p: 2, position: 'sticky', top: 16 }}>
                    <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                      <ShoppingCartIcon color="primary" />
                      <Typography variant="h6">Cart</Typography>
                      <Chip label={selectedItems.length} color="primary" size="small" />
                    </Stack>

                    <Stack spacing={1}>
                      {selectedItems.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">No items selected</Typography>
                      ) : selectedItems.map(item => {
                          const glow = item.num === newlyAddedItemNum;
                          return (
                            <Paper key={`${item.num}-${item.item_type}`} sx={{
                              p: 1,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              transition: 'box-shadow 300ms, transform 300ms',
                              boxShadow: glow ? '0 0 18px rgba(59,130,246,0.55)' : 'none',
                              transform: glow ? 'translateY(-2px)' : 'none',
                              bgcolor: glow ? 'rgba(59,130,246,0.03)' : 'inherit'
                            }}>
                              <Box>
                                <Typography variant="body2" fontWeight="medium">{item.name}</Typography>
                                {item.selected_identifiers && item.selected_identifiers.length > 0 && (
                                  <Typography variant="caption" color="text.secondary">IDs: {item.selected_identifiers.join(', ')}</Typography>
                                )}
                              </Box>
                              <Box>
                                <Typography variant="body2" textAlign="right">{item.qty}</Typography>
                                <Typography variant="caption" color="text.secondary">{item.is_consumable ? 'Consumable' : 'Non-Consumable'}</Typography>
                              </Box>
                            </Paper>
                          );
                        })}
                    </Stack>

                    <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                      <Button fullWidth variant="outlined" onClick={() => { setSelectedItems([]); setNewlyAddedItemNum(null); }}>Clear</Button>
                      <Button fullWidth variant="contained" onClick={handleNext} sx={{ bgcolor: '#b91c1c', '&:hover': { bgcolor: '#b91c1c.dark' }}}>Proceed</Button>
                    </Box>
                  </Paper>
                </Box>
              </Box>
            </Box>
          )}

          {/* Step 3: Confirmation */}
          {activeStep === 3 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {requestForm.borrow_id ? "Borrow Details" : "Borrow Request Summary"}
              </Typography>
              
              <Paper sx={{ p: 2, mb: 3, bgcolor: "grey.50" }}>
                <Typography variant="subtitle2" gutterBottom>Borrower Information</Typography>
                <Stack spacing={1}>
                  <Box sx={{ display: "flex" }}>
                    <Typography variant="body2" sx={{ minWidth: 120 }}>Type:</Typography>
                    <Typography variant="body2" fontWeight="medium">{borrowType} - {userType}</Typography>
                  </Box>
                  {borrowType === 'Reservation' && (
                    <Box sx={{ display: "flex" }}>
                      <Typography variant="body2" sx={{ minWidth: 120 }}>Reservation Code:</Typography>
                      <Typography variant="body2" fontWeight="medium">{reservationCode}</Typography>
                    </Box>
                  )}
                  <Box sx={{ display: "flex" }}>
                    <Typography variant="body2" sx={{ minWidth: 120 }}>Borrower:</Typography>
                    <Typography variant="body2" fontWeight="medium">{requestForm.borrow_user}</Typography>
                  </Box>
                  <Box sx={{ display: "flex" }}>
                    <Typography variant="body2" sx={{ minWidth: 120 }}>Program:</Typography>
                    <Typography variant="body2" fontWeight="medium">{requestForm.course}</Typography>
                  </Box>
                  {userType === 'Group' && (
                    <>
                      <Box sx={{ display: "flex" }}>
                        <Typography variant="body2" sx={{ minWidth: 120 }}>Group:</Typography>
                        <Typography variant="body2" fontWeight="medium">{requestForm.group_number}</Typography>
                      </Box>
                      <Box sx={{ display: "flex" }}>
                        <Typography variant="body2" sx={{ minWidth: 120 }}>Leader:</Typography>
                        <Typography variant="body2" fontWeight="medium">{requestForm.group_leader}</Typography>
                      </Box>
                      <Box sx={{ display: "flex" }}>
                        <Typography variant="body2" sx={{ minWidth: 120 }}>Leader ID:</Typography>
                        <Typography variant="body2" fontWeight="medium">{requestForm.group_leader_id}</Typography>
                      </Box>
                    </>
                  )}
                  <Box sx={{ display: "flex" }}>
                    <Typography variant="body2" sx={{ minWidth: 120 }}>Instructor:</Typography>
                    <Typography variant="body2" fontWeight="medium">{requestForm.instructor}</Typography>
                  </Box>
                  <Box sx={{ display: "flex" }}>
                    <Typography variant="body2" sx={{ minWidth: 120 }}>Subject:</Typography>
                    <Typography variant="body2" fontWeight="medium">{requestForm.subject}</Typography>
                  </Box>
                  <Box sx={{ display: "flex" }}>
                    <Typography variant="body2" sx={{ minWidth: 120 }}>Schedule:</Typography>
                    <Typography variant="body2" fontWeight="medium">{requestForm.schedule}</Typography>
                  </Box>
                  {/* Add return status information */}
                  <Box sx={{ display: "flex" }}>
                    <Typography variant="body2" sx={{ minWidth: 120 }}>Status:</Typography>
                    <Chip 
                      label={requestForm.status} 
                      size="small" 
                      color={
                        requestForm.status === "Returned" ? "success" : 
                        requestForm.status === "Partially Returned" ? "warning" : "error"
                      } 
                    />
                  </Box>
                  {requestForm.status === "Returned" && selectedBorrowForReturn?.date_returned && (
                    <Box sx={{ display: "flex" }}>
                      <Typography variant="body2" sx={{ minWidth: 120 }}>Date Returned:</Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {new Date(selectedBorrowForReturn.date_returned).toLocaleString()}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Paper>
              
              <Paper sx={{ p: 2, bgcolor: "grey.50" }}>
                <Typography variant="subtitle2" fontWeight="bold">
                  Items {requestForm.borrow_id ? "Details" : "to Borrow"}
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item</TableCell>
                      <TableCell align="right">Quantity</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Condition</TableCell>
                      <TableCell>Notes</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedItems.map((item: any) => (
                      <TableRow key={`${item.num}-${item.item_type}`}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {item.name}
                          </Typography>
                          {item.selected_identifiers && item.selected_identifiers.length > 0 && (
                            <Typography variant="caption" color="text.secondary">
                              IDs: {item.selected_identifiers.join(", ")}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">{item.qty}</TableCell>
                        <TableCell>
                          <Chip 
                            label={item.is_consumable ? "Consumable" : "Non-Consumable"} 
                            size="small" 
                            color={item.is_consumable ? "secondary" : "primary"}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={item.status || 'Borrowed'} 
                            size="small" 
                            color={
                              item.status === "Returned" ? "success" : 
                              item.status === "Partially Returned" ? "warning" : "default"
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={item.return_condition} 
                            size="small" 
                            color={
                              item.return_condition === "Good" ? "success" : 
                              item.return_condition === "Damaged" ? "warning" : 
                              item.return_condition === "Broken" ? "error" : "default"
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontSize="0.75rem">
                            {item.notes || '-'}
                            {item.damage_report && ` Damage: ${item.damage_report}`}
                            {item.lacking_items && ` Lacking: ${item.lacking_items}`}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            </Box>
          )}

          {error && (
            <Typography color="error" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}

          {/* Stepper Navigation */}
          <Box sx={{ display: "flex", justifyContent: "space-between", mt: 3 }}>
            <Button
              onClick={handleBack}
              disabled={activeStep === 0}
              sx={{ borderRadius: 2 }}
            >
              Back
            </Button>

            {activeStep === steps.length - 1 ? (
              <Button
                variant="contained"
                onClick={handleConfirmBorrow}
                disabled={saving}
                sx={{
                  bgcolor: "#b91c1c",
                  "&:hover": { bgcolor: "#b91c1c.dark" },
                  borderRadius: 2,
                  minWidth: 120,
                }}
              >
                {saving ? <CircularProgress size={24} /> : "Confirm"}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleNext}
                sx={{
                  bgcolor: "#b91c1c",
                  "&:hover": { bgcolor: "#b91c1c.dark" },
                  borderRadius: 2,
                  minWidth: 120,
                }}
              >
                Next
              </Button>
            )}
          </Box>
        </DialogContent>
      </Dialog>

      {/* Identifier Selection Dialog */}
      <Dialog 
        open={identifierDialogOpen} 
        onClose={() => setIdentifierDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Select Identifiers for {currentItem?.equipment_name}
          <Typography variant="body2" color="text.secondary">
            Available: {currentItem?.available} identifiers
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Select one or more identifiers (use Ctrl/Cmd for multiple selection):
          </Typography>
          
          <List sx={{ mt: 2, maxHeight: 300, overflow: "auto" }}>
            {currentItem?.identifiers?.map((identifier) => (
              <ListItem key={identifier} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  selected={selectedIdentifiers.includes(identifier)}
                  onClick={() => {
                    if (selectedIdentifiers.includes(identifier)) {
                      setSelectedIdentifiers(prev => prev.filter(id => id !== identifier));
                    } else if (selectedIdentifiers.length < (currentItem?.available || 0)) {
                      setSelectedIdentifiers(prev => [...prev, identifier]);
                    }
                  }}
                  sx={{
                    borderRadius: 1,
                    width: '100%',
                    "&.Mui-selected": {
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      "&:hover": {
                        bgcolor: alpha(theme.palette.primary.main, 0.2),
                      }
                    }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <Checkbox
                      edge="start"
                      checked={selectedIdentifiers.includes(identifier)}
                      tabIndex={-1}
                      disableRipple
                    />
                  </ListItemIcon>
                  <ListItemText 
                    primary={identifier} 
                    primaryTypographyProps={{ variant: "body2" }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          
          {selectedIdentifiers.length > 0 && (
            <Paper sx={{ p: 2, mt: 2, bgcolor: "grey.50" }}>
              <Typography variant="subtitle2" gutterBottom>
                Selected ({selectedIdentifiers.length}):
              </Typography>
              <Typography variant="body2">
                {selectedIdentifiers.join('; ')}
              </Typography>
            </Paper>
          )}
          
          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3, gap: 1 }}>
            <Button onClick={() => setIdentifierDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="contained" 
              onClick={handleAddWithIdentifiers}
              disabled={selectedIdentifiers.length === 0}
            >
              Add {selectedIdentifiers.length} Item(s)
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* AI Dialog */}
{/* AI Dialog */}
<Dialog 
  open={aiDialogOpen} 
  onClose={() => setAiDialogOpen(false)}
  maxWidth="md"
  fullWidth
>
  <DialogTitle>
    <Stack direction="row" spacing={1} alignItems="center">
      <AutoAwesomeIcon color="primary" />
      <Typography variant="h6">AI Borrow Report</Typography>
    </Stack>
  </DialogTitle>
  <DialogContent dividers>
    <Typography variant="body2" color="text.secondary" gutterBottom>
      Ask questions about borrow records, analyze patterns, or generate custom reports.
    </Typography>
    
    <Stack spacing={2} sx={{ mt: 2 }}>
      <TextField
        multiline
        rows={3}
        placeholder="e.g., Show me all borrow requests for ECE students this month
Which courses borrow the most equipment?
List overdue borrow requests
Show borrow trends by day of week
What's the average return time for different courses?"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        fullWidth
        variant="outlined"
      />
      
      <Button
        variant="contained"
        onClick={handleGenerateReport}
        disabled={loading || !question.trim()}
        startIcon={loading ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
      >
        {loading ? "Generating..." : "Generate Report"}
      </Button>
    </Stack>
    
    {reportText && (
      <Paper sx={{ p: 2, mt: 3, bgcolor: "grey.50" }}>
        <Typography variant="body2" whiteSpace="pre-wrap">
          {reportText}
        </Typography>
      </Paper>
    )}
    
    {reportTable && (
      <Box sx={{ mt: 3 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<PictureAsPdfIcon />}
            onClick={handleGeneratePDF2}
          >
            Generate PDF
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              setReportTable(null);
              setReportText("");
            }}
          >
            Clear Results
          </Button>
        </Stack>
        
        <Typography variant="subtitle2" gutterBottom>
          Report Results:
        </Typography>
        <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {reportTable.columns.map((col, index) => (
                  <TableCell key={index} sx={{ fontWeight: "bold" }}>
                    {col}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {reportTable.rows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <TableCell key={cellIndex}>{cell}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    )}
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setAiDialogOpen(false)}>Close</Button>
  </DialogActions>
</Dialog>
        <Dialog 
        open={reportDialogOpen} 
        onClose={() => setReportDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <PictureAsPdfIcon color="secondary" />
            <Typography variant="h6">Generate Borrow Records Report</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Select fields to include and apply filters to generate a custom borrow records report.
          </Typography>
          
          {/* Field Selection Section */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Select Fields to Include
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, maxHeight: 200, overflow: 'auto' }}>
              <Stack spacing={1}>
                {availableFields.map((field) => (
                  <Box key={field.field} sx={{ display: 'flex', alignItems: 'center' }}>
                    <Checkbox
                      checked={selectedFields.includes(field.field)}
                      onChange={() => handleFieldSelection(field.field)}
                      color="secondary"
                    />
                    <Typography variant="body2">
                      {field.label} ({field.type})
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Paper>
          </Box>

          {/* Filters Section */}
          <Box sx={{ mb: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold">
                Filters
              </Typography>
              <Button 
                variant="outlined" 
                size="small" 
                onClick={addFilter}
                startIcon={<AddIcon />}
              >
                Add Filter
              </Button>
            </Stack>

            <Stack spacing={2}>
              {reportFilters.map((filter, index) => (
                <Paper key={index} variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    {/* Field Select */}
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                      <InputLabel>Field</InputLabel>
                      <Select
                        value={filter.field}
                        label="Field"
                        onChange={(e) => updateFilter(index, { field: e.target.value })}
                      >
                        {availableFields.map((field) => (
                          <MenuItem key={field.field} value={field.field}>
                            {field.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {/* Operator Select */}
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                      <InputLabel>Operator</InputLabel>
                      <Select
                        value={filter.operator}
                        label="Operator"
                        onChange={(e) => updateFilter(index, { operator: e.target.value as any })}
                      >
                        {filter.field ? getOperatorsForField(
                          availableFields.find(f => f.field === filter.field)?.type || 'string'
                        ).map(op => (
                          <MenuItem key={op.value} value={op.value}>
                            {op.label}
                          </MenuItem>
                        )) : (
                          <MenuItem value="equals">Equals</MenuItem>
                        )}
                      </Select>
                    </FormControl>

                    {/* Value Input */}
                    <TextField
                      size="small"
                      label="Value"
                      value={filter.value}
                      onChange={(e) => updateFilter(index, { value: e.target.value })}
                      sx={{ flex: 1 }}
                      type={availableFields.find(f => f.field === filter.field)?.type === 'number' ? 'number' : 'text'}
                    />

                    {/* Remove Filter Button */}
                    <IconButton 
                      size="small" 
                      onClick={() => removeFilter(index)}
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setReportDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={generateCustomReport}
            disabled={selectedFields.length === 0}
            color="secondary"
            startIcon={<PictureAsPdfIcon />}
          >
            Generate PDF Report
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Borrow Dialog - read-only */}
      {viewDialogOpenBorrow && (
        <Dialog open={viewDialogOpenBorrow} onClose={() => setViewDialogOpenBorrow(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EventIcon sx={{ color: "#1976d2" }} />
              <Typography variant="h6">View Borrow Request</Typography>
            </Box>
          </DialogTitle>
          <DialogContent dividers>
            {viewBorrowRecord ? (
              <Stack spacing={2}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold">Borrow Details</Typography>
                  <Stack spacing={1}>
                    <Box sx={{ display: "flex" }}>
                      <Typography variant="body2" sx={{ minWidth: 120 }}>Borrow ID:</Typography>
                      <Typography variant="body2">{viewBorrowRecord.borrow_id || viewBorrowRecord._id}</Typography>
                    </Box>
                    <Box sx={{ display: "flex" }}>
                      <Typography variant="body2" sx={{ minWidth: 120 }}>Type:</Typography>
                      <Typography variant="body2">{viewBorrowRecord.borrow_type} - {viewBorrowRecord.user_type}</Typography>
                    </Box>
                    <Box sx={{ display: "flex" }}>
                      <Typography variant="body2" sx={{ minWidth: 120 }}>Borrower:</Typography>
                      <Typography variant="body2">{viewBorrowRecord.borrow_user}</Typography>
                    </Box>
                    <Box sx={{ display: "flex" }}>
                      <Typography variant="body2" sx={{ minWidth: 120 }}>Program:</Typography>
                      <Typography variant="body2">{viewBorrowRecord.course}</Typography>
                    </Box>
                    <Box sx={{ display: "flex" }}>
                      <Typography variant="body2" sx={{ minWidth: 120 }}>Group:</Typography>
                      <Typography variant="body2">{viewBorrowRecord.group_number || '-'}</Typography>
                    </Box>
                    <Box sx={{ display: "flex" }}>
                      <Typography variant="body2" sx={{ minWidth: 120 }}>Group Leader:</Typography>
                      <Typography variant="body2">{viewBorrowRecord.group_leader || '-'}</Typography>
                    </Box>
                    <Box sx={{ display: "flex" }}>
                      <Typography variant="body2" sx={{ minWidth: 120 }}>Leader ID:</Typography>
                      <Typography variant="body2">{viewBorrowRecord.group_leader_id || '-'}</Typography>
                    </Box>
                    <Box sx={{ display: "flex" }}>
                      <Typography variant="body2" sx={{ minWidth: 120 }}>Instructor:</Typography>
                      <Typography variant="body2">{viewBorrowRecord.instructor}</Typography>
                    </Box>
                    <Box sx={{ display: "flex" }}>
                      <Typography variant="body2" sx={{ minWidth: 120 }}>Subject:</Typography>
                      <Typography variant="body2">{viewBorrowRecord.subject}</Typography>
                    </Box>
                    <Box sx={{ display: "flex" }}>
                      <Typography variant="body2" sx={{ minWidth: 120 }}>Schedule:</Typography>
                      <Typography variant="body2">{viewBorrowRecord.schedule}</Typography>
                    </Box>
                    {/* Add return status information */}
                    <Box sx={{ display: "flex" }}>
                      <Typography variant="body2" sx={{ minWidth: 120 }}>Status:</Typography>
                      <Chip 
                        label={viewBorrowRecord.status} 
                        size="small" 
                        color={
                          viewBorrowRecord.status === "Returned" ? "success" : 
                          viewBorrowRecord.status === "Partially Returned" ? "warning" : "error"
                        } 
                      />
                    </Box>
                    {viewBorrowRecord.date_returned && (
                      <Box sx={{ display: "flex" }}>
                        <Typography variant="body2" sx={{ minWidth: 120 }}>Date Returned:</Typography>
                        <Typography variant="body2">
                          {new Date(viewBorrowRecord.date_returned).toLocaleString()}
                        </Typography>
                      </Box>
                    )}
                    <Box sx={{ display: "flex" }}>
                      <Typography variant="body2" sx={{ minWidth: 120 }}>Reservation Code:</Typography>
                      <Typography variant="body2">{viewBorrowRecord.reservation_code || '-'}</Typography>
                    </Box>
                    {/* Group Members */}
                    {viewBorrowRecord.group_members && viewBorrowRecord.group_members.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: "bold" }}>Group Members:</Typography>
                        <Stack spacing={0.5}>
                          {viewBorrowRecord.group_members.map((gm, idx) => (
                            <Typography key={idx} variant="body2">
                              {gm.name} ({gm.id})
                            </Typography>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Stack>
                    <Box sx={{ display: "flex", mt:3}}>
                      <Typography variant="body2" sx={{ minWidth: 120 }}><b>Managed by:</b></Typography>
                      <Typography variant="body2">{viewBorrowRecord.managed_name || viewBorrowRecord.managed_by || "Unknown"}</Typography>
                    </Box>
                </Paper>

                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold">Items</Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Item</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Condition</TableCell>
                        <TableCell>Notes</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {viewBorrowRecord.items.map(item => (
                        <TableRow key={item._id || `${item.item_id}-${item.item_name}`}>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">{item.item_name}</Typography>
                            {item.identifiers && item.identifiers.length > 0 && (
                              <Typography variant="caption" color="text.secondary">
                                IDs: {item.identifiers.map((id:any) => id.identifier).join(', ')}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">{item.quantity}</TableCell>
                          <TableCell>
                            <Chip 
                              label={item.item_type === "consumable" ? "Consumable" : "Non-Consumable"} 
                              size="small" 
                              color={item.item_type === "consumable" ? "secondary" : "primary"}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={item.status || 'Borrowed'} 
                              size="small" 
                              color={
                                item.status === "Returned" ? "success" : 
                                item.status === "Partially Returned" ? "warning" : "default"
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={item.return_condition} 
                              size="small" 
                              color={
                                item.return_condition === "Good" ? "success" : 
                                item.return_condition === "Damaged" ? "warning" : 
                                item.return_condition === "Broken" ? "error" : "default"
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontSize="0.75rem">
                              {item.notes || '-'}
                              {item.damage_report && ` Damage: ${item.damage_report}`}
                              {item.lacking_items && ` Lacking: ${item.lacking_items}`}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper> 
              </Stack>
            ) : (
              <Typography>No data</Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setViewDialogOpenBorrow(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Return Items Dialog */}
      <Dialog 
        open={returnDialogOpen} 
        onClose={() => setReturnDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <CheckCircleIcon color="success" />
            <Typography variant="h6">Return Items</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {selectedBorrowForReturn?.borrow_user} - {selectedBorrowForReturn?.course}
          </Typography>
        </DialogTitle>
        
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Report the condition of returned items and fill out necessary forms for damaged/lost items.
          </Typography>

          {returnForm.items.map((item, index) => (
            <Paper key={item.itemId} sx={{ p: 2, mb: 2 }}>
              <Stack spacing={2}>
                {/* Item Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {item.itemName}
                  </Typography>
                  <Chip 
                    label={item.itemType} 
                    size="small" 
                    color={item.itemType === 'consumable' ? 'secondary' : 'primary'}
                    variant="outlined"
                  />
                </Box>

                {/* Quantity Returned */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="body2">Quantity to Return:</Typography>
                  <TextField
                    type="number"
                    size="small"
                    value={item.returnedQty}
                    onChange={(e) => updateReturnItemCondition(index, { 
                      returnedQty: Math.max(0, Math.min(item.borrowedQty, parseInt(e.target.value) || 0))
                    })}
                    inputProps={{ min: 0, max: item.borrowedQty }}
                    sx={{ width: 80 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    / {item.borrowedQty} borrowed
                  </Typography>
                </Box>

                {/* Condition Selection */}
                <FormControl fullWidth size="small">
                  <InputLabel>Condition</InputLabel>
                  <Select
                    value={item.condition}
                    label="Condition"
                    onChange={(e) => updateReturnItemCondition(index, { condition: e.target.value })}
                  >
                    <MenuItem value="Good">Good</MenuItem>
                    <MenuItem value="Damaged">Damaged</MenuItem>
                    <MenuItem value="Broken">Broken</MenuItem>
                    <MenuItem value="Lost">Lost</MenuItem>
                    <MenuItem value="Lacking">Lacking</MenuItem>
                  </Select>
                </FormControl>

                {/* Condition-specific forms */}
                {(item.condition === 'Damaged' || item.condition === 'Broken') && (
                  <TextField
                    label="Damage/Breakage Report"
                    multiline
                    rows={3}
                    value={item.damageReport}
                    onChange={(e) => updateReturnItemCondition(index, { damageReport: e.target.value })}
                    fullWidth
                    placeholder="Describe the damage or breakage in detail..."
                  />
                )}

                {item.condition === 'Lacking' && (
                  <TextField
                    label="Lacking Items Report"
                    multiline
                    rows={2}
                    value={item.lackingItems}
                    onChange={(e) => updateReturnItemCondition(index, { lackingItems: e.target.value })}
                    fullWidth
                    placeholder="Specify what items are missing or incomplete..."
                  />
                )}

                {item.condition === 'Lost' && (
                  <TextField
                    label="Loss Report"
                    multiline
                    rows={2}
                    value={item.damageReport}
                    onChange={(e) => updateReturnItemCondition(index, { damageReport: e.target.value })}
                    fullWidth
                    placeholder="Provide details about the loss..."
                  />
                )}

                {/* General Notes */}
                <TextField
                  label="Additional Notes"
                  multiline
                  rows={2}
                  value={item.notes}
                  onChange={(e) => updateReturnItemCondition(index, { notes: e.target.value })}
                  fullWidth
                  placeholder="Any additional comments..."
                />

                {/* Identifier Selection for Non-Consumables */}
                {item.itemType === 'non-consumable' && selectedBorrowForReturn && (
                  <FormControl fullWidth size="small">
                    <InputLabel>Returned Identifiers</InputLabel>
                    <Select
                      multiple
                      value={item.returnedIdentifiers || []}
                      label="Returned Identifiers"
                      onChange={(e) => updateReturnItemCondition(index, { 
                        returnedIdentifiers: e.target.value 
                      })}
                      renderValue={(selected) => selected.join(', ')}
                    >
                      {selectedBorrowForReturn.items
                        .find(borrowItem => borrowItem._id === item.itemId)
                        ?.identifiers?.map(identifier => (
                          <MenuItem key={identifier.identifier} value={identifier.identifier}>
                            <Checkbox checked={item.returnedIdentifiers?.includes(identifier.identifier) || false} />
                            <ListItemText primary={identifier.identifier} />
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                )}
              </Stack>
            </Paper>
          ))}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setReturnDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="success" 
            onClick={handleSubmitReturn}
            startIcon={<CheckCircleIcon />}
          >
            Confirm Return
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}