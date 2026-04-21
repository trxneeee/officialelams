import React, { createContext, useContext, useState } from "react";

// Types
export interface InventoryItem {
  num: string;
  equipment_name: string;
  facility: string;
  brand_model: string;
  total_qty: string;
  borrowed: string;
  identifier_type: string;
  identifiers: string[];
  statuses: string[];
  location: string;
  soft_hard: string;
  e_location: string;
  bat_type: string;
  bat_qty: string;
  bat_total: string;
}

export interface CInventoryItem {
  num: string;
  location: string;
  description: string;
  quantity_opened: string;
  quantity_unopened: string;
  quantity_on_order: string;
  remarks: string;
  experiment: string;
  subject: string;
  date_issued: string;
  issuance_no: string;
  stock_alert: string;
}

interface InventoryContextType {
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  cinventory: CInventoryItem[];
  setCInventory: React.Dispatch<React.SetStateAction<CInventoryItem[]>>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(
  undefined
);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [cinventory, setCInventory] = useState<CInventoryItem[]>([]);

  return (
    <InventoryContext.Provider
      value={{ inventory, setInventory, cinventory, setCInventory }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error("useInventory must be used inside InventoryProvider");
  return ctx;
};
