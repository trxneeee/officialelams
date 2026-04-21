import { useState, useMemo } from "react";
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  FormGroup,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  Typography,
  Stack,
} from "@mui/material";

export interface NewMaintenanceItem {
  timestamp: string;
  reporterName: string;
  labRoom: string;
  subject: string;
  brandModel: string;
  serialNumber: string;
  inventoryNumber?: string;
  maintenanceType: "Preventive" | "Repair or Corrective" | "Calibration" | "";
  problemDescription: string;
  actionTaken: string;
  result: "FIXED" | "Defective" | "Repair Pending" | "Requires External Service" | "";
  conclusions?: string;
  routineCleaning: boolean;
  partsAssessment: boolean;
  visualInspection: boolean;
  calibrationLink?: string;
}

const initialFormState: NewMaintenanceItem = {
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
  calibrationLink: "",
};

type Props = {
  onSubmit: (data: NewMaintenanceItem) => Promise<void> | void;
  onClose: () => void;
  reporters?: string[];
  rooms?: string[];
  subjects?: string[];
};

export default function NewMaintenanceForm({ onSubmit, onClose, reporters, rooms, subjects }: Props) {
  const [form, setForm] = useState<NewMaintenanceItem>(initialFormState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const reporterOptions = reporters ?? ["John Doe", "Jane Smith", "Atenza Patrick A."];
  const roomOptions = rooms ?? ["ECE Lab (204)", "Physics Lab", "Mechatronics Lira"];
  const subjectOptions = subjects ?? ["Power Supply", "VOM", "Digital Weighing"];

  const validate = useMemo(() => {
    const required = [
      "reporterName",
      "labRoom",
      "subject",
      "brandModel",
      "serialNumber",
      "maintenanceType",
      "problemDescription",
      "actionTaken",
      "result",
    ];
    const e: Record<string, string> = {};
    for (const k of required) {
      // @ts-ignore
      if (!form[k] || String(form[k]).trim() === "") e[k] = "Required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [form]);

  const handleChange = (key: keyof NewMaintenanceItem, value: any) =>
    setForm((s) => ({ ...s, [key]: value }));

  const handleSubmit = async () => {
    // refresh timestamp
    const payload = { ...form, timestamp: new Date().toISOString() };
    setForm(payload);
    if (!validate) return;
    try {
      setSubmitting(true);
      await Promise.resolve(onSubmit(payload));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box component="form" noValidate>
      <Stack spacing={2}>
        {/* A. Equipment & Reporter Details */}
        <Stack>
          <Typography variant="subtitle1" fontWeight="bold">Equipment & Reporter Details</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Reporter</InputLabel>
              <Select
                value={form.reporterName}
                label="Reporter"
                onChange={(e) => handleChange("reporterName", e.target.value)}
                error={!!errors.reporterName}
              >
                <MenuItem value=""><em>Choose</em></MenuItem>
                {reporterOptions.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Lab / Room</InputLabel>
              <Select
                value={form.labRoom}
                label="Lab / Room"
                onChange={(e) => handleChange("labRoom", e.target.value)}
                error={!!errors.labRoom}
              >
                <MenuItem value=""><em>Choose</em></MenuItem>
                {roomOptions.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Subject / Equipment</InputLabel>
              <Select
                value={form.subject}
                label="Subject / Equipment"
                onChange={(e) => handleChange("subject", e.target.value)}
                error={!!errors.subject}
              >
                <MenuItem value=""><em>Choose</em></MenuItem>
                {subjectOptions.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Brand / Model"
              value={form.brandModel}
              onChange={(e) => handleChange("brandModel", e.target.value)}
              fullWidth
              size="small"
              error={!!errors.brandModel}
              helperText={errors.brandModel}
            />
            <TextField
              label="Serial Number"
              value={form.serialNumber}
              onChange={(e) => handleChange("serialNumber", e.target.value)}
              fullWidth
              size="small"
              error={!!errors.serialNumber}
              helperText={errors.serialNumber}
            />
            <TextField
              label="Inventory Number (optional)"
              value={form.inventoryNumber}
              onChange={(e) => handleChange("inventoryNumber", e.target.value)}
              fullWidth
              size="small"
            />
          </Stack>
        </Stack>

        {/* B. Maintenance Details */}
        <Stack>
          <Typography variant="subtitle1" fontWeight="bold">Maintenance Details</Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Maintenance Type</InputLabel>
              <Select
                value={form.maintenanceType}
                label="Maintenance Type"
                onChange={(e) => handleChange("maintenanceType", e.target.value)}
                size="small"
                error={!!errors.maintenanceType}
              >
                <MenuItem value=""><em>Choose</em></MenuItem>
                <MenuItem value="Preventive">Preventive</MenuItem>
                <MenuItem value="Repair or Corrective">Repair or Corrective</MenuItem>
                <MenuItem value="Calibration">Calibration</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Result</InputLabel>
              <Select
                value={form.result}
                label="Result"
                onChange={(e) => handleChange("result", e.target.value)}
                size="small"
                error={!!errors.result}
              >
                <MenuItem value=""><em>Choose</em></MenuItem>
                <MenuItem value="FIXED">FIXED</MenuItem>
                <MenuItem value="Defective">Defective</MenuItem>
                <MenuItem value="Repair Pending">Repair Pending</MenuItem>
                <MenuItem value="Requires External Service">Requires External Service</MenuItem>
              </Select>
            </FormControl>

            <FormControl component="fieldset" sx={{ minWidth: 220 }}>
              <RadioGroup
                row
                value={form.maintenanceType}
                onChange={(e) => handleChange("maintenanceType", e.target.value as any)}
              >
                <FormControlLabel value="Preventive" control={<Radio size="small" />} label="Preventive" />
                <FormControlLabel value="Repair or Corrective" control={<Radio size="small" />} label="Repair" />
                <FormControlLabel value="Calibration" control={<Radio size="small" />} label="Calibration" />
              </RadioGroup>
            </FormControl>
          </Stack>

          <TextField
            label="Problem Description"
            value={form.problemDescription}
            onChange={(e) => handleChange("problemDescription", e.target.value)}
            multiline
            minRows={3}
            fullWidth
            size="small"
            error={!!errors.problemDescription}
            helperText={errors.problemDescription}
            sx={{ mt: 1 }}
          />

          <TextField
            label="Action Taken"
            value={form.actionTaken}
            onChange={(e) => handleChange("actionTaken", e.target.value)}
            multiline
            minRows={3}
            fullWidth
            size="small"
            error={!!errors.actionTaken}
            helperText={errors.actionTaken}
            sx={{ mt: 1 }}
          />
        </Stack>

        {/* C. Inspection Checklist & Notes */}
        <Stack>
          <Typography variant="subtitle1" fontWeight="bold">Inspection Checklist & Notes</Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <FormGroup>
              <FormControlLabel
                control={<Checkbox checked={form.routineCleaning} onChange={(e) => handleChange("routineCleaning", e.target.checked)} />}
                label="Routine Cleaning performed"
              />
              <FormControlLabel
                control={<Checkbox checked={form.partsAssessment} onChange={(e) => handleChange("partsAssessment", e.target.checked)} />}
                label="Parts assessment completed"
              />
              <FormControlLabel
                control={<Checkbox checked={form.visualInspection} onChange={(e) => handleChange("visualInspection", e.target.checked)} />}
                label="Visual inspection done"
              />
            </FormGroup>

            <Stack spacing={2} sx={{ flex: 1 }}>
              <TextField
                label="Link to Calibration Worksheet (Optional)"
                value={form.calibrationLink}
                onChange={(e) => handleChange("calibrationLink", e.target.value)}
                fullWidth
                size="small"
              />
              <TextField
                label="Conclusions / Recommendations (optional)"
                value={form.conclusions}
                onChange={(e) => handleChange("conclusions", e.target.value)}
                multiline
                minRows={2}
                fullWidth
                size="small"
              />
            </Stack>
          </Stack>
        </Stack>

        {/* Actions */}
        <Box>
          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button onClick={() => onClose()} color="inherit" disabled={submitting}>Cancel</Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSubmit}
              disabled={!validate || submitting}
            >
              {submitting ? "Submitting..." : "Submit Maintenance Record"}
            </Button>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
