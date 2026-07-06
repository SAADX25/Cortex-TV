import AppLayout from "./AppLayout";
import AppProviders from "./AppProviders";
import { DebugPanel } from "@/shared/components/DebugPanel";
import { useUIStore } from "@/stores/useUIStore";

export default function App() {
  return (
    <AppProviders>
      <AppLayout />
      <DebugPanel />
    </AppProviders>
  );
}
