import type { Metadata } from "next";
import { WaitingScreen } from "./waiting-screen";

export const metadata: Metadata = {
  title: "Le live commence bientôt — Lyon e-Sport 2026",
  description: "Source navigateur animée 16:9 pour vMix.",
};

export default function Home() {
  return <WaitingScreen />;
}
