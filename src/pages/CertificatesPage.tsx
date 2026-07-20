import { useState, useMemo } from 'react'
import { useEvents } from '../context/EventsContext'
import { Award, ArrowLeft, Download, Eye, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function CertificatesPage() {
  const navigate = useNavigate()
  const { events, registrations } = useEvents()

  // Get events with paid registrations
  const certifiedEvents = useMemo(() => {
    return events.filter(e => registrations[e.id] && registrations[e.id].paymentStatus === 'paid')
  }, [events, registrations])

  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [viewingCert, setViewingCert] = useState<string | null>(null)

  const handleDownload = (eventId: string, eventName: string) => {
    setDownloadingId(eventId)
    setTimeout(() => {
      // Simulate file download by creating a mock file link
      const element = document.createElement('a')
      const file = new Blob([`Certificate of Participation\n\nThis is to certify that you have successfully participated in the event: ${eventName}.`], { type: 'text/plain' })
      element.href = URL.createObjectURL(file)
      element.download = `Certificate_${eventName.replace(/\s+/g, '_')}.txt`
      document.body.appendChild(element)
      element.click()
      document.body.removeChild(element)
      setDownloadingId(null)
    }, 1500)
  }

  return (
    <div className="min-h-[calc(100vh-48px)] bg-[#eaf2fb] dark:bg-slate-900/80 px-4 py-8 sm:px-6 md:py-10">
      <div className="mx-auto w-full max-w-[1200px] space-y-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/home')}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-blue-400"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-400">My Certificates</h2>
            <p className="text-xs text-slate-500">Download and share your earned event certificates</p>
          </div>
        </div>

        {certifiedEvents.length === 0 ? (
          <div className="rounded-[22px] bg-white p-12 text-center shadow-sm border border-slate-300 dark:bg-slate-800 dark:border-slate-700">
            <Award className="mx-auto h-16 w-16 text-slate-300 dark:text-slate-600 mb-4 animate-pulse" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No Certificates Earned Yet</h3>
            <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
              Certificates become available once your event registration payment is completed and approved.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {certifiedEvents.map(event => (
              <div
                key={event.id}
                className="group relative overflow-hidden rounded-[24px] border border-amber-200 bg-gradient-to-br from-amber-50/40 to-white p-6 shadow-sm transition-all hover:shadow-md dark:border-amber-900/30 dark:from-amber-950/15 dark:to-slate-800"
              >
                <div className="absolute right-0 top-0 -mr-6 -mt-6 h-24 w-24 rounded-full bg-amber-400/10 transition-transform group-hover:scale-125" />
                
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
                    <Award className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 uppercase tracking-wider">
                      <Sparkles className="h-3 w-3" /> Ready
                    </span>
                    <h3 className="mt-1.5 truncate text-lg font-bold text-slate-800 dark:text-slate-100">
                      {event.eventName}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{event.date} • {event.venue}</p>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <button
                    onClick={() => setViewingCert(viewingCert === event.id ? null : event.id)}
                    className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 px-4 text-xs font-semibold shadow-sm transition-all dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {viewingCert === event.id ? 'Hide Preview' : 'Preview'}
                  </button>

                  <button
                    disabled={downloadingId !== null}
                    onClick={() => handleDownload(event.id, event.eventName)}
                    className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-amber-500 text-white hover:bg-amber-600 px-4 text-xs font-semibold shadow-md shadow-amber-500/10 transition-all disabled:opacity-50"
                  >
                    <Download className={`h-3.5 w-3.5 ${downloadingId === event.id ? 'animate-bounce' : ''}`} />
                    {downloadingId === event.id ? 'Downloading...' : 'Download'}
                  </button>
                </div>

                {viewingCert === event.id && (
                  <div className="mt-5 rounded-xl border border-amber-300/40 bg-amber-50/20 p-4 dark:border-amber-900/20 dark:bg-amber-950/5">
                    <div className="border-[6px] border-double border-amber-600/40 p-4 text-center bg-white dark:bg-slate-900 rounded-lg">
                      <Award className="mx-auto h-8 w-8 text-amber-500 mb-2" />
                      <h4 className="font-serif text-[13px] font-bold tracking-wide uppercase text-slate-800 dark:text-slate-200">
                        CERTIFICATE OF PARTICIPATION
                      </h4>
                      <p className="text-[9px] text-slate-400 mt-1">PROUDLY PRESENTED TO</p>
                      <p className="text-[13px] font-bold text-amber-600 font-serif my-1">
                        Kathirselvam
                      </p>
                      <p className="text-[8px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                        for active participation and completion of the technical/non-technical challenges at {event.eventName}.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
