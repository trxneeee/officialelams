// src/App.tsx
import axios from "axios";
import type { ReactNode } from "react";
import { useEffect, useState, useRef } from "react";
import { Route, BrowserRouter as Router, Routes, Navigate } from "react-router-dom";
import "./App.css"; // 👈 for layout styling
import Footer from "./components/Footer";
import Header from "./components/Header";
import BorrowPage from "./pages/BorrowPage";
import FacultyReservationPage from "./pages/FacultyReservationPage";
import HomePage from "./pages/HomePage";
import InventoryPage from "./pages/InventoryPage";
import { useNavigate } from "react-router-dom";
import Login from "./pages/Login";
import MaintenancePage from "./pages/MaintenancePage";
import StaffPage from "./pages/StaffPage";
import InfoIcon from "@mui/icons-material/Info";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import NotificationsIcon from "@mui/icons-material/Notifications";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import ReservationPage from "./pages/ReservationPage";
import StudentPrepPage from "./pages/StudentPrepPage";
import SubjectCoursePage from "./pages/SubjectCoursePage";
import { Dialog, IconButton, ToggleButton, ToggleButtonGroup } from "@mui/material";
import ForecastPage from "./pages/ForecastPage";
import AllForecastPage from "./pages/AllForecastPage";
import { AiOutlineTool } from "react-icons/ai";
import { useTheme } from "@mui/material/styles";
interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description: string;
  location: string;
  instructor?: string;
  reservation_code?: string;
}
interface Notification {
  id: number;
  text: React.ReactNode;
  type: "info" | "warning" | "success" | "maintenance";
  onClick?: () => void; // optional click handler
}

//interface CInventoryItem {
//  num: string;
//  location: string;
//  description: string;
//  quantity_opened: string;
//  quantity_unopened: string;
//  quantity_on_order: string;
//  remarks: string;
//  experiment: string;
//  subject: string;
//  date_issued: string;
//  issuance_no: string;
//  stock_alert: string;
// } 

// Replace Google Sheets handlers with server-backed implementations
const SERVER_API = "https://elams.sit.ubaguio.edu/api";

/* CalendarPanel: shows Approved/Assigned reservations with recurring expansion */
function CalendarPanel() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "today" | "week" | "month">("today"); // default to today
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const WEEKDAY_MAP: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6
  };

  const toLocalDate = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  // Build event start/end ISO from a base date and reservation times (fallback to full-day 1h window)
  const buildEventForDate = (r: any, date: Date): CalendarEvent => {
    const start = new Date(date);
    const end = new Date(date);
    if (r.startTime) {
      const [sh, sm] = String(r.startTime).split(":").map(Number);
      start.setHours(sh ?? 0, sm ?? 0, 0, 0);
    } else {
      start.setHours(9, 0, 0, 0);
    }
    if (r.endTime) {
      const [eh, em] = String(r.endTime).split(":").map(Number);
      end.setHours(eh ?? (start.getHours() + 1), em ?? 0, 0, 0);
    } else {
      end.setTime(start.getTime() + 60 * 60 * 1000);
    }

    return {
      id: `${r._id}::${start.toISOString()}`,
      title: `${r.subject}`,
      start: start.toISOString(),
      end: end.toISOString(),
      description: r.notes || "",
      location: r.room || "",
      instructor: r.instructor || "",
      reservation_code: r.reservation_code || ""
    };
  };

  // Expand a recurring reservation into occurrences from `fromDate` up to `endDate`
  const expandRecurring = (r: any, fromDate: Date, untilDate: Date): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    // Expect schedule like "Every Monday, Tuesday until 2025-12-12" per FacultyReservationPage
    const txt = (r.schedule || "").trim();
    if (!txt.toLowerCase().startsWith("every")) return events;

    // Extract days and optional until date
    const untilMatch = txt.match(/until\s+([0-9]{4}-[0-9]{2}-[0-9]{2})/i);
    const end = untilMatch ? new Date(untilMatch[1]) : untilDate;
    const daysPart = txt.replace(/^every\s+/i, "").replace(/until\s+[0-9]{4}-[0-9]{2}-[0-9]{2}/i, "").trim();
    const dayNames = daysPart
      .split(/[,\s]+/)
      .map((s: string) => s.replace(/[^a-zA-Z]/g, '').toLowerCase())
      .filter(Boolean);

    // For each weekday, compute the first occurrence on/after fromDate and then add weekly occurrences
    // ensure TypeScript knows we have strings, then guard keys at runtime
    const uniqueWeekdays = Array.from(new Set(dayNames)) as string[];
    uniqueWeekdays.forEach((dayName) => {
      if (!(dayName in WEEKDAY_MAP)) return; // runtime guard -> narrows type
      const wk = WEEKDAY_MAP[dayName as keyof typeof WEEKDAY_MAP];
      // start from today's date (local)
      const startCandidate = toLocalDate(fromDate);
      // move to this week's weekday
      const diff = (wk - startCandidate.getDay() + 7) % 7;
      let occ = new Date(startCandidate);
      occ.setDate(startCandidate.getDate() + diff);
      // If occ < fromDate (time portion), make sure occ >= fromDate (use local date compare)
      while (occ <= end) {
        // Only include occurrences >= fromDate (today)
        if (occ >= toLocalDate(fromDate)) {
          events.push(buildEventForDate(r, occ));
        }
        // next week
        occ = new Date(occ);
        occ.setDate(occ.getDate() + 7);
      }
    });

    // sort by date
    events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    return events;
  };

  // Improved fetch: uses AbortController, compares payload to avoid unnecessary setState,
  // and only shows loading on first (initial) load.
  const eventsJsonRef = useRef<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const fetchEvents = async (initial = false) => {
    if (controllerRef.current) controllerRef.current.abort();
    const ctrl = new AbortController();
    controllerRef.current = ctrl;

    if (initial) setLoading(true);
    try {
      const resp = await axios.get(`${SERVER_API}/reservations`, { signal: ctrl.signal });
      const reservations = Array.isArray(resp.data) ? resp.data : [];

      // only keep Approved/Assigned to show in calendar,
      // but if user is Instructor or Program Chair show only their reservations
      const parsed: CalendarEvent[] = [];
      let visibleReservations = reservations.filter((r: any) => r && (r.status === "Approved" || r.status === "Assigned"));
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const currentRole = (currentUser?.role || '').toString();
      const currentEmail = (currentUser?.email || currentUser?.name || '').toString().toLowerCase();
      if (currentRole === "Instructor" || currentRole === "Program Chair") {
        visibleReservations = visibleReservations.filter((r: any) => {
          const instrEmail = String(r.instructor_email || r.instructor || '').toLowerCase();
          return instrEmail && instrEmail === currentEmail;
        });
      }

      visibleReservations.forEach((r: any) => {
        const sched = String(r.schedule || "").trim();
        if (sched.toLowerCase().startsWith("every")) {
          // expand recurring occurrences for the next 30 days (adjust as needed)
          const occurrences = expandRecurring(r, new Date(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
          parsed.push(...occurrences);
        } else {
          // single-date reservation (or plain date string)
          const dateCandidate = new Date(r.schedule);
          const baseDate = !isNaN(dateCandidate.getTime()) ? new Date(dateCandidate) : new Date();
          parsed.push(buildEventForDate(r, baseDate));
        }
      });

      const newJson = JSON.stringify(parsed);
      // only update state if data changed to avoid UI blinking
      if (eventsJsonRef.current !== newJson) {
        eventsJsonRef.current = newJson;
        setEvents(parsed);
      }
    } catch (err: any) {
      if (err?.name !== 'CanceledError' && err?.message !== 'canceled') {
        console.error("Failed to fetch reservations for calendar", err);
        // keep old events instead of clearing to avoid blink
      }
    } finally {
      if (initial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents(true);
    // poll less frequently to avoid visual churn
    const iv = setInterval(() => fetchEvents(false), 60_000);
    return () => {
      clearInterval(iv);
      controllerRef.current?.abort();
    };
  }, []);

  const getFilteredEvents = () => {
    if (filter === "all") return events;
    const now = new Date();
    const manilaNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const filtered = events.filter((e) => {
      const eventStart = new Date(e.start);
      const eventDate = new Date(eventStart.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
      if (filter === "today") {
        return eventDate.getFullYear() === manilaNow.getFullYear() &&
               eventDate.getMonth() === manilaNow.getMonth() &&
               eventDate.getDate() === manilaNow.getDate();
      }
      if (filter === "week") {
        const startOfWeek = new Date(manilaNow); startOfWeek.setDate(manilaNow.getDate() - manilaNow.getDay()); startOfWeek.setHours(0,0,0,0);
        const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 7);
        return eventDate >= startOfWeek && eventDate < endOfWeek;
      }
      if (filter === "month") {
        return eventDate.getFullYear() === manilaNow.getFullYear() &&
               eventDate.getMonth() === manilaNow.getMonth();
      }
      return true;
    });

    // ensure events are displayed in chronological order (earliest first)
    filtered.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    return filtered;
  };

  const filteredEvents = getFilteredEvents();

  // responsive widths (use the top-level hook)
  const ww = useWindowWidth();
  let panelWidth = 280;
  if (ww < 480) panelWidth = Math.max(200, ww - 40); // phone: full-ish width with margin
  else if (ww < 900) panelWidth = 220; // tablet
  else panelWidth = 280; // desktop

  return (
    <aside
      className="calendar-panel"
      style={{
        width: panelWidth,
        minWidth: panelWidth,
        maxWidth: panelWidth,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        height: ww < 900 ? "auto" : "calc(100vh - 140px)",
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 6px 18px rgba(15,23,42,0.06)",
        border: "1px solid rgba(0,0,0,0.04)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 12 }}>
        <div style={{ width: 56, height: 56, borderRadius: 12, background: "#ffecec", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CalendarTodayIcon sx={{ color: "#b71c1c" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: "#111827" }}>Calendar</div>
        </div>
      </div>

      <div style={{ height: 1, background: "linear-gradient(90deg, rgba(0,0,0,0.04), rgba(0,0,0,0))", marginBottom: 12 }} />

      <div style={{ flex: 1, overflowY: "auto", paddingRight: 8 }}>
        {/* Filter controls: Today / Week / Month / All */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <ToggleButtonGroup
            value={filter}
            exclusive
            size="small"
            onChange={(_, v) => v && setFilter(v)}
            aria-label="date filter"
          >
            <ToggleButton value="today" aria-label="today">Today</ToggleButton>
            <ToggleButton value="week" aria-label="week">Week</ToggleButton>
            <ToggleButton value="month" aria-label="month">Month</ToggleButton>
            <ToggleButton value="all" aria-label="all">All</ToggleButton>
          </ToggleButtonGroup>
          <div style={{ fontSize: 12, color: "#6b7280" }}><strong>{filteredEvents.length}</strong></div>
        </div>

        {loading ? (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280" }}>
            <div>Loading…</div>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: "#9ca3af" }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>No upcoming events</div>
              <div style={{ fontSize: 13 }}>Create reservations to populate the calendar</div>
            </div>
          </div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {filteredEvents.map((e) => (
              <li key={e.id} onClick={() => setSelectedEvent(e)} style={{
                marginBottom: 12,
                padding: 12,
                borderRadius: 12,
                background: "#fff",
                border: "1px solid rgba(0,0,0,0.04)",
                boxShadow: "0 4px 14px rgba(17,24,39,0.04)",
                cursor: "pointer",
                transition: "transform 120ms ease, box-shadow 120ms ease"
              }}
                onMouseEnter={(ev:any) => ev.currentTarget.style.transform = "translateY(-4px)"} 
                onMouseLeave={(ev:any) => ev.currentTarget.style.transform = "translateY(0)"} 
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>{e.title}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{new Date(e.start).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" })}</div>
                </div>
                <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ fontSize: 13, color: "#2563eb", background: "#eff6ff", padding: "4px 8px", borderRadius: 8 }}>
                    {new Date(e.start).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div style={{ fontSize: 13, color: "#059669", background: "#ecfdf5", padding: "4px 8px", borderRadius: 8 }}>
                    {new Date(e.end).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <div style={{ marginTop: 10, fontSize: 13, color: "#4b5563" }}>
                  <div>Room: {e.location || "-"}</div>
                  <div style={{ marginTop: 4 }}>Instructor: {e.instructor || "-"}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal isOpen={!!selectedEvent} onClose={() => setSelectedEvent(null)}>
        {selectedEvent && (
          <div>
            <h2 style={{ marginBottom: 12, fontSize: 20 }}>{selectedEvent.title}</h2>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              {selectedEvent.reservation_code && <div style={{ fontSize: 14 }}><strong>Code:</strong> {selectedEvent.reservation_code}</div>}
              {selectedEvent.instructor && <div style={{ fontSize: 14 }}><strong>Instructor:</strong> {selectedEvent.instructor}</div>}
            </div>
            <div style={{ marginBottom: 10 }}>
              <strong>Date:</strong>{" "}
              {new Date(selectedEvent.start).toLocaleDateString("en-PH", {
                timeZone: "Asia/Manila",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>

            <div style={{ marginBottom: 6 }}>
              <strong>Start Time:</strong>{" "}
              {new Date(selectedEvent.start).toLocaleTimeString("en-PH", {
                timeZone: "Asia/Manila",
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>

            <div style={{ marginBottom: 12 }}>
              <strong>End Time:</strong>{" "}
              {new Date(selectedEvent.end).toLocaleTimeString("en-PH", {
                timeZone: "Asia/Manila",
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>

            {selectedEvent.description && (
              <div style={{ marginBottom: 12, padding: 10, background: "#f5f5f5", borderRadius: 6 }}>
                <strong>Notes:</strong>
                <div style={{ marginTop: 6 }} dangerouslySetInnerHTML={{ __html: selectedEvent.description }} />
              </div>
            )}

            <div style={{ marginBottom: 6 }}>
              <strong>Room:</strong> {selectedEvent.location}
            </div>
          </div>
        )}
      </Modal>
    </aside>
  );
}

/* NotificationPanel: stock alerts, pending reservations, unread messages */
function NotificationPanel() {
    const theme = useTheme();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  // improved fetchNotifications: only update if changed, don't toggle loading on background polls
  const notificationsJsonRef = useRef<string | null>(null);
  const notifControllerRef = useRef<AbortController | null>(null);
  const fetchNotifications = async (initial = false) => {
    if (notifControllerRef.current) notifControllerRef.current.abort();
    const ctrl = new AbortController();
    notifControllerRef.current = ctrl;
    if (initial) setLoading(true);
    try {
      const [resReservations, resInventory, resMaintenance] = await Promise.all([
        axios.get(`${SERVER_API}/reservations`, { signal: ctrl.signal }),
        axios.get(`${SERVER_API}/inventory`, { signal: ctrl.signal }),
        axios.post(`${SERVER_API}/maintenance`, { action: "read" }, { signal: ctrl.signal })
      ]);
      const reservations = Array.isArray(resReservations.data) ? resReservations.data : [];
      const inventory = Array.isArray(resInventory.data) ? resInventory.data : [];
      const maintenanceList = Array.isArray(resMaintenance.data?.data) ? resMaintenance.data.data : [];

      // If Instructor/Program Chair -> restrict reservations to their own
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const currentRole = (currentUser?.role || '').toString();
      const currentEmail = (currentUser?.email || currentUser?.name || '').toString().toLowerCase();
      const visibleReservations = (currentRole === "Instructor" || currentRole === "Program Chair")
        ? reservations.filter((r: any) => {
            const instrEmail = String(r.instructor_email || r.instructor || '').toLowerCase();
            return instrEmail && instrEmail === currentEmail;
          })
        : reservations;

      const pendingCount = visibleReservations.filter((r: any) => r.status === "Pending").length;
      // low stock is a global concern; per request we omit low-stock notifications for Instructor/Program Chair
      const lowStockItems = inventory.filter((it: any) =>
        // use the same rule as InventoryPage: consider "low" when opened quantity <= stock_alert
        it.is_consumable && (Number(it.quantity_opened || 0) <= Number(it.stock_alert ?? 5))
      );
      const lowStockCount = (currentRole === "Instructor" || currentRole === "Program Chair") ? 0 : lowStockItems.length;

      const userEmail = currentEmail;

      let totalUnread = 0;
      const perResUnread: { res: any; unread: number }[] = [];
      // Only count unread messages for visibleReservations (i.e., their own for Instructor/Program Chair)
      visibleReservations.forEach((r: any) => {
        const msgs = Array.isArray(r.messages) ? r.messages : [];
        const unread = msgs.filter((m:any) => !(Array.isArray(m.seen_by) ? m.seen_by : []).includes(userEmail)).length;
        if (unread > 0) {
          totalUnread += unread;
          perResUnread.push({ res: r, unread });
        }
      });

      const generated: Notification[] = [];
      // For Instructor/Program Chair we only show notifications about their reservations (pending/unread)
      if (pendingCount > 0) {
        generated.push({ id: 2, text: <>You have <strong style={{ color: 'orange' }}>{pendingCount}</strong> pending reservation(s)</>, type: "warning", onClick: () => navigate('/reservation?status=Pending') });
      } else if (lowStockCount > 0) {
        // non-instructors still get low-stock global notice
        generated.push({ id: 1, text: <>You have <strong style={{ color: 'red' }}>{lowStockCount} low-stock consumable item(s)</strong>. Please restock soon</>, type: "warning", onClick: () => navigate('/inventory?stock=Alert') });
      }
      if (totalUnread > 0) {
        generated.push({ id: 3, text: <>You have <strong style={{ color: '#b71c1c' }}>{totalUnread}</strong> unread message(s) across <strong>{perResUnread.length}</strong> reservation(s)</>, type: "info", onClick: () => navigate('/reservation') });
        perResUnread.slice(0,5).forEach(({ res, unread }: any, idx: number) => generated.push({ id: 100 + idx, text: <>Reservation <strong>{res.reservation_code}</strong> • {res.subject} — {unread} unread</>, type: "info", onClick: () => navigate(`/reservation?openChat=${res._id}`) }));
      }

      // Scheduled maintenance notification
      const now = new Date();
      const monthStr = now.toLocaleString('en-US', { month: 'short' }).toUpperCase();
      const yearNum = now.getFullYear();
      const scheduledMaint = maintenanceList.filter((m: any) =>
        String(m.month || '').toUpperCase() === monthStr &&
        Number(m.scheduledYear || yearNum) === yearNum
      );
      if (scheduledMaint.length > 0) {
        generated.push({
          id: 200,
          text: <>You have <strong style={{ color: '#b71c1c' }}>{scheduledMaint.length}</strong> scheduled maintenance{scheduledMaint.length > 1 ? 's' : ''} this month.</>,
          type: "maintenance",
          onClick: () => navigate('/maintenance')
        });
      }

      const newJson = JSON.stringify(generated);
      if (notificationsJsonRef.current !== newJson) {
        notificationsJsonRef.current = newJson;
        setNotifications(generated);
      }
    } catch (err: any) {
      if (err?.name !== 'CanceledError' && err?.message !== 'canceled') {
        console.error("Failed to fetch notifications", err);
      }
    } finally {
      if (initial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(true);
    const iv = setInterval(() => fetchNotifications(false), 30_000);
    return () => {
      clearInterval(iv);
      notifControllerRef.current?.abort();
    };
  }, [navigate]);

  const getIcon = (type: string) => {
    switch (type) {
      case "info": return <InfoIcon sx={{ color: "#0056b3" }} />;
      case "maintenance": return <AiOutlineTool style={{ color: theme.palette.warning.main,  fontSize: 22 }} />;
      case "warning": return <WarningAmberIcon sx={{ color: "#b36b00" }} />;
      case "success": return <CheckCircleIcon sx={{ color: "#137333" }} />;
      default: return <Inventory2Icon />;
    }
  };

  // responsive widths
  const ww = useWindowWidth();
  let panelWidth = 280;
  if (ww < 480) panelWidth = Math.max(200, ww - 40);
  else if (ww < 900) panelWidth = 220;
  else panelWidth = 280;

  return (
    <aside
      style={{
        width: panelWidth,
        minWidth: panelWidth,
        maxWidth: panelWidth,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        height: ww < 900 ? "auto" : "calc(100vh - 140px)",
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 6px 18px rgba(15,23,42,0.06)",
        border: "1px solid rgba(0,0,0,0.04)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 12 }}>
        <div style={{ width: 56, height: 56, borderRadius: 12, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <NotificationsIcon sx={{ color: "#b71c1c" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: "#111827" }}>Notifications</div>
        </div>
      </div>

      <div style={{ height: 1, background: "linear-gradient(90deg, rgba(0,0,0,0.04), rgba(0,0,0,0))", marginBottom: 12 }} />

      <div style={{ flex: 1, overflowY: "auto", paddingRight: 8 }}>
        {loading ? (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#6b7280" }}>
            <div>Loading…</div>
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "#9ca3af" }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>You're all caught up</div>
            <div style={{ fontSize: 13 }}>No new notifications</div>
          </div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {notifications.map((n) => (
              <li key={n.id} onClick={n.onClick} style={{
                marginBottom: 12,
                padding: 12,
                borderRadius: 12,
                background: "#fff",
                border: "1px solid rgba(0,0,0,0.04)",
                boxShadow: "0 4px 14px rgba(17,24,39,0.04)",
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: n.onClick ? "pointer" : "default",
                transition: "transform 120ms ease"
              }}
                onMouseEnter={(ev:any) => ev.currentTarget.style.transform = "translateY(-3px)"} 
                onMouseLeave={(ev:any) => ev.currentTarget.style.transform = "translateY(0)"} 
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.03)" }}>
                  {getIcon(n.type)}
                </div>
                <div style={{ flex: 1, color: "#111827" }}>{n.text}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

// Add top-level hook so all components can use it
function useWindowWidth() {
	const [w, setW] = useState<number>(typeof window !== "undefined" ? window.innerWidth : 1200);
	useEffect(() => {
		const onResize = () => setW(window.innerWidth);
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);
	return w;
}


interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

function Modal({ isOpen, onClose, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: "24px",
          borderRadius: "10px",
          maxWidth: "500px",
          width: "90%",
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        }}
      >
        {children}
        <button
          onClick={onClose}
          style={{
            marginTop: "20px",
            padding: "8px 14px",
            border: "none",
            borderRadius: "6px",
            background: "#007bff",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

function AppLayout({ children }: { children: ReactNode }) {
  // make layout responsive: stack panels on small screens and show top nav buttons
  const ww = useWindowWidth();
  const isStacked = ww < 900;
  const [showCalendarMobile, setShowCalendarMobile] = useState(false);
  const [showNotifMobile, setShowNotifMobile] = useState(false);

  // hide calendar/notifications for Student role
  const storedUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
  const currentUser = storedUser ? JSON.parse(storedUser || "{}") : {};
  const currentRole = (currentUser?.role || "").toString();
  const isStudent = currentRole === "Student";

  // Listen for header-dispatched mobile actions
  useEffect(() => {
    if (isStudent) return; // students shouldn't open these panels
    const onOpenCalendar = () => setShowCalendarMobile(true);
    const onOpenNotifications = () => setShowNotifMobile(true);
    window.addEventListener('open-calendar', onOpenCalendar as EventListener);
    window.addEventListener('open-notifications', onOpenNotifications as EventListener);
    return () => {
      window.removeEventListener('open-calendar', onOpenCalendar as EventListener);
      window.removeEventListener('open-notifications', onOpenNotifications as EventListener);
    };
  }, []);

  return (
    <>
      <Header />

      {/* Mobile toolbar buttons (appear under Header when stacked) */}
      {isStacked && !isStudent && (
        <div style={{ display: "flex", justifyContent: "flex-end", padding: 8, gap: 8 }}>
          <IconButton
            aria-label="Open calendar"
            onClick={() => setShowCalendarMobile(true)}
            size="large"
            sx={{ bgcolor: "#fff", border: "1px solid rgba(0,0,0,0.04)" }}
          >
            <CalendarTodayIcon />
          </IconButton>
          <IconButton
            aria-label="Open notifications"
            onClick={() => setShowNotifMobile(true)}
            size="large"
            sx={{ bgcolor: "#fff", border: "1px solid rgba(0,0,0,0.04)" }}
          >
            <NotificationsIcon />
          </IconButton>
        </div>
      )}

      <div
        className="app-layout"
        style={{
          display: "flex",
          flexDirection: isStacked ? "column" : "row",
          alignItems: "stretch",
          gap: isStacked ? 12 : 16,
        }}
      >
        {/* Desktop: inline left panel; Mobile: hidden (use dialog) */}
        {!isStacked && !isStudent && <CalendarPanel />}

        <main
          className="main-content"
          style={{
            flex: 1,
            minWidth: 0,
            width: isStacked ? "100%" : "auto",
            padding: isStacked ? "12px" : undefined,
          }}
        >
          {children}
        </main>

        {/* Desktop: inline right panel; Mobile: hidden (use dialog) */}
        {!isStacked && !isStudent && <NotificationPanel />}
      </div>

      {/* Mobile dialogs for panels */}
      {!isStudent && (
        <Dialog fullScreen open={showCalendarMobile} onClose={() => setShowCalendarMobile(false)}>
         <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
           <div style={{ display: "flex", justifyContent: "flex-end", padding: 8 }}>
             <IconButton onClick={() => setShowCalendarMobile(false)} aria-label="close calendar">Close</IconButton>
           </div>
           <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
             <CalendarPanel />
           </div>
         </div>
        </Dialog>
      )}

      {!isStudent && (
        <Dialog fullScreen open={showNotifMobile} onClose={() => setShowNotifMobile(false)}>
         <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
           <div style={{ display: "flex", justifyContent: "flex-end", padding: 8 }}>
             <IconButton onClick={() => setShowNotifMobile(false)} aria-label="close notifications">Close</IconButton>
           </div>
           <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
             <NotificationPanel />
           </div>
         </div>
        </Dialog>
      )}

      <Footer />
    </>
  );
}

function App() {
  // simple route protector: allowedRoles = list of role strings that can access
  const Protected = ({ children, allowedRoles }: { children: ReactNode; allowedRoles: string[] }) => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const role = user?.role || "";
    if (!role) return <Navigate to="/" replace />;
    if (allowedRoles.includes(role)) return <>{children}</>;
    // redirect based on role if not allowed
    if (role === "Instructor" || role === "Program Chair") return <Navigate to="/facultyreserve" replace />;
    if (role === "Student") return <Navigate to="/studentprep" replace />;
    return <Navigate to="/" replace />;
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <Protected allowedRoles={["Student Assistant", "Custodian", "Admin"]}>
              <AppLayout>
                <HomePage />
              </AppLayout>
            </Protected>
          }
        />
                <Route
          path="/studentprep"
          element={
            <Protected allowedRoles={["Student"]}>
              <AppLayout>
                <StudentPrepPage />
              </AppLayout>
            </Protected>
          }
        />
        <Route
          path="/forecast"
          element={
            <Protected allowedRoles={["Program Chair", "Custodian", "Admin"]}>
              <AppLayout>
                <ForecastPage />
              </AppLayout>
            </Protected>
          }
        />
                <Route
          path="/allforecast"
          element={
            <Protected allowedRoles={["Custodian", "Admin"]}>
              <AppLayout>
                <AllForecastPage />
              </AppLayout>
            </Protected>
          }
        />
                <Route
          path="/studentprep"
          element={
            <Protected allowedRoles={["Student"]}>
              <AppLayout>
                <StudentPrepPage />
              </AppLayout>
            </Protected>
          }
        />
        <Route
          path="/staff"
          element={
            <Protected allowedRoles={["Custodian", "Admin"]}>
              <AppLayout>
                <StaffPage />
              </AppLayout>
            </Protected>
          }
        />
        <Route
          path="/borrow"
          element={
            <Protected allowedRoles={["Student Assistant", "Custodian", "Admin"]}>
              <AppLayout>
                <BorrowPage />
              </AppLayout>
            </Protected>
          }
        />
                <Route
          path="/facultyreserve"
          element={
            <Protected allowedRoles={["Instructor", "Program Chair", "Admin"]}>
              <AppLayout>
                <FacultyReservationPage />
              </AppLayout>
            </Protected>
          }
        />
                        <Route
          path="/reservation"
          element={
            <Protected allowedRoles={["Student Assistant", "Custodian", "Admin"]}>
              <AppLayout>
                <ReservationPage />
              </AppLayout>
            </Protected>
          }
        />
        <Route
          path="/inventory"
          element={
            <Protected allowedRoles={["Student Assistant", "Custodian", "Admin"]}>
              <AppLayout>
                <InventoryPage />
              </AppLayout>
            </Protected>
          }
        />
        <Route
          path="/maintenance"
          element={
            <Protected allowedRoles={["Student Assistant", "Custodian", "Admin"]}>
              <AppLayout>
                <MaintenancePage />
              </AppLayout>
            </Protected>
          }
        />
        <Route
          path="/subjects-courses"
          element={
            <Protected allowedRoles={["Custodian", "Admin"]}>
              <AppLayout>
                <SubjectCoursePage />
              </AppLayout>
            </Protected>
          }
        />
        {/* Student and other routes (studentelams etc.) remain public per your flows */}
        <Route
          path="*"
          element={
            <AppLayout>
              <h1 style={{ padding: "20px" }}>404 - Page Not Found</h1>
            </AppLayout>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
