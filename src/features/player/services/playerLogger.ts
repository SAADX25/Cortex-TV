export function createPlayerLogLine(message: string): string {
  const timestamp = new Date().toLocaleTimeString("en-GB", { hour12: false });
  return `[${timestamp}] ${message}`;
}

export function logPlayerDebug(message: string): void {
  console.log(`[Player-Debug] ${message}`);
}
