import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Upload, X, CheckCircle, Plus, Trash2, ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import type { EventItem, TeamMember } from '../types'
import { useEvents } from '../context/EventsContext'
import { CATEGORY_COLORS, CategoryIcon } from '../components/events/EventCard'

const DOCUMENT_TYPES = ['ID Card', 'Fee Receipt', 'College Certificate', 'Other']

function getCategorySolidBgClass(cat: string) {
  switch (cat) {
    case 'TECHNICAL': return 'bg-[#064675]'
    case 'CULTURAL': return 'bg-purple-600'
    case 'SPORTS': return 'bg-[#783c1d]'
    case 'LITERARY': return 'bg-orange-600'
    case 'MANAGEMENT': return 'bg-pink-600'
    case 'MULTI-EVENTS': return 'bg-emerald-600'
    default: return 'bg-slate-700'
  }
}

function ReadField({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <input
        readOnly
        value={value}
        className="cursor-default rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-normal text-slate-800 outline-none shadow-sm transition-all duration-200"
      />
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 border-b border-slate-200 pb-2.5 text-[15px] font-bold text-[#00558f]">
        {title}
      </h3>
      {children}
    </section>
  )
}

function TeamRow({
  member,
  index,
  onChange,
  onAdd,
  onRemove,
  canRemove,
}: {
  member: TeamMember
  index: number
  onChange: (id: string, field: keyof TeamMember, value: string) => void
  onAdd: () => void
  onRemove: (id: string) => void
  canRemove: boolean
}) {
  const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <tr className="border-b border-slate-50 last:border-0">
      <td className="px-3 py-2 text-center text-xs font-medium text-slate-400">{index + 1}</td>
      <td className="px-2 py-2">
        <input
          type="email"
          value={member.registeredMailId}
          onChange={e => onChange(member.id, 'registeredMailId', e.target.value)}
          placeholder="email@example.com"
          className={inputCls}
        />
      </td>
      <td className="px-2 py-2">
        <input
          value={member.name}
          onChange={e => onChange(member.id, 'name', e.target.value)}
          placeholder="Full name"
          className={inputCls}
        />
      </td>
      <td className="px-2 py-2">
        <input
          value={member.organization}
          onChange={e => onChange(member.id, 'organization', e.target.value)}
          placeholder="College / Company"
          className={inputCls}
        />
      </td>
      <td className="px-2 py-2">
        <select
          value={member.role}
          onChange={e => onChange(member.id, 'role', e.target.value)}
          className={inputCls}
        >
          <option value="">Role</option>
          <option value="Leader">Team Leader</option>
          <option value="Member">Team Member</option>
          <option value="Presenter">Presenter</option>
        </select>
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center justify-center gap-1.5">
          <button
            onClick={onAdd}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-700 text-white hover:bg-blue-800"
            title="Add row"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onRemove(member.id)}
            disabled={!canRemove}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white disabled:cursor-not-allowed disabled:bg-slate-200"
            title="Remove row"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

function getTeamMemberBounds(teamSize?: string) {
  if (!teamSize) return { min: 1, max: null as number | null }
  const matches = teamSize.match(/\d+/g)
  if (!matches?.length) return { min: 1, max: null }

  const values = matches.map(Number).filter(value => Number.isFinite(value) && value > 0)
  if (!values.length) return { min: 1, max: null }

  const min = values[0]
  const max = values.length > 1 ? values[values.length - 1] : values[0]
  return {
    min: Math.max(1, min),
    max: Math.max(1, max),
  }
}

function createTeamMembers(count: number) {
  return Array.from({ length: Math.max(1, count) }, (_, index) => ({
    id: `${Date.now()}-${index}`,
    registeredMailId: '',
    name: '',
    organization: '',
    role: '',
  }))
}

export default function RegistrationPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { startRegistration, updateTeamMembers, markFormReady } = useEvents()

  const event = location.state?.event as EventItem | undefined
  const parentEvent = location.state?.parentEvent as EventItem | undefined
  const [members, setMembers] = useState<TeamMember[]>([])
  const [docType, setDocType] = useState('')
  const [fileName, setFileName] = useState('')
  const [currentStep, setCurrentStep] = useState(1)
  const isTeam = event?.participation === 'Team'
  const { min: minMembers, max: maxMembers } = getTeamMemberBounds(event?.teamSize)

  useEffect(() => {
    if (isTeam) {
      setMembers(prev => (prev.length ? prev : createTeamMembers(minMembers)))
      return
    }
    setMembers([])
  }, [isTeam, minMembers])

  useEffect(() => {
    if (!event) navigate('/home', { replace: true })
  }, [event, navigate])

  if (!event) return null

  const maxSteps = isTeam ? 3 : 2
  const isTeamValid = !isTeam || (
    members.length >= minMembers &&
    members.every(m => m.registeredMailId.trim() !== '' && m.name.trim() !== '' && m.organization.trim() !== '' && m.role !== '')
  )

  const canProceed = fileName.trim().length > 0 && docType.trim().length > 0
  const colors = CATEGORY_COLORS[event.category] ?? { pill: 'bg-slate-700 text-white', bg: 'bg-slate-50', icon: 'text-slate-500' }

  const updateMember = (id: string, field: keyof TeamMember, value: string) => {
    setMembers(prev => prev.map(member => (member.id === id ? { ...member, [field]: value } : member)))
  }

  const addMember = () => {
    setMembers(prev =>
      maxMembers && prev.length >= maxMembers
        ? prev
        : [...prev, { id: `${Date.now()}-${prev.length}`, registeredMailId: '', name: '', organization: '', role: '' }],
    )
  }

  const removeMember = (id: string) => {
    setMembers(prev => {
      const next = prev.filter(member => member.id !== id)
      return next.length >= minMembers ? next : prev
    })
  }

  const handleSave = () => {
    if (!canProceed) return
    startRegistration(event.id)
    if (isTeam) updateTeamMembers(event.id, members)
    markFormReady(event.id, {
      documentType: docType,
      fileName,
      uploadedAt: new Date().toISOString(),
    })
    navigate('/event-register', {
      replace: true,
      state: { event: parentEvent ?? event, parentEvent, showPaymentSummary: true, paymentEventId: event.id },
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-3 backdrop-blur-sm">
      <div className="w-full max-w-[860px] overflow-hidden rounded-[24px] bg-gradient-to-br from-white via-[#f3f7fc] to-[#e6effa] shadow-[0_22px_60px_rgba(15,23,42,0.26)] flex flex-col">
        <div className="flex items-start justify-between border-b border-slate-200 bg-transparent px-5 py-4">
          <div className="flex items-start gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${getCategorySolidBgClass(event.category)}`}>
              <CategoryIcon category={event.category} iconClassName="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#00558f]">{event.eventName}</h2>
              <span className={`mt-1 inline-flex rounded-md px-2.5 py-0.5 text-[11px] font-semibold ${colors.pill}`}>
                {event.category}
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100/50 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Tracker */}
        <div className="border-b border-slate-200 bg-white/80 px-6 py-3.5 flex items-center justify-center gap-6 text-xs font-semibold text-slate-500">
          {/* Step 1 */}
          <div className={`flex items-center gap-2 ${currentStep >= 1 ? 'text-blue-700' : 'text-slate-500'}`}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold border ${currentStep > 1
              ? 'bg-blue-700 text-white border-blue-700'
              : 'bg-blue-100 text-blue-700 border-blue-200'
              }`}>
              {currentStep > 1 ? '✓' : '1'}
            </span>
            <span>Event Details</span>
          </div>

          <span className={`h-px w-12 ${currentStep > 1 ? 'bg-blue-500' : 'bg-slate-200'}`} />

          {/* Step 2 (Team Details if isTeam) */}
          {isTeam && (
            <>
              <div className={`flex items-center gap-2 ${currentStep >= 2 ? 'text-blue-700' : 'text-slate-500'}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold border ${currentStep > 2
                  ? 'bg-blue-700 text-white border-blue-700'
                  : currentStep === 2
                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                    : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}>
                  {currentStep > 2 ? '✓' : '2'}
                </span>
                <span>Team Details</span>
              </div>
              <span className={`h-px w-12 ${currentStep > 2 ? 'bg-blue-500' : 'bg-slate-200'}`} />
            </>
          )}

          {/* Step 3 (or 2) (Document Upload) */}
          <div className={`flex items-center gap-2 ${currentStep === maxSteps ? 'text-blue-700' : 'text-slate-500'}`}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold border ${currentStep === maxSteps
              ? 'bg-blue-100 text-blue-700 border-blue-200'
              : 'bg-slate-100 text-slate-400 border-slate-200'
              }`}>
              {isTeam ? 3 : 2}
            </span>
            <span>Document Upload</span>
          </div>
        </div>

        <div className="max-h-[68vh] overflow-y-auto px-5 py-5">
          <div className="space-y-6">
            {currentStep === 1 && (
              <>
                <Section title="Event Details">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <ReadField label="Event Name" value={event.eventName} />
                    <ReadField label="Category" value={event.category} />
                    <ReadField label="Date" value={event.date} />
                    <ReadField label="Venue" value={event.venue} />
                    <ReadField label="Participation" value={event.participation} />
                    <ReadField label="Fees" value={`₹${event.fees} / ${event.feesUnit}`} />
                  </div>
                </Section>

                <Section title="Coordinator Details">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <ReadField label="Coordinator Name" value="Dr. Anitha R" />
                    <ReadField label="Designation" value="Assistant Professor" />
                    <ReadField label="Mobile" value="+91 98765 43210" />
                    <ReadField label="Department" value="Computer Science & Engineering" className="sm:col-span-2" />
                    <ReadField label="Email" value="anitha.r@ksrct.ac.in" />
                  </div>
                </Section>
              </>
            )}

            {isTeam && currentStep === 2 && (
              <Section title="Team Details">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    Team size: <span className="font-semibold text-slate-700">{event.teamSize}</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    Min {minMembers}{maxMembers ? ` - Max ${maxMembers}` : ''}
                  </p>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full min-w-[760px]">
                    <thead className="bg-blue-700 text-white">
                      <tr>
                        {['#', 'Email', 'Name', 'Organization', 'Role', 'Action'].map(header => (
                          <th key={header} className="px-3 py-2.5 text-left text-xs font-semibold">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {members.map((member, index) => (
                        <TeamRow
                          key={member.id}
                          member={member}
                          index={index}
                          onChange={updateMember}
                          onAdd={addMember}
                          onRemove={removeMember}
                          canRemove={members.length > minMembers}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                {!isTeamValid && <p className="mt-2 text-xs text-red-500">Please fill in all team member details to proceed.</p>}
              </Section>
            )}

            {currentStep === maxSteps && (
              <Section title="Document Upload">
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-slate-600 font-medium">Please choose a document type and upload the file to complete registration.</p>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <select
                      value={docType}
                      onChange={e => setDocType(e.target.value)}
                      className="min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Type</option>
                      {DOCUMENT_TYPES.map(type => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
                      <Upload className="h-4 w-4" />
                      Choose File
                      <input type="file" className="hidden" onChange={e => setFileName(e.target.files?.[0]?.name ?? '')} />
                    </label>
                    {fileName && <span className="text-xs text-slate-500 font-medium">{fileName}</span>}
                  </div>
                </div>
              </Section>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-transparent px-5 py-3.5">
          {currentStep > 1 ? (
            <button
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 bg-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          ) : (
            <button
              onClick={() => navigate('/event-register', { state: { event: parentEvent ?? event } })}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 bg-white"
            >
              Cancel
            </button>
          )}

          {currentStep < maxSteps ? (
            <button
              onClick={() => setCurrentStep(prev => prev + 1)}
              disabled={isTeam && currentStep === 2 && !isTeamValid}
              className="flex items-center gap-2 rounded-xl bg-blue-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next Step
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={!canProceed}
              className="flex items-center gap-2 rounded-xl bg-blue-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCircle className="h-4 w-4" />
              {canProceed ? 'Submit Registration' : 'Upload File to Submit'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
