import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useProfile } from '../context/ProfileContext'
import { useEvents } from '../context/EventsContext'
import { User, ClipboardList, Star, Award, ChevronRight } from 'lucide-react'
import EventCard from '../components/events/EventCard'
import type { EventItem } from '../types'

export default function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { profileCompletion } = useProfile()
  const { events, registrations } = useEvents()

  const filteredEvents = useMemo(() => events, [events])

  const handleViewDetails = (event: EventItem) => {
    navigate('/event-register', { state: { event } })
  }

  // Calculate registrations completion percentage dynamically
  const regProgress = useMemo(() => {
    const startedRegs = Object.values(registrations)
    if (startedRegs.length === 0) return 0
    const sum = startedRegs.reduce((acc, r) => {
      let val = 0
      if (r.formStatus === 'ready') val += 50
      if (r.paymentStatus === 'paid') val += 50
      else if (r.paymentStatus === 'processing') val += 25
      return acc + val
    }, 0)
    return Math.round(sum / startedRegs.length)
  }, [registrations])

  // Calculate feedback completion percentage dynamically
  const feedbackProgress = useMemo(() => {
    const registeredCount = events.filter(e => registrations[e.id] && registrations[e.id].formStatus === 'ready').length
    if (registeredCount === 0) return 0
    try {
      const stored = localStorage.getItem('ep_feedbacks')
      const fbs = stored ? JSON.parse(stored) : []
      return Math.min(100, Math.round((fbs.length / registeredCount) * 100))
    } catch {
      return 0
    }
  }, [events, registrations])

  // Calculate certificate completion percentage dynamically
  const certProgress = useMemo(() => {
    const registeredCount = events.filter(e => registrations[e.id] && registrations[e.id].formStatus === 'ready').length
    if (registeredCount === 0) return 0
    const paidCount = events.filter(e => registrations[e.id] && registrations[e.id].paymentStatus === 'paid').length
    return Math.round((paidCount / registeredCount) * 100)
  }, [events, registrations])

  const boxes = [
    {
      title: 'My Profile',
      description: 'View & update your personal details',
      icon: User,
      color: 'bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400',
      progressColor: 'bg-purple-600',
      borderColor: 'hover:border-purple-300',
      percentage: profileCompletion,
      path: '/profile',
    },
    {
      title: 'My Registrations',
      description: 'View your event registrations',
      icon: ClipboardList,
      color: 'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
      progressColor: 'bg-blue-600',
      borderColor: 'hover:border-blue-300',
      percentage: regProgress,
      path: '/registrations',
    },
    {
      title: 'Feedback',
      description: 'Share your valuable feedback',
      icon: Star,
      color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
      progressColor: 'bg-emerald-600',
      borderColor: 'hover:border-emerald-300',
      percentage: feedbackProgress,
      path: '/feedback',
    },
    {
      title: 'Certificates',
      description: 'Download your event certificates',
      icon: Award,
      color: 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
      progressColor: 'bg-amber-500',
      borderColor: 'hover:border-amber-300',
      percentage: certProgress,
      path: '/certificates',
    },
  ]

  return (
    <div className="min-h-[calc(100vh-48px)] bg-[#eaf2fb] dark:bg-slate-900/80 px-4 py-8 sm:px-6 md:py-10">
      <div className="mx-auto w-full max-w-[1200px] space-y-8">
        {/* Welcome Header */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            Hello, {user?.name || 'User'}! <span className="animate-bounce">🖐️</span>
          </h1>
        </div>

        {/* 4 Boxes Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {boxes.map((box, idx) => {
            const Icon = box.icon
            return (
              <button
                key={idx}
                onClick={() => navigate(box.path)}
                className={`group relative flex flex-col justify-between overflow-hidden rounded-[20px] border border-slate-200/80 bg-white p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${box.borderColor} dark:border-slate-800 dark:bg-slate-800`}
              >
                {/* Main Content Row */}
                <div className="flex items-center gap-3 w-full">
                  {/* Left Circle Icon */}
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${box.color} shadow-sm transition-transform duration-300 group-hover:scale-105`}>
                    <Icon className="h-5.5 w-5.5" />
                  </div>

                  {/* Text Details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                      {box.title}
                    </h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                      {box.description}
                    </p>
                  </div>

                  {/* Arrow Icon */}
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5" />
                </div>

                {/* Progress bar inside the box */}
                <div className="mt-3.5 w-full">
                  <div className="flex items-center justify-between text-[10px] font-bold mb-1 text-slate-500 dark:text-slate-400">
                    <span className="uppercase tracking-wider text-[9px] text-slate-400">Progress</span>
                    <span>{box.percentage}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700/60 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${box.progressColor} transition-all duration-500`}
                      style={{ width: `${box.percentage}%` }}
                    />
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Upcoming Events Section */}
        <div className="pt-2">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-400">Upcoming Events</h2>
          </div>

          <section className="rounded-[22px] bg-white p-6 text-slate-800 shadow-sm border border-slate-300 dark:bg-slate-800 dark:border-slate-700">
            {filteredEvents.length === 0 ? (
              <div className="text-center p-12">
                <p className="text-slate-500">No events match your search.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-x-12 gap-y-6 md:grid-cols-2">
                {filteredEvents.map(event => (
                  <EventCard key={event.id} event={event} onViewDetails={handleViewDetails} compact={true} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
