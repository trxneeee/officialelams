import {
  AppBar,
  Toolbar,
  Tabs,
  Tab,
  Box,
  Avatar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  useMediaQuery,
  ListItemButton,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Button,
  DialogActions,
  Alert,
} from "@mui/material";
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AiOutlineHome,
  AiFillHome,
  AiOutlineUser,
  AiOutlineFileSearch,
  AiOutlineAppstore,
  AiFillAppstore,
  AiOutlineTool,
  AiFillTool,
  AiOutlineSetting,
  AiOutlineSecurityScan,
  AiOutlineDatabase,
  AiOutlineGold,
  AiFillGold
} from "react-icons/ai";
import { AiFillDatabase } from "react-icons/ai";
import { AiOutlineBook, AiFillBook } from "react-icons/ai";
import { MdPerson, MdMenu, MdEditDocument, MdLogout } from "react-icons/md";
import { useTheme } from "@mui/material/styles";
import axios from "axios";
const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [userRoles, setUserRole] = useState("");
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
     const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (!storedUser) {
      navigate("/");
    } else{
      setUserRole(user.role);
    }
  }, [navigate]);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // build tabs based on role
  let tabIcons = [];
  const staffAllowed = ["Student Assistant", "Custodian", "Admin"];

  if (userRoles === "Instructor") {
    // Instructors / Program Chairs: only faculty reservation tab
    tabIcons = [
      { to: "/facultyreserve", label: "Instructor Reservations", icon: <AiOutlineBook size={24} />, active: <AiFillBook size={24} /> }
    ];
  } else if (userRoles === "Program Chair") {
    // Students: direct to student flow only
    tabIcons = [
      { to: "/facultyreserve", label: "Instructor Reservations", icon: <AiOutlineBook size={24} />, active: <AiFillBook size={24} /> },
      { to: "/forecast", label: "Forecast", icon: <AiOutlineGold size={24} />, active: <AiFillGold size={24} /> }
    ];
  }
  else if (userRoles === "Student") {
    // Students: direct to student flow only
    tabIcons = [
      { to: "/studentelams", label: "Student", icon: <AiOutlineBook size={24} />, active: <AiFillBook size={24} /> }
    ];
  } else if (staffAllowed.includes(userRoles)) {
    // Student Assistants, Custodian, Admin -> full tabs
    tabIcons = [
      { to: "/dashboard", label: "Home", icon: <AiOutlineHome size={24} />, active: <AiFillHome size={24} /> },
      ...(userRoles === "Custodian" || userRoles === "Admin" ? [{ to: "/staff", label: "User", icon: <AiOutlineUser size={24} />, active: <MdPerson size={24} /> }] : []),
      // Subjects & Courses management (Custodian/Admin only)
      ...(userRoles === "Custodian" || userRoles === "Admin" ? [{ to: "/subjects-courses", label: "Cour/Prog", icon: <AiOutlineDatabase size={24} />, active: <AiFillDatabase size={24} /> }] : []),
      ...(userRoles === "Custodian" || userRoles === "Admin" ? [{ to: "/allforecast", label: "Forecast", icon: <AiOutlineGold size={24} />, active: <AiFillGold size={24} /> }] : []),
      { to: "/reservation", label: "Reservation", icon: <AiOutlineBook size={24} />, active: <AiFillBook size={24} /> },
      { to: "/borrow", label: "Borrow", icon: <AiOutlineFileSearch size={24} />, active: <MdEditDocument size={24} /> },
      { to: "/inventory", label: "Inventory", icon: <AiOutlineAppstore size={24} />, active: <AiFillAppstore size={24} /> },
      { to: "/maintenance", label: "Maintenance", icon: <AiOutlineTool size={24} />, active: <AiFillTool size={24} /> },
    ];
  } else {
    // Fallback: minimal home
    tabIcons = [
      { to: "/dashboard", label: "Home", icon: <AiOutlineHome size={24} />, active: <AiFillHome size={24} /> }
    ];
  }
  
  // derive path->index from tabIcons so indices remain correct for any role
  const pathToIndex: Record<string, number> = tabIcons.reduce((acc, t, i) => {
    acc[t.to] = i;
    return acc;
  }, {} as Record<string, number>);
  
  const [value, setValue] = useState<number>(pathToIndex[location.pathname] ?? 0);
  
  useEffect(() => {
    setValue(pathToIndex[location.pathname] ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, userRoles]); // update when role changes too

  const handleChange = (_: unknown, newValue: number) => {
    setValue(newValue);
  };

  // Profile Menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleProfileClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);

  const handleLogout = () => {
    handleClose();
    localStorage.removeItem("user");
    navigate("/");
  };

  // Settings Dialog
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [userData, setUserData] = useState({
    email: "",
    firstname: "",
    lastname: "",
    password: "",
    confirmPassword: "",
    currentPassword: ""
  });
  const [alert, setAlert] = useState({ open: false, message: "", severity: "success" });

  const handleSettingsOpen = () => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    setUserData({
      email: user.email || "",
      firstname: user.firstname || "",
      lastname: user.lastname || "",
      password: "",
      confirmPassword: "",
      currentPassword: ""
    });
    setSettingsOpen(true);
    handleClose();
  };

  const handleSecurityOpen = () => {
    setUserData({
      email: "",
      firstname: "",
      lastname: "",
      password: "",
      confirmPassword: "",
      currentPassword: ""
    });
    setSecurityOpen(true);
    handleClose();
  };

  const handleSettingsClose = () => {
    setSettingsOpen(false);
    setAlert({ open: false, message: "", severity: "success" });
  };

  const handleSecurityClose = () => {
    setSecurityOpen(false);
    setAlert({ open: false, message: "", severity: "success" });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSettingsUpdate = async () => {
  try {
    if (!userData.firstname || !userData.lastname) {
      setAlert({ open: true, message: "First name and last name are required", severity: "error" });
      return;
    }

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const response = await axios.get(
      "https://script.google.com/macros/s/AKfycbwJaoaV_QAnwlFxtryyN-v7KWUPjCop3zaSwCCjcejp34nP32X-HXCIaXoX-PlGqPd4/exec",
      {
        params: {
          sheet: "users",
          action: "update",
          email: user.email,
          firstname: userData.firstname,
          lastname: userData.lastname,
          password: user.password,
          role: user.role
        }
      }
    );

    if (response.data.success) {
      // Update local storage
      const updatedUser = { ...user, firstname: userData.firstname, lastname: userData.lastname };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      
      setAlert({ open: true, message: "Profile updated successfully", severity: "success" });
      setTimeout(() => {
        setSettingsOpen(false);
        window.location.reload(); // Refresh to update header
      }, 1000);
    }
  } catch (error) {
    setAlert({ open: true, message: "Error updating profile", severity: "error" });
  }
};

  // Drawer for mobile
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleDrawer = (open: boolean) => () => {
    setDrawerOpen(open);
  };

 // (tabIcons defined above dynamically)

  // Get logged in user from localStorage
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userRole = user?.role || "No Role";
  const userFirstName = user?.firstname || user?.given_name;
  
  // If role is "Admin", set lastname to "Admin", otherwise use the stored lastname
  const userLastName = userRole === "Admin" ? "Admin" : (user?.lastname || user?.family_name);
  
  // Safe initials extraction
  const getInitials = (first?: string, last?: string) => {
    const f = first?.charAt(0).toUpperCase() || "";
    const l = last?.charAt(0).toUpperCase() || "";
    return f + l || "?";
  };

  const initials = getInitials(userFirstName, userLastName);

  return (
    <>
      <AppBar
        position="fixed"
        sx={{
          bgcolor: "#b91c1c",
          zIndex: (theme) => theme.zIndex.drawer + 1,
          boxShadow: 2,
        }}
      >
        <Toolbar sx={{ position: "relative", display: "flex", justifyContent: "space-between" }}>
          {/* LEFT: Branding - ECE Laboratory Asset Management System / University of Baguio */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mr: 2 }}>
            <Box sx={{ display: { xs: "none", sm: "block" } }}>
              <Typography sx={{ color: "white", fontWeight: "bold", lineHeight: 1 }}>
                ECE Laboratory Asset Management System
              </Typography>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.9)" }}>
                University of Baguio
              </Typography>
            </Box>
            {/* compact brand for small screens */}
            <Box sx={{ display: { xs: "block", sm: "none" } }}>
              <Typography variant="subtitle2" sx={{ color: "white", fontWeight: "bold" }}>
                ECE ELAMS
              </Typography>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.9)" }}>
                Univ. of Baguio
              </Typography>
            </Box>
          </Box>

          {/* Mobile Menu + quick panel buttons */}
          {isMobile && (
            <>
              <IconButton edge="start" color="inherit" onClick={toggleDrawer(true)}>
                <MdMenu size={28} />
              </IconButton>
              <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                <IconButton
                  color="inherit"
                  aria-label="open calendar"
                  onClick={() => window.dispatchEvent(new CustomEvent('open-calendar'))}
                  size="large"
                >
                  <CalendarTodayIcon />
                </IconButton>
                <IconButton
                  color="inherit"
                  aria-label="open notifications"
                  onClick={() => window.dispatchEvent(new CustomEvent('open-notifications'))}
                  size="large"
                >
                  <NotificationsIcon />
                </IconButton>
              </Box>
            </>
          )}

          {/* Tabs - show only on desktop */}
          {!isMobile && (
            // absolutely center tabs so they remain centered regardless of left/right content width
            <Box
  sx={{
    position: "absolute",
    left: "50%",
    top: 0,
    transform: "translateX(-50%)",
    height: "100%",
    display: "flex",
    alignItems: "center",
    pointerEvents: "auto",
    zIndex: 1
  }}
>
  <Tabs
    value={value}
    onChange={handleChange}
    textColor="inherit"
    TabIndicatorProps={{ style: { display: "none" } }}
    sx={{
      "& .MuiTab-root": {
        minWidth: 70,
        color: "white",
        borderRadius: "12px",
        padding: "8px 12px",
        transition: "0.3s",
        marginLeft: 1,
        marginRight: 1,
        display: "flex",
        flexDirection: "column",
        "& .MuiTab-iconWrapper": {
          marginBottom: "4px",
        },
        "&:hover": {
          backgroundColor: "#f5f6f8",
          color: "#b91c1c",
        },
      },
      "& .Mui-selected": {
        backgroundColor: "#f5f6f8",
        color: "#b91c1c",
        fontWeight: "bold",
      },
    }}
  >
    {tabIcons.map((tab) => (
      <Tab
        key={tab.to}
        icon={value === pathToIndex[tab.to] ? tab.active : tab.icon}
        label={tab.label}
        component={Link}
        to={tab.to}
      />
    ))}
  </Tabs>
</Box>
          )}

          {/* Profile Section - right aligned on desktop */}
          {!isMobile && (
            <Box sx={{ display: "flex", alignItems: "center", position: "absolute", right: 16 }}>
<IconButton onClick={handleProfileClick} size="small" sx={{ ml: 2 }}>
<Avatar
    src={user.picture}
    alt={user.name || "User"}
    sx={{
      width: 32,
      height: 32,
      border: "2px solid white",    // ✅ White border
      boxShadow: "0 0 0 1px #e5e7eb" // Optional subtle outer edge (like Gmail)
    }}
  />
</IconButton>
              <Box sx={{ ml: 1, textAlign: "left", color: "white" }}>
                <Typography variant="body1" sx={{ fontWeight: "bold" }}>
                  {userFirstName + " " + userLastName}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
                  {userRole}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Dropdown Menu for desktop */}
          <Menu
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
            onClick={handleClose}
            PaperProps={{
              elevation: 3,
              sx: {
                mt: 1.5,
                borderRadius: 2,
                minWidth: 160,
              },
            }}
          >
            <MenuItem onClick={handleLogout}>
              <MdLogout style={{ marginRight: 8 }} />
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>

        {/* Drawer for Mobile */}
        <Drawer anchor="left" open={drawerOpen} onClose={toggleDrawer(false)}>
          <Box sx={{ width: 250 }} role="presentation" onClick={toggleDrawer(false)}>
            <Box sx={{ p: 2, display: "flex", alignItems: "center" }}>
              <Avatar sx={{ bgcolor: "#b91c1c", color: "white", mr: 1 }}>
                {initials}
              </Avatar>
              <Box>
                <Typography variant="body1" sx={{ fontWeight: "bold" }}>
                  {userFirstName + " " + userLastName}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
                  {userRole}
                </Typography>
              </Box>
            </Box>
            <Divider />
            <List>
              {tabIcons.map((tab) => (
                <ListItem key={tab.to} disablePadding>
                  <ListItemButton component={Link} to={tab.to}>
                    <ListItemIcon>{tab.icon}</ListItemIcon>
                    <ListItemText primary={tab.label} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>

            <Divider />
            <MenuItem onClick={handleSettingsOpen}>
              <ListItemIcon>
                <AiOutlineSetting size={20} />
              </ListItemIcon>
              Settings
            </MenuItem>
            <MenuItem onClick={handleSecurityOpen}>
              <ListItemIcon>
                <AiOutlineSecurityScan size={20} />
              </ListItemIcon>
              Security
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <MdLogout size={20} />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Box>
        </Drawer>
      </AppBar>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onClose={handleSettingsClose} maxWidth="sm" fullWidth>
        <DialogTitle>Update Profile</DialogTitle>
        <DialogContent>
          {alert.open && (
            <Alert severity={alert.severity as any} sx={{ mb: 2 }}>
              {alert.message}
            </Alert>
          )}
          <TextField
            autoFocus
            margin="dense"
            name="firstname"
            label="First Name"
            type="text"
            fullWidth
            variant="outlined"
            value={userData.firstname}
            onChange={handleInputChange}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            name="lastname"
            label="Last Name"
            type="text"
            fullWidth
            variant="outlined"
            value={userData.lastname}
            onChange={handleInputChange}
            sx={{ mb: 2 }}
            disabled={userRole === "Admin"} // Disable last name field for Admin
          />
          <TextField
            margin="dense"
            name="email"
            label="Email"
            type="email"
            fullWidth
            variant="outlined"
            value={userData.email}
            onChange={handleInputChange}
            disabled
            sx={{ mb: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSettingsClose} style={{color:'red'}}>Cancel</Button>
          <Button onClick={handleSettingsUpdate} variant="contained" color="error">
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Security Dialog */}
      <Dialog open={securityOpen} onClose={handleSecurityClose} maxWidth="sm" fullWidth>
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          {alert.open && (
            <Alert severity={alert.severity as any} sx={{ mb: 2 }}>
              {alert.message}
            </Alert>
          )}
           <TextField
      autoFocus
      margin="dense"
      name="currentPassword"
      label="Current Password"
      type="password"
      fullWidth
      variant="outlined"
      value={userData.currentPassword}
      onChange={handleInputChange}
      sx={{ mb: 2 }}
    />
          <TextField
            autoFocus
            margin="dense"
            name="password"
            label="New Password"
            type="password"
            fullWidth
            variant="outlined"
            value={userData.password}
            onChange={handleInputChange}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            name="confirmPassword"
            label="Confirm Password"
            type="password"
            fullWidth
            variant="outlined"
            value={userData.confirmPassword}
            onChange={handleInputChange}
          />
        </DialogContent>

      </Dialog>
    </>
  );
};

export default Header;