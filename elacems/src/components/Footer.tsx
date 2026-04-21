// src/components/Footer.tsx
import React from "react";

const Footer: React.FC = () => {
  return (
    <footer
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: "100%",
        height: "50px",
        backgroundColor: "#f5f5f5",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        borderTop: "1px solid #ddd",
        fontSize: "14px",
        color: "#555",
      }}
    >
      © {new Date().getFullYear()} ELAMS. All rights reserved.
    </footer>
  );
};

export default Footer;
