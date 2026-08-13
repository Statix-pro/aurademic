import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

import { useAuth } from './AuthContext';
import { API_BASE_URL } from '../config/api';

import type {
  EventItem,
  EventRegistration,
  PaymentProof,
  TeamMember,
  RegistrationDocument,
} from '../types';

type PublicApiEvent = Record<string, unknown>;

const CATEGORY_MAP: Record<string, string> = {
  hackathon: 'TECHNICAL',
  technical: 'TECHNICAL',
  training: 'MANAGEMENT',
  management: 'MANAGEMENT',
  sports: 'SPORTS',
  cultural: 'CULTURAL',
  literary: 'LITERARY',
};

function formatEventDate(value: unknown) {
  if (!value || typeof value !== 'string') return 'Date to be announced';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
}

function mapPublicEvent(item: PublicApiEvent): EventItem {
  const categoryValue = String(item.category ?? 'technical').toLowerCase();
  const statusValue = String(item.status ?? '').toLowerCase();

  return {
    id: String(item.id),
    eventName: String(item.title ?? item.eventName ?? 'Untitled event'),
    category: CATEGORY_MAP[categoryValue] ?? 'TECHNICAL',
    description: String(item.description ?? ''),
    date: formatEventDate(item.startDate ?? item.date),
    fromDate: formatEventDate(item.startDate ?? item.fromDate ?? item.date),
    toDate: formatEventDate(item.endDate ?? item.toDate ?? item.startDate ?? item.date),
    deadline: item.deadline ? formatEventDate(item.deadline) : undefined,
    venue: String(item.venue ?? item.department ?? 'Venue to be announced'),
    participation: item.participation === 'Team' ? 'Team' : 'Individual',
    teamSize: typeof item.teamSize === 'string' ? item.teamSize : undefined,
    fees: Number(item.fees ?? 0),
    feesUnit: item.feesUnit === 'Team' ? 'Team' : 'Participant',
    // The admin API returns approved public events.  Keep explicit closed
    // statuses closed; approved/published events are open for users.
    status: ['closed', 'cancelled', 'inactive', 'draft'].includes(statusValue) ? 'Closed' : 'Open',
    subEvents: [],
    hasAccommodation: Boolean(item.hasAccommodation),
    hasRegistrationFee: Boolean(item.hasRegistrationFee),
  };
}

export function isAiHackathon(event: EventItem) {
  return event.eventName === 'AI Hackathon 2026';
}

export function getMultiEventStateLabel(event: EventItem, registration?: EventRegistration) {
  if (registration?.reviewStatus === 'selected') return 'Selected';
  if (registration?.reviewStatus === 'rejected') return 'Rejected';
  if (event.eventName === 'Build Battle') return 'Selected';
  if (event.eventName === 'Idea Pitch') return 'Rejected';
  return '';
}

function toRowEvent(
  event: EventItem,
  subEvent: NonNullable<EventItem['subEvents']>[number],
): EventItem {
  return {
    ...event,
    id: `${event.id}-${subEvent.id}`,
    eventName: subEvent.eventName,
    parentEventName: event.eventName,
    category: subEvent.category ?? event.category,
    participation: subEvent.participation,
    fees: subEvent.fees,
    feesUnit: subEvent.feesUnit,
    teamSize: subEvent.participation === 'Team' ? event.teamSize : undefined,
    subEvents: undefined,
  };
}

export function flattenEvents(items: EventItem[]) {
  return items.flatMap((event) =>
    event.category === 'MULTI-EVENTS'
      ? (event.subEvents ?? []).map((subEvent) => toRowEvent(event, subEvent))
      : [event],
  );
}

export function isPayableEvent(
  event: EventItem,
  registration: EventRegistration,
  paymentEventId?: string,
) {
  if (!event.hasRegistrationFee) return false;
  if (registration.paymentStatus === 'paid') return false;
  if (isAiHackathon(event)) return registration.reviewStatus === 'selected';
  if (getMultiEventStateLabel(event, registration) === 'Rejected') return false;
  return registration.formStatus === 'ready' || event.id === paymentEventId;
}

function normalizeRegistration(
  registration: Partial<EventRegistration> & { eventId: string },
): EventRegistration {
  return {
    eventId: registration.eventId,
    teamMembers: registration.teamMembers,
    formStatus: registration.formStatus === 'ready' ? 'ready' : 'pending',
    paymentStatus:
      registration.paymentStatus === 'processing' || registration.paymentStatus === 'paid'
        ? registration.paymentStatus
        : 'unpaid',
    paymentProof: registration.paymentProof ?? null,
    document: registration.document ?? null,
    reviewStatus: registration.reviewStatus ?? 'pending',
  };
}

interface EventsContextType {
  events: EventItem[];
  registrations: Record<string, EventRegistration>;
  addEvent: (event: Omit<EventItem, 'id'>) => void;
  startRegistration: (eventId: string) => void;
  updateTeamMembers: (eventId: string, members: TeamMember[]) => void;
  markFormReady: (eventId: string, document?: RegistrationDocument) => void;
  markPaymentDone: (eventId: string, paymentProof?: PaymentProof | null) => void;
  updateReviewStatus: (eventId: string, reviewStatus: EventRegistration['reviewStatus']) => void;
  clearRegistration: (eventId: string) => void;
  getRegistration: (eventId: string) => EventRegistration | undefined;
  isApiOnline: boolean;
}

const EventsContext = createContext<EventsContextType | null>(null);

export function EventsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const storageKey = user ? `ep_registrations_${user.email}` : 'ep_registrations_guest';

  const [isApiOnline, setIsApiOnline] = useState(true);

  const [events, setEvents] = useState<EventItem[]>([]);

  const [registrations, setRegistrations] = useState<Record<string, EventRegistration>>(() => {
    try {
      const stored = localStorage.getItem(storageKey);

      if (stored) {
        const parsed = JSON.parse(stored) as Record<
          string,
          Partial<EventRegistration> & { eventId: string }
        >;

        return Object.fromEntries(
          Object.entries(parsed).map(([eventId, registration]) => [
            eventId,
            normalizeRegistration(registration),
          ]),
        );
      }
    } catch (err) {
      void err;
    }

    return {};
  });

  useEffect(() => {
    async function fetchEvents() {
      try {
        const response = await fetch(`${API_BASE_URL}/events/public`);

        if (!response.ok) {
          throw new Error('Failed to fetch events');
        }

        const data = await response.json();
        const apiEvents = Array.isArray(data) ? data : data.events;
        if (!Array.isArray(apiEvents)) {
          throw new Error('Public events response does not contain an events array');
        }

        setEvents(apiEvents.map(mapPublicEvent));
        setIsApiOnline(true);
      } catch (err) {
        console.error(err);
        setIsApiOnline(false);
      }
    }

    fetchEvents();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(registrations));
    } catch (err) {
      void err;
    }
  }, [registrations, storageKey]);

  const addEvent = useCallback((ev: Omit<EventItem, 'id'>) => {
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
              ev?.participation === 'Team'
                ? [
                    {
                      id: '1',
                      registeredMailId: '',
                      name: '',
                      organization: '',
                      role: '',
                    },
                  ]
                : undefined,
            formStatus: 'pending',
            paymentStatus: 'unpaid',
            reviewStatus: 'pending',
          },
        };
      });
    },
    [events],
  );

  const updateTeamMembers = useCallback((eventId: string, members: TeamMember[]) => {
    setRegistrations((prev) => ({
      ...prev,
      [eventId]: {
        ...prev[eventId],
        teamMembers: members,
      },
    }));
  }, []);

  const markFormReady = useCallback((eventId: string, document?: RegistrationDocument) => {
    setRegistrations((prev) => ({
      ...prev,
      [eventId]: {
        ...prev[eventId],
        formStatus: 'ready',
        document: document ?? null,
      },
    }));
  }, []);

  const markPaymentDone = useCallback(
    (eventId: string, paymentProof: PaymentProof | null = null) => {
      setRegistrations((prev) => ({
        ...prev,
        [eventId]: {
          ...prev[eventId],
          paymentStatus: 'paid',
          paymentProof,
          reviewStatus: 'selected',
        },
      }));
    },
    [],
  );

  const updateReviewStatus = useCallback(
    (eventId: string, reviewStatus: EventRegistration['reviewStatus']) => {
      setRegistrations((prev) => ({
        ...prev,
        [eventId]: {
          ...prev[eventId],
          reviewStatus,
        },
      }));
    },
    [],
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
    [registrations],
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
    throw new Error('useEvents must be used within EventsProvider');
  }

  return ctx;
}
