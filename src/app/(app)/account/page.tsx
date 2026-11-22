import type { Metadata } from "next";
import { Account } from "@/components/app/Account";
import { Gate } from "@/components/app/Gate";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <Gate next="/account">
      <Account />
    </Gate>
  );
}
