// src/components/PrepareReservationDialog.tsx
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';

interface PrepareReservationDialogProps {
  open: boolean;
  reservation: any;
  inventory: any[];
  onClose: () => void;
  onPrepare: (preparedItems: any[]) => void;
}

export default function PrepareReservationDialog({
  open,
  reservation,
  inventory,
  onClose,
  onPrepare
}: PrepareReservationDialogProps) {
  const [preparedItems, setPreparedItems] = useState<any[]>([]);

  useEffect(() => {
    if (reservation) {
      // Initialize prepared items from reservation items
      const initialPrepared = reservation.items.map((item: any) => ({
        ...item,
        identifier: '',
        prepared_by: JSON.parse(localStorage.getItem('user') || '{}').email || 'Unknown'
      }));
      setPreparedItems(initialPrepared);
    }
  }, [reservation]);

  const handleIdentifierChange = (itemId: string, identifier: string) => {
    setPreparedItems(prev => 
      prev.map(item => 
        item.item_id === itemId ? { ...item, identifier } : item
      )
    );
  };

  const getAvailableIdentifiers = (itemId: string) => {
    const item = inventory.find(i => i.num === itemId);
    return item?.identifiers || [];
  };

  const handleSubmit = () => {
    onPrepare(preparedItems);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Prepare Reservation Items
        <Typography variant="body2" color="text.secondary">
          Reservation Code: {reservation?.reservation_code}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h6" gutterBottom>
              Reservation Details
            </Typography>
            <Typography>Subject: {reservation?.subject}</Typography>
            <Typography>Instructor: {reservation?.instructor}</Typography>
            <Typography>Course: {reservation?.course}</Typography>
          </Box>

          <Box>
            <Typography variant="h6" gutterBottom>
              Select Identifiers for Items
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Item Name</TableCell>
                    <TableCell>Quantity</TableCell>
                    <TableCell>Select Identifier</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {preparedItems.map((item) => (
                    <TableRow key={item.item_id}>
                      <TableCell>{item.item_name}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>
                        <FormControl fullWidth size="small">
                          <InputLabel>Identifier</InputLabel>
                          <Select
                            value={item.identifier}
                            label="Identifier"
                            onChange={(e) => handleIdentifierChange(item.item_id, e.target.value)}
                          >
                            <MenuItem value="">None</MenuItem>
                            {getAvailableIdentifiers(item.item_id).map((identifier: string) => (
                              <MenuItem key={identifier} value={identifier}>
                                {identifier}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={handleSubmit}
          disabled={!preparedItems.every(item => item.identifier)}
        >
          Mark as Prepared
        </Button>
      </DialogActions>
    </Dialog>
  );
}