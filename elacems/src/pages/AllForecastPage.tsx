import { useEffect, useState } from "react";
import {
  Container,
  Box,
  Typography,
  Card,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Backdrop,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  useTheme,
  Snackbar,
  Alert,
  alpha,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import SearchIcon from "@mui/icons-material/Search";
import axios from "axios";

const API_BASE_URL = "https://elams.sit.ubaguio.edu/api";

type ForecastItem = { item_name: string; quantity: number; notes?: string };
type ForecastRequest = {
  _id?: string;
  requester_email?: string;
  requester_name?: string;
  school?: string;
  school_year?: string;
  semester?: string;
  subject?: string; // Added subject field
  items?: ForecastItem[];
  status?: string;
  date_requested?: string;
  date_approved?: string | null;
  custodian_name?: string;
};

type Subject = {
  _id: string;
  name: string;
  code?: string;
};

export default function AllForecastPage() {
  const theme = useTheme();
  const brandRed = "#b91c1c";
  const ubRed = "#B71C1C";

  // unified action button styles (neutral grey, UB red on hover)
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

  const [requests, setRequests] = useState<ForecastRequest[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<ForecastRequest | null>(null);

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });

  // search
  const [search, setSearch] = useState("");

  const currentUser = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}") : {};
  const currentEmail = currentUser?.email || "";
  const currentName = currentUser?.name || `${currentUser.firstname || ""} ${currentUser.lastname || ""}`.trim();
  const currentRole = currentUser?.role || "";

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/forecast-approval`, { action: "read" });
      if (res.data && res.data.success) setRequests(res.data.data || []);
      else if (Array.isArray(res.data)) setRequests(res.data);
    } catch (err) {
      console.error("Failed to fetch forecast requests", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/subjects`);
      setSubjects(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch subjects", err);
    }
  };

  useEffect(() => {
    fetchAll();
    fetchSubjects();
  }, []);

  const getSubjectName = (subjectId: string) => {
    if (!subjectId) return "-";
    const found = subjects.find(s => s._id === subjectId);
    return found ? `${found.name}${found.code ? ` (${found.code})` : ''}` : subjectId;
  };

  const openView = (r: ForecastRequest) => {
    setSelected(r);
    setViewOpen(true);
  };

  const handleApprove = async (r: ForecastRequest) => {
    if (!r._id) return;
    if (!window.confirm(`Approve forecast request from ${r.requester_name || r.requester_email} for ${getSubjectName(r.subject || '')}?`)) return;
    setProcessing(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/forecast-approval`, {
        action: "approve",
        id: r._id,
        custodian_email: currentEmail,
        custodian_name: currentName,
      });
      if (res.data && res.data.success) {
        setSnackbar({ open: true, message: "Forecast approved", severity: "success" });
        fetchAll();
      } else {
        setSnackbar({ open: true, message: res.data?.error || "Approve failed", severity: "error" });
      }
    } catch (err) {
      console.error("Approve error", err);
      setSnackbar({ open: true, message: "Approve failed", severity: "error" });
    } finally {
      setProcessing(false);
    }
  };

  const startReject = (r: ForecastRequest) => {
    setSelected(r);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const submitReject = async () => {
    if (!selected?._id) return;
    setProcessing(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/forecast-approval`, {
        action: "reject",
        id: selected._id,
        custodian_email: currentEmail,
        custodian_name: currentName,
        reason: rejectReason || "No reason provided",
      });
      if (res.data && res.data.success) {
        setSnackbar({ open: true, message: "Forecast rejected", severity: "success" });
        setRejectDialogOpen(false);
        setSelected(null);
        fetchAll();
      } else {
        setSnackbar({ open: true, message: res.data?.error || "Reject failed", severity: "error" });
      }
    } catch (err) {
      console.error("Reject error", err);
      setSnackbar({ open: true, message: "Reject failed", severity: "error" });
    } finally {
      setProcessing(false);
    }
  };

  const pendingCount = requests.filter((r) => (r.status || "Pending") === "Pending").length;
  const approvedCount = requests.filter((r) => r.status === "Approved").length;
  const rejectedCount = requests.filter((r) => r.status === "Rejected").length;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Backdrop sx={{ color: "#fff", zIndex: (t) => t.zIndex.modal + 1 }} open={loading || processing}>
        <CircularProgress color="inherit" />
      </Backdrop>

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" color={brandRed}>
          Forecast Management
        </Typography>
        <Typography variant="body2" color="text.secondary">
          View and manage forecast requests submitted by Program Chairs
        </Typography>
      </Box>

      {/* Summary Cards */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={3} mb={3}>
        <Card
          sx={{
            flex: 1,
            p: 3,
            borderRadius: 3,
            display: "flex",
            gap: 2,
            alignItems: "center",
            bgcolor: "rgba(185,28,28,0.06)",
          }}
        >
          <VisibilityIcon sx={{ color: brandRed, fontSize: 36 }} />
          <Box>
            <Typography variant="caption" color="text.secondary">
              Total Requests
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: "bold", color: brandRed }}>
              {requests.length}
            </Typography>
          </Box>
        </Card>
        <Card
          sx={{
            flex: 1,
            p: 3,
            borderRadius: 3,
            display: "flex",
            gap: 2,
            alignItems: "center",
            bgcolor: alpha(theme.palette.warning.main, 0.06),
          }}
        >
          <Typography sx={{ fontSize: 28, color: theme.palette.warning.main }}>⏳</Typography>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Pending
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: "bold", color: theme.palette.warning.main }}>
              {pendingCount}
            </Typography>
          </Box>
        </Card>
        <Card
          sx={{
            flex: 1,
            p: 3,
            borderRadius: 3,
            display: "flex",
            gap: 2,
            alignItems: "center",
            bgcolor: alpha(theme.palette.success.main, 0.06),
          }}
        >
          <CheckCircleIcon sx={{ color: theme.palette.success.main, fontSize: 36 }} />
          <Box>
            <Typography variant="caption" color="text.secondary">
              Approved
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: "bold", color: theme.palette.success.main }}>
              {approvedCount}
            </Typography>
          </Box>
        </Card>
        <Card
          sx={{
            flex: 1,
            p: 3,
            borderRadius: 3,
            display: "flex",
            gap: 2,
            alignItems: "center",
            bgcolor: alpha(theme.palette.error.main, 0.06),
          }}
        >
          <CancelIcon sx={{ color: theme.palette.error.main, fontSize: 36 }} />
          <Box>
            <Typography variant="caption" color="text.secondary">
              Rejected
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: "bold", color: theme.palette.error.main }}>
              {rejectedCount}
            </Typography>
          </Box>
        </Card>
      </Stack>

      {/* Search Bar */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={3} justifyContent="space-between" alignItems="center">
        <Box sx={{ maxWidth: 480, width: "100%" }}>
          <TextField
            size="small"
            placeholder="Search requester / subject / school / year / semester..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            variant="outlined"
            fullWidth
            InputProps={{
              startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
            }}
          />
        </Box>
      </Stack>

      {/* Requests Table */}
      <Card sx={{ p: 3, borderRadius: 3 }}>
        <TableContainer>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Date Requested</TableCell>
                <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Requester</TableCell>
                <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>School</TableCell>
                <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Subject</TableCell>
                <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>School Year</TableCell>
                <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Semester</TableCell>
                <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}># Items</TableCell>
                <TableCell sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Status</TableCell>
                <TableCell align="center" sx={{ bgcolor: "grey.50", fontWeight: "bold" }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests
                .filter((r) => {
                  if (!search.trim()) return true;
                  const q = search.toLowerCase();
                  return (
                    (r.requester_name || r.requester_email || "").toLowerCase().includes(q) ||
                    (r.school || "").toLowerCase().includes(q) ||
                    getSubjectName(r.subject || "").toLowerCase().includes(q) ||
                    (r.school_year || "").toLowerCase().includes(q) ||
                    (r.semester || "").toLowerCase().includes(q)
                  );
                })
                .map((r) => (
                  <TableRow key={r._id}>
                    <TableCell>{r.date_requested ? new Date(r.date_requested).toLocaleString() : "-"}</TableCell>
                    <TableCell>{r.requester_name || r.requester_email || "-"}</TableCell>
                    <TableCell>{r.school || "-"}</TableCell>
                    <TableCell>
                      <Chip 
                        label={getSubjectName(r.subject || "")} 
                        size="small" 
                        variant="outlined"
                        sx={{ fontWeight: 500 }}
                      />
                    </TableCell>
                    <TableCell>{r.school_year || "-"}</TableCell>
                    <TableCell>{r.semester || "-"}</TableCell>
                    <TableCell>{(r.items || []).length}</TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          color:
                            r.status === "Approved"
                              ? theme.palette.success.main
                              : r.status === "Rejected"
                              ? theme.palette.error.main
                              : theme.palette.warning.main,
                          fontWeight: "bold",
                        }}
                      >
                        {r.status || "Pending"}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <Tooltip title="View Details">
                          <IconButton onClick={() => openView(r)} sx={actionIconBtnSx}>
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Approve Forecast">
                          <span>
                            <IconButton
                              onClick={() => handleApprove(r)}
                              sx={actionIconBtnSx}
                              disabled={(r.status || "Pending") !== "Pending" || !(currentRole === "Custodian" || currentRole === "Admin")}
                            >
                              <CheckCircleIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>

                        <Tooltip title="Reject Forecast">
                          <span>
                            <IconButton
                              onClick={() => startReject(r)}
                              sx={actionIconBtnSx}
                              disabled={(r.status || "Pending") !== "Pending" || !(currentRole === "Custodian" || currentRole === "Admin")}
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              {requests.filter(r => {
                if (!search.trim()) return true;
                const q = search.toLowerCase();
                return (
                  (r.requester_name || r.requester_email || "").toLowerCase().includes(q) ||
                  (r.school || "").toLowerCase().includes(q) ||
                  getSubjectName(r.subject || "").toLowerCase().includes(q) ||
                  (r.school_year || "").toLowerCase().includes(q) ||
                  (r.semester || "").toLowerCase().includes(q)
                );
              }).length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No forecast requests found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* View Details Dialog */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <VisibilityIcon sx={{ color: brandRed }} />
            <Typography variant="h6" sx={{ color: brandRed }}>
              Forecast Request Details
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selected && (
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Requester</Typography>
                <Typography variant="body1">{selected.requester_name || selected.requester_email}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">School</Typography>
                <Typography variant="body1">{selected.school || "-"}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Subject</Typography>
                <Typography variant="body1">
                  <Chip 
                    label={getSubjectName(selected.subject || "")} 
                    size="small" 
                    color="primary" 
                    variant="outlined"
                  />
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">School Year / Semester</Typography>
                <Typography variant="body1">{selected.school_year || "-"} • {selected.semester || "-"}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Requested Items</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item</TableCell>
                      <TableCell align="center">Quantity</TableCell>
                      <TableCell>Notes</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(selected.items || []).map((it, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{it.item_name}</TableCell>
                        <TableCell align="center">
                          <Chip label={it.quantity} size="small" />
                        </TableCell>
                        <TableCell>{it.notes || "-"}</TableCell>
                      </TableRow>
                    ))}
                    {(selected.items || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} align="center">No items requested</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                <Chip 
                  label={selected.status || "Pending"} 
                  color={selected.status === "Approved" ? "success" : selected.status === "Rejected" ? "error" : "warning"} 
                />
              </Box>
              {selected.status === "Approved" && selected.custodian_name && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Approved By</Typography>
                  <Typography variant="body2">{selected.custodian_name}</Typography>
                  {selected.date_approved && (
                    <Typography variant="caption" color="text.secondary">
                      {new Date(selected.date_approved).toLocaleString()}
                    </Typography>
                  )}
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject Forecast Request</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
            Please provide a reason for rejection (optional but recommended).
          </Typography>
          <TextField 
            fullWidth 
            multiline 
            rows={4} 
            value={rejectReason} 
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={submitReject}>Reject</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={3500} 
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))} 
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert 
          severity={snackbar.severity} 
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          sx={{ borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}