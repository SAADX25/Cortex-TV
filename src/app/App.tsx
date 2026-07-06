import AppLayout from "./AppLayout";
import AppProviders from "./AppProviders";
import { DebugPanel } from "@/shared/components/DebugPanel";
import { useUIStore } from "@/stores/useUIStore";

export default function App() {
  const globeFps = useUIStore((s) => s.globeSettings.globeFps);

  return (
    <AppProviders>
      <AppLayout />
      <DebugPanel globeFps={globeFps} />
    </AppProviders>
  );
}
