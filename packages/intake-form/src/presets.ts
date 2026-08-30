import type { FormDefinition } from "./index.js";

const privacy = [{ key: "privacy", required: true, label: "I agree to the privacy notice.", policyVersion: "v1" }] as const;
const contact = [
  { key: "name", label: "Name", type: "text", required: true, maxLength: 120 },
  { key: "email", label: "Email", type: "email", maxLength: 254 },
  { key: "phone", label: "Phone", type: "tel", maxLength: 40 },
] as const;

export const INDUSTRY_FORM_PRESETS: readonly FormDefinition[] = [
  {
    id: "general_contact", version: "1.0.0", industry: "general", formType: "contact", title: "Contact us",
    fields: [...contact, { key: "message", label: "Message", type: "textarea", required: true, maxLength: 4000 }], consents: privacy,
  },
  {
    id: "financial_consultation", version: "1.0.0", industry: "financial_services", formType: "consultation", title: "Request a consultation",
    fields: [...contact, { key: "serviceInterest", label: "Service", type: "select", required: true, options: [{ value: "credit_repair", label: "Credit repair" }, { value: "funding", label: "Funding" }, { value: "financial_guidance", label: "Financial guidance" }] }, { key: "preferredContactTime", label: "Preferred contact time", type: "text", maxLength: 80 }],
    consents: privacy, prohibitedFields: ["ssn", "taxId", "bankAccount", "cardNumber", "password", "creditReport"],
  },
  {
    id: "freight_quote", version: "1.0.0", industry: "transportation_logistics", formType: "freight_quote", title: "Request a freight quote",
    fields: [...contact, { key: "origin", label: "Origin", type: "text", required: true, maxLength: 180 }, { key: "destination", label: "Destination", type: "text", required: true, maxLength: 180 }, { key: "equipmentType", label: "Equipment", type: "text", maxLength: 120 }, { key: "commodity", label: "Commodity", type: "text", maxLength: 180 }, { key: "weight", label: "Weight", type: "number" }, { key: "pickupDate", label: "Pickup date", type: "date" }], consents: privacy,
  },
  {
    id: "home_service_request", version: "1.0.0", industry: "home_services", formType: "service_request", title: "Request service",
    fields: [...contact, { key: "serviceCategory", label: "Service category", type: "text", required: true, maxLength: 120 }, { key: "propertyAddress", label: "Service location", type: "text", required: true, maxLength: 240 }, { key: "urgency", label: "Urgency", type: "select", options: [{ value: "routine", label: "Routine" }, { value: "soon", label: "Soon" }, { value: "urgent", label: "Urgent" }] }, { key: "message", label: "Details", type: "textarea", maxLength: 4000 }], consents: privacy,
  },
  {
    id: "medical_transport_request", version: "1.0.0", industry: "medical_transportation", formType: "transport_request", title: "Request transportation",
    fields: [...contact, { key: "pickupLocation", label: "Pickup location", type: "text", required: true, maxLength: 240 }, { key: "dropoffLocation", label: "Drop-off location", type: "text", required: true, maxLength: 240 }, { key: "rideDate", label: "Ride date", type: "date", required: true }],
    consents: privacy, prohibitedFields: ["diagnosis", "medicalRecord", "insuranceMemberId", "medication", "healthCondition"],
  },
  {
    id: "software_project", version: "1.0.0", industry: "software_services", formType: "project_inquiry", title: "Tell us about your project",
    fields: [...contact, { key: "projectType", label: "Project type", type: "text", required: true, maxLength: 140 }, { key: "budgetRange", label: "Budget range", type: "text", maxLength: 100 }, { key: "timeline", label: "Timeline", type: "text", maxLength: 100 }, { key: "message", label: "Project details", type: "textarea", maxLength: 5000 }], consents: privacy,
  },
  {
    id: "real_estate_inquiry", version: "1.0.0", industry: "real_estate", formType: "property_inquiry", title: "Property inquiry",
    fields: [...contact, { key: "intent", label: "I want to", type: "select", required: true, options: [{ value: "buy", label: "Buy" }, { value: "sell", label: "Sell" }, { value: "rent", label: "Rent" }] }, { key: "location", label: "Preferred location", type: "text", maxLength: 180 }, { key: "budgetRange", label: "Budget range", type: "text", maxLength: 100 }, { key: "timeline", label: "Timeline", type: "text", maxLength: 100 }], consents: privacy,
  },
  {
    id: "insurance_consultation", version: "1.0.0", industry: "insurance", formType: "consultation", title: "Insurance consultation",
    fields: [...contact, { key: "productInterest", label: "Insurance interest", type: "text", required: true, maxLength: 140 }, { key: "preferredContactTime", label: "Preferred contact time", type: "text", maxLength: 80 }],
    consents: privacy, prohibitedFields: ["medicalHistory", "ssn", "bankAccount", "policyPassword"],
  },
  {
    id: "education_program_interest", version: "1.0.0", industry: "education", formType: "program_interest", title: "Program information request",
    fields: [...contact, { key: "programInterest", label: "Program", type: "text", required: true, maxLength: 160 }, { key: "educationLevel", label: "Education level", type: "text", maxLength: 120 }, { key: "preferredStart", label: "Preferred start", type: "text", maxLength: 100 }, { key: "studyMode", label: "Study mode", type: "select", options: [{ value: "online", label: "Online" }, { value: "campus", label: "Campus" }, { value: "hybrid", label: "Hybrid" }] }], consents: privacy,
  },
  {
    id: "nonprofit_engagement", version: "1.0.0", industry: "nonprofit", formType: "engagement", title: "Get involved",
    fields: [...contact, { key: "engagementType", label: "How would you like to engage?", type: "select", required: true, options: [{ value: "volunteer", label: "Volunteer" }, { value: "donor_inquiry", label: "Donor inquiry" }, { value: "assistance", label: "Assistance inquiry" }, { value: "partnership", label: "Partnership" }] }, { key: "message", label: "Message", type: "textarea", maxLength: 4000 }], consents: privacy,
  },
  {
    id: "campaign_callback", version: "1.0.0", industry: "contact_center", formType: "callback", title: "Request a callback",
    fields: [...contact, { key: "language", label: "Language", type: "text", maxLength: 60 }, { key: "preferredCallbackTime", label: "Preferred callback time", type: "text", maxLength: 80 }, { key: "reason", label: "Reason", type: "textarea", maxLength: 2000 }], consents: privacy,
  },
];
