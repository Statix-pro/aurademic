import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import type {
  EventItem,
  EventRegistration,
  PaymentProof,
  TeamMember,
  RegistrationDocument,
} from "../types";
import { useAuth } from "../hooks/useAuth";

const REGS_STORAGE_KEY = "ep_registrations_v2";

const SAMPLE_EVENTS: EventItem[] = [
  {
    id: "sample-1",
    eventName: "National Web Dev Hackathon",
    category: "TECHNICAL",
    description: "Build modern web applications with cutting edge tech.",
    date: "15/08/2026",
    venue: "Lab 3, CSE Block",
    participation: "Team",
    teamSize: "2-4",
    fees: 150,
    feesUnit: "Team",
    status: "Open",
    subEvents: []
  },
  {
    id: "sample-2",
    eventName: "Solo Classical Dance Competition",
    category: "CULTURAL",
    description: "Showcase your classical dancing talents.",
    date: "18/08/2026",
    venue: "Main Auditorium",
    participation: "Individual",
    fees: 50,
    feesUnit: "Participant",
    status: "Closed",
    subEvents: []
  },
  {
    id: "sample-3",
    eventName: "Campus Football Championship",
    category: "SPORTS",
    description: "Inter-departmental football tournament.",
    date: "20/08/2026",
    venue: "College Ground",
    participation: "Team",
    teamSize: "11",
    fees: 500,
    feesUnit: "Team",
    status: "Open",
    subEvents: []
  }
];

function normalizeRegistration(
  registration: Partial<EventRegistration> & { eventId: string }
): EventRegistration {
  return {
    eventId: registration.eventId,
    teamMembers: registration.teamMembers,
    formStatus:
      registration.formStatus === "ready" ? "ready" : "pending",
    paymentStatus:
      registration.paymentStatus === "processing" ||
        registration.paymentStatus === "paid"
        ? registration.paymentStatus
        : "unpaid",
    paymentProof: registration.paymentProof ?? null,
    document: registration.document ?? null,
    reviewStatus: registration.reviewStatus ?? "pending",
  };
}

interface EventsContextType {
  events: EventItem[];
  registrations: Record<string, EventRegistration>;
  addEvent: (event: Omit<EventItem, "id">) => void;
  startRegistration: (eventId: string) => void;
  updateTeamMembers: (
    eventId: string,
    members: TeamMember[]
  ) => void;
  markFormReady: (eventId: string, document?: RegistrationDocument) => void;
  markPaymentDone: (
    eventId: string,
    paymentProof?: PaymentProof | null
  ) => void;
  updateReviewStatus: (
    eventId: string,
    reviewStatus: EventRegistration["reviewStatus"]
  ) => void;
  clearRegistration: (eventId: string) => void;
  getRegistration: (
    eventId: string
  ) => EventRegistration | undefined;
  apiUrl: string;
  updateApiUrl: (url: string) => void;
  isApiOnline: boolean;
}

const EventsContext =
  createContext<EventsContextType | null>(null);

export function EventsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const storageKey = user ? `ep_registrations_${user.email}` : "ep_registrations_guest";

  const [apiUrl, setApiUrl] = useState(() => {
    const stored = localStorage.getItem("ep_api_url");
    if (stored) {
      try {
        new URL(stored);
        return stored;
      } catch {
        localStorage.removeItem("ep_api_url");
      }
    }
    return import.meta.env.VITE_API_URL || "http://localhost:5000";
  });
  const [isApiOnline, setIsApiOnline] = useState(true);

  const updateApiUrl = useCallback((newUrl: string) => {
    let formattedUrl = newUrl.trim();
    if (formattedUrl && !/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `http://${formattedUrl}`;
    }
    setApiUrl(formattedUrl);
    localStorage.setItem("ep_api_url", formattedUrl);
  }, []);

  const [events, setEvents] = useState<EventItem[]>(SAMPLE_EVENTS);

  const [registrations, setRegistrations] = useState<
    Record<string, EventRegistration>
  >(() => {
    try {
      const stored = localStorage.getItem(storageKey);

      if (stored) {
        const parsed = JSON.parse(stored) as Record<
          string,
          Partial<EventRegistration> & { eventId: string }
        >;

        return Object.fromEntries(
          Object.entries(parsed).map(
            ([eventId, registration]) => [
              eventId,
              normalizeRegistration(registration)
            ]
          )
        );
      }
    } catch { }

    return {};
  });

  useEffect(() => {
    async function fetchEvents() {
      try {
        const response = await fetch(`${apiUrl}/api/events/public`);

        if (!response.ok) {
          throw new Error("Failed to fetch events");
        }

        const data = await response.json();

        const formattedEvents: EventItem[] = data.map((item: any) => ({
          id: String(item.id),
          eventName: item.title,

          // Backend category -> Frontend category
          category:
            item.category === "Hackathon"
              ? "TECHNICAL"
              : item.category === "Training"
                ? "MANAGEMENT"
                : item.category === "Sports"
                  ? "SPORTS"
                  : item.category === "Cultural"
                    ? "CULTURAL"
                    : item.category === "Literary"
                      ? "LITERARY"
                      : "TECHNICAL",

          description: item.description ?? "",
          date: new Date(item.date).toLocaleDateString("en-GB"),
          venue: item.department ?? "",

          participation: "Individual",
          fees: 0,
          feesUnit: "Participant",

          // Published -> Open
          status: item.status === "Published" ? "Open" : "Closed",

          subEvents: [],
        }));

        setEvents(formattedEvents);
        setIsApiOnline(true);
      } catch (err) {
        console.error(err);
        setIsApiOnline(false);
      }
    }

    fetchEvents();
  }, [apiUrl]); useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify(registrations)
      );
    } catch { }
  }, [registrations, storageKey]);

  const addEvent = useCallback((ev: Omit<EventItem, "id">) => {
    const id = Date.now().toString();

    setEvents((prev) => [
      ...prev,
      {
        ...ev,
        id,
      },
    ]);
  }, []);

  const startRegistration = useCallback(
    (eventId: string) => {
      setRegistrations((prev) => {
        if (prev[eventId]) return prev;

        const ev = events.find((e) => e.id === eventId);

        return {
          ...prev,
          [eventId]: {
            eventId,
            teamMembers:
              ev?.participation === "Team"
                ? [
                  {
                    id: "1",
                    registeredMailId: "",
                    name: "",
                    organization: "",
                    role: "",
                  },
                ]
                : undefined,
            formStatus: "pending",
            paymentStatus: "unpaid",
            reviewStatus: "pending",
          },
        };
      });
    },
    [events]
  );

  const updateTeamMembers = useCallback(
    (eventId: string, members: TeamMember[]) => {
      setRegistrations((prev) => ({
        ...prev,
        [eventId]: {
          ...prev[eventId],
          teamMembers: members,
        },
      }));
    },
    []
  );

  const markFormReady = useCallback((eventId: string, document?: RegistrationDocument) => {
    setRegistrations((prev) => ({
      ...prev,
      [eventId]: {
        ...prev[eventId],
        formStatus: "ready",
        document: document ?? null,
      },
    }));
  }, []);

  const markPaymentDone = useCallback(
    (
      eventId: string,
      paymentProof: PaymentProof | null = null
    ) => {
      setRegistrations((prev) => ({
        ...prev,
        [eventId]: {
          ...prev[eventId],
          paymentStatus: "paid",
          paymentProof,
          reviewStatus: "selected",
        },
      }));
    },
    []
  );

  const updateReviewStatus = useCallback(
    (
      eventId: string,
      reviewStatus: EventRegistration["reviewStatus"]
    ) => {
      setRegistrations((prev) => ({
        ...prev,
        [eventId]: {
          ...prev[eventId],
          reviewStatus,
        },
      }));
    },
    []
  );

  const clearRegistration = useCallback((eventId: string) => {
    setRegistrations((prev) => {
      if (!prev[eventId]) return prev;

      const next = { ...prev };

      delete next[eventId];

      return next;
    });
  }, []);

  const getRegistration = useCallback(
    (eventId: string) => {
      return registrations[eventId];
    },
    [registrations]
  );
  return (
    <EventsContext.Provider
      value={{
        events,
        registrations,
        addEvent,
        startRegistration,
        updateTeamMembers,
        markFormReady,
        markPaymentDone,
        updateReviewStatus,
        clearRegistration,
        getRegistration,
        apiUrl,
        updateApiUrl,
        isApiOnline,
      }}
    >
      {children}
    </EventsContext.Provider>
  );
}

export function useEvents() {
  const ctx = useContext(EventsContext);

  if (!ctx) {
    throw new Error(
      "useEvents must be used within EventsProvider"
    );
  }

  return ctx;
}