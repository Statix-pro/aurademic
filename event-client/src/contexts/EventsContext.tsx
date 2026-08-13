import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

import { useAuth } from './AuthContext';
import { apiFetch } from '../config/api';

import type {
  EventItem,
  EventRegistration,
  PaymentProof,
  TeamMember,
  RegistrationDocument,
} from '../types';

/** Shape returned by GET /api/events/public. */
interface PublicApiEvent {
  id: string;
  title: string;
  description: string;
  category: string | null;
  categoryCode: string | null;
  eventType: string | null;
  startDate: string | null;
  endDate: string | null;
  venue: string | null;
  isMultiEvent: boolean;
  participation: 'Individual' | 'Team';
  minTeamSize: number | null;
  maxTeamSize: number | null;
  hasRegistrationFee: boolean;
  feeRange: { min: number; max: number };
  hasAccommodation: boolean;
  accommodationFee: number;
  registrationClosesAt: string | null;
  registrationOpen: boolean;
  status: 'Open' | 'Closed';
  subEvents?: PublicApiEvent[];
}

// The admin side stores categories as m_category rows (Academic,
// Co-Curricular, Extra-Curricular) plus a free-text event type. Map both onto
// the card colours defined in EventCard, falling back to TECHNICAL.
const CATEGORY_MAP: Record<string, string> = {
  academic: 'TECHNICAL',
  acad: 'TECHNICAL',
  hackathon: 'TECHNICAL',
  technical: 'TECHNICAL',
  workshop: 'MANAGEMENT',
  training: 'MANAGEMENT',
  management: 'MANAGEMENT',
  'co-curricular': 'MANAGEMENT',
  cocurr: 'MANAGEMENT',
  sports: 'SPORTS',
  'extra-curricular': 'SPORTS',
  extracurr: 'SPORTS',
  cultural: 'CULTURAL',
  literary: 'LITERARY',
};

function resolveCategory(item: PublicApiEvent) {
  if (item.isMultiEvent) return 'MULTI-EVENTS';

  const candidates = [item.categoryCode, item.category, item.eventType]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());

  for (const candidate of candidates) {
    if (CATEGORY_MAP[candidate]) return CATEGORY_MAP[candidate];
  }

  return 'TECHNICAL';
}

function formatEventDate(value: string | null | undefined) {
  if (!value) return 'Date to be announced';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
}

function formatTeamSize(item: PublicApiEvent) {
  if (item.participation !== 'Team') return undefined;
  const { minTeamSize: min, maxTeamSize: max } = item;
  if (min && max) return `${min} \u2013 ${max} Members`;
  if (max) return `Up to ${max} Members`;
  if (min) return `${min}+ Members`;
  return undefined;
}

function mapPublicEvent(item: PublicApiEvent): EventItem {
  return {
    id: String(item.id),
    eventName: item.title || 'Untitled event',
    category: resolveCategory(item),
    description: item.description ?? '',
    date: formatEventDate(item.startDate),
    fromDate: formatEventDate(item.startDate),
    toDate: formatEventDate(item.endDate ?? item.startDate),
    deadline: item.registrationClosesAt ? formatEventDate(item.registrationClosesAt) : undefined,
    venue: item.venue ?? 'Venue to be announced',
    participation: item.participation === 'Team' ? 'Team' : 'Individual',
    teamSize: formatTeamSize(item),
    // Fees vary by participant type, so the list exposes a range. Show the
    // lowest applicable fee until the participant's type is known.
    fees: item.feeRange?.min ?? 0,
    feeRange: item.feeRange,
    feesUnit: item.participation === 'Team' ? 'Team' : 'Participant',
    status: item.registrationOpen ? 'Open' : 'Closed',
    subEvents: (item.subEvents ?? []).map((sub) => ({
      id: String(sub.id),
      eventName: sub.title,
      participation: sub.participation === 'Team' ? 'Team' : 'Individual',
      fees: sub.feeRange?.min ?? 0,
      feesUnit: sub.participation === 'Team' ? 'Team' : 'Participant',
      category: resolveCategory(sub),
    })),
    hasAccommodation: Boolean(item.hasAccommodation),
    hasRegistrationFee: Boolean(item.hasRegistrationFee),
  };
}

/**
 * The shortlist badge for a registration, or '' while none has been decided.
 *
 * Events used to be matched by title ('AI Hackathon 2026', 'Build Battle',
 * 'Idea Pitch') to decide who saw this badge. That was demo data reaching a live
 * code path: with events now served by the API, any real event sharing one of
 * those titles would show a fabricated Selected/Rejected state and have its pay
 * button locked. The decision belongs to the registration, and only exists once
 * the backend fills `event_registrations.review_status` — until then every
 * registration reads as 'pending' and no badge is shown.
 */
export function getReviewStateLabel(registration?: EventRegistration) {
  if (registration?.reviewStatus === 'selected') return 'Selected';
  if (registration?.reviewStatus === 'rejected') return 'Rejected';
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
  // A rejected registration is never payable. A selected one is payable straight
  // away — being shortlisted is what the participant was waiting on.
  if (registration.reviewStatus === 'rejected') return false;
  if (registration.reviewStatus === 'selected') return true;
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
        const data = await apiFetch<{ events: PublicApiEvent[] }>('/events/public');

        setEvents((data.events ?? []).map(mapPublicEvent));
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
          // reviewStatus is deliberately untouched: paying is not being
          // shortlisted, and only staff can make that call.
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
