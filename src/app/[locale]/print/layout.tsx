// Druckansichten immer hell (#102): im Dunkelmodus erbten sie sonst den dunklen Hintergrund,
// während der Text schwarz gesetzt ist.
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-black" style={{ colorScheme: "light" }}>
      {children}
    </div>
  );
}
