import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

import { useAuth } from './AuthContext';
import { apiFetch, API_BASE_URL } from '../config/api';

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
  documentEnabled: boolean;
  participation: 'Individual' | 'Team';
  minTeamSize: number | null;
  maxTeamSize: number | null;
  hasRegistrationFee: boolean;
  feeRange: { min: number; max: number };
  hasAccommodation: boolean;
  accommodationFee: number;
  registrationClosesAt: string | null;
  registrationOpen: boolean;
  status: 'Open' | 'Closed' | 'Upcoming';
  shortlistingRequired?: boolean;
  selectionIntimation?: string | null;
  feedbackEnabled?: boolean;
  certificateEnabled?: boolean;
  coordinators?: {
    name: string;
    designation: string;
    mobile: string;
    department: string;
    email: string;
  }[];
  documentName?: string;
  documentType?: string;
  documentSize?: string;
  documentTextFieldEnabled?: boolean;
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
    startDate: item.startDate,
    endDate: item.endDate,
    end_date: item.endDate,
    lastDate: item.registrationClosesAt,
    last_date: item.registrationClosesAt,
    registrationClosesAt: item.registrationClosesAt,
    venue: item.venue ?? 'Venue to be announced',
    participation: item.participation === 'Team' ? 'Team' : 'Individual',
    teamSize: formatTeamSize(item),
    // Fees vary by participant type, so the list exposes a range. Show the
    // lowest applicable fee until the participant's type is known.
    fees: item.feeRange?.min ?? 0,
    feeRange: item.feeRange,
    feesUnit: item.participation === 'Team' ? 'Team' : 'Participant',
    status: item.status,
    subEvents: (item.subEvents ?? []).map((sub) => ({
      id: String(sub.id),
      eventName: sub.title,
      participation: sub.participation === 'Team' ? 'Team' : 'Individual',
      fees: sub.feeRange?.min ?? 0,
      feesUnit: sub.participation === 'Team' ? 'Team' : 'Participant',
      category: resolveCategory(sub),
      documentEnabled: Boolean(sub.documentEnabled),
      documentName: sub.documentName,
      documentType: sub.documentType,
      documentSize: sub.documentSize,
      documentTextFieldEnabled: Boolean(sub.documentTextFieldEnabled),
    })),
    hasAccommodation: Boolean(item.hasAccommodation),
    hasRegistrationFee: Boolean(item.hasRegistrationFee),
    documentEnabled: Boolean(item.documentEnabled),
    shortlistingRequired: Boolean(item.shortlistingRequired),
    selectionIntimation: item.selectionIntimation || null,
    feedbackEnabled: Boolean(item.feedbackEnabled),
    certificateEnabled: Boolean(item.certificateEnabled),
    documentName: item.documentName,
    documentType: item.documentType,
    documentSize: item.documentSize,
    documentTextFieldEnabled: Boolean(item.documentTextFieldEnabled),
    coordinators: item.coordinators,
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

/**
 * Flattens a multi-event's child into a standalone row.
 *
 * The composite `${event.id}-${subEvent.id}` id is what keys every registration
 * lookup for sub-events, so this must stay the single definition. A second copy
 * that drifts would make `registrations[event.id]` miss silently, and payable
 * rows would vanish from the payment summary with no error.
 */
export function toRowEvent(
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
  if (!event.hasRegistrationFee || Number(event.fees || 0) === 0) return false;
  if (registration.paymentStatus === 'paid') return false;
  if (
    registration.reviewStatus === 'rejected' ||
    registration.reviewStatus === 'Not Selected' ||
    registration.reviewStatus === 'Rejected'
  ) {
    return false;
  }

  const isShortlistingRequired = Boolean(
    event.shortlistingRequired || registration.shortlistingRequired,
  );

  if (isShortlistingRequired) {
    return registration.reviewStatus === 'selected' || registration.reviewStatus === 'Selected';
  }

  if (registration.reviewStatus === 'selected' || registration.reviewStatus === 'Selected') {
    return true;
  }
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
    shortlistingRequired: registration.shortlistingRequired,
    selectionIntimation: registration.selectionIntimation,
    backendId: registration.backendId,
    hasFeedback: registration.hasFeedback,
    adminFeedback: registration.adminFeedback,
  };
}

interface EventsContextType {
  events: EventItem[];
  registrations: Record<string, EventRegistration>;
  addEvent: (event: Omit<EventItem, 'id'>) => void;
  startRegistration: (eventId: string) => Promise<number | undefined>;
  updateTeamMembers: (eventId: string, members: TeamMember[]) => Promise<void>;
  markFormReady: (eventId: string, documentType?: string, file?: File | null) => Promise<void>;
  markPaymentDone: (eventId: string, paymentProof?: PaymentProof | null) => void;
  submitFeedback: (eventId: string, answers: { questionId: number; value: any }[]) => Promise<void>;
  updateReviewStatus: (eventId: string, reviewStatus: EventRegistration['reviewStatus']) => void;
  clearRegistration: (eventId: string) => void;
  getRegistration: (eventId: string) => EventRegistration | undefined;
  isApiOnline: boolean;
  isLoading: boolean;
}

const EventsContext = createContext<EventsContextType | null>(null);

export function EventsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const storageKey = user ? `ep_registrations_${user.email}` : 'ep_registrations_guest';

  const [isApiOnline, setIsApiOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

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
    async function loadInitialData() {
      if (!user) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const [eventsData, regsData] = await Promise.all([
          apiFetch<{ events: PublicApiEvent[] }>('/events/public'),
          apiFetch<{ registrations: any[] }>('/participant/registrations').catch(() => ({
            registrations: [],
          })),
        ]);

        const formattedEvents = (eventsData.events ?? []).map(mapPublicEvent);
        setEvents(formattedEvents);

        const loadedRegs: Record<string, EventRegistration> = {};
        const flatEvents = flattenEvents(formattedEvents);

        for (const r of regsData.registrations ?? []) {
          // Find matching event from flat list to restore composite ID if necessary
          const matchedEvent = flatEvents.find((e) => {
            const actualId = String(e.id).includes('-')
              ? String(e.id).split('-').pop()
              : String(e.id);
            return actualId === String(r.eventId);
          });

          const compositeKey = matchedEvent ? String(matchedEvent.id) : String(r.eventId);

          loadedRegs[compositeKey] = {
            eventId: compositeKey,
            teamMembers: r.teamMembers?.map((m: any) => ({
              id: String(m.id),
              registeredMailId: m.email,
              name: m.name,
              organization: m.organization || '',
              role: m.role || '',
            })),
            formStatus: 'ready',
            paymentStatus:
              r.hasVerifiedPayment ||
              r.registrationStatus === 'Registered' ||
              r.registration_status === 'Registered'
                ? 'paid'
                : r.hasSubmittedPayment
                  ? 'processing'
                  : 'unpaid',
            reviewStatus: r.reviewStatus || 'pending',
            shortlistingRequired: Boolean(r.shortlistingRequired),
            selectionIntimation: r.selectionIntimation || null,
            updatedAt: r.updatedAt || r.updated_at || r.created_at,
            backendId: r.id,
            paymentProof: r.paymentProofPath
              ? {
                  billType: r.paymentProofPath.includes('Accommodation')
                    ? 'accommodation bill'
                    : 'event registration bill',
                  screenshotName: r.paymentProofPath.split('/').pop() || 'screenshot',
                  screenshotDataUrl: API_BASE_URL.replace(/\/api\/?$/, '') + r.paymentProofPath,
                  uploadedAt: r.paymentProofUploadedAt || r.created_at,
                }
              : null,
            document: r.documentPath
              ? {
                  documentType: r.documentTypeName || 'Document',
                  fileName: r.documentPath.split('/').pop() || 'document',
                  uploadedAt: r.documentUploadedAt || r.created_at,
                }
              : null,
            hasFeedback: Boolean(r.hasFeedback),
            certificateRefNo: r.certificateRefNo || null,
            attendance: r.attendance,
          };
        }
        setRegistrations(loadedRegs);
        setIsApiOnline(true);
      } catch (err) {
        console.error(err);
        setIsApiOnline(false);
      } finally {
        setIsLoading(false);
      }
    }

    loadInitialData();
  }, [user]);

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
    async (eventId: string) => {
      let actualEventId = String(eventId);
      if (actualEventId.includes('-')) {
        actualEventId = actualEventId.split('-').pop() || actualEventId;
      }
      let backendId: number | undefined;
      try {
        const result = await apiFetch<{ registrationId: number }>('/participant/registrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId: actualEventId }),
        });
        backendId = result.registrationId;
      } catch (err: any) {
        // 409 = already registered — fetch the existing registration and reuse it
        if (err?.status === 409) {
          try {
            const existing = await apiFetch<{ registrations: any[] }>('/participant/registrations');
            const match = existing.registrations?.find(
              (r: any) => String(r.eventId) === String(actualEventId),
            );
            if (match?.id) {
              backendId = match.id;
            }
            // else proceed without backendId — team/doc endpoints will fetch it themselves
          } catch {
            // If we can't fetch existing, just proceed without a backendId
          }
        } else {
          console.error('Failed to create registration', err);
          throw err;
        }
      }

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
            backendId,
          } as EventRegistration,
        };
      });
      return backendId;
    },
    [events],
  );

  const updateTeamMembers = useCallback(
    async (eventId: string, members: TeamMember[]) => {
      try {
        const reg = registrations[eventId];
        let backendRegId = reg?.backendId;

        let actualEventId = String(eventId);
        if (actualEventId.includes('-')) {
          actualEventId = actualEventId.split('-').pop() || actualEventId;
        }

        if (!backendRegId) {
          const result = await apiFetch<{ registrations: any[] }>('/participant/registrations');
          const backendReg = result.registrations.find(
            (r) => String(r.eventId) === String(actualEventId),
          );
          if (backendReg) {
            backendRegId = backendReg.id;
          }
        }

        if (backendRegId) {
          await apiFetch(`/participant/registrations/${backendRegId}/team`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              members: members.map((m) => ({
                email: m.registeredMailId,
                name: m.name,
                organization: m.organization,
                role: m.role,
              })),
            }),
          });
        }
      } catch (err) {
        console.error('Failed to save team members', err);
        throw err;
      }

      setRegistrations((prev) => ({
        ...prev,
        [eventId]: {
          ...prev[eventId],
          teamMembers: members,
        },
      }));
    },
    [registrations],
  );

  const markFormReady = useCallback(
    async (eventId: string, documentType?: string, file?: File | null) => {
      const reg = registrations[eventId];

      if (reg && reg.backendId && file && documentType) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('documentType', documentType);
          await apiFetch(`/participant/registrations/${reg.backendId}/documents`, {
            method: 'POST',
            body: formData,
          });
        } catch (err) {
          console.error('Failed to upload document', err);
          throw err;
        }
      }

      setRegistrations((prev) => ({
        ...prev,
        [eventId]: {
          ...prev[eventId],
          formStatus: 'ready',
          document:
            file && documentType
              ? {
                  documentType,
                  fileName: file.name,
                  uploadedAt: new Date().toISOString(),
                }
              : prev[eventId]?.document || null,
        },
      }));
    },
    [registrations],
  );

  const markPaymentDone = useCallback(
    (eventId: string, paymentProof: PaymentProof | null = null) => {
      setRegistrations((prev) => ({
        ...prev,
        [eventId]: {
          ...prev[eventId],
          paymentStatus: 'paid', // Instantly mark as paid so 'Registered' shows on all pages
          paymentProof,
        },
      }));
    },
    [],
  );

  const submitFeedback = useCallback(
    async (eventId: string, answers: { questionId: number; value: any }[]) => {
      const reg = registrations[eventId];
      if (!reg || !reg.backendId) throw new Error('No registration found');

      await apiFetch(`/participant/registrations/${reg.backendId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });

      setRegistrations((prev) => ({
        ...prev,
        [eventId]: {
          ...prev[eventId],
          hasFeedback: true,
        },
      }));
    },
    [registrations],
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
        submitFeedback,
        updateReviewStatus,
        clearRegistration,
        getRegistration,
        isApiOnline,
        isLoading,
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
