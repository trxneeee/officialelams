import { useState, useRef, useEffect } from "react";
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  InputAdornment,
  useTheme,
  useMediaQuery
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import axios from "axios";

const API_BASE_URL = "https://elams.sit.ubaguio.edu/api";

interface Reservation {
  _id: string;
  reservation_code: string;
  subject?: string;
  course?: string;
  instructor?: string;
  schedule?: string;
  group_count?: number;
  notes?: string;
  // ...other optional fields
}

export default function StudentPrepPage() {
  const [code, setCode] = useState("");
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(false);
  const [groupNumber, setGroupNumber] = useState("");
  const [leaderName, setLeaderName] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const [members, setMembers] = useState<{ name: string; id: string }[]>([]);
  const [memberDraft, setMemberDraft] = useState({ name: "", id: "" });
  const [barcode, setBarcode] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [myPreps, setMyPreps] = useState<any[]>([]);
  const [viewPrepDialogOpen, setViewPrepDialogOpen] = useState(false);
  const [selectedPrep, setSelectedPrep] = useState<any | null>(null);

  // SVG ref + preview image for the "View saved prep" dialog
  const svgRefView = useRef<SVGSVGElement | null>(null);
  // SVG ref for the generated barcode (used across effects / rendering)
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [previewImageView, setPreviewImageView] = useState<string | null>(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Responsive barcode container refs and measured widths
  const barcodeContainerRef = useRef<HTMLDivElement | null>(null);
  const barcodeViewContainerRef = useRef<HTMLDivElement | null>(null);
  const [barcodeWidth, setBarcodeWidth] = useState<number>(420);
  const [barcodeViewWidth, setBarcodeViewWidth] = useState<number>(420);

  useEffect(() => {
    const updateWidths = () => {
      try {
        const cW = barcodeContainerRef.current?.clientWidth ?? Math.min(window.innerWidth - 48, 720);
        const vW = barcodeViewContainerRef.current?.clientWidth ?? Math.min(window.innerWidth - 48, 720);
        setBarcodeWidth(Math.max(220, Math.min(cW, 720)));
        setBarcodeViewWidth(Math.max(220, Math.min(vW, 720)));
      } catch {
        setBarcodeWidth(420);
        setBarcodeViewWidth(420);
      }
    };
    updateWidths();
    window.addEventListener("resize", updateWidths);
    return () => window.removeEventListener("resize", updateWidths);
  }, []);

  // Add helper to extract user's full name and student id from email
  const getCurrentUserNameAndId = () => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      const given = (u.given_name || u.firstname || u.name || "").toString().trim();
      const family = (u.family_name || u.lastname || "").toString().trim();
      const email = (u.email || "").toString().trim().toLowerCase();
      // try to extract the local-part number before @s.ubaguio.edu
      let id = "";
      const m = email.match(/^([^@]+)@s\.ubaguio\.edu$/i);
      if (m && m[1]) {
        const digits = m[1].match(/\d+/);
        id = digits ? digits[0] : m[1];
      }
      const fullName = `${given} ${family}`.trim() || given || family || "";
      return { fullName, id };
    } catch {
      return { fullName: "", id: "" };
    }
  };

  const loadReservation = async () => {
    if (!code.trim()) return alert("Enter reservation code");
    setLoading(true);
    try {
      const resp = await axios.get(`${API_BASE_URL}/reservations/code/${encodeURIComponent(code.trim())}`);
      setReservation(resp.data);
      // prefill nothing sensitive — students provide group details
      // PREFILL leader name & id from current user when available
      const { fullName, id } = getCurrentUserNameAndId();
      if (fullName && !leaderName) setLeaderName(fullName);
      if (id && !leaderId) setLeaderId(id);
      setDialogOpen(true);
    } catch (err: any) {
      console.error("Load reservation error:", err);
      alert(err.response?.data?.error || "Reservation not found");
      setReservation(null);
    } finally {
      setLoading(false);
    }
  };

  const addMember = () => {
    if (!memberDraft.name.trim() && !memberDraft.id.trim()) return;
    setMembers(prev => [...prev, { ...memberDraft }]);
    setMemberDraft({ name: "", id: "" });
  };

  const removeMember = (index: number) => {
    setMembers(prev => prev.filter((_, i) => i !== index));
  };

  const generateCode128Barcode = (): string => {
    // Use reservation code + group number + random base36 suffix (alphanumeric)
    const prefix = reservation?.reservation_code ? String(reservation.reservation_code).toUpperCase() : "C128";
    const group = (groupNumber || "G").toString().replace(/\s+/g, '').toUpperCase();
    const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const code = `${prefix}-${group}-${suffix}`;
    return code;
  };

  const generateBarcode = (): string => {
    // generate Code128 payload and set state
    const c128 = generateCode128Barcode();
    setBarcode(c128);
    return c128;
  };

  // Fetch student's prep records and filter for current user (by leader id or borrower_name)
  const fetchMyPreps = async () => {
    try {
      const resp = await axios.post(`${API_BASE_URL}/student-prep`, { action: 'read' });
      const all: any[] = Array.isArray(resp.data) ? resp.data : (resp.data?.data || []);
      const { fullName, id } = getCurrentUserNameAndId();
      const filtered = all.filter(sp => {
        if (!sp) return false;
        const leaderMatch = sp.group_leader_id && id && String(sp.group_leader_id) === String(id);
        const borrowerMatch = sp.borrower_name && fullName && String(sp.borrower_name).toLowerCase().includes(String(fullName).toLowerCase());
        const leaderNameMatch = sp.group_leader && fullName && String(sp.group_leader).toLowerCase().includes(String(fullName).toLowerCase());
        return leaderMatch || borrowerMatch || leaderNameMatch;
      });
      setMyPreps(filtered);
    } catch (err) {
      console.error('Failed to fetch student prep records', err);
    }
  };

  useEffect(() => {
    fetchMyPreps();
  }, []);

  // Delete a student-prep record (calls server)
  const handleDeletePrep = async (prepId: string) => {
    if (!confirm('Delete this group prep?')) return;
    try {
      await axios.post(`${API_BASE_URL}/student-prep`, { action: 'delete', _id: prepId });
      await fetchMyPreps();
      alert('Record deleted');
    } catch (err) {
      console.error('Delete prep error', err);
      alert('Failed to delete record');
    }
  };

  // View prep details
  const handleViewPrep = (prep: any) => {
    setSelectedPrep(prep);
    setViewPrepDialogOpen(true);
  };

  // render barcode to SVG using JsBarcode when "barcode" changes
  useEffect(() => {
    let mounted = true;
    if (!barcode) {
      // clear svg + preview image
      if (svgRef.current) svgRef.current.innerHTML = "";
      setPreviewImage(null);
      return;
    }

    // dynamic import to avoid build-time typing issues if package not installed
    (async () => {
      try {
        const JsBarcodeModule: any = await import("jsbarcode");
        const JsBarcode = JsBarcodeModule.default || JsBarcodeModule;
        if (!mounted) return;
        if (svgRef.current) {
          // Responsive sizing: use measured container width
          const width = Math.round(barcodeWidth);
          const height = Math.max(64, Math.round(width * 0.24));
          svgRef.current.innerHTML = "";
          svgRef.current.setAttribute("width", String(width));
          svgRef.current.setAttribute("height", String(height));
          svgRef.current.setAttribute("viewBox", `0 0 ${width} ${height}`);
          JsBarcode(svgRef.current, barcode, {
            format: "CODE128",
            displayValue: true,
            height: Math.max(40, Math.round(height * 0.6)),
            textMargin: 4,
            fontSize: Math.max(10, Math.round(width / 36)),
            margin: Math.max(6, Math.round(width * 0.02))
          });

           // After rendering SVG, convert to PNG data URL for preview/download
           try {
             // Serialize SVG to string
             const serializer = new XMLSerializer();
             const svgString = serializer.serializeToString(svgRef.current);
             // Create a Blob and an objectURL for the SVG string
             const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
             const url = URL.createObjectURL(svgBlob);

             // Create an Image to draw onto canvas
             const img = new Image();
             // Ensure crossOrigin to avoid tainting (if served locally this is fine)
             img.crossOrigin = "anonymous";
             img.onload = () => {
               if (!mounted) {
                 URL.revokeObjectURL(url);
                 return;
               }
               // Create canvas sized to measured width/height (scale for better DPI)
               const scale = 2;
               const canvas = document.createElement("canvas");
               canvas.width = width * scale;
               canvas.height = height * scale;
               const ctx = canvas.getContext("2d");
               if (ctx) {
                 ctx.fillStyle = "#ffffff"; // white background
                 ctx.fillRect(0, 0, canvas.width, canvas.height);
                 ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                 try {
                   const pngData = canvas.toDataURL("image/png");
                   setPreviewImage(pngData);
                 } catch (err) {
                   console.error("Failed to convert canvas to PNG:", err);
                   setPreviewImage(null);
                 }
               }
               URL.revokeObjectURL(url);
             };
            img.onerror = (e) => {
              console.error("Failed to load SVG image for conversion", e);
              URL.revokeObjectURL(url);
              setPreviewImage(null);
            };
            img.src = url;
           } catch (convErr) {
             console.error("SVG-to-PNG conversion failed:", convErr);
             setPreviewImage(null);
           }
        }
      } catch (err) {
        console.error("Failed to render barcode, ensure jsbarcode is installed:", err);
        setPreviewImage(null);
      }
    })();

    return () => { mounted = false; };
  }, [barcode, barcodeWidth]);

  // Render selectedPrep.group_barcode into SVG + generate PNG preview
  useEffect(() => {
    let mounted = true;
    if (!selectedPrep?.group_barcode) {
      if (svgRefView.current) svgRefView.current.innerHTML = "";
      setPreviewImageView(null);
      return;
    }

    (async () => {
      try {
        const JsBarcodeModule: any = await import("jsbarcode");
        const JsBarcode = JsBarcodeModule.default || JsBarcodeModule;
        if (!mounted) return;
        if (svgRefView.current) {
          const width = Math.round(barcodeViewWidth);
          const height = Math.max(64, Math.round(width * 0.24));
          svgRefView.current.innerHTML = "";
          svgRefView.current.setAttribute("width", String(width));
          svgRefView.current.setAttribute("height", String(height));
          svgRefView.current.setAttribute("viewBox", `0 0 ${width} ${height}`);
          JsBarcode(svgRefView.current, String(selectedPrep.group_barcode), {
            format: "CODE128",
            displayValue: true,
            height: Math.max(40, Math.round(height * 0.6)),
            textMargin: 4,
            fontSize: Math.max(10, Math.round(width / 36)),
            margin: Math.max(6, Math.round(width * 0.02))
          });

           // convert SVG -> PNG for preview & download
           try {
             const serializer = new XMLSerializer();
             const svgString = serializer.serializeToString(svgRefView.current);
             const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
             const url = URL.createObjectURL(svgBlob);
             const img = new Image();
             img.crossOrigin = "anonymous";
             img.onload = () => {
               if (!mounted) { URL.revokeObjectURL(url); return; }
               const scale = 2;
               const canvas = document.createElement("canvas");
               canvas.width = width * scale;
               canvas.height = height * scale;
               const ctx = canvas.getContext("2d");
               if (ctx) {
                 ctx.fillStyle = "#ffffff";
                 ctx.fillRect(0, 0, canvas.width, canvas.height);
                 ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                 try {
                   const pngData = canvas.toDataURL("image/png");
                   setPreviewImageView(pngData);
                 } catch (err) {
                   setPreviewImageView(null);
                 }
               }
               URL.revokeObjectURL(url);
             };
             img.onerror = () => { URL.revokeObjectURL(url); setPreviewImageView(null); };
             img.src = url;
           } catch (convErr) {
             console.error("SVG->PNG (view) failed:", convErr);
             setPreviewImageView(null);
           }
        }
      } catch (err) {
        console.error("JsBarcode import/render failed (view):", err);
        setPreviewImageView(null);
      }
    })();

    return () => { mounted = false; };
  }, [selectedPrep, barcodeViewWidth]);

  const copyBarcode = async () => {
    if (!barcode) return;
    try {
      await navigator.clipboard.writeText(barcode);
      alert("Code128 copied to clipboard");
    } catch {
      alert(`Code128: ${barcode}`);
    }
  };

  const savePrep = async () => {
    if (!reservation) return;
    // Ensure leader fields filled (fallback to current user)
    const { fullName: userFullName, id: userId } = getCurrentUserNameAndId();
    if (!leaderName.trim() && userFullName) setLeaderName(userFullName);
    if (!leaderId.trim() && userId) setLeaderId(userId);

    if (!leaderName.trim() || !leaderId.trim() || !groupNumber.trim()) {
      return alert("Please fill Group Number, Leader Name and Leader ID");
    }
    setSaving(true);
    try {
      // ensure barcode
      const generated: string = barcode || generateBarcode();

      // Build borrower_name: "Given Family <ID>" (for individual use and record)
      const borrowerNameFromUser = `${userFullName}${userId ? " " + userId : ""}`.trim();

      const updatedNotes = (reservation.notes || "") + (reservation.notes ? "\n" : "") + `Group Barcode: ${generated}`;

      // Build payload for StudentPrep model (stored separately)
      const prepPayload = {
        reservation_ref: reservation._id,
        reservation_code: reservation.reservation_code,
        group_barcode: generated,
        user_type: "Group",
        // set borrower_name from user (if any) — also keep leaderName so staff sees leader explicitly
        borrower_name: borrowerNameFromUser || leaderName,
        group_number: groupNumber,
        group_leader: leaderName,
        group_leader_id: leaderId,
        group_members: members.map(m => ({ name: m.name || "", id: m.id || "" })),
        notes: updatedNotes
      };

      // Save student-prep record to new endpoint
      await axios.post(`${API_BASE_URL}/student-prep`, { action: 'create', ...prepPayload });

      setBarcode(generated);
      alert("Group prep saved. Show the barcode to staff at pickup.");
      setDialogOpen(false);
    } catch (err) {
      console.error("Save prep error:", err);
      alert("Failed to save group prep");
    } finally {
      setSaving(false);
    }
  };

  // Download helper for viewed prep image
  const downloadPrepImage = () => {
    const filename = `${selectedPrep?.reservation_code || "prep"}-code128.png`;
    if (previewImageView) {
      const a = document.createElement("a");
      a.href = previewImageView;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    if (svgRefView.current) {
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svgRefView.current);
      const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedPrep?.reservation_code || "prep"}-code128.svg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  };

  // Add helper to download PNG (uses previewImage if available, fallback to SVG serialization)
  const downloadBarcodeImage = () => {
    const filename = `${reservation?.reservation_code || "barcode"}-code128.png`;
    if (previewImage) {
      const a = document.createElement("a");
      a.href = previewImage;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    // fallback: serialize SVG and trigger download as .svg
    if (svgRef.current) {
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svgRef.current);
      const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reservation?.reservation_code || "barcode"}-code128.svg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Student Reservation Prep
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enter your reservation code and fill your group details. A group barcode will be generated — show it
          to staff when picking up equipment so they can pre-fill borrower info.
        </Typography>

        <Stack direction="row" spacing={2} mb={2}>
          <TextField
            fullWidth
            label="Reservation Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") loadReservation(); }}
          />
          <Button variant="contained" onClick={loadReservation} disabled={loading}>
            {loading ? "Loading..." : "Load"}
          </Button>
        </Stack>

        {reservation && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2">Reservation found:</Typography>
            <Typography variant="body2">{reservation.subject} — {reservation.course} — {reservation.instructor}</Typography>
          </Box>
        )}

        {barcode && (
          <Paper sx={{ p: 2, mb: 2, bgcolor: "grey.50" }}>
            <Stack direction={isMobile ? "column" : "row"} alignItems="center" justifyContent="space-between" spacing={2}>
              <Box>
                <Typography variant="caption">Generated Code128 (scanable)</Typography>
                <Typography variant="h6" sx={{ mt: 0.5, letterSpacing: 1.5 }}>{barcode}</Typography>
                {reservation && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                    Reservation: {reservation.reservation_code}
                  </Typography>
                )}
                {/* Show PNG preview image if available */}
                {previewImage && (
                  <Box
                    ref={barcodeContainerRef}
                    sx={{
                      mt: 1,
                      width: isMobile ? "100%" : 420,
                      maxWidth: "100%",
                      overflowX: "auto",
                    }}
                  >
                    {previewImage ? (
                      <img
                        src={previewImage}
                        alt="barcode preview"
                        style={{
                          width: "100%",
                          maxWidth: 720,
                          height: "auto",
                          display: "block",
                          marginTop: 8,
                          borderRadius: 6,
                          background: "#fff"
                        }}
                      />
                    ) : (
                      <svg ref={svgRef} style={{ width: "100%", height: "auto", display: "block" }} />
                    )}
                  </Box>
                )}
              </Box>
              <Stack direction="row" spacing={1}>
                <IconButton onClick={copyBarcode} aria-label="copy code128"><ContentCopyIcon /></IconButton>
                <Button variant="outlined" onClick={() => { setBarcode(null); setPreviewImage(null); }}>Clear</Button>
                <Button variant="contained" onClick={downloadBarcodeImage} sx={{ ml: 1 }}>
                  Download Image
                </Button>
              </Stack>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
              Scan or type this Code128 into the Borrow page's Reservation Code field to auto-populate borrower info (or give this code to staff).
            </Typography>
          </Paper>
        )}

        <Box>
          <Button
            disabled={!reservation}
            onClick={() => setDialogOpen(true)}
            variant="outlined"
            fullWidth={isMobile}
          >
            Open Group Prep Form
          </Button>
        </Box>
      </Paper>

      {/* My Prep Records (student-owned) */}
      <Box sx={{ mt: 4 }}>
        <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>Saved Form</Typography>
          <Typography variant="body2" color="text.secondary">Your saved group prep records are listed below.</Typography>
        </Paper>

        {myPreps.length === 0 ? (
           <Typography variant="body2" color="text.secondary">No prep records found.</Typography>
         ) : (
           <Stack spacing={2}>
             {myPreps.map((p) => (
               <Paper key={p._id} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 2 }}>
                 <Box>
                   <Typography variant="subtitle2">{p.reservation_code || '-'}</Typography>
                   <Typography variant="body2" color="text.secondary">
                     Leader: {p.group_leader || '-'} {p.group_leader_id ? `(${p.group_leader_id})` : ''}
                   </Typography>
                   <Typography variant="caption" color="text.secondary" display="block">
                     Barcode: {p.group_barcode}
                   </Typography>
                 </Box>
                 <Stack direction="row" spacing={1}>
                   <Button size="small" variant="outlined" onClick={() => handleViewPrep(p)}>View</Button>
                   <Button size="small" color="error" variant="contained" onClick={() => handleDeletePrep(p._id)}>Delete</Button>
                 </Stack>
               </Paper>
             ))}
           </Stack>
         )}
       </Box>

      {/* View StudentPrep Dialog */}
      <Dialog open={viewPrepDialogOpen} onClose={() => { setViewPrepDialogOpen(false); setSelectedPrep(null); setPreviewImageView(null); }} fullWidth maxWidth="sm">
        <DialogTitle>Group Prep Details</DialogTitle>
        <DialogContent>
          {selectedPrep ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Reservation Code" value={selectedPrep.reservation_code || ''} InputProps={{ readOnly: true }} fullWidth />
              <TextField label="Group Barcode" value={selectedPrep.group_barcode || ''} InputProps={{ readOnly: true }} fullWidth />
              <TextField label="Group Number" value={selectedPrep.group_number || ''} InputProps={{ readOnly: true }} fullWidth />
              <TextField label="Group Leader" value={selectedPrep.group_leader || ''} InputProps={{ readOnly: true }} fullWidth />
              <TextField label="Leader ID" value={selectedPrep.group_leader_id || ''} InputProps={{ readOnly: true }} fullWidth />

              {/* Render both PNG preview (if generated) and inline SVG (for crispness / fallback) */}
              <Box
                ref={barcodeViewContainerRef}
                sx={{
                  mt: 1,
                  width: isMobile ? "100%" : 420,
                  maxWidth: "100%",
                  overflowX: "auto",
                }}
              >
                {previewImageView ? (
                  <img
                    src={previewImageView}
                    alt="barcode preview"
                    style={{
                      width: "100%",
                      maxWidth: 720,
                      height: "auto",
                      display: "block",
                      marginTop: 8,
                      borderRadius: 6,
                      background: "#fff"
                    }}
                  />
                ) : (
                  <svg ref={svgRefView} style={{ width: "100%", height: "auto", display: "block" }} />
                )}
              </Box>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button size="small" variant="contained" onClick={downloadPrepImage}>Download Image</Button>
                <Button size="small" variant="outlined" onClick={() => { setViewPrepDialogOpen(false); setSelectedPrep(null); setPreviewImageView(null); }}>Close</Button>
              </Stack>

              <Box>
                <Typography variant="subtitle2">Members</Typography>
                {Array.isArray(selectedPrep.group_members) && selectedPrep.group_members.length > 0 ? (
                  <Stack spacing={0.5} sx={{ mt: 1 }}>
                    {selectedPrep.group_members.map((m: any, i: number) => (
                      <Typography key={i} variant="body2">{m.name || 'Unnamed'} {m.id ? `(${m.id})` : ''}</Typography>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">No members recorded</Typography>
                )}
              </Box>
              {selectedPrep.notes && <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>{selectedPrep.notes}</Typography>}
            </Stack>
          ) : <Typography>No data</Typography>}
        </DialogContent>
        <DialogActions>
          {/* Close button moved above as well — keep consistent */}
          <Button onClick={() => { setViewPrepDialogOpen(false); setSelectedPrep(null); setPreviewImageView(null); }}>Done</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="sm"
        fullScreen={isMobile}
        scroll="paper"
      >
        <DialogTitle>Group Preparation</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* Group Number + Leader Name row (kept together) */}
            <Stack direction={isMobile ? "column" : "row"} spacing={2}>
              <TextField label="Group Number" value={groupNumber} onChange={(e) => setGroupNumber(e.target.value)} fullWidth />
              {/* Prefilled leader name should be readOnly */}
              <TextField label="Group Leader Name" value={leaderName} onChange={(e) => setLeaderName(e.target.value)} fullWidth InputProps={{ readOnly: true }} />
            </Stack>

            {/* Group Leader ID on its own row to avoid collisions with members control */}
            <Stack direction="row" spacing={2}>
              {/* Prefilled leader id should be readOnly */}
              <TextField label="Group Leader ID" value={leaderId} onChange={(e) => setLeaderId(e.target.value)} fullWidth InputProps={{ readOnly: true }} />
            </Stack>

            {/* Members add controls on a separate row (prevents layout overlap) */}
            <Stack direction={isMobile ? "column" : "row"} spacing={2} alignItems="center">
              <TextField
                label="Member Name"
                value={memberDraft.name}
                onChange={(e) => setMemberDraft(prev => ({ ...prev, name: e.target.value }))}
                sx={{ flex: 2 }}
                size="small"
                fullWidth={isMobile}
              />
              <TextField
                label="Member ID"
                value={memberDraft.id}
                onChange={(e) => setMemberDraft(prev => ({ ...prev, id: e.target.value }))}
                sx={{ flex: 1 }}
                size="small"
                fullWidth={isMobile}
              />
              <Button variant="contained" startIcon={<AddIcon />} onClick={addMember} disabled={!memberDraft.name && !memberDraft.id}>
                Add
              </Button>
            </Stack>

            {/* Member chips */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Group Members</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {members.map((m, i) => (
                  <Chip key={i} label={`${m.name || "Unnamed"} ${m.id ? `(${m.id})` : ""}`} onDelete={() => removeMember(i)} sx={{ m: 0.5 }} />
                ))}
                {members.length === 0 && <Typography variant="caption" color="text.secondary">No members added</Typography>}
              </Stack>
            </Box>

            <TextField label="Optional Notes" multiline rows={3} InputProps={{ startAdornment: <InputAdornment position="start">✎</InputAdornment> }} fullWidth />

            {/* Barcode preview + rendered SVG */}
            {barcode && (
              <Paper sx={{ p: 2, mb: 2, bgcolor: "grey.50" }}>
                <Stack direction={isMobile ? "column" : "row"} alignItems="center" justifyContent="space-between" spacing={2}>
                  <Box>
                    <Typography variant="caption">Generated Code128 (scanable)</Typography>
                    <Typography variant="h6" sx={{ mt: 0.5, letterSpacing: 1.5 }}>{barcode}</Typography>
                    {reservation && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                        Reservation: {reservation.reservation_code}
                      </Typography>
                    )}
                  </Box>

                  <Stack direction="row" spacing={1} alignItems="center">
                    <IconButton onClick={copyBarcode} aria-label="copy code128"><ContentCopyIcon /></IconButton>
                    <Button variant="outlined" onClick={() => { setBarcode(null); if (svgRef.current) svgRef.current.innerHTML = ""; setPreviewImage(null); }}>Clear</Button>
                    <Button variant="contained" onClick={downloadBarcodeImage}>Download Image</Button>
                  </Stack>
                </Stack>

                {/* SVG barcode rendered by JsBarcode */}
                <Box
                  ref={barcodeContainerRef}
                  sx={{
                    mt: 2,
                    width: isMobile ? "100%" : 420,
                    maxWidth: "100%",
                    overflowX: "auto",
                    display: "flex",
                    justifyContent: isMobile ? "center" : "flex-start"
                  }}
                >
                  {previewImage ? (
                    <img
                      src={previewImage}
                      alt="barcode preview"
                      style={{
                        width: "100%",
                        maxWidth: 720,
                        height: "auto",
                        display: "block",
                        background: "#fff",
                        borderRadius: 6
                      }}
                    />
                  ) : (
                    <svg ref={svgRef} style={{ width: "100%", height: "auto", display: "block" }} />
                  )}
                </Box>

                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                  Scan or type this Code128 into the Borrow page's Reservation Code field to auto-populate borrower info (or give this code to staff).
                </Typography>
              </Paper>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: isMobile ? 2 : 1.5 }}>
          <Stack direction={isMobile ? "column" : "row"} spacing={1} sx={{ width: "100%" }}>
            <Button onClick={() => { generateBarcode(); }} variant="outlined" fullWidth={isMobile}>
              Generate Code128
            </Button>
            <Button onClick={savePrep} variant="contained" disabled={saving} fullWidth={isMobile}>
              {saving ? "Saving..." : "Save & Publish Code128"}
            </Button>
            <Button onClick={() => setDialogOpen(false)} fullWidth={isMobile}>Close</Button>
          </Stack>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
