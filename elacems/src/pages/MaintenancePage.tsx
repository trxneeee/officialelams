// src/pages/MaintenancePage.tsx
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EditIcon from "@mui/icons-material/Edit";
import EventIcon from "@mui/icons-material/Event";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import SearchIcon from "@mui/icons-material/Search";
import {
  Box,
  Card,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  TableContainer,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Button,
  Chip,
  alpha,
  useTheme,
  InputAdornment,
  CircularProgress,
  Backdrop,
  TablePagination,
  ToggleButton,
  ToggleButtonGroup,
  Snackbar,
  Alert,
  MenuItem,
  FormControlLabel,
  Checkbox
} from "@mui/material";
import axios from "axios";
import { useEffect, useState } from "react";
import Loader from "../components/Loader";
import NewMaintenanceForm from "../components/NewMaintenanceForm";
import type { NewMaintenanceItem } from "../components/NewMaintenanceForm";

const API_BASE_URL = "https://elams.sit.ubaguio.edu/api";

interface MaintenanceItem {
  num: string;
  equipment_num: string;
  equipment_name: string;
  brand_model: string;
  identifier_type: string;
  identifier_number: string;
  month: string;
  date_accomplished: string;
  accomplished_by: string;
  scheduledYear?: number;
  notes?: string; // optional raw notes JSON/string from server
}

const MaintenancePage = () => {
  const theme = useTheme();
  const [maintenance, setMaintenance] = useState<MaintenanceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [open, setOpen] = useState(false);
  // New record dialog state
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [viewMode, setViewMode] = useState<"current" | "all">("current");

  const [form, setForm] = useState({
    num: "",
    accomplished_by: ""
  });
  // mark-as-done richer form (prefilled on edit)
  const initialMarkForm: NewMaintenanceItem = {
    timestamp: new Date().toISOString(),
    reporterName: "",
    labRoom: "",
    subject: "",
    brandModel: "",
    serialNumber: "",
    inventoryNumber: "",
    maintenanceType: "",
    problemDescription: "",
    actionTaken: "",
    result: "",
    conclusions: "",
    routineCleaning: false,
    partsAssessment: false,
    visualInspection: false,
    calibrationLink: ""
  };
  const [markForm, setMarkForm] = useState<NewMaintenanceItem>({
    timestamp: new Date().toISOString(),
    reporterName: "",
    labRoom: "",
    subject: "",
    brandModel: "",
    serialNumber: "",
    inventoryNumber: "",
    maintenanceType: "",
    problemDescription: "",
    actionTaken: "",
    result: "",
    conclusions: "",
    routineCleaning: false,
    partsAssessment: false,
    visualInspection: false,
    calibrationLink: ""
  });
  // viewing mode: true when dialog opened to view an already-completed maintenance record
  const [isViewing, setIsViewing] = useState(false);

  // snackbar for user messages (used by handleNewRecordSubmit etc.)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Get current month abbreviation (e.g., "SEP")
  const getCurrentMonth = () => {
    const date = new Date();
    return date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  };

  // Get current year
  const getCurrentYear = () => {
    return new Date().getFullYear();
  };

  const formatDateDisplay = (dateString: string) => {
    if (!dateString) return "-";
    
    try {
      if (dateString.includes('T')) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      
      return dateString;
    } catch (error) {
      console.error("Error formatting date:", error);
      return dateString;
    }
  };

  // Get current month number (0-11)
  const getCurrentMonthNumber = () => {
    return new Date().getMonth();
  };

  const currentMonth = getCurrentMonth();
  const currentYear = getCurrentYear();
  const currentMonthNumber = getCurrentMonthNumber();

  const fetchMaintenance = async () => {
    setLoading(true);
    try {
      // call local server endpoint
      const resp = await axios.post(`${API_BASE_URL}/maintenance`, { action: "read" });
      if (resp.data && resp.data.success) {
        const rows = resp.data.data || [];
        // server returns array of maintenance objects; map to MaintenanceItem shape expected by this component
        const parsed: MaintenanceItem[] = rows.map((it: any) => ({
          num: (it.maintenance_num ?? it.num ?? "").toString(),
          equipment_num: (it.equipment_num ?? "").toString(),
          equipment_name: it.equipment_name ?? it.equipment_name ?? "",
          brand_model: it.brand_model ?? "",
          identifier_type: it.identifier_type ?? "",
          identifier_number: it.identifier_number ?? "",
          month: it.month ?? "",
          date_accomplished: it.date_accomplished ? new Date(it.date_accomplished).toISOString() : "",
          accomplished_by: it.accomplished_by ?? "",
          notes: typeof it.notes === "string" ? it.notes : (it.notes ? JSON.stringify(it.notes) : ""),
          scheduledYear: typeof it.scheduledYear === "number" ? it.scheduledYear : (it.scheduledYear ? Number(it.scheduledYear) : (new Date()).getFullYear())
        }));
        setMaintenance(parsed);
      } else {
        setMaintenance([]);
      }
    } catch (err) {
      console.error("Failed to fetch maintenance records", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaintenance();
  }, []);

  const handleUpdateItem = async () => {
    setProcessing(true);
    try {
      // call server to update maintenance row by maintenance_num (num)
      // include extra mark-as-done details inside notes (JSON) so server can persist them if supported
      const notesPayload = {
        problemDescription: markForm.problemDescription,
        actionTaken: markForm.actionTaken,
        result: markForm.result,
        conclusions: markForm.conclusions,
        routineCleaning: markForm.routineCleaning,
        partsAssessment: markForm.partsAssessment,
        visualInspection: markForm.visualInspection,
        calibrationLink: markForm.calibrationLink,
        brandModel: markForm.brandModel,
        subject: markForm.subject,
        serialNumber: markForm.serialNumber,
        inventoryNumber: markForm.inventoryNumber
      };

      await axios.post(`${API_BASE_URL}/maintenance`, {
        action: "update",
        num: form.num,
        accomplished_by: form.accomplished_by,
        notes: JSON.stringify(notesPayload)
      });

      setForm({
        num: "",
        accomplished_by: ""
      });

      // if we updated, clear viewing flag
      setIsViewing(false);
      setSnackbar({ open: true, message: "Maintenance saved", severity: "success" });
      await fetchMaintenance();
      setOpen(false);
    } catch (err) {
      console.error("Failed to update maintenance record", err);
      alert("Failed to update maintenance record");
    } finally {
      setProcessing(false);
    }
  };

  const handleEditClick = (item: MaintenanceItem) => {
    // prefill simple update form
    setForm({
      num: item.num,
      accomplished_by: item.accomplished_by || ""
    });
    
    // Determine if this record is already accomplished
    const alreadyDone = !!item.date_accomplished;
    setIsViewing(alreadyDone);

    // Parse notes (may be JSON) and prefill markForm fields when available
    let notesObj: any = null;
    if (item.notes) {
      try {
        notesObj = JSON.parse(item.notes);
      } catch (e) {
        // not JSON — ignore
      }
    }

    setMarkForm({
      ...initialMarkForm,
      timestamp: new Date().toISOString(),
      subject: item.equipment_name || "",
      brandModel: item.brand_model || "",
      serialNumber: item.identifier_number || "",
      inventoryNumber: item.equipment_num || "",
      problemDescription: notesObj?.problemDescription || notesObj?.problem_description || "",
      actionTaken: notesObj?.actionTaken || notesObj?.action_taken || "",
      result: notesObj?.result || "",
      conclusions: notesObj?.conclusions || "",
      routineCleaning: !!notesObj?.routineCleaning,
      partsAssessment: !!notesObj?.partsAssessment,
      visualInspection: !!notesObj?.visualInspection,
      calibrationLink: notesObj?.calibrationLink || ""
    });

    setOpen(true);
  };

  const resetForm = () => {
    setForm({
      num: "",
      accomplished_by: ""
    });
    setIsViewing(false);
    setMarkForm(initialMarkForm);
  };

  // Check if maintenance is done for current year
  const isDoneThisYear = (item: MaintenanceItem) => {
    if (!item.date_accomplished) return false;
    try {
      const date = new Date(item.date_accomplished);
      const scheduled = item.scheduledYear ?? currentYear;
      return date.getFullYear() === Number(scheduled);
    } catch (e) {
      return false;
    }
  };

  // Check if maintenance is done for current month
  const checkDoneThisMonth = (item: MaintenanceItem) => {
    if (!item.date_accomplished) return false;
    try {
      const date = new Date(item.date_accomplished);
      const scheduled = item.scheduledYear ?? currentYear;
      return date.getFullYear() === Number(scheduled) && date.getMonth() === currentMonthNumber;
    } catch (e) {
      return false;
    }
  };

  // Filter maintenance items based on search query
  const filteredMaintenance = maintenance.filter(item =>
    [item.equipment_name, item.brand_model, item.identifier_number, item.accomplished_by]
      .some(field => String(field || "").toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Filter for current month items
  const currentMonthItems = filteredMaintenance.filter(item => item.month === currentMonth && (item.scheduledYear ?? currentYear) === currentYear);

  // Calculate statistics
  const completedThisMonth = maintenance.filter(item => checkDoneThisMonth(item)).length;
  const pendingThisMonth = currentMonthItems.filter(item => !checkDoneThisMonth(item)).length;

  // submit handler for new maintenance record
  const handleNewRecordSubmit = async (data: NewMaintenanceItem) => {
    setProcessing(true);
    try {
      // map NewMaintenanceItem -> server fields expected by /api/maintenance?action=create
      const payload = {
        action: "create",
        equipment_num: data.inventoryNumber || undefined,
        equipment_name: data.subject || data.brandModel || "Unknown",
        brand_model: data.brandModel,
        identifier_type: data.serialNumber ? "Serial Number" : "None",
        identifier_number: data.serialNumber || "",
        month: new Date().toLocaleString("en-US", { month: "short" }).toUpperCase(),
        // keep additional metadata under 'notes' if server schema allows (not required)
        notes: JSON.stringify({
          reporterName: data.reporterName,
          labRoom: data.labRoom,
          problemDescription: data.problemDescription,
          actionTaken: data.actionTaken,
          result: data.result,
          conclusions: data.conclusions,
          routineCleaning: data.routineCleaning,
          partsAssessment: data.partsAssessment,
          visualInspection: data.visualInspection,
          calibrationLink: data.calibrationLink,
        }),
      };

      const res = await axios.post(`${API_BASE_URL}/maintenance`, payload);
      if (res.data && res.data.success) {
        setSnackbar({ open: true, message: "Maintenance record created", severity: "success" });
        setNewDialogOpen(false);
        await fetchMaintenance();
      } else {
        setSnackbar({ open: true, message: res.data?.error || "Create failed", severity: "error" });
      }
    } catch (err) {
      console.error("Create maintenance error", err);
      setSnackbar({ open: true, message: "Failed to create maintenance record", severity: "error" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Backdrop
        sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={processing}
      >
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={60} thickness={4} sx={{ color: "#b91c1c"}} />
          <Typography variant="h6" sx={{ color: "#fff" }}>
            Processing...
          </Typography>
        </Stack>
      </Backdrop>

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" color="#b91c1c" gutterBottom>
          Maintenance Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Track and manage equipment maintenance schedules
        </Typography>
      </Box>

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
            <EventIcon sx={{ fontSize: 30, color: "#b91c1c" }} />
          </Box>
          <Box>
            <Typography variant="caption" color="#b91c1c" fontWeight="medium">Current Month</Typography>
            <Typography variant="h4" sx={{ fontWeight: "bold", color: "#b91c1c" }}>
              {currentMonthItems.length}
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
            <Typography variant="caption" color="text.secondary" fontWeight="medium">Completed This Month</Typography>
            <Typography variant="h4" sx={{ fontWeight: "bold", color: theme.palette.success.main }}>
              {completedThisMonth}
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
            <Inventory2Icon sx={{ fontSize: 30, color: theme.palette.warning.main }} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight="medium">Pending This Month</Typography>
            <Typography variant="h4" sx={{ fontWeight: "bold", color: theme.palette.warning.main }}>
              {pendingThisMonth}
            </Typography>
          </Box>
        </Card>
      </Stack>

      {/* Action Bar */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={3} justifyContent="space-between" alignItems="center">
        <Box sx={{ flex: 1, maxWidth: 400 }}>
          <TextField
            placeholder="Search equipment, model, identifier..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            variant="outlined"
            size="small"
            fullWidth
            sx={{
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
        
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, value) => value && setViewMode(value)}
          sx={{
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <ToggleButton
            value="current"
            sx={{
              height: 40,
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
            Current Month
          </ToggleButton>

          <ToggleButton
            value="all"
            sx={{
              height: 40,
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
            All Records
          </ToggleButton>
        </ToggleButtonGroup>
        {/* +NewRecord removed — marking done is handled via Edit/Mark-as-done dialog */}
       </Stack>

      {/* New Maintenance Form Dialog */}
      <Dialog open={newDialogOpen} onClose={() => setNewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Typography variant="h6" sx={{ color: "#b91c1c", fontWeight: "bold" }}>New Maintenance Record</Typography>
        </DialogTitle>
        <DialogContent dividers>
          <NewMaintenanceForm
            onClose={() => setNewDialogOpen(false)}
            onSubmit={handleNewRecordSubmit}
          />
        </DialogContent>
      </Dialog>
      
      {/* Current Month Table */}
      <Typography variant="h5" sx={{ mt: 3, mb: 2, color: "#b91c1c" }}>
        {currentMonth} {currentYear} - Maintenance Schedule
      </Typography>
      
      <Card
        sx={{
          p: 3,
          borderRadius: 3,
          backgroundColor: "background.paper",
          marginBottom: 3,
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
        }}
      >
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
            <Loader />
          </Box>
        ) : currentMonthItems.length === 0 ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200 }}>
            <Typography variant="body2" color="text.secondary">
              No maintenance records found for {currentMonth}.
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer sx={{ maxHeight: 600, borderRadius: 2 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Equipment Name</TableCell>
                    <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Brand/Model</TableCell>
                    <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Identifier Number</TableCell>
                    <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Last Date Accomplished</TableCell>
                    <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Accomplished By</TableCell>
                    <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Status</TableCell>
                    <TableCell align="center" sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {currentMonthItems
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((item) => {
                      const isDone = isDoneThisYear(item);
                      const doneThisMonth = checkDoneThisMonth(item);
                      return (
                        <TableRow key={item.num} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {item.equipment_name}
                            </Typography>
                          </TableCell>
                          <TableCell>{item.brand_model}</TableCell>
                          <TableCell>{item.identifier_number}</TableCell>
                          <TableCell>{formatDateDisplay(item.date_accomplished) || "-"}</TableCell>
                          <TableCell>{item.accomplished_by || "-"}</TableCell>
                          <TableCell>
                            <Chip 
                              label={doneThisMonth ? 'Completed This Month' : 
                                     isDone ? 'Completed' : 'Calibrate'} 
                              size="small"
                              color={doneThisMonth ? "success" : isDone ? "primary" : "warning"}
                              variant={doneThisMonth ? "filled" : "outlined"}
                            />
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1} justifyContent="center">
                              <Tooltip title={isDone ? "View Details" : "Mark as Done"}>
                                <IconButton
                                  onClick={() => handleEditClick(item)}
                                  sx={{
                                    bgcolor: isDone ? "success.light" : "#b91c1c",
                                    "&:hover": { 
                                      bgcolor: isDone ? "success.main" : "#b91c1c",
                                      color: "#fff"
                                    },
                                    color:'white'
                                  }}
                                >
                                  {isDone ? <Inventory2Icon fontSize="small" /> : <EditIcon fontSize="small" />}
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination */}
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={currentMonthItems.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              sx={{ borderTop: "1px solid", borderColor: "divider" }}
            />
          </>
        )}
      </Card>

      {/* All Records Table (when viewMode is "all") */}
      {viewMode === "all" && (
        <>
          <Typography variant="h5" sx={{ mt: 3, mb: 2, color: "#b91c1c" }}>
            All Maintenance Records
          </Typography>
          
          <Card
            sx={{
              p: 3,
              borderRadius: 3,
              backgroundColor: "background.paper",
              marginBottom: 3,
              boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            }}
          >
            {filteredMaintenance.length === 0 ? (
              <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200 }}>
                <Typography variant="body2" color="text.secondary">
                  No maintenance records found.
                </Typography>
              </Box>
            ) : (
              <>
                <TableContainer sx={{ maxHeight: 600, borderRadius: 2 }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Month</TableCell>
                        <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Equipment Name</TableCell>
                        <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Brand/Model</TableCell>
                        <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Identifier Type</TableCell>
                        <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Identifier Number</TableCell>
                        <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Last Date Accomplished</TableCell>
                        <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Accomplished By</TableCell>
                        <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Status</TableCell>
                        <TableCell align="center" sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredMaintenance
                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                        .map((item) => {
                          const isDone = isDoneThisYear(item);
                          const doneThisMonth = checkDoneThisMonth(item);
                          return (
                            <TableRow key={item.num} hover>
                              <TableCell>
                                <Chip label={item.month} size="small" variant="outlined" />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight="medium">
                                  {item.equipment_name}
                                </Typography>
                              </TableCell>
                              <TableCell>{item.brand_model}</TableCell>
                              <TableCell>{item.identifier_type}</TableCell>
                              <TableCell>{item.identifier_number}</TableCell>
                              <TableCell>{formatDateDisplay(item.date_accomplished) || "-"}</TableCell>
                              <TableCell>{item.accomplished_by || "-"}</TableCell>
                              <TableCell>
                                <Chip 
                                  label={doneThisMonth ? 'Completed This Month' : 
                                         isDone ? 'Completed' : 'Calibrate'} 
                                  size="small"
                                  color={doneThisMonth ? "success" : isDone ? "primary" : "warning"}
                                  variant={doneThisMonth ? "filled" : "outlined"}
                                />
                              </TableCell>
                              <TableCell>
                                <Stack direction="row" spacing={1} justifyContent="center">
                                  <Tooltip title={isDone ? "View Details" : "Mark as Done"}>
                                    <IconButton
                                      color={isDone ? "success" : "primary"}
                                      onClick={() => handleEditClick(item)}
                                      sx={{
                                        bgcolor: isDone ? "success.light" : "primary.light",
                                        "&:hover": { 
                                          bgcolor: isDone ? "success.main" : "primary.main",
                                          color: "#fff"
                                        },
                                      }}
                                    >
                                      {isDone ? <Inventory2Icon fontSize="small" /> : <EditIcon fontSize="small" />}
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Pagination */}
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25]}
                  component="div"
                  count={filteredMaintenance.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  sx={{ borderTop: "1px solid", borderColor: "divider" }}
                />
              </>
            )}
          </Card>
        </>
      )}

      {/* Update Dialog */}
      <Dialog open={open} onClose={() => {
        setOpen(false);
        resetForm();
      }} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
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
          {isViewing ? "Maintenance Details" : "Mark Maintenance as Done"}
          <Button
            onClick={() => {
              setOpen(false);
              resetForm();
            }}
            sx={{
              textTransform: "none",
              fontWeight: "bold",
              color: "#b91c1c",
              "&:hover": { bgcolor: "rgba(25,118,210,0.08)" },
            }}
          >
            {isViewing ? "Close" : "Cancel"}
          </Button>
        </DialogTitle>
        
        <DialogContent dividers>
          {/* Read-only item info */}
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2">Equipment</Typography>
              <Typography fontWeight="bold">{markForm.subject || "—"}</Typography>
              <Typography variant="caption" color="text.secondary">{markForm.brandModel || ""} • {markForm.serialNumber || "—"}</Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2">Completion Details</Typography>
              <TextField
                label="Accomplished By"
                value={form.accomplished_by}
                onChange={(e) => setForm({ ...form, accomplished_by: e.target.value })}
                fullWidth
                size="small"
                sx={{ mb: 1 }}
                placeholder="Enter your name"
                disabled={processing || isViewing}
              />

              <TextField
                label="Problem Description"
                value={markForm.problemDescription}
                onChange={(e) => setMarkForm({ ...markForm, problemDescription: e.target.value })}
                multiline
                minRows={2}
                fullWidth
                size="small"
                sx={{ mb: 1 }}
                disabled={isViewing}
              />

              <TextField
                label="Action Taken"
                value={markForm.actionTaken}
                onChange={(e) => setMarkForm({ ...markForm, actionTaken: e.target.value })}
                multiline
                minRows={2}
                fullWidth
                size="small"
                sx={{ mb: 1 }}
                disabled={isViewing}
              />

              <TextField
                label="Conclusions / Recommendations (optional)"
                value={markForm.conclusions}
                onChange={(e) => setMarkForm({ ...markForm, conclusions: e.target.value })}
                multiline
                minRows={2}
                fullWidth
                size="small"
                sx={{ mb: 1 }}
                disabled={isViewing}
              />

              <TextField
                select
                label="Result"
                value={markForm.result}
                onChange={(e) => setMarkForm({ ...markForm, result: e.target.value as any })}
                fullWidth
                size="small"
                sx={{ mb: 1 }}
                disabled={isViewing}
              >
                <MenuItem value=""><em>Choose result</em></MenuItem>
                <MenuItem value="Fixed / Maintained">Fixed / Maintained</MenuItem>
                <MenuItem value="Defective">Defective</MenuItem>
                <MenuItem value="Need Repair">Need Repair</MenuItem>
                <MenuItem value="Requires External Service">Requires External Service</MenuItem>
              </TextField>

              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <FormControlLabel control={<Checkbox checked={markForm.routineCleaning} onChange={(e)=>setMarkForm({...markForm, routineCleaning: e.target.checked})} />} label="Routine Cleaning" />
                <FormControlLabel control={<Checkbox checked={markForm.partsAssessment} onChange={(e)=>setMarkForm({...markForm, partsAssessment: e.target.checked})} />} label="Parts Assessment" />
                <FormControlLabel control={<Checkbox checked={markForm.visualInspection} onChange={(e)=>setMarkForm({...markForm, visualInspection: e.target.checked})} />} label="Visual Inspection" />
              </Stack>

              <TextField
                label="Link to Calibration Worksheet (optional)"
                value={markForm.calibrationLink}
                onChange={(e) => setMarkForm({ ...markForm, calibrationLink: e.target.value })}
                fullWidth
                size="small"
                sx={{ mt: 1 }}
                disabled={isViewing}
              />
            </Box>
          </Stack>

          <Box sx={{ mt: 2 }}>
            {/* Only show Confirm when NOT viewing an already-completed record */}
            {!isViewing && (
              <Button
                onClick={handleUpdateItem}
                variant="contained"
                disabled={!form.accomplished_by.trim() || processing}
                fullWidth
                sx={{
                  textTransform: "none",
                  fontWeight: "bold",
                  bgcolor: "#b91c1c",
                  "&:hover": { bgcolor: "#b91c1c" },
                }}
              >
                {processing ? <CircularProgress size={24} sx={{ color: "white" }} /> : "Confirm Completion & Save Details"}
              </Button>
            )}
          </Box>
        </DialogContent>
      </Dialog>

      {/* Snackbar for user feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default MaintenancePage;