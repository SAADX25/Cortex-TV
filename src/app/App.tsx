import AppLayout from "./AppLayout";
import AppProviders from "./AppProviders";

export default function App() {
  return (
    <AppProviders>
      <AppLayout />
    </AppProviders>
  );
}
