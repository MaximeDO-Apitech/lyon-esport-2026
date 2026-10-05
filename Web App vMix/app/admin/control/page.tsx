import type { Metadata } from "next";
import { ControlStudio } from "../../../components/admin/control-studio";
import { StingerTestPanel } from "../../../components/admin/stinger-test-panel";
import { ReplayControlPanel } from "../../../components/admin/replay-control-panel";
import { ReplayTestPanel } from "../../../components/admin/replay-test-panel";

export const metadata: Metadata = {
  title: "Pupitre — LES Graphics Studio",
  description: "Préparation, prévisualisation et publication des graphismes Lyon e-Sport 2026.",
};

export default function AdminControlPage() {
  return (
    <>
      <ControlStudio />
      <StingerTestPanel />
      <ReplayControlPanel />
      <ReplayTestPanel />
    </>
  );
}
