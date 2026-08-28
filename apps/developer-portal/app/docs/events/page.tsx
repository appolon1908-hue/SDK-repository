import { loadEventCatalogue } from "../../../lib/contracts";
import { EventCatalogueView } from "./EventCatalogueView";

export default function EventsPage(): JSX.Element {
  const channels = loadEventCatalogue();
  return <EventCatalogueView channels={channels} />;
}
