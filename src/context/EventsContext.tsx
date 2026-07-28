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
} from "../types";

const API_URL = "http://10.34.43.149:5000/api/events/public";
const REGS_STORAGE_KEY = "ep_registrations_v2";

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
  markFormReady: (eventId: string) => void;
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
}

const EventsContext =
  createContext<EventsContextType | null>(null);

export function EventsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [events, setEvents] = useState<EventItem[]>([]);

  const [registrations, setRegistrations] = useState<
    Record<string, EventRegistration>
  >(() => {
    try {
      const stored = localStorage.getItem(REGS_STORAGE_KEY);

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
        const response = await fetch(API_URL);

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
      } catch (err) {
        console.error(err);
      }
    }

    fetchEvents();
  }, []); useEffect(() => {
    try {
      localStorage.setItem(
        REGS_STORAGE_KEY,
        JSON.stringify(registrations)
      );
    } catch { }
  }, [registrations]);

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

  const markFormReady = useCallback((eventId: string) => {
    setRegistrations((prev) => ({
      ...prev,
      [eventId]: {
        ...prev[eventId],
        formStatus: "ready",
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