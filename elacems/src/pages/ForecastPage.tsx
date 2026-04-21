import { useEffect, useState } from "react";
import {
  Container, Box, Typography, Card, Stack, TextField, Select, MenuItem, InputLabel, FormControl,
  Button, Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, Chip, IconButton,
  Snackbar, Alert, CircularProgress, Backdrop, Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions, Tooltip, Checkbox, FormControlLabel
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import axios from "axios";

const API_BASE_URL = "https://elams.sit.ubaguio.edu:5000/api";

type ForecastItem = {
  id: string;
  item_name: string;
  quantity: number;
  notes?: string;
};

type ForecastRequest = {
  _id?: string;
  requester_email: string;
  requester_name: string;
  school?: string;
  school_year?: string;
  semester?: string;
  subject?: string;
  items: ForecastItem[];
  status?: string;
  date_requested?: string;
};

type Subject = {
  _id: string;
  name: string;
  code?: string;
  required_items?: Array<{
    item_name: string;
    quantity: number;
    item_type: string;
  }>;
};

export default function ForecastPage() {
  const brandRed = "#b91c1c";
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

  const [school, setSchool] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [semester, setSemester] = useState<"1st" | "2nd">("1st");
  const [subject, setSubject] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [items, setItems] = useState<ForecastItem[]>([]);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState<number>(1);
  const [newNotes, setNewNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<ForecastRequest[]>([]);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false, message: "", severity: "success"
  });
  const [useRequiredItems, setUseRequiredItems] = useState(true);
  const [loadingSubjectItems, setLoadingSubjectItems] = useState(false);

  const [tabIndex, setTabIndex] = useState(0);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewRequest, setViewRequest] = useState<ForecastRequest | null>(null);
  
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const currentUser = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("user") || "{}") : {};
  const userEmail = currentUser?.email || "";
  const userName = currentUser?.firstname ? `${currentUser.firstname} ${currentUser.lastname || ""}`.trim() : currentUser.name || "";

  const SCHOOLS = [
    "School of Information Technology",
    "School of Engineering and Architecture"
  ];

  const now = new Date();
  const currentYear = now.getFullYear();
  const academicYears = [
    `${currentYear}-${currentYear + 1}`,
    `${currentYear - 1}-${currentYear}`
  ];

  useEffect(() => {
    fetchMyRequests();
    fetchSubjects();
    if (!school && SCHOOLS.length) setSchool(SCHOOLS[0]);
    if (!schoolYear && academicYears.length) setSchoolYear(academicYears[0]);
  }, []);

  const fetchSubjects = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/subjects`);
      setSubjects(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch subjects", err);
    }
  };

  const fetchMyRequests = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/forecast-request`, { action: "read", user: { email: userEmail } });
      if (res.data && res.data.success) setRequests(res.data.data || []);
      else if (Array.isArray(res.data)) setRequests(res.data);
    } catch (err) {
      console.error("Failed to fetch forecast requests", err);
    } finally { setLoading(false); }
  };

  // Load required items when subject changes
  const loadSubjectRequiredItems = async (subjectId: string) => {
    if (!subjectId || !useRequiredItems) return;
    
    setLoadingSubjectItems(true);
    try {
      const selectedSubject = subjects.find(s => s._id === subjectId);
      if (selectedSubject && selectedSubject.required_items && selectedSubject.required_items.length > 0) {
        const requiredItems: ForecastItem[] = selectedSubject.required_items.map((item, idx) => ({
          id: `${Date.now()}-${idx}`,
          item_name: item.item_name,
          quantity: item.quantity,
          notes: `Required for ${selectedSubject.name}`
        }));
        setItems(requiredItems);
        setSnackbar({ open: true, message: `Loaded ${requiredItems.length} required items for ${selectedSubject.name}`, severity: "success" });
      } else {
        setItems([]);
        setSnackbar({ open: true, message: "No required items defined for this subject", severity: "error" });
      }
    } catch (err) {
      console.error("Error loading subject items", err);
    } finally {
      setLoadingSubjectItems(false);
    }
  };

  const handleSubjectChange = (subjectId: string) => {
    setSubject(subjectId);
    if (useRequiredItems) {
      loadSubjectRequiredItems(subjectId);
    }
  };

  const addItem = () => {
    if (!newName.trim() || newQty <= 0) {
      setSnackbar({ open: true, message: "Item name and positive quantity required", severity: "error" });
      return;
    }
    setItems(prev => [...prev, { id: String(Date.now()) + Math.random().toString(36).slice(2,6), item_name: newName.trim(), quantity: newQty, notes: newNotes }]);
    setNewName(""); setNewQty(1); setNewNotes("");
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const startEditRequest = (r: ForecastRequest) => {
    setSchool(r.school || "");
    setSchoolYear(r.school_year || "");
    setSemester((r.semester as "1st" | "2nd") || "1st");
    setSubject(r.subject || "");
    setItems((r.items || []).map((it: any, idx: number) => ({ id: String(idx) + '-' + (Date.now()%1000), item_name: it.item_name, quantity: it.quantity || 1, notes: it.notes || "" })));
    setEditingRequestId(r._id || null);
    setIsEditing(true);
    setUseRequiredItems(false); // When editing, don't auto-load required items
    setTabIndex(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingRequestId(null);
    setIsEditing(false);
    setItems([]);
    setSchool("");
    setSchoolYear("");
    setSemester("1st");
    setSubject("");
    setUseRequiredItems(true);
  };

  const handleSubmit = async () => {
    if (!school.trim() || !schoolYear.trim() || !semester) {
      setSnackbar({ open: true, message: "School, school year and semester are required", severity: "error" }); 
      return;
    }
    if (!subject) {
      setSnackbar({ open: true, message: "Please select a subject", severity: "error" }); 
      return;
    }
    if (items.length === 0) { 
      setSnackbar({ open: true, message: "Add at least one item", severity: "error" }); 
      return; 
    }

    setSubmitting(true);
    try {
      const itemsPayload = items.map(it => ({ item_name: it.item_name, quantity: it.quantity, notes: it.notes }));
      if (isEditing && editingRequestId) {
        const res = await axios.post(`${API_BASE_URL}/forecast-request`, {
          action: "update",
          id: editingRequestId,
          user: { email: userEmail, name: userName },
          school, school_year: schoolYear, semester, subject, items: itemsPayload
        });
        if (res.data && res.data.success) {
          setSnackbar({ open: true, message: "Forecast updated", severity: "success" });
          cancelEdit();
          fetchMyRequests();
        } else {
          setSnackbar({ open: true, message: res.data?.error || "Failed to update", severity: "error" });
        }
      } else {
        const res = await axios.post(`${API_BASE_URL}/forecast-request`, {
          action: "create",
          user: { email: userEmail, name: userName },
          school, school_year: schoolYear, semester, subject, items: itemsPayload
        });
        if (res.data && res.data.success) {
          setSnackbar({ open: true, message: "Forecast request submitted", severity: "success" });
          setItems([]); 
          setSchool(""); 
          setSchoolYear(""); 
          setSemester("1st");
          setSubject("");
          setUseRequiredItems(true);
          fetchMyRequests();
        } else {
          setSnackbar({ open: true, message: "Failed to submit forecast", severity: "error" });
        }
      }
    } catch (err) {
      console.error("Submit forecast error", err);
      setSnackbar({ open: true, message: "Submission failed", severity: "error" });
    } finally { setSubmitting(false); }
  };

  const handleDeleteRequest = async (r: ForecastRequest) => {
    if (!r._id) return;
    if (!window.confirm(`Delete forecast request for ${r.subject || 'unknown'}?`)) return;
    try {
      const res = await axios.post(`${API_BASE_URL}/forecast-request`, { action: "delete", id: r._id, user: { email: userEmail, name: userName } });
      if (res.data && res.data.success) {
        setSnackbar({ open: true, message: "Forecast request deleted", severity: "success" });
        fetchMyRequests();
      } else {
        setSnackbar({ open: true, message: res.data?.error || "Failed to delete", severity: "error" });
      }
    } catch (e) {
      console.error("Delete forecast error", e);
      setSnackbar({ open: true, message: "Deletion failed", severity: "error" });
    }
  };

  const openViewRequest = (r: ForecastRequest) => {
    setViewRequest(r);
    setViewDialogOpen(true);
  };

  const getSubjectName = (subjectId: string) => {
    const found = subjects.find(s => s._id === subjectId);
    return found ? found.name : subjectId;
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Backdrop sx={{ color: "#fff", zIndex: (t) => t.zIndex.modal + 1 }} open={loading || submitting || loadingSubjectItems}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" color={brandRed}>Forecast Requests</Typography>
        <Typography variant="body2" color="text.secondary">Create and manage forecast requests for semester stock planning</Typography>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} textColor="inherit" indicatorColor="primary">
          <Tab label="Create Forecast" />
          <Tab label="My Forecast Requests" />
        </Tabs>
      </Box>

      {/* TabPanel: Create Forecast */}
      {tabIndex === 0 && (
        <Box>
          <Card sx={{ p: 3, mb: 4, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, color: brandRed }}>Create Forecast</Typography>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>School / College</InputLabel>
                  <Select
                    value={school}
                    label="School / College"
                    onChange={(e) => setSchool(e.target.value as string)}
                    size="small"
                  >
                    {SCHOOLS.map((s) => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl sx={{ width: 220 }}>
                  <InputLabel>School Year</InputLabel>
                  <Select
                    value={schoolYear}
                    label="School Year"
                    onChange={(e) => setSchoolYear(e.target.value as string)}
                    size="small"
                  >
                    {academicYears.map((y) => (
                      <MenuItem key={y} value={y}>{y}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl sx={{ width: 220 }}>
                  <InputLabel>Semester</InputLabel>
                  <Select value={semester} label="Semester" onChange={(e) => setSemester(e.target.value as any)} size="small">
                    <MenuItem value="1st">1st Semester</MenuItem>
                    <MenuItem value="2nd">2nd Semester</MenuItem>
                  </Select>
                </FormControl>
              </Stack>

              {/* Subject Selection */}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                <FormControl fullWidth>
                  <InputLabel>Subject</InputLabel>
                  <Select
                    value={subject}
                    label="Subject"
                    onChange={(e) => handleSubjectChange(e.target.value as string)}
                    size="small"
                  >
                    {subjects.map((s) => (
                      <MenuItem key={s._id} value={s._id}>
                        {s.name} {s.code ? `(${s.code})` : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={useRequiredItems}
                      onChange={(e) => {
                        setUseRequiredItems(e.target.checked);
                        if (e.target.checked && subject) {
                          loadSubjectRequiredItems(subject);
                        } else if (!e.target.checked) {
                          setItems([]);
                        }
                      }}
                    />
                  }
                  label="Use Subject Required Items"
                  sx={{ whiteSpace: "nowrap" }}
                />
                
                {useRequiredItems && subject && (
                  <Tooltip title="Reload Required Items">
                    <IconButton onClick={() => loadSubjectRequiredItems(subject)} sx={actionIconBtnSx}>
                      <AutorenewIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>

              {/* Items Section */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Items to Forecast</Typography>
                
                {/* Add new item form - only show if not using required items or editing */}
                {(!useRequiredItems || isEditing) && (
                  <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", mb: 2 }}>
                    <TextField label="Item name" value={newName} onChange={(e) => setNewName(e.target.value)} sx={{ flex: 1 }} size="small" />
                    <TextField label="Quantity" type="number" value={newQty} onChange={(e) => setNewQty(Number(e.target.value) || 1)} sx={{ width: 140 }} size="small" />
                    <TextField label="Notes (optional)" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} sx={{ width: 260 }} size="small" />
                    <Button startIcon={<AddIcon />} variant="outlined" onClick={addItem} sx={{ whiteSpace: "nowrap" }}>Add</Button>
                  </Box>
                )}

                {/* Items table */}
                {items.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    {useRequiredItems && !isEditing 
                      ? "No required items found for this subject. Uncheck 'Use Subject Required Items' to add custom items."
                      : "No items added yet. Use the form above to add items."}
                  </Typography>
                ) : (
                  <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Item</TableCell>
                          <TableCell align="center">Quantity</TableCell>
                          <TableCell>Notes</TableCell>
                          <TableCell align="center">Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {items.map(it => (
                          <TableRow key={it.id}>
                            <TableCell>{it.item_name}</TableCell>
                            <TableCell align="center"><Chip label={it.quantity} size="small" /></TableCell>
                            <TableCell>{it.notes || "-"}</TableCell>
                            <TableCell align="center">
                              <IconButton size="small" color="error" onClick={() => removeItem(it.id)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>

              {/* Action bar */}
              <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
                {isEditing ? (
                  <>
                    <Button onClick={cancelEdit} sx={{ textTransform: 'none' }}>Cancel</Button>
                    <Button variant="contained" onClick={handleSubmit} sx={{ bgcolor: brandRed, color: '#fff', textTransform: 'none', "&:hover": { bgcolor: "#9f1515" } }}>
                      Update Forecast
                    </Button>
                  </>
                ) : (
                  <Button variant="contained" onClick={handleSubmit} sx={{ bgcolor: brandRed, color: '#fff', textTransform: 'none', "&:hover": { bgcolor: "#9f1515" } }}>
                    Submit Forecast
                  </Button>
                )}
              </Box>
            </Stack>
          </Card>
        </Box>
      )}

      {/* TabPanel: My Forecast Requests */}
      {tabIndex === 1 && (
        <Box>
          <Card sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, color: brandRed }}>My Forecast Requests</Typography>

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 160 }}>
                <CircularProgress />
              </Box>
            ) : requests.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No forecast requests yet.</Typography>
            ) : (
              <TableContainer>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date Requested</TableCell>
                      <TableCell>School</TableCell>
                      <TableCell>Subject</TableCell>
                      <TableCell>School Year</TableCell>
                      <TableCell>Semester</TableCell>
                      <TableCell># Items</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {requests.map((r) => (
                      <TableRow key={r._id}>
                        <TableCell>{r.date_requested ? new Date(r.date_requested).toLocaleString() : "-"}</TableCell>
                        <TableCell>{r.school || "-"}</TableCell>
                        <TableCell>{getSubjectName(r.subject || "")}</TableCell>
                        <TableCell>{r.school_year || "-"}</TableCell>
                        <TableCell>{r.semester || "-"}</TableCell>
                        <TableCell>{(r.items || []).length}</TableCell>
                        <TableCell>
                          <Chip 
                            label={r.status || "Pending"} 
                            color={r.status === "Approved" ? "success" : r.status === "Rejected" ? "error" : "warning"} 
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={1} justifyContent="center">
                            <Tooltip title="View">
                              <IconButton onClick={() => openViewRequest(r)} sx={actionIconBtnSx}>
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            {r.status === "Pending" && (
                              <Tooltip title="Edit">
                                <IconButton onClick={() => startEditRequest(r)} sx={actionIconBtnSx}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}

                            {r.status === "Pending" && (
                              <Tooltip title="Delete">
                                <IconButton onClick={() => handleDeleteRequest(r)} sx={actionIconBtnSx}>
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
            )}
          </Card>
        </Box>
      )}

      {/* View Request Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <VisibilityIcon sx={{ color: brandRed }} />
            <Typography variant="h6" sx={{ color: brandRed }}>Forecast Request Details</Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {viewRequest && (
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2" fontWeight="bold">School</Typography>
                <Typography>{viewRequest.school || '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" fontWeight="bold">Subject</Typography>
                <Typography>{getSubjectName(viewRequest.subject || '')}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" fontWeight="bold">School Year / Semester</Typography>
                <Typography>{viewRequest.school_year || '-'} • {viewRequest.semester || '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" fontWeight="bold">Requested Items</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item</TableCell>
                      <TableCell align="center">Qty</TableCell>
                      <TableCell>Notes</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(viewRequest.items || []).map((it, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{it.item_name}</TableCell>
                        <TableCell align="center">{it.quantity}</TableCell>
                        <TableCell>{it.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
              <Box>
                <Typography variant="subtitle2" fontWeight="bold">Status</Typography>
                <Chip 
                  label={viewRequest.status || "Pending"} 
                  color={viewRequest.status === "Approved" ? "success" : viewRequest.status === "Rejected" ? "error" : "warning"} 
                />
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)} sx={{ textTransform: 'none' }}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3500} onClose={() => setSnackbar(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Container>
  );
}