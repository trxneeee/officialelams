import { useEffect, useState } from "react";
import { TableContainer, Container, Card, Typography, Stack, TextField, Button, Table, TableBody, TableCell, TableHead, TableRow, IconButton, Box, TablePagination, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert, Chip, InputAdornment, Tabs, Tab, Fade, Grow, Tooltip, CircularProgress, Backdrop, Paper, FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import SchoolIcon from "@mui/icons-material/School";
import BookIcon from "@mui/icons-material/Book";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import InventoryIcon from "@mui/icons-material/Inventory";
import ScienceIcon from "@mui/icons-material/Science";
import BuildIcon from "@mui/icons-material/Build";
import { alpha as alphaColor } from "@mui/material/styles";
import UBLogo from "../assets/ublogo.png";
import axios from "axios";

const API_BASE_URL = "https://elams.sit.ubaguio.edu:5000/api";
const user = JSON.parse(localStorage.getItem("user") || "{}");
const userRole = user?.role || "Custodian";

interface Subject {
  _id: string;
  name: string;
  code?: string;
  courses?: string[];
  required_items?: RequiredItem[];
}

interface RequiredItem {
  item_name: string;
  quantity: number;
  item_type: "consumable" | "non-consumable";
  item_id?: string;
}

interface Course {
  _id: string;
  name: string;
  code?: string;
}

interface InventoryItem {
  num: string;
  equipment_name: string;
  is_consumable: boolean;
  available: number;
}

export default function SubjectCoursePage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [newSubject, setNewSubject] = useState({ name: "", code: "" });
  const [newCourse, setNewCourse] = useState({ name: "", code: "" });
  const [loading, setLoading] = useState(false);
  const [subjectCourses, setSubjectCourses] = useState<Record<string, string[]>>({});
  const [searchSubject, setSearchSubject] = useState("");
  const [searchCourse, setSearchCourse] = useState("");
  const [activeTab, setActiveTab] = useState(0);
  
  // Inventory state
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  
  // Item assignment state
  const [selectedSubjectForItems, setSelectedSubjectForItems] = useState<Subject | null>(null);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [consumableItems, setConsumableItems] = useState<RequiredItem[]>([]);
  const [nonConsumableItems, setNonConsumableItems] = useState<RequiredItem[]>([]);
  const [consumableSearch, setConsumableSearch] = useState("");
  const [nonConsumableSearch, setNonConsumableSearch] = useState("");
  const [currentConsumable, setCurrentConsumable] = useState({
    item_name: "",
    quantity: 1,
    item_type: "consumable" as const,
    custom_name: "",
    selected_num: "",
  });
  const [currentNonConsumable, setCurrentNonConsumable] = useState({
    item_name: "",
    quantity: 1,
    item_type: "non-consumable" as const,
    custom_name: "",
    selected_num: "",
  });
  
  // Pagination states
  const [subjectPage, setSubjectPage] = useState(0);
  const [coursePage, setCoursePage] = useState(0);
  const rowsPerPage = 5;

  // Confirmation modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [onConfirm, setOnConfirm] = useState<(() => void) | null>(null);

  // Snackbar state
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

  const fetchLists = async () => {
    setLoading(true);
    try {
      const [sRes, cRes, invRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/subjects`),
        axios.get(`${API_BASE_URL}/courses`),
        axios.get(`${API_BASE_URL}/inventory`)
      ]);
      setSubjects(Array.isArray(sRes.data) ? sRes.data : []);
      setCourses(Array.isArray(cRes.data) ? cRes.data : []);
      setInventory(Array.isArray(invRes.data) ? invRes.data : []);
      
      const subjMap: Record<string, string[]> = {};
      (Array.isArray(sRes.data) ? sRes.data : []).forEach((s: any) => {
        if (Array.isArray(s.courses)) subjMap[s._id] = s.courses;
      });
      setSubjectCourses(subjMap);
    } catch (err) {
      console.error("Failed to fetch subjects/courses", err);
      setSnackbar({ open: true, message: "Failed to fetch data", severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLists(); }, []);

  const showConfirm = (title: string, message: string, onYes: () => void) => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setOnConfirm(() => onYes);
    setConfirmOpen(true);
  };

  const createSubject = async () => {
    if (!newSubject.name.trim()) {
      setSnackbar({ open: true, message: "Subject name required", severity: "error" });
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/subjects`, { 
        name: newSubject.name.trim(), 
        code: newSubject.code.trim() 
      });
      setNewSubject({ name: "", code: "" });
      await fetchLists();
      setSnackbar({ open: true, message: "Subject added successfully", severity: "success" });
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.error || "Failed to create subject", severity: "error" });
    } finally { setLoading(false); }
  };

  const createCourse = async () => {
    if (!newCourse.name.trim()) {
      setSnackbar({ open: true, message: "Program name required", severity: "error" });
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/courses`, { 
        name: newCourse.name.trim(), 
        code: newCourse.code.trim() 
      });
      setNewCourse({ name: "", code: "" });
      await fetchLists();
      setSnackbar({ open: true, message: "Program added successfully", severity: "success" });
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.error || "Failed to create program", severity: "error" });
    } finally { setLoading(false); }
  };

  const deleteSubject = async (id: string) => {
    showConfirm(
      "Delete Subject",
      "Are you sure you want to delete this subject? This action cannot be undone.",
      async () => {
        setConfirmOpen(false);
        try {
          await axios.delete(`${API_BASE_URL}/subjects/${id}`);
          await fetchLists();
          setSnackbar({ open: true, message: "Subject deleted successfully", severity: "success" });
        } catch (err) {
          setSnackbar({ open: true, message: "Failed to delete subject", severity: "error" });
        }
      }
    );
  };

  const deleteCourse = async (id: string) => {
    showConfirm(
      "Delete Program",
      "Are you sure you want to delete this program? This action cannot be undone.",
      async () => {
        setConfirmOpen(false);
        try {
          await axios.delete(`${API_BASE_URL}/courses/${id}`);
          await fetchLists();
          setSnackbar({ open: true, message: "Program deleted successfully", severity: "success" });
        } catch (err) {
          setSnackbar({ open: true, message: "Failed to delete program", severity: "error" });
        }
      }
    );
  };

  const addCourseToSubject = async (subjectId: string, courseId: string) => {
    if (!courseId) return;
    setLoading(true);
    try {
      await axios.patch(`${API_BASE_URL}/subjects/${subjectId}`, { addCourse: courseId });
      await fetchLists();
      setSnackbar({ open: true, message: "Program linked to subject successfully", severity: "success" });
    } catch (err) {
      setSnackbar({ open: true, message: "Failed to link program to subject", severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  const removeCourseFromSubject = async (subjectId: string, courseId: string) => {
    setLoading(true);
    try {
      await axios.patch(`${API_BASE_URL}/subjects/${subjectId}`, { removeCourse: courseId });
      await fetchLists();
      setSnackbar({ open: true, message: "Program unlinked from subject successfully", severity: "success" });
    } finally {
      setLoading(false);
    }
  };

  // Item management functions
  const openItemDialog = (subject: Subject) => {
    setSelectedSubjectForItems(subject);
    // Load existing items
    const existingItems = subject.required_items || [];
    const consumables = existingItems.filter(i => i.item_type === "consumable");
    const nonConsumables = existingItems.filter(i => i.item_type === "non-consumable");
    setConsumableItems(consumables);
    setNonConsumableItems(nonConsumables);
    setItemDialogOpen(true);
  };

  const getInventoryOptions = (type: "consumable" | "non-consumable", search: string = "") =>
    inventory.filter(
      (i) =>
        (type === "consumable" ? i.is_consumable : !i.is_consumable) &&
        (!search || i.equipment_name.toLowerCase().includes(search.toLowerCase()))
    );

  const handleAddConsumable = () => {
    const customName = currentConsumable.custom_name?.trim() || "";
    if (
      (currentConsumable.item_name === "Other" && customName) ||
      (currentConsumable.item_name && currentConsumable.item_name !== "Other")
    ) {
      const newItem: RequiredItem = {
        item_name: currentConsumable.item_name === "Other" ? customName : currentConsumable.item_name,
        quantity: currentConsumable.quantity,
        item_type: "consumable",
        item_id: currentConsumable.selected_num || undefined,
      };
      setConsumableItems(prev => [...prev, newItem]);
      setCurrentConsumable({
        item_name: "",
        quantity: 1,
        item_type: "consumable",
        custom_name: "",
        selected_num: "",
      });
      setConsumableSearch("");
    }
  };

  const handleAddNonConsumable = () => {
    const customName = currentNonConsumable.custom_name?.trim() || "";
    if (
      (currentNonConsumable.item_name === "Other" && customName) ||
      (currentNonConsumable.item_name && currentNonConsumable.item_name !== "Other")
    ) {
      const newItem: RequiredItem = {
        item_name: currentNonConsumable.item_name === "Other" ? customName : currentNonConsumable.item_name,
        quantity: currentNonConsumable.quantity,
        item_type: "non-consumable",
        item_id: currentNonConsumable.selected_num || undefined,
      };
      setNonConsumableItems(prev => [...prev, newItem]);
      setCurrentNonConsumable({
        item_name: "",
        quantity: 1,
        item_type: "non-consumable",
        custom_name: "",
        selected_num: "",
      });
      setNonConsumableSearch("");
    }
  };

  const handleRemoveConsumable = (index: number) => {
    setConsumableItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveNonConsumable = (index: number) => {
    setNonConsumableItems(prev => prev.filter((_, i) => i !== index));
  };

  const saveSubjectItems = async () => {
    if (!selectedSubjectForItems) return;
    
    setLoading(true);
    try {
      const allItems = [...consumableItems, ...nonConsumableItems];
      await axios.patch(`${API_BASE_URL}/subjects/${selectedSubjectForItems._id}`, {
        required_items: allItems
      });
      await fetchLists();
      setItemDialogOpen(false);
      setSnackbar({ open: true, message: "Required items updated successfully", severity: "success" });
    } catch (err) {
      setSnackbar({ open: true, message: "Failed to update required items", severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  const filteredSubjects = subjects.filter(s => 
    s.name.toLowerCase().includes(searchSubject.toLowerCase()) ||
    (s.code && s.code.toLowerCase().includes(searchSubject.toLowerCase()))
  );

  const filteredCourses = courses.filter(c => 
    c.name.toLowerCase().includes(searchCourse.toLowerCase()) ||
    (c.code && c.code.toLowerCase().includes(searchCourse.toLowerCase()))
  );

  const paginatedSubjects = filteredSubjects.slice(subjectPage * rowsPerPage, subjectPage * rowsPerPage + rowsPerPage);
  const paginatedCourses = filteredCourses.slice(coursePage * rowsPerPage, coursePage * rowsPerPage + rowsPerPage);

  const canEdit = userRole === "Custodian" || userRole === "Admin";

  // Calculate total items for a subject
  const getTotalRequiredItems = (subject: Subject) => {
    const items = subject.required_items || [];
    return items.reduce((sum, item) => sum + item.quantity, 0);
  };

  const ItemsTable = ({ items, onRemove, type }: { items: RequiredItem[]; onRemove: (index: number) => void; type: "consumable" | "non-consumable" }) => (
    <TableContainer component={Paper} sx={{ mt: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: type === "consumable" ? alphaColor("#4caf50", 0.1) : alphaColor("#2196f3", 0.1) }}>
            <TableCell><strong>Item Name</strong></TableCell>
            <TableCell align="center"><strong>Quantity</strong></TableCell>
            <TableCell align="center"><strong>Type</strong></TableCell>
            <TableCell align="center"><strong>Action</strong></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item, index) => (
            <TableRow key={index}>
              <TableCell>
                <Typography fontWeight="medium">
                  {item.item_name}
                  {item.item_id && (
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      [ID: {item.item_id}]
                    </Typography>
                  )}
                </Typography>
              </TableCell>
              <TableCell align="center">
                <Chip label={item.quantity} size="small" color={type === "consumable" ? "success" : "info"} />
              </TableCell>
              <TableCell align="center">
                <Chip 
                  label={type === "consumable" ? "Consumable" : "Non-Consumable"} 
                  size="small" 
                  variant="outlined"
                  color={type === "consumable" ? "success" : "info"}
                />
              </TableCell>
              <TableCell align="center">
                <IconButton color="error" size="small" onClick={() => onRemove(index)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                <Typography color="text.secondary">No items added yet</Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Backdrop open={loading} sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={60} thickness={4} sx={{ color: "#F8A41A" }} />
          <Typography variant="h6" sx={{ color: "#fff" }}>Processing...</Typography>
        </Stack>
      </Backdrop>

      {/* UB Branding Header */}
      <Fade in timeout={500}>
        <Box sx={{ mb: 4, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <img src={UBLogo} alt="University of Baguio" style={{ height: 56, borderRadius: 12, background: "#fff", boxShadow: "0 2px 8px rgba(183,28,28,0.08)" }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: "bold", color: "#B71C1C" }}>
                Courses & Programs
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage academic subjects, program offerings, and required items per subject
              </Typography>
            </Box>
          </Box>
          <Tooltip title="Refresh Data">
            <IconButton onClick={fetchLists} sx={{ bgcolor: alphaColor("#B71C1C", 0.1), "&:hover": { bgcolor: alphaColor("#B71C1C", 0.2) } }}>
              <RefreshIcon sx={{ color: "#B71C1C" }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Fade>

      {/* Summary Cards */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={3} mb={4}>
        <Grow in timeout={600}>
          <Card sx={{
            flex: 1,
            p: 3,
            borderRadius: 3,
            background: `linear-gradient(135deg, ${alphaColor("#B71C1C", 0.05)} 0%, ${alphaColor("#B71C1C", 0.15)} 100%)`,
            border: `1px solid ${alphaColor("#B71C1C", 0.2)}`,
            transition: "transform 0.2s, box-shadow 0.2s",
            "&:hover": { transform: "translateY(-4px)", boxShadow: "0 8px 24px rgba(183,28,28,0.15)" }
          }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box sx={{ p: 1.5, borderRadius: "50%", bgcolor: alphaColor("#B71C1C", 0.1) }}>
                <BookIcon sx={{ fontSize: 32, color: "#B71C1C" }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Total Subjects</Typography>
                <Typography variant="h3" sx={{ fontWeight: "bold", color: "#B71C1C" }}>{subjects.length}</Typography>
              </Box>
            </Stack>
          </Card>
        </Grow>
        
        <Grow in timeout={700}>
          <Card sx={{
            flex: 1,
            p: 3,
            borderRadius: 3,
            background: `linear-gradient(135deg, ${alphaColor("#757575", 0.05)} 0%, ${alphaColor("#757575", 0.15)} 100%)`,
            border: `1px solid ${alphaColor("#757575", 0.2)}`,
            transition: "transform 0.2s, box-shadow 0.2s",
            "&:hover": { transform: "translateY(-4px)", boxShadow: "0 8px 24px rgba(117,117,117,0.15)" }
          }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box sx={{ p: 1.5, borderRadius: "50%", bgcolor: alphaColor("#757575", 0.1) }}>
                <SchoolIcon sx={{ fontSize: 32, color: "#757575" }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Total Programs</Typography>
                <Typography variant="h3" sx={{ fontWeight: "bold", color: "#757575" }}>{courses.length}</Typography>
              </Box>
            </Stack>
          </Card>
        </Grow>
      </Stack>

      {/* Tabs for better organization */}
      <Tabs 
        value={activeTab} 
        onChange={(_, val) => setActiveTab(val)}
        sx={{ mb: 3, borderBottom: `2px solid ${alphaColor("#B71C1C", 0.2)}` }}
      >
        <Tab 
          label="Courses & Program Links" 
          icon={<BookIcon />} 
          iconPosition="start"
          sx={{ fontWeight: "bold", "&.Mui-selected": { color: "#B71C1C" } }}
        />
        <Tab 
          label="Programs Management" 
          icon={<SchoolIcon />} 
          iconPosition="start"
          sx={{ fontWeight: "bold", "&.Mui-selected": { color: "#757575" } }}
        />
      </Tabs>

      {activeTab === 0 && (
        <Fade in={activeTab === 0}>
          <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", overflow: "hidden" }}>
            {/* Subjects Header */}
            <Box sx={{ p: 3, bgcolor: alphaColor("#B71C1C", 0.03), borderBottom: `1px solid ${alphaColor("#B71C1C", 0.1)}` }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems="center">
                <Typography variant="h6" sx={{ color: "#B71C1C", fontWeight: "bold", display: "flex", alignItems: "center", gap: 1 }}>
                  <BookIcon /> Course Management
                </Typography>
                <Stack direction="row" spacing={2} sx={{ width: { xs: "100%", sm: "auto" } }}>
                  <TextField
                    placeholder="Search subjects..."
                    size="small"
                    value={searchSubject}
                    onChange={(e) => { setSearchSubject(e.target.value); setSubjectPage(0); }}
                    sx={{ minWidth: 200 }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                    }}
                  />
                  {canEdit && (
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={createSubject}
                      disabled={!newSubject.name.trim()}
                      sx={{ bgcolor: "#B71C1C", "&:hover": { bgcolor: "#9f1515" }, textTransform: "none", fontWeight: "bold" }}
                    >
                      Add Subject
                    </Button>
                  )}
                </Stack>
              </Stack>
              
              {canEdit && (
                <Stack direction="row" spacing={2} mt={2}>
                  <TextField
                    label="Subject Name"
                    value={newSubject.name}
                    onChange={(e) => setNewSubject(s => ({ ...s, name: e.target.value }))}
                    size="small"
                    fullWidth
                    placeholder="e.g., Mathematics"
                  />
                  <TextField
                    label="Subject Code (Optional)"
                    value={newSubject.code}
                    onChange={(e) => setNewSubject(s => ({ ...s, code: e.target.value }))}
                    size="small"
                    fullWidth
                    placeholder="e.g., MATH101"
                  />
                </Stack>
              )}
            </Box>

            {/* Subjects Table */}
            <Box sx={{ overflowX: "auto" }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: alphaColor("#B71C1C", 0.05) }}>
                    <TableCell sx={{ fontWeight: "bold", color: "#B71C1C" }}>Subject Name</TableCell>
                    <TableCell sx={{ fontWeight: "bold", color: "#B71C1C" }}>Code</TableCell>
                    <TableCell sx={{ fontWeight: "bold", color: "#B71C1C" }}>Linked Programs</TableCell>
                    <TableCell sx={{ fontWeight: "bold", color: "#B71C1C" }} align="center">Required Items</TableCell>
                    {canEdit && <TableCell sx={{ fontWeight: "bold", color: "#B71C1C" }} align="right">Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedSubjects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canEdit ? 5 : 4} align="center" sx={{ py: 6 }}>
                        <Stack alignItems="center" spacing={1}>
                          <BookIcon sx={{ fontSize: 48, color: alphaColor("#B71C1C", 0.3) }} />
                          <Typography color="text.secondary">No subjects found</Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedSubjects.map((subject) => (
                      <TableRow key={subject._id} hover>
                        <TableCell>
                          <Typography fontWeight="medium">{subject.name}</Typography>
                        </TableCell>
                        <TableCell>
                          {subject.code ? (
                            <Chip label={subject.code} size="small" sx={{ bgcolor: alphaColor("#B71C1C", 0.1), color: "#B71C1C" }} />
                          ) : (
                            <Typography variant="body2" color="text.secondary">—</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            {(subjectCourses[subject._id] || []).map(cid => {
                              const course = courses.find(c => c._id === cid);
                              return course ? (
                                <Chip
                                  key={cid}
                                  label={course.name}
                                  size="small"
                                  onDelete={canEdit ? () => removeCourseFromSubject(subject._id, cid) : undefined}
                                  deleteIcon={canEdit ? <LinkOffIcon /> : undefined}
                                  sx={{ bgcolor: alphaColor("#F8A41A", 0.15), color: "#B71C1C", fontWeight: 500 }}
                                />
                              ) : null;
                            })}
                            {canEdit && (
                              <TextField
                                select
                                size="small"
                                value=""
                                onChange={e => addCourseToSubject(subject._id, e.target.value)}
                                SelectProps={{
                                  native: true,
                                  displayEmpty: true,
                                }}
                                sx={{ minWidth: 140 }}
                              >
                                <option value="">+ Link Program</option>
                                {courses.filter(c => !(subjectCourses[subject._id] || []).includes(c._id)).map(c => (
                                  <option key={c._id} value={c._id}>{c.name}</option>
                                ))}
                              </TextField>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Manage Required Items">
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<InventoryIcon />}
                              onClick={() => openItemDialog(subject)}
                              sx={{ 
                                borderColor: "#F8A41A", 
                                color: "#B71C1C",
                                "&:hover": { bgcolor: alphaColor("#F8A41A", 0.1) }
                              }}
                            >
                              {getTotalRequiredItems(subject)} Items
                            </Button>
                          </Tooltip>
                        </TableCell>
                        {canEdit && (
                          <TableCell align="right">
                            <Tooltip title="Delete Subject">
                              <IconButton size="small" onClick={() => deleteSubject(subject._id)} sx={{ color: "#B71C1C" }}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Box>
            
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={filteredSubjects.length}
              rowsPerPage={rowsPerPage}
              page={subjectPage}
              onPageChange={(_, newPage) => setSubjectPage(newPage)}
              onRowsPerPageChange={() => {}}
              labelRowsPerPage="Rows per page"
            />
          </Card>
        </Fade>
      )}

      {activeTab === 1 && (
        <Fade in={activeTab === 1}>
          <Card sx={{ borderRadius: 3, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", overflow: "hidden" }}>
            {/* Programs Header */}
            <Box sx={{ p: 3, bgcolor: alphaColor("#757575", 0.03), borderBottom: `1px solid ${alphaColor("#757575", 0.1)}` }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems="center">
                <Typography variant="h6" sx={{ color: "#757575", fontWeight: "bold", display: "flex", alignItems: "center", gap: 1 }}>
                  <SchoolIcon /> Program Management
                </Typography>
                <Stack direction="row" spacing={2} sx={{ width: { xs: "100%", sm: "auto" } }}>
                  <TextField
                    placeholder="Search programs..."
                    size="small"
                    value={searchCourse}
                    onChange={(e) => { setSearchCourse(e.target.value); setCoursePage(0); }}
                    sx={{ minWidth: 200 }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                    }}
                  />
                  {canEdit && (
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={createCourse}
                      disabled={!newCourse.name.trim()}
                      sx={{ bgcolor: "#757575", "&:hover": { bgcolor: "#616161" }, textTransform: "none", fontWeight: "bold" }}
                    >
                      Add Program
                    </Button>
                  )}
                </Stack>
              </Stack>
              
              {canEdit && (
                <Stack direction="row" spacing={2} mt={2}>
                  <TextField
                    label="Program Name"
                    value={newCourse.name}
                    onChange={(e) => setNewCourse(c => ({ ...c, name: e.target.value }))}
                    size="small"
                    fullWidth
                    placeholder="e.g., Bachelor of Science in Computer Science"
                  />
                  <TextField
                    label="Program Code (Optional)"
                    value={newCourse.code}
                    onChange={(e) => setNewCourse(c => ({ ...c, code: e.target.value }))}
                    size="small"
                    fullWidth
                    placeholder="e.g., BSCS"
                  />
                </Stack>
              )}
            </Box>

            {/* Programs Table */}
            <Box sx={{ overflowX: "auto" }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: alphaColor("#757575", 0.05) }}>
                    <TableCell sx={{ fontWeight: "bold", color: "#757575" }}>Program Name</TableCell>
                    <TableCell sx={{ fontWeight: "bold", color: "#757575" }}>Code</TableCell>
                    {canEdit && <TableCell sx={{ fontWeight: "bold", color: "#757575" }} align="right">Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedCourses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canEdit ? 3 : 2} align="center" sx={{ py: 6 }}>
                        <Stack alignItems="center" spacing={1}>
                          <SchoolIcon sx={{ fontSize: 48, color: alphaColor("#757575", 0.3) }} />
                          <Typography color="text.secondary">No programs found</Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedCourses.map((course) => (
                      <TableRow key={course._id} hover>
                        <TableCell>
                          <Typography fontWeight="medium">{course.name}</Typography>
                        </TableCell>
                        <TableCell>
                          {course.code ? (
                            <Chip label={course.code} size="small" sx={{ bgcolor: alphaColor("#757575", 0.1), color: "#757575" }} />
                          ) : (
                            <Typography variant="body2" color="text.secondary">—</Typography>
                          )}
                        </TableCell>
                        {canEdit && (
                          <TableCell align="right">
                            <Tooltip title="Delete Program">
                              <IconButton size="small" onClick={() => deleteCourse(course._id)} sx={{ color: "#757575" }}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Box>
            
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={filteredCourses.length}
              rowsPerPage={rowsPerPage}
              page={coursePage}
              onPageChange={(_, newPage) => setCoursePage(newPage)}
              onRowsPerPageChange={() => {}}
              labelRowsPerPage="Rows per page"
            />
          </Card>
        </Fade>
      )}

      {/* Item Assignment Dialog */}
      <Dialog 
        open={itemDialogOpen} 
        onClose={() => setItemDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ bgcolor: alphaColor("#B71C1C", 0.05), borderBottom: `1px solid ${alphaColor("#B71C1C", 0.1)}` }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <InventoryIcon sx={{ color: "#B71C1C" }} />
            <Box>
              <Typography variant="h6" fontWeight="bold" sx={{ color: "#B71C1C" }}>
                Required Items for {selectedSubjectForItems?.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Define what items are needed for this subject each semester
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Stack spacing={4}>
            {/* Consumable Items Section */}
            <Paper sx={{ p: 3, bgcolor: alphaColor("#4caf50", 0.04), borderRadius: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <ScienceIcon color="success" />
                  <Typography variant="h6" color="success.main" fontWeight="bold">
                    Consumable Items
                  </Typography>
                </Box>
                <Chip label={`Total: ${consumableItems.reduce((sum, i) => sum + i.quantity, 0)} items`} color="success" />
              </Box>

              {/* Add Consumable Form */}
              <Stack spacing={2} sx={{ mb: 3 }}>
                <TextField
                  label="Search Consumable Items"
                  value={consumableSearch}
                  onChange={(e) => setConsumableSearch(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="Type to search inventory..."
                />
                <FormControl fullWidth size="small">
                  <InputLabel>Select Consumable Item</InputLabel>
                  <Select
                    value={currentConsumable.selected_num || (currentConsumable.item_name === "Other" ? "Other" : "")}
                    label="Select Consumable Item"
                    onChange={(e) => {
                      const selectedNum = String(e.target.value);
                      if (selectedNum === "Other") {
                        setCurrentConsumable(prev => ({
                          ...prev,
                          item_name: "Other",
                          selected_num: "",
                          custom_name: "",
                        }));
                        return;
                      }
                      const inv = getInventoryOptions("consumable", consumableSearch).find(i => String(i.num) === selectedNum);
                      if (inv) {
                        setCurrentConsumable(prev => ({
                          ...prev,
                          item_name: inv.equipment_name,
                          selected_num: selectedNum,
                          custom_name: "",
                        }));
                      }
                    }}
                  >
                    {getInventoryOptions("consumable", consumableSearch).map((item) => (
                      <MenuItem key={item.num} value={item.num}>
                        {item.equipment_name} (Available: {item.available})
                      </MenuItem>
                    ))}
                    <MenuItem value="Other">Other (Specify)</MenuItem>
                  </Select>
                </FormControl>
                {currentConsumable.item_name === "Other" && (
                  <TextField
                    label="Custom Item Name"
                    value={currentConsumable.custom_name}
                    onChange={(e) => setCurrentConsumable(prev => ({ ...prev, custom_name: e.target.value }))}
                    fullWidth
                    size="small"
                    required
                  />
                )}
                <TextField
                  label="Quantity Needed"
                  type="number"
                  value={currentConsumable.quantity}
                  onChange={(e) => setCurrentConsumable(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                  size="small"
                  inputProps={{ min: 1 }}
                  sx={{ width: 200 }}
                />
                <Button
                  startIcon={<AddIcon />}
                  onClick={handleAddConsumable}
                  variant="contained"
                  color="success"
                  disabled={
                    !currentConsumable.item_name ||
                    (currentConsumable.item_name === "Other" && !currentConsumable.custom_name?.trim()) ||
                    currentConsumable.quantity < 1
                  }
                  sx={{ alignSelf: "flex-start" }}
                >
                  Add Consumable Item
                </Button>
              </Stack>

              <ItemsTable items={consumableItems} onRemove={handleRemoveConsumable} type="consumable" />
            </Paper>

            {/* Non-Consumable Items Section */}
            <Paper sx={{ p: 3, bgcolor: alphaColor("#2196f3", 0.04), borderRadius: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <BuildIcon color="info" />
                  <Typography variant="h6" color="info.main" fontWeight="bold">
                    Non-Consumable Items
                  </Typography>
                </Box>
                <Chip label={`Total: ${nonConsumableItems.reduce((sum, i) => sum + i.quantity, 0)} items`} color="info" />
              </Box>

              {/* Add Non-Consumable Form */}
              <Stack spacing={2} sx={{ mb: 3 }}>
                <TextField
                  label="Search Non-Consumable Items"
                  value={nonConsumableSearch}
                  onChange={(e) => setNonConsumableSearch(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="Type to search inventory..."
                />
                <FormControl fullWidth size="small">
                  <InputLabel>Select Non-Consumable Item</InputLabel>
                  <Select
                    value={currentNonConsumable.selected_num || (currentNonConsumable.item_name === "Other" ? "Other" : "")}
                    label="Select Non-Consumable Item"
                    onChange={(e) => {
                      const selectedNum = String(e.target.value);
                      if (selectedNum === "Other") {
                        setCurrentNonConsumable(prev => ({
                          ...prev,
                          item_name: "Other",
                          selected_num: "",
                          custom_name: "",
                        }));
                        return;
                      }
                      const inv = getInventoryOptions("non-consumable", nonConsumableSearch).find(i => String(i.num) === selectedNum);
                      if (inv) {
                        setCurrentNonConsumable(prev => ({
                          ...prev,
                          item_name: inv.equipment_name,
                          selected_num: selectedNum,
                          custom_name: "",
                        }));
                      }
                    }}
                  >
                    {getInventoryOptions("non-consumable", nonConsumableSearch).map((item) => (
                      <MenuItem key={item.num} value={item.num}>
                        {item.equipment_name} (Available: {item.available})
                      </MenuItem>
                    ))}
                    <MenuItem value="Other">Other (Specify)</MenuItem>
                  </Select>
                </FormControl>
                {currentNonConsumable.item_name === "Other" && (
                  <TextField
                    label="Custom Item Name"
                    value={currentNonConsumable.custom_name}
                    onChange={(e) => setCurrentNonConsumable(prev => ({ ...prev, custom_name: e.target.value }))}
                    fullWidth
                    size="small"
                    required
                  />
                )}
                <TextField
                  label="Quantity Needed"
                  type="number"
                  value={currentNonConsumable.quantity}
                  onChange={(e) => setCurrentNonConsumable(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                  size="small"
                  inputProps={{ min: 1 }}
                  sx={{ width: 200 }}
                />
                <Button
                  startIcon={<AddIcon />}
                  onClick={handleAddNonConsumable}
                  variant="contained"
                  color="info"
                  disabled={
                    !currentNonConsumable.item_name ||
                    (currentNonConsumable.item_name === "Other" && !currentNonConsumable.custom_name?.trim()) ||
                    currentNonConsumable.quantity < 1
                  }
                  sx={{ alignSelf: "flex-start" }}
                >
                  Add Non-Consumable Item
                </Button>
              </Stack>

              <ItemsTable items={nonConsumableItems} onRemove={handleRemoveNonConsumable} type="non-consumable" />
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, bgcolor: alphaColor("#B71C1C", 0.05) }}>
          <Button onClick={() => setItemDialogOpen(false)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            onClick={saveSubjectItems}
            variant="contained"
            sx={{ bgcolor: "#B71C1C", "&:hover": { bgcolor: "#9f1515" }, textTransform: "none", fontWeight: "bold" }}
          >
            Save Required Items
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Modal */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: "bold", color: "#B71C1C" }}>{confirmTitle}</DialogTitle>
        <DialogContent>
          <Typography>{confirmMessage}</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            onClick={() => { if (onConfirm) onConfirm(); }}
            variant="contained"
            color="error"
            sx={{ textTransform: "none", fontWeight: "bold" }}
          >
            Yes, Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          icon={snackbar.severity === "success" ? <CheckCircleIcon /> : undefined}
          sx={{ borderRadius: 2, fontWeight: "medium", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}