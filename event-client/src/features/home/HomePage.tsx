import { User, ClipboardList, Star, Award, ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { flattenEvents, useEvents } from '../../contexts/EventsContext';
import { useProfile } from '../../contexts/ProfileContext';
import { STORES, readScoped } from '../../shared/storage';
import EventCard from '../events/EventCard';

import type { EventItem } from '../../types';
import './HomePage.css';

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profileCompletion } = useProfile();
  const { events, registrations } = useEvents();

  const filteredEvents = useMemo(
    () => events.filter((event) => event.status !== 'Closed'),
    [events],
  );

  const handleViewDetails = (event: EventItem) => {
    navigate('/event-register', { state: { event } });
  };

  // Calculate registrations completion percentage dynamically
  const regProgress = useMemo(() => {
    const startedRegs = Object.values(registrations);
    if (startedRegs.length === 0) return 0;
    const sum = startedRegs.reduce((acc, r) => {
      let val = 0;
      if (r.formStatus === 'ready') val += 50;
      if (r.paymentStatus === 'paid') val += 50;
      else if (r.paymentStatus === 'processing') val += 25;
      return acc + val;
    }, 0);
    return Math.round(sum / startedRegs.length);
  }, [registrations]);

  // Registrations for a multi-event's children are keyed by the composite row id
  // (`${event.id}-${subEvent.id}`), which never matches a parent's id. Counting
  // over the raw `events` list therefore missed every sub-event registration, so
  // a participant registered only for sub-events saw 0% on both bars.
  const readyCount = useMemo(
    () =>
      flattenEvents(events).filter(
        (e) => registrations[e.id] && registrations[e.id].formStatus === 'ready',
      ).length,
    [events, registrations],
  );

  // Calculate feedback completion percentage dynamically
  const feedbackProgress = useMemo(() => {
    if (readyCount === 0) return 0;
    const fbs = readScoped<unknown[]>(STORES.feedbacks, user?.email, []);
    return Math.min(100, Math.round((fbs.length / readyCount) * 100));
  }, [readyCount, user?.email]);

  // Calculate certificate completion percentage dynamically
  const certProgress = useMemo(() => {
    if (readyCount === 0) return 0;
    const paidCount = flattenEvents(events).filter(
      (e) => registrations[e.id] && registrations[e.id].paymentStatus === 'paid',
    ).length;
    // Clamped: a registration can be paid without its form being ready, so
    // paidCount can exceed readyCount and overflow the progress bar.
    return Math.min(100, Math.round((paidCount / readyCount) * 100));
  }, [events, registrations, readyCount]);

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
  ];

  return (
    <div className="home-page-1">
      <div className="home-page-2">
        {/* Welcome Header */}
        <div>
          <h1 className="home-page-3">
            Hello, {user?.name || 'User'}! <span className="home-page-4">🖐️</span>
          </h1>
        </div>

        {/* 4 Boxes Grid */}
        <div className="home-page-5">
          {boxes.map((box, idx) => {
            const Icon = box.icon;
            return (
              <button
                key={idx}
                onClick={() => navigate(box.path)}
                className={`group relative flex flex-col justify-between overflow-hidden rounded-[20px] border border-slate-200/80 bg-white p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${box.borderColor} dark:border-slate-800 dark:bg-slate-800`}
              >
                {/* Main Content Row */}
                <div className="home-page-6">
                  {/* Left Circle Icon */}
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${box.color} shadow-sm transition-transform duration-300 group-hover:scale-105`}
                  >
                    <Icon className="home-page-7" />
                  </div>

                  {/* Text Details */}
                  <div className="home-page-8">
                    <h3 className="home-page-9">{box.title}</h3>
                    <p className="home-page-10">{box.description}</p>
                  </div>

                  {/* Arrow Icon */}
                  <ChevronRight className="home-page-11" />
                </div>

                {/* Progress bar inside the box */}
                <div className="home-page-12">
                  <div className="home-page-13">
                    <span className="home-page-14">Progress</span>
                    <span>{box.percentage}%</span>
                  </div>
                  <div className="home-page-15">
                    <div
                      className={`h-full rounded-full ${box.progressColor} transition-all duration-500`}
                      style={{ width: `${box.percentage}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Upcoming Events Section */}
        <div className="home-page-16">
          <div className="home-page-17">
            <h2 className="home-page-18">Upcoming Events</h2>
          </div>

          <section className="home-page-19">
            {filteredEvents.length === 0 ? (
              <div className="home-page-20">
                <p className="home-page-21">No events match your search.</p>
              </div>
            ) : (
              <div className="home-page-22">
                {filteredEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onViewDetails={handleViewDetails}
                    compact={true}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
