// src/pages/FacultyReservationPage.tsx
import { useState, useEffect, useRef, useLayoutEffect } from "react";
import {
  Container,
  Card,
  Typography,
  Box,
  Stack,
  Tooltip,
  TextField,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  alpha,
  useTheme,
  Tabs,
  Tab,
  CircularProgress,
  Backdrop,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Badge,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EventIcon from "@mui/icons-material/Event";
import ScienceIcon from "@mui/icons-material/Science";
import BuildIcon from "@mui/icons-material/Build";
import InboxIcon from "@mui/icons-material/Inbox";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ChatBubbleIcon from "@mui/icons-material/ChatBubble";
import SendIcon from "@mui/icons-material/Send";
import EditIcon from "@mui/icons-material/Edit";
import ListIcon from "@mui/icons-material/List";
import axios from "axios";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

const API_BASE_URL = "https://elams.sit.ubaguio.edu/api";

interface RequestedItem {
  item_name: string;
  quantity: number;
  item_type: "consumable" | "non-consumable";
}

interface ReservationForm {
  subject: string;
  instructor: string;
  schedule: string;
  scheduleType: "single" | "recurring";
  scheduleDate: string;
  recurringDays: string[];
  recurringEndDate: string;
  course: string;
  room: string;
  startTime: string;
  endTime: string;
  group_count: number;
  needsItems: boolean;
  notes: string;
}

interface Reservation {
  _id: string;
  reservation_code: string;
  subject: string;
  instructor: string;
  instructor_email: string;
  schedule: string;
  startTime?: string;
  endTime?: string;
  course: string;
  room: string;
  group_count: number;
  requested_items: RequestedItem[];
  status: string;
  date_created: string;
  messages?: Array<{
    sender: string;
    sender_name?: string;
    message: string;
    timestamp: string;
  }>;
  user_type?: "Individual" | "Group";
  edits?: any[]; // edit history from server (keeps flexible shape)
  notes?: string; // <-- added so references to reservation.notes compile
}

export default function FacultyReservationPage() {
  const theme = useTheme();
  const brandRed = "#b91c1c";
  const [currentTab, setCurrentTab] = useState(0);
  const [facultyName, setFacultyName] = useState("");

  // --- ADD: Confirmation modal + Snackbar state/helper ---
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [onConfirm, setOnConfirm] = useState<(() => void) | null>(null);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "info";
  }>({ open: false, message: "", severity: "success" });

  const showConfirm = (title: string, message: string, onYes: () => void) => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setOnConfirm(() => onYes);
    setConfirmOpen(true);
  };

  // Reservation Form State
  const [reservationForm, setReservationForm] = useState<ReservationForm>({
    subject: "",
    instructor: "",
    schedule: "",
    scheduleType: "single",
    scheduleDate: new Date().toISOString().split("T")[0],
    recurringDays: [],
    recurringEndDate: "",
    course: "",
    room: "",
    startTime: "09:00",
    endTime: "10:00",
    group_count: 1,
    needsItems: true,
    notes: "",
  });

  const [consumableItems, setConsumableItems] = useState<RequestedItem[]>([]);
  const [nonConsumableItems, setNonConsumableItems] = useState<RequestedItem[]>([]);
  const [consumableSearch, setConsumableSearch] = useState("");
  const [nonConsumableSearch, setNonConsumableSearch] = useState("");
  const [currentConsumable, setCurrentConsumable] = useState<{
    item_name: string;
    quantity: number;
    item_type: "consumable";
    custom_name?: string;
    selected_num?: string;
  }>({
    item_name: "",
    quantity: 1,
    item_type: "consumable",
    custom_name: "",
    selected_num: "",
  });
  const [currentNonConsumable, setCurrentNonConsumable] = useState<{
    item_name: string;
    quantity: number;
    item_type: "non-consumable";
    custom_name?: string;
    selected_num?: string;
  }>({
    item_name: "",
    quantity: 1,
    item_type: "non-consumable",
    custom_name: "",
    selected_num: "",
  });

  // Reservation Inbox State
  const [myReservations, setMyReservations] = useState<Reservation[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [selectedReservationForChat, setSelectedReservationForChat] = useState<Reservation | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  const [saving, setSaving] = useState(false);
  const [successDialog, setSuccessDialog] = useState(false);
  const [reservationCode, setReservationCode] = useState("");

  // Add user_type state (Individual | Group)
  const [userType, setUserType] = useState<"Individual" | "Group">("Individual");
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [currentLogs, setCurrentLogs] = useState<any[]>([]);

  // Inventory state
  const [inventory, setInventory] = useState<{
    num: string;
    equipment_name: string;
    is_consumable: boolean;
    available: number;
  }[]>([]);

  // Subjects and Courses state
  const [subjects, setSubjects] = useState<{ _id: string; name: string; code?: string; courses?: string[] }[]>([]);
  const [courses, setCourses] = useState<{ _id: string; name: string; code?: string }[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedCourse, setSelectedCourse] = useState<string>("");

  // ref to the messages container for automatic scrolling
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // chat polling interval ref -> prevents "startChatPolling/stopChatPolling is not defined" errors
  const chatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startChatPolling = (reservationId: string) => {
    // stop existing interval first
    stopChatPolling();
    chatIntervalRef.current = setInterval(async () => {
      try {
        const resp = await axios.get(`${API_BASE_URL}/reservations/${reservationId}`);
        const updated = resp.data as Reservation;
        setMyReservations((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
        setSelectedReservationForChat((prev) => (prev && prev._id === updated._id ? updated : prev));
      } catch (err) {
        console.error("Chat polling error:", err);
      }
    }, 1000); // faster polling for near real-time
  };

  const stopChatPolling = () => {
    if (chatIntervalRef.current) {
      clearInterval(chatIntervalRef.current);
      chatIntervalRef.current = null;
    }
  };

  // cleanup on unmount
  useEffect(() => {
    return () => {
      stopChatPolling();
    };
  }, []);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (user.name && user.email) {
      setFacultyName(user.name);
      setReservationForm((prev) => ({
        ...prev,
        instructor: user.name,
      }));
    }
    fetchMyReservations();
  }, []);

  // Add inventory fetch on mount
  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/inventory`);
        setInventory(
          Array.isArray(response.data)
            ? response.data.map((item: any) => ({
                num: item.num,
                equipment_name: item.equipment_name,
                is_consumable: item.is_consumable,
                available: item.available ?? 0,
              }))
            : []
        );
      } catch (err) {
        setInventory([]);
      }
    };
    fetchInventory();
  }, []);

  // Fetch subjects & courses on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [sRes, cRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/subjects`),
          axios.get(`${API_BASE_URL}/courses`),
        ]);
        if (!mounted) return;
        setSubjects(Array.isArray(sRes.data) ? sRes.data : []);
        setCourses(Array.isArray(cRes.data) ? cRes.data : []);
      } catch (err) {
        console.error("Failed to fetch subjects/courses", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const fetchMyReservations = async () => {
    setLoadingReservations(true);
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (!user.email) {
        console.error("No user email found in localStorage");
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/reservations`);
      const allReservations = response.data;
      // Filter by current faculty member's email
      const filtered = allReservations
        .filter((res: Reservation) => res.instructor_email && res.instructor_email.toLowerCase() === user.email.toLowerCase())
        .sort((a: Reservation, b: Reservation) => {
          const da = a.date_created ? new Date(a.date_created).getTime() : 0;
          const db = b.date_created ? new Date(b.date_created).getTime() : 0;
          return db - da; // newest first
        });
      setMyReservations(filtered);
    } catch (error) {
      console.error("Fetch reservations error:", error);
    } finally {
      setLoadingReservations(false);
    }
  };

  const generateScheduleString = (): string => {
    if (reservationForm.scheduleType === "single") {
      return reservationForm.scheduleDate;
    } else {
      const days = reservationForm.recurringDays.join(", ");
      const endDate = reservationForm.recurringEndDate ? ` until ${reservationForm.recurringEndDate}` : "";
      return `Every ${days}${endDate}`;
    }
  };

  // For adding consumable/non-consumable items, use dropdown selection
  const getInventoryOptions = (type: "consumable" | "non-consumable", search: string = "") =>
    inventory.filter(
      (i) =>
        (type === "consumable" ? i.is_consumable : !i.is_consumable) &&
        (!search || i.equipment_name.toLowerCase().includes(search.toLowerCase()))
    );

  const handleAddConsumable = () => {
    const customName = typeof currentConsumable.custom_name === "string" ? currentConsumable.custom_name : "";
    if (
      (currentConsumable.item_name === "Other" && customName.trim()) ||
      (currentConsumable.item_name && currentConsumable.item_name !== "Other")
    ) {
      setConsumableItems((prev) => [
        ...prev,
        {
          item_name: currentConsumable.item_name === "Other" ? customName : currentConsumable.item_name,
          quantity: currentConsumable.quantity,
          item_type: "consumable",
          item_id: currentConsumable.selected_num && currentConsumable.item_name !== "Other" ? currentConsumable.selected_num : undefined,
        } as any,
      ]);
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
    const customName = typeof currentNonConsumable.custom_name === "string" ? currentNonConsumable.custom_name : "";
    if (
      (currentNonConsumable.item_name === "Other" && customName.trim()) ||
      (currentNonConsumable.item_name && currentNonConsumable.item_name !== "Other")
    ) {
      setNonConsumableItems((prev) => [
        ...prev,
        {
          item_name: currentNonConsumable.item_name === "Other" ? customName : currentNonConsumable.item_name,
          quantity: currentNonConsumable.quantity,
          item_type: "non-consumable",
          item_id: currentNonConsumable.selected_num && currentNonConsumable.item_name !== "Other" ? currentNonConsumable.selected_num : undefined,
        } as any,
      ]);
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
    setConsumableItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveNonConsumable = (index: number) => {
    setNonConsumableItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculate totals
  const totalConsumableItems = consumableItems.reduce((sum, item) => sum + item.quantity * reservationForm.group_count, 0);
  const totalNonConsumableItems = nonConsumableItems.reduce((sum, item) => sum + item.quantity * reservationForm.group_count, 0);
  const totalAllItems = totalConsumableItems + totalNonConsumableItems;

  // When opening the New Reservation form for edit, populate states
  const openEditForm = (res: Reservation) => {
    setIsEditing(true);
    setEditingId(res._id);
    setReservationForm((prev) => ({
      ...prev,
      subject: res.subject || "",
      instructor: res.instructor || facultyName,
      schedule: res.schedule || "",
      // detect recurring vs single
      scheduleType: String(res.schedule || "").toLowerCase().startsWith("every") ? "recurring" : "single",
      scheduleDate: String(res.schedule || "").match(/^\d{4}-\d{2}-\d{2}/) ? String(res.schedule) : new Date().toISOString().split("T")[0],
      recurringDays: [],
      recurringEndDate: "",
      course: res.course || "",
      room: res.room || "",
      startTime: res.startTime || "09:00",
      endTime: res.endTime || "10:00",
      group_count: res.group_count || 1,
      needsItems: res.requested_items && res.requested_items.length > 0,
      notes: res.notes || "",
    }));
    // Restore selected_num for items if possible
    const consumables: RequestedItem[] = (res.requested_items || [])
      .filter((i) => String(i.item_type).toLowerCase() === "consumable")
      .map((i) => ({
        item_name: i.item_name,
        quantity: i.quantity,
        item_type: "consumable",
        item_id: (i as any).item_id,
      }));
    const noncons: RequestedItem[] = (res.requested_items || [])
      .filter((i) => String(i.item_type).toLowerCase() === "non-consumable")
      .map((i) => ({
        item_name: i.item_name,
        quantity: i.quantity,
        item_type: "non-consumable",
        item_id: (i as any).item_id,
      }));
    setConsumableItems(consumables);
    setNonConsumableItems(noncons);
    setUserType(res.group_count && res.group_count > 1 ? "Group" : "Individual");
    setCurrentTab(1);
  };

  // Submit handler (create or edit)
  const handleSubmit = async () => {
    if (!reservationForm.subject || !reservationForm.instructor || !reservationForm.course || !reservationForm.room) {
      alert("Please fill all required fields");
      return;
    }

    // Validate items if needed
    if (reservationForm.needsItems && consumableItems.length === 0 && nonConsumableItems.length === 0) {
      alert("Please add at least one item or disable 'Items Needed' if no items are required");
      return;
    }

    // Validate schedule
    if (reservationForm.scheduleType === "single" && !reservationForm.scheduleDate) {
      alert("Please select a date for single reservation");
      return;
    }

    if (reservationForm.scheduleType === "recurring" && reservationForm.recurringDays.length === 0) {
      alert("Please select at least one day of the week for recurring reservation");
      return;
    }

    // Validate times
    if (!reservationForm.startTime || !reservationForm.endTime) {
      alert("Please set start and end times");
      return;
    }

    setSaving(true);
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");

      // Build requested items (keeps existing behavior)
      const allItems: any[] = reservationForm.needsItems ? [...consumableItems, ...nonConsumableItems] : [];

      // Build assigned_items from those requested items that already have an item_id (selected from inventory)
      const assigned_items = allItems
        .map((it, idx) => ({ ...it, requested_index: idx })) // temp map
        .filter((it) => (it as any).item_id) // only those assigned from inventory
        .map((it) => ({
          requested_item_index: it.requested_index,
          item_id: it.item_id,
          item_name: it.item_name,
          item_type: it.item_type,
          quantity: it.quantity,
          assigned_by: user.email || user.name || "Unknown",
          date_assigned: new Date(),
        }));

      // Compose payload, include assigned_items when present
      const payload: any = {
        ...reservationForm,
        instructor_email: user.email,
        schedule: generateScheduleString(),
        requested_items: allItems,
        user_type: userType,
      };

      if (assigned_items.length > 0) {
        payload.assigned_items = assigned_items;
        // NOTE: Do NOT set payload.status or date_assigned here.
        // Keep reservation as Pending so staff can approve/assign in workflow.
      }

      if (isEditing && editingId) {
        // call PUT to update reservation and include editor info
        const resp = await axios.put(`${API_BASE_URL}/reservations/${editingId}`, {
          ...payload,
          editedBy: user.email,
          editedName: user.name || user.firstname || user.email,
          editReason: "Edited by faculty",
        });
        // refresh and reset
        await fetchMyReservations();
        setIsEditing(false);
        setEditingId(null);
        setReservationCode(resp.data.reservation_code || resp.data.reservation_code);
        setSuccessDialog(true);
      } else {
        const response = await axios.post(`${API_BASE_URL}/reservations`, payload);
        setReservationCode(response.data.reservation_code);
        setSuccessDialog(true);
      }

      // Reset form
      setReservationForm({
        subject: "",
        instructor: facultyName,
        schedule: "",
        scheduleType: "single",
        scheduleDate: new Date().toISOString().split("T")[0],
        recurringDays: [],
        recurringEndDate: "",
        course: "",
        room: "",
        startTime: "09:00",
        endTime: "10:00",
        group_count: 1,
        needsItems: true,
        notes: "",
      });
      setConsumableItems([]);
      setNonConsumableItems([]);

      // Refresh reservations inbox
      await fetchMyReservations();
    } catch (error) {
      console.error("Create/update reservation error:", error);
      alert("Failed to save reservation");
    } finally {
      setSaving(false);
    }
  };

  // helper: count unseen messages for current user
  const unseenCount = (reservation: Reservation) => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const email = (user && (user.email || user.name)) || "";
      if (!email) return 0;
      return (reservation.messages || []).filter((m) => !(m as any).seen_by || !(m as any).seen_by.includes(email)).length;
    } catch (e) {
      return 0;
    }
  };

  const handleOpenChat = async (reservation: Reservation) => {
    setSelectedReservationForChat(reservation);
    setMessageDialogOpen(true);
    setMessageText("");

    // mark messages seen on server and refresh the reservation locally
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userEmail = user.email || user.name || "Unknown";
      await axios.post(`${API_BASE_URL}/reservations/${reservation._id}/messages-seen`, {
        user_email: userEmail,
      });

      // fetch updated reservation to update messages/seen_by immediately
      const resp = await axios.get(`${API_BASE_URL}/reservations/${reservation._id}`);
      const updated = resp.data as Reservation;

      // update chat state and inbox (replace or append)
      setSelectedReservationForChat(updated);
      setMyReservations((prev) => {
        const exists = prev.some((r) => r._id === updated._id);
        return exists ? prev.map((r) => (r._id === updated._id ? updated : r)) : [updated, ...prev];
      });

      // ensure scroll after render
      setTimeout(() => {
        try {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        } catch (e) {}
      }, 50);
    } catch (err) {
      console.error("Mark messages seen error:", err);
    }

    startChatPolling(reservation._id);
  };

  const handleSendMessage = async () => {
    if (!selectedReservationForChat || !messageText.trim()) {
      return;
    }

    setSendingMessage(true);
    try {
      const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
      const userIdentifier = currentUser.email || currentUser.name || "Unknown";
      const userName = currentUser.name || userIdentifier;

      const resp = await axios.post(`${API_BASE_URL}/reservations/${selectedReservationForChat._id}/message`, {
        sender: userIdentifier,
        sender_name: userName,
        message: messageText,
      });

      const updated = resp.data as Reservation;

      try {
        await axios.post(`${API_BASE_URL}/reservations/${selectedReservationForChat._id}/messages-seen`, {
          user_email: userIdentifier,
        });
      } catch (e) {
        // non-fatal
      }

      setSelectedReservationForChat(updated);
      startChatPolling(updated._id);
      setMessageText("");
      setTimeout(() => {
        try {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        } catch (e) {}
      }, 50);
    } catch (error) {
      console.error("Send message error:", error);
      setSnackbar({ open: true, message: "Failed to send message", severity: "error" });
    } finally {
      setSendingMessage(false);
    }
  };

  // Open edit logs dialog for a reservation (safe if edits is undefined)
  const openLogs = (res: Reservation) => {
    const logs = Array.isArray((res as any).edits) ? (res as any).edits : [];
    setCurrentLogs(logs);
    setLogsOpen(true);
  };

  const scrollToBottom = () => {
    try {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    } catch (e) {}
  };

  // Ensure we scroll when chat opens or when messages change
  useLayoutEffect(() => {
    if (messageDialogOpen && selectedReservationForChat) {
      scrollToBottom();
    }
  }, [messageDialogOpen, selectedReservationForChat?.messages?.length]);

  /* Insert ItemsTable component here */
  const ItemsTable = ({ items, onRemove, type }: { items: RequestedItem[]; onRemove: (index: number) => void; type: "consumable" | "non-consumable" }) => (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>
              <strong>Item Name</strong>
            </TableCell>
            <TableCell align="center">
              <strong>Qty per Group</strong>
            </TableCell>
            <TableCell align="center">
              <strong>Total Qty</strong>
            </TableCell>
            <TableCell align="center">
              <strong>Type</strong>
            </TableCell>
            <TableCell align="center">
              <strong>Action</strong>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item, index) => (
            <TableRow key={index}>
              <TableCell>
                <Typography fontWeight="medium">
                  {item.item_name}
                  {(item as any).item_id && (
                    <span style={{ color: "#888", fontSize: "0.8em", marginLeft: 4 }}>
                      [{(item as any).item_id}]
                    </span>
                  )}
                </Typography>
              </TableCell>
              <TableCell align="center">
                <Chip label={item.quantity} color="primary" size="small" />
              </TableCell>
              <TableCell align="center">
                <Chip label={item.quantity * reservationForm.group_count} color="secondary" size="small" variant="outlined" />
              </TableCell>
              <TableCell align="center">
                <Chip label={type === "consumable" ? "Consumable" : "Non-Consumable"} color={type === "consumable" ? "success" : "info"} size="small" variant="filled" />
              </TableCell>
              <TableCell align="center">
                <IconButton color="error" size="small" onClick={() => onRemove(index)}>
                  <DeleteIcon />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  // --- FIX: delete handler uses fetchReservations ---
  const handleDeleteReservation = async (reservation: any) => {
    const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
    const isStudentAssistant = (currentUser?.role || "") === "Student Assistant";
    if (isStudentAssistant) {
      setSnackbar({ open: true, message: "You are not allowed to delete reservations.", severity: "error" });
      return;
    }

    showConfirm(
      "Delete Reservation",
      `Are you sure you want to delete reservation ${reservation.reservation_code}?`,
      async () => {
        setConfirmOpen(false);
        try {
          await axios.delete(`${API_BASE_URL}/reservations/${reservation._id}`);
          await fetchMyReservations();
          setSnackbar({ open: true, message: "Reservation deleted", severity: "success" });
        } catch (error) {
          console.error("Delete reservation error:", error);
          setSnackbar({ open: true, message: "Failed to delete reservation", severity: "error" });
        }
      }
    );
  };

  // Filter subjects based on selected course
  const filteredSubjects = selectedCourse
    ? subjects.filter(s => (s.courses || []).includes(selectedCourse))
    : subjects;

  // Filter courses based on selected subject
  const filteredCourses = selectedSubject
    ? courses.filter(c => {
        const subj = subjects.find(s => s._id === selectedSubject);
        return subj?.courses?.includes(c._id);
      })
    : courses;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Backdrop sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.modal + 1 }} open={saving}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={60} thickness={4} sx={{ color: theme.palette.primary.main }} />
          <Typography variant="h6" sx={{ color: "#fff" }}>
            Submitting...
          </Typography>
        </Stack>
      </Backdrop>

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" color={brandRed} gutterBottom>
          Faculty Reservation Portal
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {facultyName ? `Welcome, ${facultyName}` : "Create and manage equipment reservations"}
        </Typography>
      </Box>
      

      {/* Tabs */}
      <Card sx={{ mb: 3 }}>
        <Tabs
          value={currentTab}
          onChange={(_, newValue) => setCurrentTab(newValue)}
          sx={{ borderBottom: 1, borderColor: "divider" }}
        >
          <Tab label="My Reservation" icon={<InboxIcon />} iconPosition="start" />
          <Tab label="New Reservation" icon={<AddIcon />} iconPosition="start" />
        </Tabs>
      </Card>

      {/* Tab Content */}
      {currentTab === 1 && (
        // New Reservation Form
        <Card sx={{ p: 4, borderRadius: 3 }}>
          <Stack spacing={3}>
            {/* USER TYPE: Individual / Group selector - choose before filling other info */}
            <Paper sx={{ p: 2, display: "flex", gap: 1, alignItems: "center" }}>
              <Typography variant="subtitle1" sx={{ mr: 2 }}>Reservation for</Typography>
              <Button
                variant={userType === "Individual" ? "contained" : "outlined"}
                onClick={() => {
                  setUserType("Individual");
                  // reset group-specific fields when switching to Individual
                  setReservationForm((prev) => ({ ...prev, group_count: 1 }));
                  setConsumableItems([]);
                  setNonConsumableItems([]);
                  setReservationForm((prev) => ({ ...prev, needsItems: prev.needsItems }));
                }}
              >
                Individual
              </Button>
              <Button
                variant={userType === "Group" ? "contained" : "outlined"}
                onClick={() => {
                  setUserType("Group");
                  // default to 2 groups if switching to Group and it's 1
                  setReservationForm((prev) => ({ ...prev, group_count: Math.max(2, prev.group_count || 2) }));
                }}
              >
                Group
              </Button>
            </Paper>

            {/* Class Information */}
            <Paper sx={{ p: 3, bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
              <Typography variant="h6" gutterBottom color="primary">
                Class Information
              </Typography>
              <Stack spacing={2}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  {/* Subject Select: only show subjects connected to selected course */}
                  <FormControl fullWidth size="small">
                    <InputLabel>Subject</InputLabel>
                    <Select
                      label="Subject"
                      value={selectedSubject}
                      onChange={(e) => {
                        setSelectedSubject(e.target.value);
                        // Set subject name in reservationForm
                        const subj = subjects.find(s => s._id === e.target.value);
                        setReservationForm((prev) => ({ ...prev, subject: subj ? subj.name : "" }));
                      }}
                    >
                      {filteredSubjects.map((s) => (
                        <MenuItem key={s._id} value={s._id}>
                          {s.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {/* Course Select: only show courses connected to selected subject */}
                  <FormControl fullWidth size="small">
                    <InputLabel>Program</InputLabel>
                    <Select
                      label="Program"
                      value={selectedCourse}
                      onChange={(e) => {
                        setSelectedCourse(e.target.value);
                        // Set course name in reservationForm
                        const course = courses.find(c => c._id === e.target.value);
                        setReservationForm((prev) => ({ ...prev, course: course ? course.name : "" }));
                      }}
                    >
                      {filteredCourses.map((c) => (
                        <MenuItem key={c._id} value={c._id}>
                          {c.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>

                <TextField
                  label="Instructor *"
                  value={reservationForm.instructor}
                  disabled
                  fullWidth
                  helperText="Automatically filled from your profile"
                />

                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    label="Room *"
                    value={reservationForm.room}
                    onChange={(e) => setReservationForm((prev) => ({ ...prev, room: e.target.value }))}
                    fullWidth
                  />
                  <TextField
                    label="Number of Groups"
                    type="number"
                    value={reservationForm.group_count}
                    onChange={(e) => setReservationForm((prev) => ({ ...prev, group_count: parseInt(e.target.value) || 1 }))}
                    fullWidth
                    inputProps={{ min: 1 }}
                    disabled={userType === "Individual"} // disable when Individual selected
                  />
                </Stack>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <TextField
                    label="Start Time *"
                    type="time"
                    value={reservationForm.startTime}
                    onChange={(e) => setReservationForm((prev) => ({ ...prev, startTime: e.target.value }))}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label="End Time *"
                    type="time"
                    value={reservationForm.endTime}
                    onChange={(e) => setReservationForm((prev) => ({ ...prev, endTime: e.target.value }))}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Stack>

                {/* Schedule Section */}
                <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.warning.main, 0.05), borderRadius: 2 }}>
                  <Typography
                    variant="subtitle2"
                    fontWeight="bold"
                    gutterBottom
                    sx={{ display: "flex", alignItems: "center", gap: 1 }}
                  >
                    <EventIcon fontSize="small" /> Schedule
                  </Typography>

                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Schedule Type</InputLabel>
                    <Select
                      value={reservationForm.scheduleType}
                      onChange={(e) => setReservationForm((prev) => ({ ...prev, scheduleType: e.target.value as "single" | "recurring" }))}
                      label="Schedule Type"
                    >
                      <MenuItem value="single">Single Date</MenuItem>
                      <MenuItem value="recurring">Recurring (Weekly)</MenuItem>
                    </Select>
                  </FormControl>

                  {reservationForm.scheduleType === "single" ? (
                    <TextField
                      type="date"
                      label="Date *"
                      value={reservationForm.scheduleDate}
                      onChange={(e) => setReservationForm((prev) => ({ ...prev, scheduleDate: e.target.value }))}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                  ) : (
                    <Stack spacing={2}>
                      <Typography variant="subtitle2" fontWeight="bold">
                        Select Days of Week *
                      </Typography>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                          gap: 1,
                        }}
                      >
                        {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                          <Box
                            key={day}
                            onClick={() => {
                              setReservationForm((prev) => {
                                const days = prev.recurringDays.includes(day)
                                  ? prev.recurringDays.filter((d) => d !== day)
                                  : [...prev.recurringDays, day];
                                return { ...prev, recurringDays: days };
                              });
                            }}
                            sx={{
                              p: 1.5,
                              border: "2px solid",
                              borderColor: reservationForm.recurringDays.includes(day) ? "primary.main" : "divider",
                              borderRadius: 2,
                              cursor: "pointer",
                              textAlign: "center",
                              transition: "all 0.2s",
                              bgcolor:
                                reservationForm.recurringDays.includes(day) ? alpha(theme.palette.primary.main, 0.1) : "transparent",
                              "&:hover": {
                                borderColor: "primary.main",
                                bgcolor: alpha(theme.palette.primary.main, 0.05),
                              },
                            }}
                          >
                            <Typography
                              variant="body2"
                              fontWeight={reservationForm.recurringDays.includes(day) ? "bold" : "medium"}
                              color={reservationForm.recurringDays.includes(day) ? "primary" : "text.primary"}
                            >
                              {day}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                      <TextField
                        type="date"
                        label="End Date (Optional)"
                        value={reservationForm.recurringEndDate}
                        onChange={(e) => setReservationForm((prev) => ({ ...prev, recurringEndDate: e.target.value }))}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        helperText="Leave empty for no end date"
                      />
                      {reservationForm.recurringDays.length > 0 && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ p: 1, bgcolor: alpha(theme.palette.info.main, 0.1), borderRadius: 1 }}
                        >
                          📅 Recurring: Every {reservationForm.recurringDays.join(", ")}{" "}
                          {reservationForm.recurringEndDate ? `until ${reservationForm.recurringEndDate}` : " (ongoing)"}
                        </Typography>
                      )}
                      {reservationForm.recurringDays.length === 0 && (
                        <Typography
                          variant="caption"
                          color="error"
                          sx={{ p: 1, bgcolor: alpha(theme.palette.error.main, 0.1), borderRadius: 1 }}
                        >
                          ⚠️ Please select at least one day of the week
                        </Typography>
                      )}
                    </Stack>
                  )}
                </Paper>

                <TextField
                  label="Additional Notes (Optional)"
                  value={reservationForm.notes}
                  onChange={(e) => setReservationForm((prev) => ({ ...prev, notes: e.target.value }))}
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="Any additional information about your reservation"
                />
              </Stack>
            </Paper>

            {/* Items Needed Toggle */}
            <Paper sx={{ p: 3, bgcolor: alpha(theme.palette.success.main, 0.04) }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box
                  onClick={() => setReservationForm((prev) => ({ ...prev, needsItems: !prev.needsItems }))}
                  sx={{
                    p: 1.5,
                    border: "2px solid",
                    borderColor: reservationForm.needsItems ? "success.main" : "divider",
                    borderRadius: 2,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    bgcolor: reservationForm.needsItems ? alpha(theme.palette.success.main, 0.1) : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 50,
                    minHeight: 50,
                  }}
                >
                  <Typography variant="h6" color={reservationForm.needsItems ? "success.main" : "text.disabled"}>
                    {reservationForm.needsItems ? "✓" : "○"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Do you need equipment items for this reservation?
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {reservationForm.needsItems
                      ? "Click below to add consumable and non-consumable items"
                      : "No items will be requested for this reservation"}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* Requested Items - Two Sections (Only show if needsItems is true) */}
            {reservationForm.needsItems && (
              <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
                {/* Consumable Items */}
                <Paper sx={{ p: 3, bgcolor: alpha(theme.palette.success.main, 0.04), flex: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <ScienceIcon color="success" />
                      <Typography variant="h6" color="success.main">
                        Consumable Items
                      </Typography>
                    </Box>
                    <Chip label={`Total: ${totalConsumableItems}`} color="success" variant="filled" />
                  </Box>

                  {/* Consumable Item Form */}
                  <Stack spacing={2} sx={{ mb: 3 }}>
                    <TextField
                      label="Search Consumable Item"
                      value={consumableSearch}
                      onChange={(e) => setConsumableSearch(e.target.value)}
                      fullWidth
                      placeholder="Type to search inventory..."
                    />
                    <FormControl fullWidth>
                      <InputLabel>Select Consumable Item</InputLabel>
                      <Select
                        value={currentConsumable.selected_num || (currentConsumable.item_name === "Other" ? "Other" : "")}
                        label="Select Consumable Item"
                        onChange={(e) => {
                          const selectedNum = String(e.target.value);
                          if (selectedNum === "Other") {
                            setCurrentConsumable((prev) => ({
                              ...prev,
                              item_name: "Other",
                              selected_num: "",
                              custom_name: "",
                            }));
                            return;
                          }
                          const inv = getInventoryOptions("consumable", consumableSearch).find((i) => String(i.num) === selectedNum);
                          if (!inv) return;
                          // prevent duplicate assignment of same inventory num
                          const already = consumableItems.some((it) => (it as any).item_id && (it as any).item_id === selectedNum);
                          if (!already) {
                            setConsumableItems((prev) => [
                              ...prev,
                              {
                                item_name: inv.equipment_name,
                                quantity: currentConsumable.quantity || 1,
                                item_type: "consumable",
                                item_id: selectedNum,
                              } as any,
                            ]);
                          }
                          // reset selection state
                          setCurrentConsumable({
                            item_name: "",
                            quantity: 1,
                            item_type: "consumable",
                            custom_name: "",
                            selected_num: "",
                          });
                          setConsumableSearch("");
                        }}
                        MenuProps={{ PaperProps: { style: { maxHeight: 300 } } }}
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
                        value={currentConsumable.custom_name ?? ""}
                        onChange={(e) => setCurrentConsumable((prev) => ({ ...prev, custom_name: e.target.value }))}
                        fullWidth
                        required
                      />
                    )}
                    <TextField
                      label="Qty per Group *"
                      type="number"
                      value={currentConsumable.quantity}
                      onChange={(e) => setCurrentConsumable((prev) => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                      sx={{ minWidth: 140 }}
                      inputProps={{ min: 1 }}
                    />
                    {currentConsumable.selected_num && currentConsumable.item_name !== "Other" && (
                      <Typography variant="caption" color="text.secondary">
                        Available: {getInventoryOptions("consumable").find((i) => i.num === currentConsumable.selected_num)?.available ?? 0}
                      </Typography>
                    )}
                    <Button
                      startIcon={<AddIcon />}
                      onClick={handleAddConsumable}
                      variant="outlined"
                      disabled={
                        !currentConsumable.item_name ||
                        (currentConsumable.item_name === "Other" && !(currentConsumable.custom_name ?? "").trim()) ||
                        currentConsumable.quantity < 1
                      }
                    >
                      Add Consumable Item
                    </Button>
                  </Stack>

                  {consumableItems.length > 0 ? (
                    <ItemsTable items={consumableItems} onRemove={handleRemoveConsumable} type="consumable" />
                  ) : (
                    <Typography variant="body2" color="text.secondary" textAlign="center" py={3}>
                      No consumable items added yet.
                    </Typography>
                  )}
                </Paper>

                {/* Non-Consumable Items */}
                <Paper sx={{ p: 3, bgcolor: alpha(theme.palette.info.main, 0.04), flex: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <BuildIcon color="info" />
                      <Typography variant="h6" color="info.main">
                        Non-Consumable Items
                      </Typography>
                    </Box>
                    <Chip label={`Total: ${totalNonConsumableItems}`} color="info" variant="filled" />
                  </Box>

                  {/* Non-Consumable Item Form */}
                  <Stack spacing={2} sx={{ mb: 3 }}>
                    <TextField
                      label="Search Non-Consumable Item"
                      value={nonConsumableSearch}
                      onChange={(e) => setNonConsumableSearch(e.target.value)}
                      fullWidth
                      placeholder="Type to search inventory..."
                    />
                    <FormControl fullWidth>
                      <InputLabel>Select Non-Consumable Item</InputLabel>
                      <Select
                        value={currentNonConsumable.selected_num || (currentNonConsumable.item_name === "Other" ? "Other" : "")}
                        label="Select Non-Consumable Item"
                        onChange={(e) => {
                          const selectedNum = String(e.target.value);
                          if (selectedNum === "Other") {
                            setCurrentNonConsumable((prev) => ({
                              ...prev,
                              item_name: "Other",
                              selected_num: "",
                              custom_name: "",
                            }));
                            return;
                          }
                          const inv = getInventoryOptions("non-consumable", nonConsumableSearch).find((i) => String(i.num) === selectedNum);
                          if (!inv) return;
                          const already = nonConsumableItems.some((it) => (it as any).item_id && (it as any).item_id === selectedNum);
                          if (!already) {
                            setNonConsumableItems((prev) => [
                              ...prev,
                              {
                                item_name: inv.equipment_name,
                                quantity: currentNonConsumable.quantity || 1,
                                item_type: "non-consumable",
                                item_id: selectedNum,
                              } as any,
                            ]);
                          }
                          // reset selection state
                          setCurrentNonConsumable({
                            item_name: "",
                            quantity: 1,
                            item_type: "non-consumable",
                            custom_name: "",
                            selected_num: "",
                          });
                          setNonConsumableSearch("");
                        }}
                        MenuProps={{ PaperProps: { style: { maxHeight: 300 } } }}
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
                        value={currentNonConsumable.custom_name ?? ""}
                        onChange={(e) => setCurrentNonConsumable((prev) => ({ ...prev, custom_name: e.target.value }))}
                        fullWidth
                        required
                      />
                    )}
                    <TextField
                      label="Qty per Group *"
                      type="number"
                      value={currentNonConsumable.quantity}
                      onChange={(e) => setCurrentNonConsumable((prev) => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                      sx={{ minWidth: 140 }}
                      inputProps={{ min: 1 }}
                    />
                    {currentNonConsumable.selected_num && currentNonConsumable.item_name !== "Other" && (
                      <Typography variant="caption" color="text.secondary">
                        Available: {getInventoryOptions("non-consumable").find((i) => i.num === currentNonConsumable.selected_num)?.available ?? 0}
                      </Typography>
                    )}
                    <Button
                      startIcon={<AddIcon />}
                      onClick={handleAddNonConsumable}
                      variant="outlined"
                      disabled={
                        !currentNonConsumable.item_name ||
                        (currentNonConsumable.item_name === "Other" && !(currentNonConsumable.custom_name ?? "").trim()) ||
                        currentNonConsumable.quantity < 1
                      }
                    >
                      Add Non-Consumable Item
                    </Button>
                  </Stack>

                  {nonConsumableItems.length > 0 ? (
                    <ItemsTable items={nonConsumableItems} onRemove={handleRemoveNonConsumable} type="non-consumable" />
                  ) : (
                    <Typography variant="body2" color="text.secondary" textAlign="center" py={3}>
                      No non-consumable items added yet.
                    </Typography>
                  )}
                </Paper>
              </Stack>
            )}

            {/* Summary and Submit */}
            <Paper sx={{ p: 3, bgcolor: alpha(theme.palette.warning.main, 0.04) }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="h6" color="warning.main">
                  Reservation Summary
                </Typography>
                <Chip
                  label={`Grand Total: ${totalAllItems} items`}
                  color="warning"
                  variant="filled"
                  sx={{ fontSize: "1rem", py: 1 }}
                />
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2">
                    Consumable Items: <strong>{totalConsumableItems}</strong> total items
                  </Typography>
                  <Typography variant="body2">
                    Non-Consumable Items: <strong>{totalNonConsumableItems}</strong> total items
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2">
                    Number of Groups: <strong>{reservationForm.group_count}</strong>
                  </Typography>
                  <Typography variant="body2">
                    Total Items Needed: <strong>{totalAllItems}</strong>
                  </Typography>
                </Box>
              </Stack>

              <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleSubmit}
                  disabled={saving || (reservationForm.needsItems && consumableItems.length === 0 && nonConsumableItems.length === 0)}
                  sx={{
                    bgcolor: brandRed,
                    "&:hover": { bgcolor: "#9f1515" },
                    borderRadius: 2,
                    px: 4,
                    py: 1.5,
                    fontSize: "1.1rem",
                  }}
                >
                  {saving ? "Submitting..." : "Submit Reservation"}
                </Button>
              </Box>
            </Paper>
          </Stack>
        </Card>
      )}

      {currentTab === 0 && (
        // Reservation Inbox
        <Card sx={{ p: 3, borderRadius: 3 }}>
          {loadingReservations ? (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
              <CircularProgress />
            </Box>
          ) : myReservations.length === 0 ? (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
              <Stack alignItems="center" spacing={2}>
                <InboxIcon sx={{ fontSize: 60, color: "text.disabled" }} />
                <Typography variant="h6" color="text.secondary">
                  No reservations yet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Create a new reservation to get started
                </Typography>
              </Stack>
            </Box>
          ) : (
            <TableContainer sx={{ borderRadius: 2 }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
                    <TableCell>
                      <Typography fontWeight="bold">Code</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight="bold">Subject</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight="bold">Program</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight="bold">Schedule</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight="bold">Status</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography fontWeight="bold">Actions</Typography>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {myReservations.map((reservation) => (
                    <TableRow
                      key={reservation._id}
                      sx={{
                        "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.05) },
                        borderBottom: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <TableCell>
                        <Chip
                          label={reservation.reservation_code}
                          color="primary"
                          variant="outlined"
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight="medium">{reservation.subject}</Typography>
                      </TableCell>
                      <TableCell>{reservation.course}</TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {reservation.schedule}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={reservation.status}
                          color={
                            reservation.status === "Pending"
                              ? "warning"
                              : reservation.status === "Assigned"
                              ? "success"
                              : reservation.status === "Rejected"
                              ? "error"
                              : "default"
                          }
                          size="small"
                          variant="filled"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <Tooltip title="View Details">
                            <IconButton
                              color="default"
                              onClick={() => {
                                setSelectedReservation(reservation);
                                setViewDialogOpen(true);
                              }}
                              sx={{
                                bgcolor: "#ffebee",
                                "&:hover": { bgcolor: "#484848ff", color: "#fff" },
                                p: 1,
                              }}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          {/* Chat button with unseen badge */}
                          <Tooltip title="Open Chat">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenChat(reservation)}
                              color="info"
                            >
                              <Badge
                                badgeContent={unseenCount(reservation)}
                                color="error"
                                invisible={unseenCount(reservation) === 0}
                              >
                                <ChatBubbleIcon />
                              </Badge>
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Edit Reservation">
                            <IconButton size="small" onClick={() => openEditForm(reservation)} color="primary">
                              <EditIcon />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="View Edit Logs">
                            <IconButton size="small" onClick={() => openLogs(reservation)} color="default">
                              <ListIcon />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Delete Reservation">
                            <IconButton
                              color="error"
                              onClick={() => handleDeleteReservation(reservation)}
                              sx={{
                                bgcolor: "#ffebee",
                                "&:hover": { bgcolor: "#f44336", color: "#fff" },
                                p: 1,
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Card>
      )}

      {/* Success Dialog */}
      <Dialog open={successDialog} onClose={() => setSuccessDialog(false)}>
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <EventIcon color="success" />
            <Typography variant="h6">Reservation Created Successfully!</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography>
            Your reservation has been submitted successfully. Please save your reservation code:
          </Typography>
          <Box sx={{ textAlign: "center", my: 2 }}>
            <Chip
              label={reservationCode}
              color="primary"
              variant="filled"
              sx={{ fontSize: "1.2rem", py: 2, px: 3 }}
            />
          </Box>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="bold">
              Reservation Summary:
            </Typography>
            <Typography variant="body2">
              • Consumable Items: {totalConsumableItems} total
            </Typography>
            <Typography variant="body2">
              • Non-Consumable Items: {totalNonConsumableItems} total
            </Typography>
            <Typography variant="body2">
              • Groups: {reservationForm.group_count}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Student assistants will assign actual equipment items to your reservation.
            You can use this code to track your reservation status.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuccessDialog(false)} variant="contained">
            OK
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <VisibilityIcon sx={{ color: brandRed }} />
            <Typography variant="h6" sx={{ color: brandRed }}>
              Reservation Details
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedReservation && (
            <Stack spacing={3} sx={{ pt: 2 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Basic Information
                </Typography>
                <Stack spacing={2}>
                  <Box sx={{ display: "flex", gap: 2 }}>
                    <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 120 }}>
                      Code:
                    </Typography>
                    <Chip label={selectedReservation.reservation_code} size="small" />
                  </Box>
                  <Box sx={{ display: "flex", gap: 2 }}>
                    <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 120 }}>
                      Status:
                    </Typography>
                    <Chip
                      label={selectedReservation.status}
                      color={
                        selectedReservation.status === "Pending"
                          ? "warning"
                          : selectedReservation.status === "Assigned"
                          ? "success"
                          : selectedReservation.status === "Rejected"
                          ? "error"
                          : "default"
                      }
                      size="small"
                    />
                  </Box>
                  <Box sx={{ display: "flex", gap: 2 }}>
                    <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 120 }}>
                      Subject:
                    </Typography>
                    <Typography variant="body2">{selectedReservation.subject}</Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 2 }}>
                    <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 120 }}>
                      Program:
                    </Typography>
                    <Typography variant="body2">{selectedReservation.course}</Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 2 }}>
                    <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 120 }}>
                      Schedule:
                    </Typography>
                    <Typography variant="body2">{selectedReservation.schedule}</Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 2 }}>
                    <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 120 }}>
                      Room:
                    </Typography>
                    <Typography variant="body2">{selectedReservation.room}</Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 2 }}>
                    <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 120 }}>
                      Groups:
                    </Typography>
                    <Chip label={selectedReservation.group_count} size="small" />
                  </Box>
                </Stack>
              </Box>

              <Box>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Requested Items ({selectedReservation.requested_items.length})
                </Typography>
                <Stack spacing={1}>
                  {selectedReservation.requested_items.map((item, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        p: 2,
                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                        borderRadius: 1,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {item.item_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.item_type === "consumable" ? "🧪 Consumable" : "🔧 Non-Consumable"}
                        </Typography>
                      </Box>
                      <Chip label={`${item.quantity} per group`} size="small" />
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)} sx={{ textTransform: "none" }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Message Chat Dialog */}
      <Dialog open={messageDialogOpen} onClose={() => { setMessageDialogOpen(false); stopChatPolling(); }} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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
            <Box sx={{ minHeight: 400 }}>
              {/* Messages container with scrollbar */}
              <Paper
                ref={messageListRef}
                sx={{
                  p: 2,
                  bgcolor: alpha(theme.palette.info.main, 0.04),
                  overflowY: "auto",
                  maxHeight: 420,
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.5,
                  borderRadius: 3,
                  boxShadow: 1,
                }}
              >
                {selectedReservationForChat.messages && selectedReservationForChat.messages.length > 0 ? (
                  selectedReservationForChat.messages.map((msg, index) => {
                    const isCurrentUser = msg.sender === JSON.parse(localStorage.getItem("user") || "{}").email;
                    return (
                      <Box key={index} sx={{ display: "flex", justifyContent: isCurrentUser ? "flex-end" : "flex-start" }}>
                        <Paper
                          sx={{
                            p: 1.5,
                            maxWidth: "70%",
                            bgcolor: isCurrentUser ? alpha(theme.palette.primary.main, 0.15) : alpha(theme.palette.grey[300], 0.5),
                            borderRadius: 2,
                            boxShadow: 1,
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            fontWeight="bold"
                            sx={{ color: isCurrentUser ? theme.palette.primary.main : theme.palette.text.primary }}
                          >
                            {(msg as any).sender_name || msg.sender}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>
                            {msg.message}
                          </Typography>
                          <Typography variant="caption" color="textSecondary" sx={{ display: "block", mt: 0.5 }}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </Typography>
                        </Paper>
                      </Box>
                    );
                  })
                ) : (
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
                    <Typography variant="body2" color="textSecondary">No messages yet. Start the conversation!</Typography>
                  </Box>
                )}
                <div ref={messagesEndRef} />
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ flexDirection: "column", gap: 1, py: 2 }}>
          {/* Composer fixed below the scrollable messages container */}
          <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
            <Paper
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                p: 1,
                borderRadius: 3,
                boxShadow: 3,
                width: { xs: "100%", sm: 520 },
                maxWidth: "100%",
                bgcolor: "#fff",
              }}
            >
              <TextField
                placeholder="Type a message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && messageText.trim()) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                multiline
                maxRows={4}
                fullWidth
                size="small"
                disabled={sendingMessage}
              />
              <Button
                variant="contained"
                color="info"
                onClick={handleSendMessage}
                disabled={!messageText.trim() || sendingMessage}
                sx={{ borderRadius: 2, minWidth: 48, minHeight: 48 }}
              >
                <SendIcon />
              </Button>
            </Paper>
          </Box>

          <Box sx={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
            <Button
              onClick={() => {
                setMessageDialogOpen(false);
                stopChatPolling();
                window.location.reload(); // ← reloads the page
              }}
              sx={{ textTransform: "none" }}
            >
              Close
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Edit Logs Dialog */}
      <Dialog open={logsOpen} onClose={() => setLogsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Reservation Edit History</DialogTitle>
        <DialogContent dividers>
          {currentLogs.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No edits recorded.</Typography>
          ) : (
            currentLogs.map((log, idx) => (
              <Paper key={idx} sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2">{log.editedName || log.editedBy} — {new Date(log.editedAt).toLocaleString()}</Typography>
                {log.reason && <Typography variant="caption" color="text.secondary">Reason: {log.reason}</Typography>}
                <details style={{ marginTop: 8 }}>
                  <summary>View previous snapshot</summary>
                  <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(log.previous, null, 2)}</pre>
                </details>
              </Paper>
            ))
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Modal */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>{confirmTitle}</DialogTitle>
        <DialogContent>
          <Typography>{confirmMessage}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} color="inherit">Cancel</Button>
          <Button
            onClick={() => { if (onConfirm) onConfirm(); }}
            color="error"
            variant="contained"
          >
            Yes, Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}