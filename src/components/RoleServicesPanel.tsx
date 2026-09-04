import { useState } from "react";
import DigitalServicesCatalog, { type Service } from "./DigitalServicesCatalog";
import ServicePurchaseDialog from "./ServicePurchaseDialog";

export default function RoleServicesPanel({ agentStoreId }: { agentStoreId?: string }) {
  const [service, setService] = useState<Service | null>(null);
  return <>
    <DigitalServicesCatalog agentStoreId={agentStoreId} onBuy={setService} />
    <ServicePurchaseDialog service={service} onOpenChange={(open) => { if (!open) setService(null); }} />
  </>;
}
