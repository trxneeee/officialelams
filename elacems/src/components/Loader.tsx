// src/components/Loader.tsx
import { Box, keyframes } from "@mui/material";

const bounce = keyframes`
  0%, 80%, 100% { transform: scaleY(0.3); } 
  40% { transform: scaleY(1); }
`;

interface LoaderProps {
  color?: string;
  width?: number;
  height?: number;
  gap?: number;
}

const Loader = ({ color = "#B71C1C", width = 8, height = 40, gap = 1 }: LoaderProps) => {
  return (
    <Box display="flex" justifyContent="center" alignItems="center" height={height} gap={gap}>
      {[0, 0.2, 0.4].map((delay, i) => (
        <Box
          key={i}
          sx={{
            width: `${width}px`,
            height: `${height}px`,
            bgcolor: color,
            borderRadius: "4px",
            animation: `${bounce} 1s ease-in-out infinite`,
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </Box>
  );
};

export default Loader;
