import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { EventItem, EventRegistration, PaymentProof, RegistrationDocument, TeamMember } from '../types'

const EVENTS_STORAGE_KEY = 'ep_events_v2'
const REGS_STORAGE_KEY = 'ep_registrations_v2'

function normalizeRegistration(registration: Partial<EventRegistration> & { eventId: string }): EventRegistration {
  return {
    eventId: registration.eventId,
    teamMembers: registration.teamMembers,
    formStatus: registration.formStatus === 'ready' ? 'ready' : 'pending',
    paymentStatus: registration.paymentStatus === 'processing' || registration.paymentStatus === 'paid'
      ? registration.paymentStatus
      : 'unpaid',
    paymentProof: registration.paymentProof ?? null,
    document: registration.document ?? null,
    reviewStatus: registration.reviewStatus ?? 'pending',
  }
}

const DEFAULT_EVENTS: EventItem[] = [
  {
    id: '1',
    eventName: 'AI Hackathon 2026',
    category: 'TECHNICAL',
    description: 'Build innovative AI solutions for real-world problems',
    date: '15 Aug 2026',
    venue: 'IDEA Lab, KSRCT',
    participation: 'Team',
    teamSize: '2 - 4 Members',
    fees: 500,
    feesUnit: 'Team',
    status: 'Open',
    subEvents: [
      {
        id: '1-1',
        eventName: 'AI Hackathon 2026',
        participation: 'Team',
        fees: 500,
        feesUnit: 'Team',
        category: 'TECHNICAL',
      },
    ],
  },
  {
    id: '2',
    eventName: 'Symphony 2026',
    category: 'CULTURAL',
    description: 'A platform to showcase your artistic and cultural talents',
    date: '16 Aug 2026',
    venue: 'Seminar Hall, KSRCT',
    participation: 'Individual',
    fees: 150,
    feesUnit: 'Participant',
    status: 'Open',
  },
  {
    id: '3',
    eventName: 'Football Championship',
    category: 'SPORTS',
    description: 'Inter-department football tournament',
    date: '17 Aug 2026',
    venue: 'Football Ground, KSRCT',
    participation: 'Team',
    teamSize: '7 - 11 Players',
    fees: 800,
    feesUnit: 'Team',
    status: 'Open',
  },
  {
    id: '4',
    eventName: 'Paper Presentation',
    category: 'LITERARY',
    description: 'Present your research and innovative ideas',
    date: '18 Aug 2026',
    venue: 'Conference Hall, KSRCT',
    participation: 'Individual',
    fees: 200,
    feesUnit: 'Participant',
    status: 'Open',
  },
  {
    id: '6',
    eventName: 'Business Quiz',
    category: 'MANAGEMENT',
    description: 'Test your business knowledge and analytics skills',
    date: '20 Aug 2026',
    venue: 'MBA Block, KSRCT',
    participation: 'Team',
    teamSize: '2 - 3 Members',
    fees: 250,
    feesUnit: 'Team',
    status: 'Open',
  },
]

const DAKSHA_EVENT: EventItem = {
  id: '7',
  eventName: 'DAKSHA',
  category: 'MULTI-EVENTS',
  description: 'A multi-events arena with individual and team sub-events',
  date: '21 Aug 2026',
  venue: 'KSRCT',
  participation: 'Team',
  teamSize: 'Varies by sub-event',
  fees: 0,
  feesUnit: 'Participant',
  status: 'Open',
  subEvents: [
    { id: '7-1', eventName: 'Quiz Sprint', participation: 'Individual', fees: 100, feesUnit: 'Participant', category: 'LITERARY' },
    { id: '7-2', eventName: 'Build Battle', participation: 'Team', fees: 400, feesUnit: 'Team', category: 'TECHNICAL' },
    { id: '7-3', eventName: 'Idea Pitch', participation: 'Individual', fees: 150, feesUnit: 'Participant', category: 'MANAGEMENT' },
  ],
}

function normalizeEvent(event: EventItem): EventItem {
  if (event.eventName === 'Code Debugging') {
    return event
  }

  if (event.eventName === 'AI Hackathon 2026') {
    return {
      ...event,
      subEvents: undefined,
    }
  }

  return event
}

interface EventsContextType {
  events: EventItem[]
  registrations: Record<string, EventRegistration>
  addEvent: (event: Omit<EventItem, 'id'>) => Promise<void>
  startRegistration: (eventId: string) => void
  updateTeamMembers: (eventId: string, members: TeamMember[]) => void
  markFormReady: (eventId: string, document?: RegistrationDocument) => void
  markPaymentDone: (eventId: string, paymentProof?: PaymentProof | null) => void
  updateReviewStatus: (eventId: string, reviewStatus: EventRegistration['reviewStatus']) => void
  clearRegistration: (eventId: string) => void
  getRegistration: (eventId: string) => EventRegistration | undefined
  apiUrl: string
  updateApiUrl: (url: string) => void
  isApiOnline: boolean
}

const EventsContext = createContext<EventsContextType | null>(null)

function shouldKeepEvent(event: EventItem) {
  return event.eventName !== 'Code Debugging'
}

function ensureCoreEvents(events: EventItem[]) {
  const next = [...events]
  const hasAI = next.some(event => event.eventName === 'AI Hackathon 2026')
  const hasDaksha = next.some(event => event.category === 'MULTI-EVENTS' && event.eventName === 'DAKSHA')

  if (!hasAI) {
    next.unshift(DEFAULT_EVENTS[0])
  }

  if (!hasDaksha) {
    next.push(DAKSHA_EVENT)
  }

  return next
}

export function EventsProvider({ children }: { children: React.ReactNode }) {
  const [apiUrl, setApiUrlState] = useState(() => {
    try {
      const stored = localStorage.getItem('ep_api_url')
      if (stored) return stored
    } catch { }
    return import.meta.env.VITE_API_URL || 'http://localhost:5000'
  })

  const [isApiOnline, setIsApiOnline] = useState(false)

  const updateApiUrl = useCallback((newUrl: string) => {
    let formatted = newUrl.trim()
    if (formatted) {
      if (!/^https?:\/\//i.test(formatted)) {
        formatted = `http://${formatted}`
      }
      // Ensure it contains port if it is just an IP or localhost without port
      if (!/:\d+$/.test(formatted) && !formatted.includes('localhost') && !formatted.includes('.com') && !formatted.includes('.org')) {
        formatted = `${formatted}:5000`
      }
      formatted = formatted.replace(/\/+$/, '')
    }
    try { localStorage.setItem('ep_api_url', formatted) } catch { }
    setApiUrlState(formatted)
  }, [])

  const [events, setEvents] = useState<EventItem[]>([])

  const [registrations, setRegistrations] = useState<Record<string, EventRegistration>>(() => {
    try {
      const stored = localStorage.getItem(REGS_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, Partial<EventRegistration> & { eventId: string }>
        return Object.fromEntries(
          Object.entries(parsed).map(([eventId, registration]) => [eventId, normalizeRegistration({ eventId, ...registration })]),
        )
      }
    } catch { }
    return {}
  })

  useEffect(() => {
    let active = true
    const fetchEvents = async () => {
      try {
        const response = await fetch(`${apiUrl}/events`)
        if (response.ok) {
          const data = await response.json()
          if (active && Array.isArray(data)) {
            const normalized = data.filter(shouldKeepEvent).map(normalizeEvent)
            setEvents(ensureCoreEvents(normalized))
            setIsApiOnline(true)
          }
        } else {
          if (active) setIsApiOnline(false)
        }
      } catch (err) {
        if (active) setIsApiOnline(false)
      }
    }

    fetchEvents()
    const interval = setInterval(fetchEvents, 5000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [apiUrl])

  useEffect(() => {
    try { localStorage.setItem(REGS_STORAGE_KEY, JSON.stringify(registrations)) } catch { }
  }, [registrations])

  const addEvent = useCallback(async (ev: Omit<EventItem, 'id'>) => {
    try {
      const response = await fetch(`${apiUrl}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ev),
      })
      if (response.ok) {
        const savedEvent = await response.json()
        setEvents(prev => [...prev, savedEvent])
      } else {
        console.error('Failed to post event to backend database')
      }
    } catch (err) {
      console.error('Error connecting to backend:', err)
    }
  }, [apiUrl])

  const startRegistration = useCallback((eventId: string) => {
    setRegistrations(prev => {
      if (prev[eventId]) return prev
      const ev = events.find(e => e.id === eventId)
      return {
        ...prev,
        [eventId]: {
          eventId,
          teamMembers: ev?.participation === 'Team'
            ? [{ id: '1', registeredMailId: '', name: '', organization: '', role: '' }]
            : undefined,
          formStatus: 'pending',
          paymentStatus: 'unpaid',
          reviewStatus: 'pending',
        },
      }
    })
  }, [events])

  const updateTeamMembers = useCallback((eventId: string, members: TeamMember[]) => {
    setRegistrations(prev => ({
      ...prev,
      [eventId]: { ...prev[eventId], teamMembers: members },
    }))
  }, [])

  const markFormReady = useCallback((eventId: string, document?: RegistrationDocument) => {
    setRegistrations(prev => ({
      ...prev,
      [eventId]: { ...prev[eventId], formStatus: 'ready', document: document ?? prev[eventId]?.document ?? null },
    }))
  }, [])

  const markPaymentDone = useCallback((eventId: string, paymentProof: PaymentProof | null = null) => {
    setRegistrations(prev => ({
      ...prev,
      [eventId]: { ...prev[eventId], paymentStatus: 'paid', paymentProof, reviewStatus: 'selected' },
    }))
  }, [])

  const updateReviewStatus = useCallback((eventId: string, reviewStatus: EventRegistration['reviewStatus']) => {
    setRegistrations(prev => ({
      ...prev,
      [eventId]: { ...prev[eventId], reviewStatus },
    }))
  }, [])

  const clearRegistration = useCallback((eventId: string) => {
    setRegistrations(prev => {
      if (!prev[eventId]) return prev
      const next = { ...prev }
      delete next[eventId]
      return next
    })
  }, [])

  const getRegistration = useCallback((eventId: string) => {
    return registrations[eventId]
  }, [registrations])

  return (
    <EventsContext.Provider value={{
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
    }}>
      {children}
    </EventsContext.Provider>
  )
}

export function useEvents() {
  const ctx = useContext(EventsContext)
  if (!ctx) throw new Error('useEvents must be used within EventsProvider')
  return ctx
}
