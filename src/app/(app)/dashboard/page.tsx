import type { Metadata } from "next";
import { Dashboard } from "@/components/app/Dashboard";
import { Gate } from "@/components/app/Gate";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <Gate next="/dashboard">
      <Dashboard />
    </Gate>
  );
}
