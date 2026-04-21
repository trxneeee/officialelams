import { useEffect, useState } from "react";
import { 
  Container, 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Paper,
  Chip,
  CircularProgress
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  Warning as WarningIcon,
} from "@mui/icons-material";
import axios from "axios";
import { alpha, useTheme } from "@mui/material/styles";
import {AiOutlineUser, AiOutlineFileSearch, AiOutlineAppstore, AiOutlineTool, AiOutlineBook } from "react-icons/ai";

const API_BASE_URL = "https://elams.sit.ubaguio.edu/api";

interface User {
  email: string;
  role: string;
  given_name: string;
  family_name: string;
  password: string;
}

interface DashboardStats {
  totalItems: number;
  borrowedItems: number;
  lowStockItems: number;
  pendingMaintenance: number;
  completedMaintenance: number;
  totalStaff: number;
  recentActivity: Array<{
    type: string;
    description: string;
    time: string;
  }>;
}

const HomePage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalItems: 0,
    borrowedItems: 0,
    lowStockItems: 0,
    pendingMaintenance: 0,
    completedMaintenance: 0,
    totalStaff: 0,
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      navigate("/");
    } else {
      const parsed = JSON.parse(storedUser);
      setUser(parsed);
      fetchDashboardStats(parsed);
    }
  }, [navigate]);

  const fetchDashboardStats = async (currentUser: any = JSON.parse(localStorage.getItem("user") || "{}")) => {
    try {
      // Parallel requests
      const [inventoryRes, borrowRes, maintenanceRes, usersRes, reservationsRes, ncInvRes, cInvRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/inventory`),
        axios.get(`${API_BASE_URL}/borrow-records`),
        axios.post(`${API_BASE_URL}/maintenance`, { action: "read" }),
        axios.post(`${API_BASE_URL}/users`, { action: "read" }),
        axios.get(`${API_BASE_URL}/reservations`),
        axios.post(`${API_BASE_URL}/nc-inventory`, { action: "read" }),
        axios.post(`${API_BASE_URL}/c-inventory`, { action: "read" })
      ]);

      const combinedInventory = Array.isArray(inventoryRes.data) ? inventoryRes.data : [];
      const borrowRecords = Array.isArray(borrowRes.data) ? borrowRes.data : [];
      const maintenanceRecords = (maintenanceRes.data && maintenanceRes.data.data) ? maintenanceRes.data.data : (Array.isArray(maintenanceRes.data) ? maintenanceRes.data : []);
      const users = (usersRes.data && usersRes.data.data) ? usersRes.data.data : (Array.isArray(usersRes.data) ? usersRes.data : []);
      const reservations = Array.isArray(reservationsRes.data) ? reservationsRes.data : [];
      const ncInventory = (ncInvRes.data && ncInvRes.data.data) ? ncInvRes.data.data : (Array.isArray(ncInvRes.data) ? ncInvRes.data : []);
      const cInventory = (cInvRes.data && cInvRes.data.data) ? cInvRes.data.data : (Array.isArray(cInvRes.data) ? cInvRes.data : []);

      // totals
      const totalItems = combinedInventory.reduce((acc: number, item: any) => acc + (Number(item.total_qty || 0)), 0);
      const borrowedItems = borrowRecords.reduce((acc: number, record: any) => acc + (Array.isArray(record.items) ? record.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0) : 0), 0);

      // low stock from consumables
      const lowStockItems = Array.isArray(cInventory)
        ? cInventory.filter((row: any) => (Number(row.quantity_opened || 0) <= Number(row.stock_alert || 5))).length
        : 0;

      // maintenance stats
      const currentYear = new Date().getFullYear();
      const completedMaintenance = Array.isArray(maintenanceRecords)
        ? maintenanceRecords.filter((m: any) => {
            const d = m.date_accomplished || m.dateAccomplished || m.dateAccomplished;
            if (!d) return false;
            return new Date(d).getFullYear() === currentYear;
          }).length
        : 0;
      const pendingMaintenance = (Array.isArray(maintenanceRecords) ? maintenanceRecords.length : 0) - completedMaintenance;

      const totalStaff = Array.isArray(users) ? users.filter((u: any) => u.email !== currentUser.email).length : 0;

      // Build recent activity from multiple sources
      const activity: Array<{ timestamp: number; type: string; description: string; time: string }> = [];

      // Reservations (recent)
      reservations.slice().forEach((r: any) => {
        const ts = r.date_created ? new Date(r.date_created).getTime() : Date.now();
        activity.push({
          timestamp: ts,
          type: "reservation",
          description: `${r.instructor || 'Someone'} created reservation "${r.subject || r.reservation_code || ''}"`,
          time: new Date(ts).toLocaleString()
        });
      });

      // Borrow records
      borrowRecords.slice().forEach((b: any) => {
        const ts = b.date_borrowed ? new Date(b.date_borrowed).getTime() : Date.now();
        const count = Array.isArray(b.items) ? b.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0) : 0;
        const who = b.borrow_user || b.group_leader || b.managed_name || 'Unknown';
        activity.push({
          timestamp: ts,
          type: "borrow",
          description: `${who} borrowed ${count} item(s)${b.reservation_code ? ` (code: ${b.reservation_code})` : ''}`,
          time: new Date(ts).toLocaleString()
        });
      });

      // Maintenance events
      (maintenanceRecords || []).forEach((m: any) => {
        const ts = m.date_accomplished ? new Date(m.date_accomplished).getTime() : (m.createdAt ? new Date(m.createdAt).getTime() : Date.now());
        activity.push({
          timestamp: ts,
          type: "maintenance",
          description: m.date_accomplished ? `Maintenance completed: ${m.equipment_name || m.identifier_number || ''}` : `Maintenance scheduled: ${m.equipment_name || ''}`,
          time: new Date(ts).toLocaleString()
        });
      });

      // Inventory adds/updates (non-consumable + consumable)
      (ncInventory || []).forEach((it: any) => {
        const ts = it.createdAt ? new Date(it.createdAt).getTime() : Date.now();
        activity.push({
          timestamp: ts,
          type: "inventory",
          description: `Inventory item added/updated: ${it.equipment_name || it.description || it.num || ''}`,
          time: new Date(ts).toLocaleString()
        });
      });
      (cInventory || []).forEach((it: any) => {
        const ts = it.createdAt ? new Date(it.createdAt).getTime() : Date.now();
        activity.push({
          timestamp: ts,
          type: "inventory",
          description: `Consumable updated: ${it.description || it.num || ''}`,
          time: new Date(ts).toLocaleString()
        });
      });

      // User/account creations
      (users || []).forEach((u: any) => {
        const ts = u.createdAt ? new Date(u.createdAt).getTime() : Date.now();
        activity.push({
          timestamp: ts,
          type: "account",
          description: `Account created: ${u.firstname || u.email || u.email}`,
          time: new Date(ts).toLocaleString()
        });
      });

      // Sort descending and take recent 6
      activity.sort((a, b) => b.timestamp - a.timestamp);
      const recentActivity = activity.slice(0, 6).map(a => ({ type: a.type, description: a.description, time: a.time }));

      setStats({
        totalItems,
        borrowedItems,
        lowStockItems,
        pendingMaintenance,
        completedMaintenance,
        totalStaff,
        recentActivity
      });
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
      // keep previous fallback if any error occurs
      setStats({
        totalItems: 142,
        borrowedItems: 28,
        lowStockItems: 7,
        pendingMaintenance: 15,
        completedMaintenance: 42,
        totalStaff: 8,
        recentActivity: [
          { type: "borrow", description: "Physics Lab borrowed 5 Multimeters", time: "2 hours ago" },
          { type: "return", description: "Chemistry Dept returned Oscilloscope", time: "5 hours ago" },
          { type: "maintenance", description: "Microscope calibration completed", time: "1 day ago" },
          { type: "inventory", description: "New resistors added to inventory", time: "1 day ago" }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon, color, subtitle, onClick }: any) => (
    <Card 
      sx={{ 
        p: 2, 
        borderRadius: 3, 
        boxShadow: 2,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': onClick ? {
          transform: 'translateY(-4px)',
          boxShadow: 4,
          bgcolor: alpha(color, 0.05)
        } : {},
        flex: '1 1 200px',
        minWidth: '200px',
        m: 1
      }}
      onClick={onClick}
    >
      <CardContent sx={{ p: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h4" fontWeight="bold" color={color}>
              {value}
            </Typography>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box 
            sx={{ 
              p: 1.5, 
              borderRadius: '50%', 
              bgcolor: alpha(color, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  const QuickAction = ({ title, description, icon, color, path }: any) => (
    <Paper 
      sx={{ 
        p: 2, 
        borderRadius: 3,
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 3,
          bgcolor: alpha(color, 0.05)
        },
        flex: '1 1 200px',
        minWidth: '200px',
        m: 1
      }}
      onClick={() => navigate(path)}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        <Box 
          sx={{ 
            p: 1, 
            borderRadius: 2, 
            bgcolor: alpha(color, 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );

  const ActivityItem = ({ type, description, time }: any) => {
    const getIcon = () => {
      switch (type) {
        case "borrow": return <AiOutlineFileSearch style={{ color: theme.palette.info.main, fontSize: 22 }} />;
        case "return": return <AiOutlineFileSearch style={{ color: theme.palette.success.main, fontSize: 22 }} />;
        case "maintenance": return <AiOutlineTool style={{ color: theme.palette.warning.main, fontSize: 22 }} />;
        case "inventory": return <AiOutlineAppstore style={{ color: theme.palette.primary.main, fontSize: 22 }} />;
        case "account": return <AiOutlineUser style={{ color: theme.palette.secondary.main, fontSize: 22 }} />;
        case "reservation": return <AiOutlineBook style={{ color: "#6b7280", fontSize: 22 }} />;
        default: return <AiOutlineAppstore style={{ fontSize: 22 }} />;
      }
    };

    return (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, py: 1 }}>
        <Box sx={{ color: theme.palette.text.secondary }}>
          {getIcon()}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2">{description}</Typography>
          <Typography variant="caption" color="text.secondary">
            {time}
          </Typography>
        </Box>
      </Box>
    );
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={60} sx={{ mb: 2, color: theme.palette.primary.main }} />
          <Typography variant="h6" color="text.secondary">
            Loading dashboard data...
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Welcome Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Welcome back, {user?.given_name} {user?.family_name}
        </Typography>
        <Chip 
          label={user?.role} 
          color="primary" 
          variant="outlined" 
          sx={{ mt: 1 }} 
        />
      </Box>

      {/* Stats Overview */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', mb: 4, mx: -1 }}>
        <StatCard
          title="Total Items"
          value={stats.totalItems}
          icon={<AiOutlineAppstore style={{ color: theme.palette.primary.main, fontSize: 22 }} />}
          subtitle={`Non-consumable & Consumable`}
          color={theme.palette.primary.main}
          onClick={() => navigate('/inventory')}
        />
        <StatCard
          title="Borrowed"
          value={stats.borrowedItems}
          icon={<AiOutlineFileSearch style={{ color: theme.palette.info.main, fontSize: 22 }} />}
          color={theme.palette.info.main}
          subtitle={`${Math.round((stats.borrowedItems / stats.totalItems) * 100)}% of inventory`}
          onClick={() => navigate('/borrow')}
        />
        <StatCard
          title="Low Stock"
          value={stats.lowStockItems}
          icon={<WarningIcon sx={{ color: theme.palette.warning.main }} />}
          color={theme.palette.warning.main}
          subtitle="Needs attention"
          onClick={() => navigate('/inventory?stock=Alert')}
        />
        <StatCard
          title="Maintenance"
          value={`${stats.completedMaintenance}/${stats.pendingMaintenance + stats.completedMaintenance}`}
          icon={<AiOutlineTool style={{ color: theme.palette.success.main, fontSize: 22 }} />}
          color={theme.palette.success.main}
          subtitle="Completed/Pending"
          onClick={() => navigate('/maintenance')}
        />
      </Box>

      {/* Main Content */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4 }}>
        {/* Quick Actions */}
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Quick Actions
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', mx: -1 }}>
            <QuickAction
              title="Manage Inventory"
              description="View and update equipment inventory"
              icon={<AiOutlineAppstore style={{ color: theme.palette.primary.main, fontSize: 22 }} />}
              color={theme.palette.primary.main}
              path="/inventory"
            />
            <QuickAction
              title="Borrow Equipment"
              description="Create new borrow requests"
              icon={<AiOutlineFileSearch style={{ color: theme.palette.info.main, fontSize: 22 }} />}
              color={theme.palette.info.main}
              path="/borrow"
            />
            <QuickAction
              title="Maintenance"
              description="Track maintenance"
              icon={<AiOutlineTool style={{ color: theme.palette.warning.main, fontSize: 22 }} />}
              color={theme.palette.warning.main}
              path="/maintenance"
            />
            <QuickAction
              title="Account Management"
              description="Manage user accounts and permissions"
              icon={<AiOutlineUser style={{ color: theme.palette.secondary.main, fontSize: 22 }} />}
              color={theme.palette.secondary.main}
              path="/staff"
            />
          </Box>
        </Box>

        {/* Recent Activity */}
        <Box sx={{ flex: 1, minWidth: { xs: '100%', md: '300px' } }}>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Recent Activity
          </Typography>
          <Paper sx={{ p: 2, borderRadius: 3 }}>
            {stats.recentActivity.map((activity, index) => (
              <ActivityItem
                key={index}
                type={activity.type}
                description={activity.description}
                time={activity.time}
              />
            ))}
            {stats.recentActivity.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                No recent activity
              </Typography>
            )}
          </Paper>
        </Box>
      </Box>
    </Container>
  );
};

export default HomePage;