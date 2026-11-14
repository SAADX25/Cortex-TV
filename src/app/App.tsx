import AppLayout from "./AppLayout";
import AppProviders from "./AppProviders";
import { DebugPanel } from "@/shared/components/DebugPanel";

export default function App() {
  return (
    <AppProviders>
      <AppLayout />
      <DebugPanel />
    </AppProviders>
  );
}
