// src/pages/InventoryPage.tsx
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { keyframes } from "@mui/system";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import FilterListIcon from "@mui/icons-material/FilterList";
import XLSX from 'xlsx-js-style';
import {
  Box,
  Button,
  Card,
  Container,
  Dialog,
  Checkbox,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableContainer,
  DialogActions,
  TableRow,
  TextField,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  Chip,
  alpha,
  useTheme,
  InputAdornment,
  CircularProgress,
  Backdrop,
  FormControl,
  Select,
  MenuItem,
  InputLabel
} from "@mui/material";
import axios from "axios";
import { useEffect, useState } from "react";
import Loader from "../components/Loader";
import { useSearchParams } from "react-router-dom";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
const API_BASE_URL = "https://elams.sit.ubaguio.edu/api";
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userRole = user?.role || "Custodian";

interface InventoryItem {
  num: string;
  identifier_type: string;
  identifiers: string[]; 
  statuses: string[];    // array for per-quantity identifiers
  equipment_name: string;
  facility: string;
  brand_model: string;
  total_qty: string;
  borrowed: string;
  // structured location
  room?: string;
  shelf_no?: string;
  soft_hard: string;
  e_location: string;
  bat_type: string;
  bat_qty: string;
  bat_total: string;
  yes_or_no: string;
  preventive_or_calibration: string;
  inhouse_outsourced:string;
  month: string;

  // <-- new utilization fields
  total_usage_minutes?: number;
  usage_logs?: {
    // added identifier and borrow_id to match server payload
    borrow_id?: string | any;
    identifier?: string;
    minutes?: number;
    borrowed_at?: string | Date | null;
    returned_at?: string | Date | null;
    borrow_record_ref?: string;
    managed_by?: string;
  }[];
}

interface CInventoryItem {
  num: string;
  location: string;
  description: string;
  quantity_opened: string;
  quantity_unopened: string;
  quantity_on_order: string;
  remarks: string;
  experiment: string;
  subject: string;
  date_issued: string;
  issuance_no: string;
  stock_alert: string;
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

const InventoryPage = () => {
  const [reportModalOpen, setReportModalOpen] = useState(false);
const [premadeReportDialogOpen, setPremadeReportDialogOpen] = useState(false);
const [selectedReportTemplate, setSelectedReportTemplate] = useState("");
  const theme = useTheme();
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
const [selectedFields, setSelectedFields] = useState<string[]>([]);
const [reportFilters, setReportFilters] = useState<ReportFilter[]>([]);
const [availableFields, setAvailableFields] = useState<ReportField[]>([]);
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [cinventory, setCInventory] = useState<CInventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [lowStockOpen, setLowStockOpen] = useState(false);
  const [lowStockSearch, setLowStockSearch] = useState("");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [searchParams, setSearchParams] = useSearchParams();
  const [sortBy, setSortBy] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const queryType = searchParams.get("stock"); 
  // Add these states near other useState declarations (around aiDialogOpen / question / reportText)
const [aiDialogOpen, setAiDialogOpen] = useState(false);
const [question, setQuestion] = useState("");
const [reportText, setReportText] = useState("");
const [reportTable, setReportTable] = useState<{ columns: string[]; rows: string[][] } | null>(null);
const [utilDialogOpen, setUtilDialogOpen] = useState(false); // <-- new
const [borrowInfo, setBorrowInfo] = useState<Record<string, { borrowerName: string; course: string }>>({});

// Add small date formatter helper near other helpers
const formatDate = (d?: string | Date | null) => {
  if (!d) return '-';
  try { return new Date(d).toLocaleString(); } catch (e) { return String(d); }
};

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };
  
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  const blink = keyframes`
    0% { box-shadow: 0 0 0px ${alpha(theme.palette.warning.main, 0.5)}; }
    50% { box-shadow: 0 0 16px ${alpha(theme.palette.warning.main, 0.8)}; }
    100% { box-shadow: 0 0 0px ${alpha(theme.palette.warning.main, 0.5)}; }
  `;

  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [itemType, setItemType] = useState("Non-Consumable");
  const [battery, setBattery] = useState("Without Battery");
  
  const [form, setForm] = useState<InventoryItem>({
    num: "",
    identifier_type: "None",
    identifiers: [],       
    statuses: [],
    equipment_name: "",
    facility: "",
    brand_model: "",
    total_qty: "1",
    borrowed: "0",
    // structured location
    room: "",
    shelf_no: "",
    soft_hard: "N/A",
    e_location: "",
    bat_type: "",
    bat_qty: "",
    bat_total: "",
    yes_or_no: "NO",
    preventive_or_calibration: "",
    inhouse_outsourced: "",
    month: ""
  });

  const getAvailableFields = (): ReportField[] => {
  if (itemType === "Non-Consumable") {
    return [
      { field: 'equipment_name', label: 'Equipment Name', type: 'string' },
      { field: 'brand_model', label: 'Brand/Model', type: 'string' },
      { field: 'facility', label: 'Facility', type: 'string' },
      { field: 'room', label: 'Room', type: 'string' },
      { field: 'shelf_no', label: 'Shelf No.', type: 'string' },
      { field: 'total_qty', label: 'Total Quantity', type: 'number' },
      { field: 'borrowed', label: 'Borrowed', type: 'number' },
      { field: 'soft_hard', label: 'Manual Type', type: 'string' },
      { field: 'bat_type', label: 'Battery Type', type: 'string' },
      { field: 'bat_qty', label: 'Battery Quantity', type: 'number' },
      { field: 'identifier_type', label: 'Identifier Type', type: 'string' },
      { field: 'yes_or_no', label: 'Has Maintenance', type: 'string' },
      { field: 'preventive_or_calibration', label: 'Maintenance Type', type: 'string' },
      { field: 'inhouse_outsourced', label: 'Service Type', type: 'string' },
      { field: 'month', label: 'Maintenance Month', type: 'string' }
    ];
  } else {
    return [
      { field: 'description', label: 'Description', type: 'string' },
      { field: 'location', label: 'Location', type: 'string' },
      { field: 'quantity_opened', label: 'Quantity Opened', type: 'number' },
      { field: 'quantity_unopened', label: 'Quantity Unopened', type: 'number' },
      { field: 'quantity_on_order', label: 'Quantity On Order', type: 'number' },
      { field: 'remarks', label: 'Remarks', type: 'string' },
      { field: 'experiment', label: 'Experiment', type: 'string' },
      { field: 'subject', label: 'Subject', type: 'string' },
      { field: 'date_issued', label: 'Date Issued', type: 'date' },
      { field: 'issuance_no', label: 'Issuance No.', type: 'string' },
      { field: 'stock_alert', label: 'Stock Alert', type: 'number' }
    ];
  }
};

// Add this useEffect to update available fields when item type changes
useEffect(() => {
  setAvailableFields(getAvailableFields());
  setSelectedFields([]);
  setReportFilters([]);
}, [itemType]);

// Add this function to handle field selection
const handleFieldSelection = (field: string) => {
  setSelectedFields(prev => 
    prev.includes(field) 
      ? prev.filter(f => f !== field)
      : [...prev, field]
  );
};

// Add this function to add a new filter
const addFilter = () => {
  setReportFilters(prev => [...prev, { field: '', operator: 'equals', value: '' }]);
};

// Add this function to remove a filter
const removeFilter = (index: number) => {
  setReportFilters(prev => prev.filter((_, i) => i !== index));
};

// Add this function to update a filter
const updateFilter = (index: number, updates: Partial<ReportFilter>) => {
  setReportFilters(prev => prev.map((filter, i) => 
    i === index ? { ...filter, ...updates } : filter
  ));
};




const excelReportTemplates = {
  availability: {
    name: "Availability of Items Report",
    generate: (data: any[], itemType: string) => {
      if (itemType === "Non-Consumable") {
        const headers = ["Equipment Name", "Total Quantity", "Borrowed", "Available", "Status"];
        const rows = data.map(item => {
          const total = parseInt(item.total_qty) || 0;
          const borrowed = parseInt(item.borrowed) || 0;
          const available = total - borrowed;
          const status = available === 0 ? "All Borrowed" : available === total ? "All Available" : "Partially Available";
          return [item.equipment_name, total, borrowed, available, status];
        });
        return { headers, rows };
      } else {
        const headers = ["Description", "Quantity Opened", "Quantity Unopened", "Total Stock", "Status"];
        const rows = data.map(item => {
          const opened = parseInt(item.quantity_opened) || 0;
          const unopened = parseInt(item.quantity_unopened) || 0;
          const total = opened + unopened;
          const status = opened === 0 ? "Unopened Only" : total > 0 ? "In Stock" : "Out of Stock";
          return [item.description, opened, unopened, total, status];
        });
        return { headers, rows };
      }
    }
  },
  maintenance: {
    name: "Maintenance Schedule Report",
    generate: (data: any[]) => {
      const headers = ["Equipment Name", "Brand/Model", "Maintenance Type", "Service Type", "Maintenance Month", "Status"];
      const rows = data
        .filter(item => item.yes_or_no === "YES")
        .map(item => [
          item.equipment_name,
          item.brand_model,
          item.preventive_or_calibration || "N/A",
          item.inhouse_outsourced || "N/A",
          item.month || "N/A",
          "Pending"
        ]);
      return { headers, rows };
    }
  },
  lowstock: {
    name: "Low Stock Alert Report",
    generate: (data: any[], itemType: string) => {
      if (itemType === "Consumable") {
        const headers = ["Description", "Location", "Current Stock", "Alert Level", "Status"];
        const rows = data
          .filter(item => {
            const alert = parseInt(item.stock_alert) || 5;
            const stock = parseInt(item.quantity_opened) || 0;
            return stock <= alert;
          })
          .map(item => [
            item.description,
            item.location,
            parseInt(item.quantity_opened) || 0,
            parseInt(item.stock_alert) || 5,
            "⚠️ Low Stock"
          ]);
        return { headers, rows };
      } else {
        const headers = ["Equipment Name", "Total Quantity", "Borrowed", "Status"];
        const rows = data
          .filter(item => {
            const total = parseInt(item.total_qty) || 0;
            const borrowed = parseInt(item.borrowed) || 0;
            return borrowed >= total;
          })
          .map(item => [
            item.equipment_name,
            parseInt(item.total_qty) || 0,
            parseInt(item.borrowed) || 0,
            "⚠️ All Borrowed"
          ]);
        return { headers, rows };
      }
    }
  },
  fullinventory: {
    name: "Full Inventory Report",
    generate: (data: any[], itemType: string) => {
      if (itemType === "Non-Consumable") {
        const headers = ["Equipment Name", "Brand/Model", "Location", "Total Quantity", "Borrowed", "Facility", "Identifier Type"];
        const rows = data.map(item => [
          item.equipment_name,
          item.brand_model,
          item.location,
          parseInt(item.total_qty) || 0,
          parseInt(item.borrowed) || 0,
          item.facility,
          item.identifier_type
        ]);
        return { headers, rows };
      } else {
        const headers = ["Description", "Location", "Opened", "Unopened", "On Order", "Remarks", "Stock Alert"];
        const rows = data.map(item => [
          item.description,
          item.location,
          parseInt(item.quantity_opened) || 0,
          parseInt(item.quantity_unopened) || 0,
          parseInt(item.quantity_on_order) || 0,
          item.remarks,
          parseInt(item.stock_alert) || 5
        ]);
        return { headers, rows };
      }
    }
  }
};

const generateCustomExcelReport = () => {
  const data = itemType === "Non-Consumable" ? inventory : cinventory;
  
  // Apply filters
  let filteredData = data.filter(item => {
    return reportFilters.every(filter => {
      if (!filter.field || !filter.value) return true;
      
      const fieldValue = item[filter.field as keyof typeof item];
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
  const headers = selectedFields.map(field => {
    const fieldInfo = availableFields.find(f => f.field === field);
    return fieldInfo?.label || field;
  });

  const rows = filteredData.map(item => 
    selectedFields.map(field => {
      const value = item[field as keyof typeof item];
      return value === null || value === undefined ? '' : String(value);
    })
  );

  const reportTitle = `Custom Report - ${itemType} Inventory`;
  generateExcelWithHeader(headers, rows, "Custom_Report", reportTitle);
  setReportDialogOpen(false);
};

// Add function for AI Report Excel generation
const generateAIExcelReport = (columns: string[], rows: string[][]) => {
 const reportTitle = `AI Generated Report - ${itemType} Inventory`;
  generateExcelWithHeader(columns, rows, "AI_Report", reportTitle);
};

const generateExcelWithHeader = (headers: string[], rows: any[][], sheetName: string, reportTitle?: string) => {
  const currentYear = new Date().getFullYear();
  const schoolYear = `${currentYear}-${currentYear + 1}`;
  
  const title = reportTitle || "Availability of Required Laboratory Materials for each Laboratory Course and Related Learning Experience";
  
  // Create the data array
  const allData = [
    [""], // Row 1: Will use IMAGE formula for logo
    ["Central Supply Room"],
    ["General Luna Road, Baguio City, Philippines 2600"],
    [""],
    [title],
    ["BS-Electronics-Engineering Program"],
    [`SCHOOL YEAR ${schoolYear}`],
    [""],
    [""],
    headers,
    ...rows
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(allData);
  const lastColIndex = headers.length - 1;
  
  // Merge cells
  ws['!merges'] = [];
  // Row 0 (Logo) - merge across all columns
  ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: lastColIndex } });
  // Rows 1-6 - merge across all columns
  for (let i = 1; i <= 6; i++) {
    ws['!merges'].push({ s: { r: i, c: 0 }, e: { r: i, c: lastColIndex } });
  }
  
  // Add IMAGE formula for logo in row 1 (index 0) centered across all columns
  const logoCell = XLSX.utils.encode_cell({ r: 0, c: 0 });
  ws[logoCell] = { t: 'n', v: '', f: 'IMAGE("https://ubaguio.edu/wp-content/uploads/2023/07/LOGO-NAME_for-light-BG.png", 1)' };
  
  // Set row height for logo
  ws['!rows'] = [];
  ws['!rows'][0] = { hpt: 42 };
  
  // Set column widths
  ws['!cols'] = [{ wch: 35 }, ...Array(lastColIndex).fill({ wch: 15 })];
  
  // Page setup for portrait orientation
  ws['!pageSetup'] = {
    orientation: 'portrait',
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
    scale: 85,
  };
  
  // Apply styles
  for (let R = 0; R < allData.length; R++) {
    for (let C = 0; C <= lastColIndex; C++) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellAddress]) {
        ws[cellAddress] = { t: 's', v: '' };
      }
      
      if (R === 0) {
        ws[cellAddress].s = {
          alignment: { horizontal: "center", vertical: "center" }
        };
      } else if (R === 1) {
        ws[cellAddress].s = {
          alignment: { horizontal: "center", vertical: "center" },
          font: { bold: true, sz: 14 }
        };
      } else if (R === 2) {
        ws[cellAddress].s = {
          alignment: { horizontal: "center", vertical: "center" },
          font: { sz: 10 }
        };
      } else if (R === 3) {
        ws[cellAddress].s = {
          alignment: { horizontal: "center", vertical: "center" }
        };
      } else if (R === 4) {
        ws[cellAddress].s = {
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          font: { bold: true, sz: 11 }
        };
      } else if (R === 5) {
        ws[cellAddress].s = {
          alignment: { horizontal: "center", vertical: "center" },
          font: { bold: true, sz: 11 }
        };
      } else if (R === 6) {
        ws[cellAddress].s = {
          alignment: { horizontal: "center", vertical: "center" },
          font: { bold: true, sz: 11 }
        };
      } else if (R === 7 || R === 8) {
        ws[cellAddress].s = {
          alignment: { horizontal: "center", vertical: "center" }
        };
      } else if (R === 9) {
        ws[cellAddress].s = {
          alignment: { horizontal: "center", vertical: "center" },
          font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
          fill: { fgColor: { rgb: "B71C1C" } },
          border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" }
          }
        };
      } else if (R >= 10) {
        ws[cellAddress].s = {
          alignment: { horizontal: "left", vertical: "center" },
          font: { sz: 9 },
          border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" }
          }
        };
      }
    }
  }
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  
  const date = new Date().toISOString().split('T')[0];
  const filename = `${sheetName.replace(/ /g, '_')}_${date}.xlsx`;
  XLSX.writeFile(wb, filename);
};


const handleGeneratePremadeExcel = () => {
  if (!selectedReportTemplate) return;
  
  const template = excelReportTemplates[selectedReportTemplate as keyof typeof excelReportTemplates];
  if (!template) return;
  
  const data = itemType === "Non-Consumable" ? inventory : cinventory;
  const { headers, rows } = template.generate(data, itemType);
  
  let reportTitle = "";
  switch(selectedReportTemplate) {
    case "availability":
      reportTitle = "Availability of Required Laboratory Materials for each Laboratory Course and Related Learning Experience";
      break;
    case "maintenance":
      reportTitle = "Maintenance Schedule Report";
      break;
    case "lowstock":
      reportTitle = "Low Stock Alert Report";
      break;
    case "fullinventory":
      reportTitle = "Full Inventory Report";
      break;
    default:
      reportTitle = template.name;
  }
  
  generateExcelWithHeader(headers, rows, template.name, reportTitle);
  
  setPremadeReportDialogOpen(false);
  setSelectedReportTemplate("");
};


// Add this function to get operators for a field type
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

  const [form2, setForm2] = useState<CInventoryItem>({
    num: "",
    location: "",
    description: "",
    quantity_opened: "0",
    quantity_unopened: "0",
    quantity_on_order: "0",
    remarks: "",
    experiment: "",
    subject: "",
    date_issued: "",
    issuance_no: "",
    stock_alert: "5"
  });

  const initialFormNC: InventoryItem = {
    num: "",
    identifier_type: "Control Number",
    identifiers: [],
    statuses: [],
    equipment_name: "",
    facility: "",
    brand_model: "",
    total_qty: "1",
    borrowed: "0",
    // structured location
    room: "",
    shelf_no: "",
    soft_hard: "N/A",
    e_location: "",
    bat_type: "",
    bat_qty: "",
    bat_total: "",
    yes_or_no: "NO",
    preventive_or_calibration: "",
    inhouse_outsourced: "",
    month: ""
  };

  const initialFormC = {
    num: "",
    description: "",
    location: "",
    quantity_opened: "0",
    quantity_unopened: "0",
    quantity_on_order: "0",
    remarks: "",
    experiment: "",
    subject: "",
    date_issued: "",
    issuance_no: "",
    stock_alert: "5"
  };
// Add this function near your other handler functions
// Update the handleGenerateReport function to handle responses with additional text:
const handleGenerateReport = async () => {
  if (!question.trim()) {
    setReportText("Please enter a question first.");
    return;
  }

  setLoading(true);
  setReportText("");
  setReportTable(null);

  try {
    console.log("Sending AI report request:", {
      question,
      itemType,
      API_BASE_URL
    });

    const res = await axios.post(`${API_BASE_URL}/ai-report`, {
      question: question,
      itemType: itemType
    }, {
      timeout: 30000 // 30 second timeout
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

  const handleEditClick = (item: InventoryItem | CInventoryItem) => {
      resetForm();
    if (itemType === "Non-Consumable") {
      const nc = item as InventoryItem;
      // prefer server-provided room/shelf_no; fallback to legacy location
      setForm({ ...nc, room: (nc.room || (nc as any).location || ""), shelf_no: (nc.shelf_no || (nc as any).shelfNo || "") });

      if (nc.bat_type || nc.bat_qty) {
        setBattery("With Battery");
      } else {
        setBattery("Without Battery");
      }
    } else {
      const c = item as CInventoryItem;
      setForm2({ ...c });
    }
    setOpen(false);
    setViewing(false);

    setEditing(true);
    setViewing(false);
    setOpen(true);
  };

  const fieldStyle = {
    mt: 2,
    "& .MuiInputBase-input.Mui-disabled": {
      WebkitTextFillColor: "#333",
      color: "#333",
    },
    "& .MuiOutlinedInput-root.Mui-disabled": {
      backgroundColor: "#f5f5f5",
    },
  };

const filteredInventory = inventory
  .filter((item) =>
    [item.equipment_name, item.room, item.shelf_no, item.brand_model].some((field) =>
      String(field || "").toLowerCase().includes(searchQuery.toLowerCase())
    )
  )
  .sort((a, b) => {
    if (sortBy === "equipment_name") {
      return a.equipment_name.localeCompare(b.equipment_name);
    }
    return 0;
  });

const filteredCInventory = cinventory
  .filter((item) =>
    [item.description, item.location, item.remarks].some((field) =>
      String(field || "").toLowerCase().includes(searchQuery.toLowerCase())
    )
  )
  .sort((a, b) => {
    if (sortBy === "description") {
      return a.description.localeCompare(b.description);
    }
    return 0;
  });

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (itemType === "Non-Consumable") {
      if (!form.equipment_name?.trim()) newErrors.equipment_name = "Name is required";
    } else {
      if (!form2.description?.trim()) newErrors.description = "Description is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleViewClick = (item: InventoryItem | CInventoryItem) => {
    if (itemType === "Non-Consumable") {
      const nc = item as InventoryItem;
      setForm({ ...nc, room: (nc.room || (nc as any).location || ""), shelf_no: (nc.shelf_no || (nc as any).shelfNo || "") });

      if ((item as InventoryItem).bat_type || (item as InventoryItem).bat_qty) {
        setBattery("With Battery");
      } else {
        setBattery("Without Battery");
      }
    } else {
      setForm2(item as CInventoryItem);
    }

    setViewing(true);
    setEditing(false);
    setOpen(true);
  };

  const resetForm = () => {
    setEditing(false);
    setViewing(false);
    if (itemType === "Non-Consumable") {
      setForm(initialFormNC);
    } else {
      setForm2(initialFormC);
    }
  };

  useEffect(() => {
    const qty = Number(form.total_qty) || 0;
    const newStatuses = Array.from({ length: qty }, (_, i) =>
      form.statuses?.[i] || "good"
    );
    setForm((prev) => ({ ...prev, statuses: newStatuses }));
  }, [form.total_qty]);

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
  

  const fetchInventory = async () => {
  setLoading(true);
  try {
    const endpoint = itemType === "Non-Consumable" ? "nc-inventory" : "c-inventory";
    
    // Replace Google Apps Script call:
    // const response = await axios.get(API_URL, {
    //   params: { sheet, action: "read" },
    // });

    // With MongoDB call:
    const response = await axios.post(`${API_BASE_URL}/${endpoint}`, {
      action: "read"
    });
    
    const result = response.data;
    if (result.success) {
      const data = result.data;
      
      if (itemType === "Non-Consumable") {
        const parsed: InventoryItem[] = data.map((item: any) => ({
          num: item.equipment_num.toString(), // Convert to string to match your interface
          equipment_name: item.equipment_name,
          facility: item.facility,
          brand_model: item.brand_model,
          total_qty: item.total_qty?.toString() || "0",
          borrowed: item.borrowed?.toString() || "0",
          identifier_type: item.identifier_type,
          identifiers: item.identifiers || [],
          statuses: item.statuses || [],
          // read structured room/shelf_no when available, fallback to legacy `location`
          room: item.room || item.location || "",
          shelf_no: item.shelf_no || item.shelfNo || "",
          soft_hard: item.soft_hard,
          e_location: item.e_location,
          bat_type: item.bat_type,
          bat_qty: item.bat_qty?.toString() || "",
          bat_total: item.bat_total?.toString() || "",
          yes_or_no: item.yes_or_no,
          preventive_or_calibration: item.preventive_or_calibration,
          inhouse_outsourced: item.inhouse_outsourced,
          month: item.month,
          // <-- map utilization fields returned by server
          total_usage_minutes: item.total_usage_minutes ?? 0,
          usage_logs: Array.isArray(item.usage_logs) ? item.usage_logs.map((l: any) => ({
            borrow_id: l.borrow_id ?? l.borrow_id?._id ?? l.borrow_record_ref ?? l.borrow_id ?? '',
            identifier: l.identifier ?? l.identifier_number ?? l.id ?? l.serial ?? null,
            minutes: l.minutes ?? 0,
            borrowed_at: l.borrowed_at ?? l.date_borrowed ?? null,
            returned_at: l.returned_at ?? l.date_returned ?? null,
            borrow_record_ref: l.borrow_record_ref ?? (l.borrow_id ? String(l.borrow_id) : '') ?? '',
            managed_by: l.managed_by ?? l.processed_by ?? ''
          })) : []
        }));
        setInventory(parsed);
      } else {
        const parsed: CInventoryItem[] = data.map((item: any) => ({
          num: item.item_num.toString(), // Convert to string to match your interface
          location: item.location,
          description: item.description,
          quantity_opened: item.quantity_opened?.toString() || "0",
          quantity_unopened: item.quantity_unopened?.toString() || "0",
          quantity_on_order: item.quantity_on_order?.toString() || "0",
          remarks: item.remarks,
          experiment: item.experiment,
          subject: item.subject,
          date_issued: item.date_issued,
          issuance_no: item.issuance_no,
          stock_alert: item.stock_alert?.toString() || "5",
        }));
        setCInventory(parsed);
      }
    }
  } catch (err) {
    console.error("Failed to fetch inventory", err);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    fetchInventory();
  }, [itemType]);

const handleCreate = async () => {
  setProcessing(true);
  try {
    if (itemType === "Non-Consumable") {
      const totalQty = Number(form.total_qty) || 0;
      const identifiers = form.identifiers.slice(0, totalQty);

      // FIXED: Remove .join(",") - send arrays directly
      const res = await axios.post(`${API_BASE_URL}/nc-inventory`, {
        action: "create",
        equipment_name: form.equipment_name,
        facility: form.facility,
        brand_model: form.brand_model,
        total_qty: Number(form.total_qty) || 1,
        borrowed: Number(form.borrowed) || 0,
        identifier_type: form.identifier_type,
        identifiers: identifiers,
        statuses: form.statuses,
        // structured location
        room: form.room || "",
        shelf_no: form.shelf_no || "",
        soft_hard: form.soft_hard,
        e_location: form.e_location,
        bat_type: form.bat_type,
        bat_qty: Number(form.bat_qty) || 0,
        bat_total: Number(form.bat_total) || 0,
        yes_or_no: form.yes_or_no,
        preventive_or_calibration: form.preventive_or_calibration,
        inhouse_outsourced: form.inhouse_outsourced,
        month: form.month,
      });

      const inventoryNum = res.data.data.equipment_num;

      // Create maintenance records if needed
      if (form.month && form.month.trim() !== "") {
        for (let id of identifiers) {
          await axios.post(`${API_BASE_URL}/maintenance`, {
            action: "create",
            equipment_num: inventoryNum,
            equipment_name: form.equipment_name,
            brand_model: form.brand_model,
            identifier_type: form.identifier_type,
            identifier_number: id,
            month: form.month,
          });
        }
      }

      setForm(initialFormNC);
      fetchInventory();
    } else {
      await axios.post(`${API_BASE_URL}/c-inventory`, {
        action: "create",
        location: form2.location,
        description: form2.description,
        quantity_opened: Number(form2.quantity_opened) || 0,
        quantity_unopened: Number(form2.quantity_unopened) || 0,
        quantity_on_order: Number(form2.quantity_on_order) || 0,
        remarks: form2.remarks,
        experiment: form2.experiment,
        subject: form2.subject,
        date_issued: form2.date_issued,
        issuance_no: form2.issuance_no,
        stock_alert: Number(form2.stock_alert) || 5,
      });

      setForm2(initialFormC);
      fetchInventory();
    }

    setOpen(false);
  } catch (err: any) {
    console.error("Failed to create item", err);
    console.error("Error details:", err.response?.data);
    alert(`Failed to create item: ${err.response?.data?.error || err.message}`);
  } finally {
    setProcessing(false);
  }
};

const handleDelete = async (item: any) => {
  const endpoint = itemType === "Non-Consumable" ? "nc-inventory" : "c-inventory";
  const name = itemType === "Non-Consumable" ? item.equipment_name : item.description;

  if (!window.confirm(`Are you sure you want to delete "${name}"`)) return;

  try {
    // Replace Google Apps Script call:
    // await axios.get(API_URL, {
    //   params: {
    //     sheet,
    //     action: "delete",
    //     num: item.num,
    //   },
    // });

    // With MongoDB call:
    await axios.post(`${API_BASE_URL}/${endpoint}`, {
      action: "delete",
      num: Number(item.num), // Convert to number for MongoDB
    });

    fetchInventory();
  } catch (err) {
    console.error("Failed to delete item", err);
  }
};

const handleUpdateItem = async () => {
  setProcessing(true);
  try {
    if (itemType === "Non-Consumable") {
      const totalQty = Number(form.total_qty) || 0;
      const trimmedIdentifiers = form.identifiers.slice(0, totalQty);

      // FIXED: Remove .join(",") - send arrays directly
      await axios.post(`${API_BASE_URL}/nc-inventory`, {
        action: "update",
        num: Number(form.num),
        equipment_name: form.equipment_name,
        facility: form.facility,
        brand_model: form.brand_model,
        total_qty: Number(form.total_qty) || 1,
        borrowed: Number(form.borrowed) || 0,
        identifier_type: form.identifier_type,
        identifiers: trimmedIdentifiers,
        statuses: form.statuses,
        // structured location
        room: form.room || "",
        shelf_no: form.shelf_no || "",
        soft_hard: form.soft_hard,
        e_location: form.e_location,
        bat_type: form.bat_type,
        bat_qty: Number(form.bat_qty) || 0,
        bat_total: Number(form.bat_total) || 0,
        yes_or_no: form.yes_or_no,
        preventive_or_calibration: form.preventive_or_calibration,
        inhouse_outsourced: form.inhouse_outsourced,
        month: form.month,
      });

      setForm(initialFormNC);
      fetchInventory();
    } else {
      await axios.post(`${API_BASE_URL}/c-inventory`, {
        action: "update",
        num: Number(form2.num),
        location: form2.location,
        description: form2.description,
        quantity_opened: Number(form2.quantity_opened) || 0,
        quantity_unopened: Number(form2.quantity_unopened) || 0,
        quantity_on_order: Number(form2.quantity_on_order) || 0,
        remarks: form2.remarks,
        experiment: form2.experiment,
        subject: form2.subject,
        date_issued: form2.date_issued,
        issuance_no: form2.issuance_no,
        stock_alert: Number(form2.stock_alert) || 5,
      });

      setForm2(initialFormC);
      fetchInventory();
    }

    setOpen(false);
    setEditing(false);
  } catch (err: any) {
    console.error("Failed to update item", err);
    console.error("Error details:", err.response?.data);
    alert(`Failed to update item: ${err.response?.data?.error || err.message}`);
  } finally {
    setProcessing(false);
  }
};

  useEffect(() => {
    const queryType = searchParams.get("stock");
    if (queryType === "Alert") {
      setItemType("Consumable");
    }
  }, [searchParams]);

  useEffect(() => {
    fetchInventory();
  }, []);

  // populate borrowInfo when utilization dialog opens
useEffect(() => {
  if (!utilDialogOpen) {
    setBorrowInfo({});
    return;
  }

  const logs = form.usage_logs || [];
  const keys = new Set<string>();
  logs.forEach((l: any) => {
    if (l.borrow_id) keys.add(String(l.borrow_id));
    if (l.borrow_record_ref) keys.add(String(l.borrow_record_ref));
    if (l._id) keys.add(String(l._id));
  });

  if (keys.size === 0) {
    setBorrowInfo({});
    return;
  }

  let mounted = true;
  (async () => {
    try {
      // fetch all borrow records once
      const resp = await axios.get(`${API_BASE_URL}/borrow-records`);
      const borrows: any[] = Array.isArray(resp.data) ? resp.data : (resp.data.data || []);

      const map: Record<string, { borrowerName: string; course: string }> = {};

      for (const b of borrows) {
        const idStr = b._id ? String(b._id) : null;
        const bidStr = (typeof b.borrow_id !== 'undefined' && b.borrow_id !== null) ? String(b.borrow_id) : null;
        const refStr = b.borrow_record_ref ? String(b.borrow_record_ref) : null;

        const borrowerName = b.borrow_user || b.group_leader || b.managed_name || '-';
        const course = b.course || '-';

        if (idStr && keys.has(idStr)) map[idStr] = { borrowerName, course };
        if (bidStr && keys.has(bidStr)) map[bidStr] = { borrowerName, course };
        if (refStr && keys.has(refStr)) map[refStr] = { borrowerName, course };
      }

      // for any missing keys, try per-id fetch (best-effort)
      const missing = Array.from(keys).filter(k => !map[k]);
      if (missing.length > 0) {
        await Promise.all(missing.map(async (k) => {
          try {
            const r = await axios.get(`${API_BASE_URL}/borrow-records/${k}`).catch(() => null);
            const bRec = r?.data;
            if (bRec) {
              map[k] = { borrowerName: bRec.borrow_user || bRec.group_leader || bRec.managed_name || '-', course: bRec.course || '-' };
            }
          } catch (e) {
            // ignore
          }
        }));
      }

      if (mounted) setBorrowInfo(map);
    } catch (err) {
      console.error('Failed to load borrow records for utilization view', err);
      if (mounted) setBorrowInfo({});
    }
  })();

  return () => { mounted = false; };
}, [utilDialogOpen, form.usage_logs]);

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Backdrop
        sx={{ color: "#fff",zIndex: (theme) => theme.zIndex.modal + 1,  }}
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
        <Typography variant="h4" fontWeight="bold" color="#b91c1c" gutterBottom>
          Inventory Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage equipment and consumable inventory
        </Typography>
      </Box>
      {/* Item Type Toggle */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={2}>
        <ToggleButtonGroup
          value={itemType}
          exclusive
          fullWidth
          sx={{
            mb: 2,
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <ToggleButton
            value="Non-Consumable"
            selected={itemType === "Non-Consumable"}
            onClick={() => setItemType("Non-Consumable")}
            sx={{
              flex: 1,
              height: 48,
              textTransform: "none",
              fontSize: "0.9rem",
              fontWeight: "bold",
              "&.Mui-selected": {
                bgcolor: "#b91c1c",
                color: "#fff",
                "&:hover": { bgcolor: "#b91c1c" },
              },
            }}
          >
            Non-Consumable
          </ToggleButton>

          <ToggleButton
            value="Consumable"
            selected={itemType === "Consumable"}
            onClick={() => setItemType("Consumable")}
            sx={{
              flex: 1,
              height: 48,
              textTransform: "none",
              fontSize: "0.9rem",
              fontWeight: "bold",
              "&.Mui-selected": {
                bgcolor: "#b91c1c",
                color: "#fff",
                "&:hover": { bgcolor: "#b91c1c" },
              },
            }}
          >
            Consumable
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      {/* Summary cards */}
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
    <Inventory2Icon sx={{ fontSize: 30, color: "#b91c1c" }} />
  </Box>
  <Box>
    <Typography variant="caption" color="text.secondary" fontWeight="medium">
      Total Items
    </Typography>
    <Typography variant="h4" sx={{ fontWeight: "bold", color: "#b91c1c" }}>
      {itemType === "Consumable" ? cinventory.length : inventory.length}
    </Typography>
  </Box>
</Card>


        {itemType === "Consumable" && (
          <Card
            onClick={() => {
              setLowStockOpen(true);
              if (searchParams.get("stock") === "Alert") {
                searchParams.delete("stock");
              } else {
                searchParams.set("stock", "Alert");
              }
              setSearchParams(searchParams);
            }}
            sx={{
              flex: 1,
              p: 3,
              borderRadius: 3,
              display: "flex",
              alignItems: "center",
              gap: 2,
              cursor: "pointer",
              background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)} 0%, ${alpha(theme.palette.warning.main, 0.2)} 100%)`,
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
              animation: queryType === "Alert" ? `${blink} 1.2s infinite ease-in-out` : "none",
              "&:hover": { boxShadow: 4 },
            }}
          >
            <Box sx={{ 
              p: 1.5, 
              borderRadius: "50%", 
              bgcolor: alpha(theme.palette.warning.main, 0.1),
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <WarningAmberIcon sx={{ fontSize: 30, color: theme.palette.warning.main }} />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight="medium">
                Low Stock
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: "bold", color: theme.palette.warning.main }}>
                {cinventory.filter((i) => {
                  const alert = Number(i.stock_alert) || 5;
                  const qtyOpened = Number(i.quantity_opened) || 0;
                  return qtyOpened <= alert;
                }).length}
              </Typography>
            </Box>
          </Card>
        )}

        {itemType === "Non-Consumable" && (
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
              <AssignmentTurnedInIcon sx={{ fontSize: 30, color: theme.palette.success.main }} />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight="medium">
                Borrowed
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: "bold", color: theme.palette.success.main }}>
                {inventory.reduce(
                  (acc, i) => acc + parseInt(i.borrowed || "0", 10),
                  0
                )}
              </Typography>
            </Box>
          </Card>
        )}
      </Stack>

      {/* Action Bar */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={3} justifyContent="space-between" alignItems="center">
  <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" sx={{ flex: 1 }}>
    <Box sx={{ maxWidth: 400, width: "100%" }}>
      <TextField
        placeholder="Search name, description, location, brand/model..."
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
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
    
    {/* Add this filter dropdown */}
    <TextField
      select
      label="Sort by"
      value={sortBy}
      onChange={(e) => setSortBy(e.target.value)}
      size="small"
      sx={{ minWidth: 150 }}
      SelectProps={{
        native: true,
      }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <FilterListIcon fontSize="small" />
          </InputAdornment>
        ),
      }}
    >
      <option value="">None</option>
      {itemType === "Non-Consumable" ? (
        <option value="equipment_name">Equipment Name</option>
      ) : (
        <option value="description">Description</option>
      )}
    </TextField>
  </Stack>
        
       <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
  {(userRole === "Custodian" || userRole === "Admin") && (
    <Button
      variant="contained"
      onClick={() => {
        setOpen(true);
        resetForm();
      }}
      sx={{
        bgcolor: "#b91c1c",
        "&:hover": { bgcolor: "#b91c1c" },
        borderRadius: 2,
        textTransform: "none",
        px: 3,
        fontWeight: "bold",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
      }}
    >
      + Add Item
    </Button>
  )}

  {(userRole === "Custodian" || userRole === "Admin") && (
    <Button
      variant="outlined"
      color="error"
      sx={{
        borderRadius: 2,
        textTransform: "none",
        px: 3,
        fontWeight: "bold",
      }}
      disabled={selectedItems.length === 0}
      onClick={async () => {
        const sheetName = itemType === "Non-Consumable" ? "nc_inventory" : "c_inventory";
        const names = selectedItems
          .map((num) => {
            const item = itemType === "Non-Consumable"
              ? inventory.find((i) => i.num === num)
              : cinventory.find((i) => i.num === num);
            return item
              ? itemType === "Non-Consumable"
                ? (item as InventoryItem).equipment_name
                : (item as CInventoryItem).description
              : null;
          })
          .filter(Boolean);

        if (!window.confirm(`Are you sure you want to delete the following items?\n\n${names.join("\n")}`))
          return;

        try {
          await Promise.all(
            selectedItems.map((num) =>
              axios.post(`${API_BASE_URL}/${sheetName === "nc_inventory" ? "nc-inventory" : "c-inventory"}`, {
                action: "delete",
                num: Number(num),
              })
            )
          );
          setSelectedItems([]);
          fetchInventory();
        } catch (err) {
          console.error("Failed to delete selected items", err);
        }
      }}
    >
      Delete Selected ({selectedItems.length})
    </Button>
  )}
  
  {/* Single Report Button that opens modal */}
  {(userRole === "Custodian" || userRole === "Admin") && (
    <Button
      variant="outlined"
      onClick={() => setReportModalOpen(true)}
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
      startIcon={<PictureAsPdfIcon />}
    >
      Reports
    </Button>
  )}
</Stack>
      </Stack>



      {/* Inventory Table */}
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
            <Loader />
          </Box>
        ) : (itemType === "Non-Consumable" ? inventory : cinventory).length === 0 ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
            <Typography variant="body2" color="text.secondary">
              No inventory items found.
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
                          selectedItems.length > 0 &&
                          selectedItems.length < (itemType === "Non-Consumable" ? inventory.length : cinventory.length)
                        }
                        checked={
                          (itemType === "Non-Consumable" ? inventory.length : cinventory.length) > 0 &&
                          selectedItems.length === (itemType === "Non-Consumable" ? inventory.length : cinventory.length)
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedItems((itemType === "Non-Consumable" ? inventory : cinventory).map((item) => item.num));
                          } else {
                            setSelectedItems([]);
                          }
                        }}
                        sx={{ color: "#b91c1c" }}
                      />
                    </TableCell>
                    {itemType === "Non-Consumable" ? (
                      <>
                        <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Name</TableCell>
                        <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Location</TableCell>
                        <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Brand/Model</TableCell>
                        <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Quantity</TableCell>
                        <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Borrowed</TableCell>
                        <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Facility</TableCell>
                        <TableCell align="center" sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Action</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Description</TableCell>
                        <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Location</TableCell>
                        <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Quantity Opened</TableCell>
                        <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Quantity Unopened</TableCell>
                        <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Remarks</TableCell>
                        <TableCell align="center" sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Action</TableCell>
                      </>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(itemType === "Non-Consumable" ? filteredInventory : filteredCInventory)
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((item) => (
                      <TableRow key={item.num} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedItems.includes(item.num)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedItems((prev) => [...prev, item.num]);
                              } else {
                                setSelectedItems((prev) => prev.filter((id) => id !== item.num));
                              }
                            }}
                            sx={{ color: "#b91c1c" }}
                          />
                        </TableCell>
                        {itemType === "Non-Consumable" ? (
                          <>
                            <TableCell>
                              <Typography variant="body2" fontWeight="medium">
                                {(item as InventoryItem).equipment_name}
                              </Typography>
                            </TableCell>
                            <TableCell>{(item as InventoryItem).room || '-'}</TableCell>
                            <TableCell>{(item as InventoryItem).brand_model || '-'}</TableCell>
                            <TableCell align="center">{(item as InventoryItem).total_qty}</TableCell>
                            <TableCell align="center">{(item as InventoryItem).borrowed}</TableCell>
                            <TableCell>{(item as InventoryItem).facility}</TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell>
                              <Typography variant="body2" fontWeight="medium">
                                {(item as CInventoryItem).description}
                              </Typography>
                            </TableCell>
                            <TableCell>{(item as CInventoryItem).location}</TableCell>
                            <TableCell align="center">
                              <Chip 
                                label={(item as CInventoryItem).quantity_opened} 
                                size="small" 
                                color={Number((item as CInventoryItem).quantity_opened) <= Number((item as CInventoryItem).stock_alert) ? "error" : "success"}
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell align="center">{(item as CInventoryItem).quantity_unopened}</TableCell>
                            <TableCell>{(item as CInventoryItem).remarks}</TableCell>
                          </>
                        )}
                        <TableCell>
                          <Stack direction="row" spacing={1} justifyContent="center">
                              <Tooltip title="View">
  <IconButton
    color="default"
    onClick={() => handleViewClick(item)}
   sx={actionIconBtnSx}
  >
   <VisibilityIcon fontSize="small" />
  </IconButton>
</Tooltip>
{(userRole === "Custodian" || userRole === "Admin") && (
  <Tooltip title="Update">
    <IconButton
      color="primary"
       onClick={() => handleEditClick(item)}
      sx={actionIconBtnSx}
    >
      <EditIcon fontSize="small" />
    </IconButton>
  </Tooltip>
)}

{(userRole === "Custodian" || userRole === "Admin") && (

  <Tooltip title="Delete">
    <IconButton
      color="error"
      onClick={() => handleDelete(item)}
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
              count={itemType === "Non-Consumable" ? filteredInventory.length : filteredCInventory.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              sx={{ borderTop: "1px solid", borderColor: "divider" }}
            />
          </>
        )}
      </Card>

<Dialog open={open} onClose={() => {
    setOpen(false);
    resetForm();
  }} maxWidth="lg" fullWidth>
<DialogTitle
  sx={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontWeight: "bold",
    color: "#B71C1C",
  }}
>
  {editing ? "Edit Item" : viewing ? "View Item" : "Add Item"}

  {/* Buttons on the same row */}
  <Box sx={{ display: "flex", gap: 1 }}>
    {viewing ? (
      <Box sx={{ display: 'flex', gap: 1 }}>
    {/* View Utilization - only enabled for non-consumable items with identifiers or usage logs */}
        <Button
      onClick={() => handleEditClick(form)}
      sx={{
        textTransform: "none",
        fontWeight: "bold",
        color: "#444",
        borderColor: alpha('#000', 0.06),
        "&:hover": { bgcolor: "rgba(0,0,0,0.04)" },
      }}
    >
      Edit
    </Button>

    <Button
      onClick={() => setUtilDialogOpen(true)}
      disabled={!(form?.identifiers && form.identifiers.length > 0) && !(form?.usage_logs && form.usage_logs.length > 0)}
      sx={{
        textTransform: "none",
        fontWeight: "bold",
        color: "#444",
        borderColor: alpha('#000', 0.06),
        "&:hover": { bgcolor: "rgba(0,0,0,0.04)" },
      }}
    >
      View Utilization
    </Button>

    <Button
      onClick={() => {
        setOpen(false);
        setViewing(false);
        resetForm();
      }}
      sx={{
        textTransform: "none",
        fontWeight: "bold",
        color: "#B71C1C",
        "&:hover": { bgcolor: "rgba(183,28,28,0.08)" },
      }}
    >
      Close
    </Button>
  </Box>
    ) : (
      <>
        <Button
          onClick={() => {
            setOpen(false);
            resetForm();
          }}
          sx={{
            textTransform: "none",
            fontWeight: "bold",
            color: "#B71C1C",
            "&:hover": { bgcolor: "rgba(183,28,28,0.08)" },
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
         // Update the Save/Update button onClick handler:
onClick={() => {
  if (!validateForm()) return;
  
  setProcessing(true); // Add this line to show the loading overlay
  editing ? handleUpdateItem() : handleCreate();
}}
          sx={{
            bgcolor: "#B71C1C",
            color: "#FFF",
            fontWeight: "bold",
            textTransform: "none",
            borderRadius: "8px",
            "&:hover": { bgcolor: "#D32F2F" },
          }}
        >
          {editing ? "Update" : "Save"}
        </Button>
      </>
    )}
  </Box>
</DialogTitle>
<DialogContent dividers>
  {itemType === "Non-Consumable" ? (// ==================================================
// NON-CONSUMABLE FORM (with Identifier Section)
// ==================================================
<Box sx={{ display: "flex", gap: 2 }}>
  {/* LEFT BOX */}
  <Box sx={{ flex: 1 }}>
    <Stack spacing={2}>
      {/* Item Type Selection */}
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 1 }}>
          Item Type
        </Typography>
        <ToggleButtonGroup
          value={itemType}
          exclusive
          onChange={(_, value) => value && setItemType(value)}
          fullWidth
          disabled={viewing}
        >
          <ToggleButton
            value="Non-Consumable"
            sx={{
              flex: 1,
              "&.Mui-selected": {
                bgcolor: "#B71C1C",
                color: "#FFF",
                "&:hover": { bgcolor: "#D32F2F" },
              },
            }}
          >
            Non-Consumable
          </ToggleButton>
          <ToggleButton
            value="Consumable"
            sx={{
              flex: 1,
              "&.Mui-selected": {
                bgcolor: "#B71C1C",
                color: "#FFF",
                "&:hover": { bgcolor: "#D32F2F" },
              },
            }}
          >
            Consumable
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* === Non-Consumable Fields === */}
      <TextField
        label="Name"
        value={form.equipment_name}
        onChange={(e) => setForm({ ...form, equipment_name: e.target.value })}
        fullWidth
        disabled={viewing}
        sx={fieldStyle}
        error={!!errors.equipment_name}
  helperText={errors.equipment_name}
      />
      <TextField
        label="Brand/Model"
        value={form.brand_model}
        onChange={(e) => setForm({ ...form, brand_model: e.target.value })}
        fullWidth
        disabled={viewing}
        sx={fieldStyle}
      />

      <Stack spacing={2} direction="row">
        <TextField
          label="Facility"
          value={form.facility}
          onChange={(e) => setForm({ ...form, facility: e.target.value })}
          fullWidth
          disabled={viewing}
          sx={fieldStyle}
        />
      </Stack>
      <Stack spacing={2} direction="row">
        <TextField
          label="Room"
          value={form.room || ""}
          onChange={(e) => setForm({ ...form, room: e.target.value })}
          fullWidth
          disabled={viewing}
          sx={fieldStyle}
        />
        <TextField
          label="Shelf No."
          value={form.shelf_no || ""}
          onChange={(e) => setForm({ ...form, shelf_no: e.target.value })}
          fullWidth
          disabled={viewing}
          sx={fieldStyle}
        />
      </Stack>

      <Stack spacing={2} direction="row">
        <TextField
          label="Total Quantity"
          type="number"
          value={form.total_qty}
          onChange={(e) =>
            setForm({ ...form, total_qty: e.target.value})
          }
          fullWidth
          disabled={viewing}
          sx={fieldStyle}
        />
      </Stack>
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 1 }}>
          Battery Information
        </Typography>
        <ToggleButtonGroup
          value={battery}
          exclusive
          onChange={(_, value) => value && setBattery(value)}
          fullWidth
          disabled={viewing}
        >
          <ToggleButton
            value="Without Battery"
            sx={{
              flex: 1,
              "&.Mui-selected": {
                bgcolor: "#B71C1C",
                color: "#FFF",
                "&:hover": { bgcolor: "#D32F2F" },
              },
            }}
          >
            Without Battery
          </ToggleButton>
          <ToggleButton
            value="With Battery"
            sx={{
              flex: 1,
              "&.Mui-selected": {
                bgcolor: "#B71C1C",
                color: "#FFF",
                "&:hover": { bgcolor: "#D32F2F" },
              },
            }}
          >
            With Battery
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {battery === "With Battery" && (
        <Stack spacing={2} direction="row">
          <TextField
            label="Battery Type"
            value={form.bat_type}
            onChange={(e) => setForm({ ...form, bat_type: e.target.value })}
            fullWidth
            variant="outlined"
            sx={fieldStyle}
            disabled={viewing}
          />
          <TextField
            label="Battery Quantity"
            type="number"
            value={form.bat_qty}
            onChange={(e) => setForm({ ...form, bat_qty: e.target.value })}
            fullWidth
            variant="outlined"
            sx={fieldStyle}
            disabled={viewing}
          />
        </Stack>
      )}

      {/* Equipment Manual */}
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 1 }}>
          Equipment Manual
        </Typography>
        <ToggleButtonGroup
          value={form.soft_hard}
          exclusive
          onChange={(_, value) => value && setForm({ ...form, soft_hard: value })}
          fullWidth
          disabled={viewing}
        >
          <ToggleButton value="Soft Copy" sx={{
              flex: 1,
              "&.Mui-selected": {
                bgcolor: "#B71C1C",
                color: "#FFF",
                "&:hover": { bgcolor: "#D32F2F" },
              },
            }}>
            Soft Copy
          </ToggleButton>
          <ToggleButton value="Hard Copy" sx={{
              flex: 1,
              "&.Mui-selected": {
                bgcolor: "#B71C1C",
                color: "#FFF",
                "&:hover": { bgcolor: "#D32F2F" },
              },
            }}>
            Hard Copy
          </ToggleButton>
          <ToggleButton value="N/A" sx={{
              flex: 1,
              "&.Mui-selected": {
                bgcolor: "#B71C1C",
                color: "#FFF",
                "&:hover": { bgcolor: "#D32F2F" },
              },
            }}>
            None
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {form.soft_hard !== "N/A" && (
        <Stack spacing={2} direction="row">
          {viewing && form.soft_hard === "Soft Copy" ? (
            <Typography
              component="a"
              href={form.e_location}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                mt: 2,
                display: "block",
                color: "primary.main",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              {form.e_location || "No link provided"}
            </Typography>
          ) : (
            <TextField
              label="Description"
              value={form.e_location}
              onChange={(e) => setForm({ ...form, e_location: e.target.value })}
              fullWidth
              variant="outlined"
              sx={fieldStyle}
              disabled={viewing}
            />
          )}
        </Stack>
      )}
    </Stack>
  </Box>

  {/* Divider between left and right */}
  <Divider orientation="vertical" flexItem />

  {/* RIGHT BOX */}
  <Box
    sx={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
    }}
  >
    <Stack spacing={2}>
      {/* Identifier Section */}
<Box>
  <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 1 }}>
    Maintenance Information
  </Typography>

  {/* Yes or No Maintenance */}
  <ToggleButtonGroup
    value={form.yes_or_no}
    exclusive
    onChange={(_, value) => {
      if (value) {
        setForm((prev) => ({ ...prev, yes_or_no: value }));
      }
    }}
    fullWidth
    disabled={viewing}
  >
    <ToggleButton
      value="NO"
      sx={{
        flex: 1,
        "&.Mui-selected": {
          bgcolor: "#B71C1C",
          color: "#FFF",
          "&:hover": { bgcolor: "#D32F2F" },
        },
      }}
    >
      Without Maintenance
    </ToggleButton>
    <ToggleButton
      value="YES"
      sx={{
        flex: 1,
        "&.Mui-selected": {
          bgcolor: "#B71C1C",
          color: "#FFF",
          "&:hover": { bgcolor: "#D32F2F" },
        },
      }}
    >
      With Maintenance
    </ToggleButton>
  </ToggleButtonGroup>

  {/* Show only if maintenance = yes */}
  {form.yes_or_no === "YES" && (
    <Box mt={2}>
      {/* Preventive / Calibration / Both */}
      <ToggleButtonGroup
        value={form.preventive_or_calibration}
        exclusive
        onChange={(_, value) => {
          if (value) {
            setForm((prev) => ({ ...prev, preventive_or_calibration: value }));
          }
        }}
        fullWidth
        disabled={viewing}
      >
        <ToggleButton value="PREVENTIVE">Preventive</ToggleButton>
        <ToggleButton value="CALIBRATION">Calibration</ToggleButton>
        <ToggleButton value="BOTH">Both</ToggleButton>
      </ToggleButtonGroup>
       <Box mt={2}>
      <ToggleButtonGroup
        value={form.inhouse_outsourced}
        exclusive
        onChange={(_, value) => {
          if (value) {
            setForm((prev) => ({ ...prev, inhouse_outsourced: value }));
          }
        }}
        fullWidth
        disabled={viewing}
      >
        <ToggleButton value="IN-HOUSE">IN-HOUSE</ToggleButton>
        <ToggleButton value="OUTSOURCE">OUTSOURCE</ToggleButton>
      </ToggleButtonGroup>
      </Box>
      {/* Month Selection */}
      <Box mt={2}>
        <ToggleButtonGroup
        disabled={viewing}
          value={form.month}
          exclusive
          onChange={(_, value) => {
            if (value) {
              setForm((prev) => ({ ...prev, month: value }));
            }
          }}
          fullWidth
        >
          {[
            "JAN","FEB","MAR","APR","MAY","JUN",
            "JUL","AUG","SEP","OCT","NOV","DEC",
          ].map((m) => (
            <ToggleButton key={m} value={m} sx={{ flex: 1 }}>
              {m.toUpperCase()}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
    </Box>
  )}
</Box>
    <Box>
  <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 1 }}>
    Identifier
  </Typography>

  {/* Toggle for type */}
  <ToggleButtonGroup
    value={form.identifier_type}
    exclusive
    onChange={(_, value) => {
      if (value) {
        setForm({
          ...form,
          identifier_type: value,
          identifiers: value === "None" ? [] : form.identifiers, // clear if None
        });
      }
    }}
    fullWidth
    disabled={viewing}
  >
    <ToggleButton
      value="Control Number"
      sx={{
        flex: 1,
        "&.Mui-selected": {
          bgcolor: "#B71C1C",
          color: "#FFF",
          "&:hover": { bgcolor: "#D32F2F" },
        },
      }}
    >
      Control
    </ToggleButton>
    <ToggleButton
      value="Serial Number"
      sx={{
        flex: 1,
        "&.Mui-selected": {
          bgcolor: "#B71C1C",
          color: "#FFF",
          "&:hover": { bgcolor: "#D32F2F" },
        },
      }}
    >
      Serial
    </ToggleButton>
    <ToggleButton
      value="Inventory Number"
      sx={{
        flex: 1,
        "&.Mui-selected": {
          bgcolor: "#B71C1C",
          color: "#FFF",
          "&:hover": { bgcolor: "#D32F2F" },
        },
      }}
    >
      Inventory
    </ToggleButton>
    <ToggleButton
      value="None"
      sx={{
        flex: 1,
        "&.Mui-selected": {
          bgcolor: "#9E9E9E",
          color: "#FFF",
          "&:hover": { bgcolor: "#757575" },
        },
      }}
    >
      None
    </ToggleButton>
  </ToggleButtonGroup>

  {/* Input fields for numbers */}
{form.identifier_type !== "None" && (
  <Stack spacing={2} sx={{ mt: 2 }}>
    {/* Header row */}
    <Stack direction="row" spacing={1} alignItems="center">
      <Box sx={{ flex: 1, fontWeight: "bold", color: "text.secondary" }}>
        {form.identifier_type || "Identifier"}
      </Box>
      <Box sx={{ width: 80, textAlign: "center", fontWeight: "bold", color: "text.secondary" }}>
        Status
      </Box>
    </Stack>


    {/* Rows */}
  {Array.from({ length: Number(form.total_qty) || 0 }).map((_, i) => (
  <Stack key={i} direction="row" spacing={1} alignItems="center">
    <TextField
      label={`${form.identifier_type || "Identifier"} ${i + 1}`}
      value={form.identifiers?.[i] || ""}
      onChange={(e) => {
        const newIdentifiers = [...(form.identifiers || [])];
        newIdentifiers[i] = e.target.value;
        setForm({ ...form, identifiers: newIdentifiers });
      }}
      fullWidth
      disabled={viewing}
      sx={fieldStyle}
    />

    {/* REPLACED: status select (text) instead of colored square */}
    <TextField
      select
      size="small"
      value={form.statuses?.[i] || 'good'}
      onChange={(e) => {
        const newStatuses = [...(form.statuses || [])];
        newStatuses[i] = e.target.value;
        setForm({ ...form, statuses: newStatuses });
      }}
      disabled={viewing}
      sx={{ width: 160, ml: 1 }}
      InputLabelProps={{ shrink: false }}
    >
      {['good', 'damaged', 'broken', 'lost', 'lacking'].map((s) => (
        <MenuItem key={s} value={s}>
          {s.charAt(0).toUpperCase() + s.slice(1)}
        </MenuItem>
      ))}
    </TextField>

    {/* Delete button */}
    {!viewing && (
      <IconButton
        onClick={() => {
          const newIdentifiers = [...(form.identifiers || [])];
          const newStatuses = [...(form.statuses || [])];
          newIdentifiers.splice(i, 1); // remove identifier at i
          newStatuses.splice(i, 1);   // remove status at i
          setForm({
            ...form,
            identifiers: newIdentifiers,
            statuses: newStatuses,
            total_qty: newIdentifiers.length.toString(),
          });
        }}
        size="small"
        sx={{ color: "#B71C1C" }}
      >
        <DeleteIcon fontSize="small" />
      </IconButton>
    )}
  </Stack>
))}
  </Stack>
)}

</Box>
    </Stack>
  </Box>
</Box>
) : (// ==================================================
// NON-CONSUMABLE FORM (cleaned with Stock Alert)
// ==================================================
<Box sx={{ display: "flex", gap: 2 }}>
  {/* LEFT BOX */}
  <Box sx={{ flex: 1 }}>
    <Stack spacing={2}>
      {/* Item Type Selection */}
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 1 }}>
          Item Type
        </Typography>
        <ToggleButtonGroup
          value={itemType}
          exclusive
          onChange={(_, value) => value && setItemType(value)}
          fullWidth
          disabled={viewing}
        >
          <ToggleButton
            value="Non-Consumable"
            sx={{
              flex: 1,
              "&.Mui-selected": {
                bgcolor: "#B71C1C",
                color: "#FFF",
                "&:hover": { bgcolor: "#D32F2F" },
              },
            }}
          >
            Non-Consumable
          </ToggleButton>
          <ToggleButton
            value="Consumable"
            sx={{
              flex: 1,
              "&.Mui-selected": {
                bgcolor: "#B71C1C",
                color: "#FFF",
                "&:hover": { bgcolor: "#D32F2F" },
              },
            }}
          >
            Consumable
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* === Non-Consumable Fields === */}
      <TextField
        label="Description"
        value={form2.description}
        onChange={(e) => setForm2({ ...form2, description: e.target.value })}
        fullWidth
        disabled={viewing}
        sx={fieldStyle}
        error={!!errors.description}
  helperText={errors.description}
      />

      <TextField
        label="Location"
        value={form2.location}
        onChange={(e) => setForm2({ ...form2, location: e.target.value })}
        fullWidth
        disabled={viewing}
        sx={fieldStyle}
      />

      {/* Quantity Fields */}
      <Stack spacing={2} direction="row">
        <TextField
          label="Quantity (Opened)"
          type="number"
          value={form2.quantity_opened}
          onChange={(e) =>
            setForm2({ ...form2, quantity_opened: e.target.value })
          }
          fullWidth
          disabled={viewing}
          sx={fieldStyle}
        />
        <TextField
          label="Quantity (Unopened)"
          type="number"
          value={form2.quantity_unopened}
          onChange={(e) =>
            setForm2({ ...form2, quantity_unopened: e.target.value })
          }
          fullWidth
          disabled={viewing}
          sx={fieldStyle}
        />
        <TextField
          label="Quantity (On Order)"
          type="number"
          value={form2.quantity_on_order}
          onChange={(e) =>
            setForm2({ ...form2, quantity_on_order: e.target.value })
          }
          fullWidth
          disabled={viewing}
          sx={fieldStyle}
        />
      </Stack>

      {/* Stock Alert */}
      <TextField
        label="Stock Alert"
        type="number"
        value={form2.stock_alert}
        onChange={(e) => setForm2({ ...form2, stock_alert: e.target.value })}
        fullWidth
        disabled={viewing}
        sx={{ ...fieldStyle, mt: 1 }}
      />
    </Stack>
  </Box>

  {/* Divider */}
  <Divider orientation="vertical" flexItem />

  <Box
   
    sx={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
    }}
  >
    <Stack spacing={2}>
      <TextField
        label="Date Issued"
        type="date"
        value={form2.date_issued}
        onChange={(e) =>
          setForm2({ ...form2, date_issued: e.target.value })
        }
        fullWidth
        disabled={viewing}
        InputLabelProps={{ shrink: true }}
        sx={fieldStyle}
      />
      <TextField
        label="Issuance No."
        value={form2.issuance_no}
        onChange={(e) =>
          setForm2({ ...form2, issuance_no: e.target.value })
        }
        fullWidth
        disabled={viewing}
        sx={fieldStyle}
      />
      <TextField
        label="Remarks"
        value={form2.remarks}
        onChange={(e) => setForm2({ ...form2, remarks: e.target.value })}
        fullWidth
        disabled={viewing}
        sx={fieldStyle}
      />
      <TextField
        label="Experiment"
        value={form2.experiment}
        onChange={(e) => setForm2({ ...form2, experiment: e.target.value })}
        fullWidth
        disabled={viewing}
        sx={fieldStyle}
      />
      <TextField
        label="Subject"
        value={form2.subject}
        onChange={(e) => setForm2({ ...form2, subject: e.target.value })}
        fullWidth
        disabled={viewing}
        sx={fieldStyle}
      />
    </Stack>
  </Box>
</Box>
)}
</DialogContent>

</Dialog>
<Dialog
  open={lowStockOpen}
  onClose={() => setLowStockOpen(false)}
  fullWidth
  maxWidth="lg"
>
  <DialogTitle sx={{ fontWeight: "bold", color: "#B71C1C" }}>
    Low Stock Items
  </DialogTitle>

  <DialogContent>
    {/* Search Bar */}
    <TextField
      placeholder="Search items..."
      value={lowStockSearch}
      onChange={(e) => setLowStockSearch(e.target.value)}
      fullWidth
      sx={{ mb: 2 }}
    />

    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell><b>Description</b></TableCell>
            <TableCell align="center"><b>Quantity (Opened)</b></TableCell>
            <TableCell align="center"><b>Quantity (Unopened)</b></TableCell>
            <TableCell align="center"><b>Quantity (On-Order)</b></TableCell>
            <TableCell align="center"><b>Stock Alert</b></TableCell>
            <TableCell align="center"><b>Actions</b></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {cinventory
            .filter(i => {
              const alert = Number(i.stock_alert) || 5;
              const qtyOpened = Number(i.quantity_opened) || 0;
              return qtyOpened <= alert;
            })
            .filter(i =>
              i.description?.toLowerCase().includes(lowStockSearch.toLowerCase()) ||
              i.location?.toLowerCase().includes(lowStockSearch.toLowerCase())
            )
            .map((row, idx) => (
              <TableRow key={idx}>
                <TableCell>{row.description}</TableCell>
                <TableCell align="center">{row.quantity_opened}</TableCell>
                <TableCell align="center">{row.quantity_unopened}</TableCell>
                <TableCell align="center">{row.quantity_on_order}</TableCell>
                <TableCell align="center">{row.stock_alert || 5}</TableCell>
                <TableCell align="center">
                  {/* same icons as your main table */}
    <Tooltip title="View">
  <IconButton
    color="default"
    onClick={() => handleViewClick(row)}
  sx={actionIconBtnSx}
  >
     <VisibilityIcon fontSize="small" />
  </IconButton>
</Tooltip>
                   <Tooltip title="Update">
    <IconButton
      color="primary"
       onClick={() => handleEditClick(row)}
      sx={actionIconBtnSx}
    >
      <EditIcon fontSize="small" />
    </IconButton>
  </Tooltip>

                <Tooltip title="Delete">
    <IconButton
      color="error"
      onClick={() => handleDelete(row)}
     sx={actionIconBtnSx}
    >
      <DeleteIcon fontSize="small" />
    </IconButton>
  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </TableContainer>
  </DialogContent>

  <DialogActions>
    <Button onClick={() => setLowStockOpen(false)}>Close</Button>
  </DialogActions>
</Dialog>

<Dialog 
  open={aiDialogOpen} 
  onClose={() => setAiDialogOpen(false)}
  maxWidth="md"
  fullWidth
>
  <DialogTitle>
    <Stack direction="row" spacing={1} alignItems="center">
      <AutoAwesomeIcon color="primary" />
      <Typography variant="h6">AI Report (MongoDB)</Typography>
    </Stack>
  </DialogTitle>
  <DialogContent dividers>
    <Typography variant="body2" color="text.secondary" gutterBottom>
      Ask questions about {itemType.toLowerCase()} inventory, borrow records, or generate custom reports.
    </Typography>
    
    <Stack spacing={2} sx={{ mt: 2 }}>
      <TextField
        multiline
        rows={3}
        placeholder={`e.g., Show me all ${itemType === "Non-Consumable" ? "equipment" : "consumables"} with low stock`}
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
    <Button
      variant="contained"
      startIcon={<PictureAsPdfIcon />}
      onClick={() => generateAIExcelReport(reportTable.columns, reportTable.rows)}
      sx={{ mb: 2 }}
      color="success"
    >
      Generate Excel Report
    </Button>
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
      <Typography variant="h6">Generate Custom Report</Typography>
    </Stack>
  </DialogTitle>
  <DialogContent dividers>
    <Typography variant="body2" color="text.secondary" gutterBottom>
      Select fields to include and apply filters to generate a custom report.
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
                {field.label}
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
    onClick={generateCustomExcelReport}
    disabled={selectedFields.length === 0}
    color="secondary"
    startIcon={<PictureAsPdfIcon />}
  >
    Generate Excel Report
  </Button>
</DialogActions>
</Dialog>

{/* Utilization Dialog */}
<Dialog
  open={utilDialogOpen}
  onClose={() => setUtilDialogOpen(false)}
  maxWidth="md"
  fullWidth
>
  <DialogTitle>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Inventory2Icon sx={{ color: "#b91c1c" }} />
      <Typography variant="h6" sx={{ color: "#b91c1c" }}>Utilization Details</Typography>
    </Box>
  </DialogTitle>

  <DialogContent dividers>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      Showing utilization logs grouped by identifier for: <strong>{form.equipment_name || '-'}</strong>
    </Typography>

    {(() => {
      const logs = form.usage_logs || [];
      const byId: Record<string, any[]> = {};
      // Group logs by explicit identifier or a placeholder for unidentified logs
      logs.forEach((l: any) => {
        const id = l.identifier ?? '__NO_IDENTIFIER__';
        if (!byId[id]) byId[id] = [];
        byId[id].push(l);
      });

      const idsToShow = (form.identifiers && form.identifiers.length > 0)
        ? form.identifiers
        : Object.keys(byId);

      if (!idsToShow || idsToShow.length === 0) {
        return <Typography variant="caption" color="text.secondary">No utilization logs available.</Typography>;
      }

      return (
        <Stack spacing={2}>
          {idsToShow.map((identifier: string, idx: number) => {
            const key = identifier ?? '__NO_IDENTIFIER__';
            const logsForId = byId[key] || [];
            const totalMinutes = logsForId.reduce((s, lg) => s + (Number(lg.minutes || 0)), 0);

            return (
              // Use native details/summary for a compact collapsible item
              <Paper key={idx} sx={{ p: 0 }}>
                <details style={{ padding: 12 }}>
                  <summary style={{ cursor: 'pointer', outline: 'none', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="subtitle2" component="span">
                        {identifier === '__NO_IDENTIFIER__' ? 'Unidentified / Item-level' : identifier}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {logsForId.length} log(s) • Total: {totalMinutes} min ({(totalMinutes / 60).toFixed(2)} hrs)
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">Expand</Typography>
                  </summary>

                  {/* Expanded content */}
                  <Box sx={{ mt: 2 }}>
                    {logsForId.length > 0 ? (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell><strong>Borrower (Course)</strong></TableCell>
                            <TableCell><strong>Borrowed At</strong></TableCell>
                            <TableCell><strong>Returned At</strong></TableCell>
                            <TableCell align="right"><strong>Minutes</strong></TableCell>
                            <TableCell><strong>Processed By</strong></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {logsForId.slice().reverse().map((log, i) => {
                            const idKey = log.borrow_id ? String(log.borrow_id) : String(log.borrow_record_ref || '');
                            const info = borrowInfo[idKey] || { borrowerName: '-', course: '-' };
                            const borrowerDisplay = `${info.borrowerName || '-'}${info.course ? ` • ${info.course}` : ''}`;
                            return (
                              <TableRow key={i}>
                                <TableCell>{borrowerDisplay}</TableCell>
                                <TableCell>{formatDate(log.borrowed_at)}</TableCell>
                                <TableCell>{formatDate(log.returned_at)}</TableCell>
                                <TableCell align="right">{log.minutes ?? 0}</TableCell>
                                <TableCell>{log.managed_by || '-'}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    ) : (
                      <Typography variant="caption" color="text.secondary">No logs for this identifier.</Typography>
                    )}
                  </Box>
                </details>
              </Paper>
            );
          })}
        </Stack>
      );
    })()}
  </DialogContent>

  <DialogActions>
    <Button onClick={() => setUtilDialogOpen(false)}>Close</Button>
  </DialogActions>
</Dialog>

{/* Main Report Selection Modal */}
<Dialog 
  open={reportModalOpen} 
  onClose={() => setReportModalOpen(false)}
  maxWidth="sm"
  fullWidth
>
  <DialogTitle sx={{ fontWeight: "bold", color: "#b91c1c" }}>
    <Stack direction="row" spacing={1} alignItems="center">
      <PictureAsPdfIcon />
      <Typography variant="h6">Generate Reports</Typography>
    </Stack>
  </DialogTitle>
  <DialogContent dividers>
    <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
      Choose a report type to generate
    </Typography>
    
    <Stack spacing={2}>
      {/* AI Report Button */}
      <Button
        fullWidth
        variant="outlined"
        onClick={() => {
          setReportModalOpen(false);
          setAiDialogOpen(true);
        }}
        sx={{
          justifyContent: "flex-start",
          p: 2,
          borderRadius: 2,  
          borderColor: "#1976d2",
          "&:hover": {
            bgcolor: "rgba(25, 118, 210, 0.04)",
            borderColor: "#1976d2"
          }
        }}
        startIcon={<AutoAwesomeIcon sx={{ color: "#1976d2" }} />}
      >
        <Stack direction="column" alignItems="flex-start" sx={{ ml: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">AI Report</Typography>
          <Typography variant="caption" color="text.secondary">
            Ask questions about inventory and get AI-powered insights
          </Typography>
        </Stack>
      </Button>

      {/* Generate Report (Premade) Button */}
      <Button
        fullWidth
        variant="outlined"
        onClick={() => {
          setReportModalOpen(false);
          setPremadeReportDialogOpen(true);
        }}
        sx={{
          justifyContent: "flex-start",
          p: 2,
          borderRadius: 2,
          borderColor: "#4caf50",
          "&:hover": {
            bgcolor: "rgba(76, 175, 80, 0.04)",
            borderColor: "#4caf50"
          }
        }}
        startIcon={<PictureAsPdfIcon sx={{ color: "#4caf50" }} />}
      >
        <Stack direction="column" alignItems="flex-start" sx={{ ml: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">Generate Report</Typography>
          <Typography variant="caption" color="text.secondary">
            Select from premade templates (Availability, Maintenance, etc.)
          </Typography>
        </Stack>
      </Button>

      {/* Custom Report Button */}
      <Button
        fullWidth
        variant="outlined"
        onClick={() => {
          setReportModalOpen(false);
          setReportDialogOpen(true);
        }}
        sx={{
          justifyContent: "flex-start",
          p: 2,
          borderRadius: 2,
          borderColor: "#ff9800",
          "&:hover": {
            bgcolor: "rgba(255, 152, 0, 0.04)",
            borderColor: "#ff9800"
          }
        }}
        startIcon={<FilterListIcon sx={{ color: "#ff9800" }} />}
      >
        <Stack direction="column" alignItems="flex-start" sx={{ ml: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">Custom Report</Typography>
          <Typography variant="caption" color="text.secondary">
            Select specific fields and apply filters
          </Typography>
        </Stack>
      </Button>
    </Stack>
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setReportModalOpen(false)}>Cancel</Button>
  </DialogActions>
</Dialog>


<Dialog 
  open={premadeReportDialogOpen} 
  onClose={() => {
    setPremadeReportDialogOpen(false);
    setSelectedReportTemplate("");
  }}
  maxWidth="md"
  fullWidth
>
  <DialogTitle>
    <Stack direction="row" spacing={1} alignItems="center">
      <PictureAsPdfIcon color="success" />
      <Typography variant="h6">Generate Excel Report - Select Template</Typography>
    </Stack>
  </DialogTitle>
  <DialogContent dividers>
    <Typography variant="body2" color="text.secondary" gutterBottom>
      Choose a report template to generate an Excel file with the official header
    </Typography>
    
    <Stack spacing={2} sx={{ mt: 2 }}>
      <FormControl fullWidth>
        <InputLabel>Select Report Type</InputLabel>
        <Select
          value={selectedReportTemplate}
          onChange={(e) => setSelectedReportTemplate(e.target.value)}
          label="Select Report Type"
        >
          <MenuItem value="availability">
            <Box>
              <Typography variant="subtitle2">📊 Availability of Items</Typography>
              <Typography variant="caption" color="text.secondary">
                Shows which items are available vs borrowed
              </Typography>
            </Box>
          </MenuItem>
          <MenuItem value="maintenance">
            <Box>
              <Typography variant="subtitle2">🔧 Maintenance Schedule</Typography>
              <Typography variant="caption" color="text.secondary">
                Equipment requiring maintenance
              </Typography>
            </Box>
          </MenuItem>
          <MenuItem value="lowstock">
            <Box>
              <Typography variant="subtitle2">⚠️ Low Stock Alert</Typography>
              <Typography variant="caption" color="text.secondary">
                Items below stock alert level
              </Typography>
            </Box>
          </MenuItem>
          <MenuItem value="fullinventory">
            <Box>
              <Typography variant="subtitle2">📋 Full Inventory Report</Typography>
              <Typography variant="caption" color="text.secondary">
                Complete list of all items
              </Typography>
            </Box>
          </MenuItem>
        </Select>
      </FormControl>
      
      {selectedReportTemplate && (
        <Paper sx={{ p: 2, bgcolor: "grey.50" }}>
          <Typography variant="body2">
            <strong>Preview:</strong> This report will include all {itemType.toLowerCase()} items.
          </Typography>
        </Paper>
      )}
    </Stack>
  </DialogContent>
  
  <DialogActions>
    <Button onClick={() => {
      setPremadeReportDialogOpen(false);
      setSelectedReportTemplate("");
    }}>
      Cancel
    </Button>
    <Button 
      variant="contained" 
      onClick={handleGeneratePremadeExcel}
      disabled={!selectedReportTemplate}
      color="success"
      startIcon={<PictureAsPdfIcon />}
    >
      Generate Excel Report
    </Button>
  </DialogActions>
</Dialog>
    </Container>
  );
};

export default InventoryPage;