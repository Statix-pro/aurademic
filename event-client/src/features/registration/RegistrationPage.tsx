import { Upload, X, CheckCircle, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useEvents } from '../../contexts/EventsContext';
import { CATEGORY_COLORS, CategoryIcon, getCategorySolidBgClass } from '../events/EventCard';

import type { EventItem, TeamMember } from '../../types';
import type { ReactNode } from 'react';
import './RegistrationPage.css';

const DOCUMENT_TYPES = ['ID Card', 'Fee Receipt', 'College Certificate', 'Other'];

function ReadField({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label className="registration-page-1">{label}</label>
      <input readOnly value={value} className="registration-page-2" />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="registration-page-3">
      <h3 className="registration-page-4">{title}</h3>
      {children}
    </section>
  );
}

function TeamRow({
  member,
  index,
  onChange,
  onAdd,
  onRemove,
  canRemove,
}: {
  member: TeamMember;
  index: number;
  onChange: (id: string, field: keyof TeamMember, value: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}) {
  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <tr className="registration-page-5">
      <td className="registration-page-6">{index + 1}</td>
      <td className="registration-page-7">
        <input
          type="email"
          value={member.registeredMailId}
          onChange={(e) => onChange(member.id, 'registeredMailId', e.target.value)}
          placeholder="email@example.com"
          className={inputCls}
        />
      </td>
      <td className="registration-page-8">
        <input
          value={member.name}
          onChange={(e) => onChange(member.id, 'name', e.target.value)}
          placeholder="Full name"
          className={inputCls}
        />
      </td>
      <td className="registration-page-9">
        <input
          value={member.organization}
          onChange={(e) => onChange(member.id, 'organization', e.target.value)}
          placeholder="College / Company"
          className={inputCls}
        />
      </td>
      <td className="registration-page-10">
        <select
          value={member.role}
          onChange={(e) => onChange(member.id, 'role', e.target.value)}
          className={inputCls}
          aria-label="Role"
        >
          <option value="">Role</option>
          <option value="Leader">Team Leader</option>
          <option value="Member">Team Member</option>
          <option value="Presenter">Presenter</option>
        </select>
      </td>
      <td className="registration-page-11">
        <div className="registration-page-12">
          <button onClick={onAdd} className="registration-page-13" title="Add row">
            <Plus className="registration-page-14" />
          </button>
          <button
            onClick={() => onRemove(member.id)}
            disabled={!canRemove}
            className="registration-page-15"
            title="Remove row"
          >
            <Trash2 className="registration-page-16" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function getTeamMemberBounds(teamSize?: string) {
  if (!teamSize) return { min: 1, max: null as number | null };
  const matches = teamSize.match(/\d+/g);
  if (!matches?.length) return { min: 1, max: null };

  const values = matches.map(Number).filter((value) => Number.isFinite(value) && value > 0);
  if (!values.length) return { min: 1, max: null };

  const min = values[0];
  const max = values.length > 1 ? values[values.length - 1] : values[0];
  return {
    min: Math.max(1, min),
    max: Math.max(1, max),
  };
}

function createTeamMembers(count: number) {
  return Array.from({ length: Math.max(1, count) }, (_, index) => ({
    id: `${Date.now()}-${index}`,
    registeredMailId: '',
    name: '',
    organization: '',
    role: '',
  }));
}

export default function RegistrationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { startRegistration, updateTeamMembers, markFormReady } = useEvents();

  const event = location.state?.event as EventItem | undefined;
  const parentEvent = location.state?.parentEvent as EventItem | undefined;
  const [isLoading, setIsLoading] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [docType, setDocType] = useState('');
  const [fileName, setFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [submitError, setSubmitError] = useState('');
  const isTeam = event?.participation === 'Team';
  const { min: minMembers, max: maxMembers } = getTeamMemberBounds(event?.teamSize);

  useEffect(() => {
    if (isTeam) {
      setMembers((prev) => (prev.length ? prev : createTeamMembers(minMembers)));
      return;
    }
    setMembers([]);
  }, [isTeam, minMembers]);

  useEffect(() => {
    if (!event) navigate('/home', { replace: true });
  }, [event, navigate]);

  if (!event) return null;

  const requiresDocument = Boolean(event.documentEnabled);
  const maxSteps = 1 + (isTeam ? 1 : 0) + (requiresDocument ? 1 : 0);
  const isTeamValid =
    !isTeam ||
    (members.length >= minMembers &&
      members.every(
        (m) =>
          m.registeredMailId.trim() !== '' &&
          m.name.trim() !== '' &&
          m.organization.trim() !== '' &&
          m.role !== '',
      ));

  const canProceed = !requiresDocument || (fileName.trim().length > 0 && docType.trim().length > 0);
  const colors = CATEGORY_COLORS[event.category] ?? {
    pill: 'bg-slate-700 text-white',
    bg: 'bg-slate-50',
    icon: 'text-slate-500',
  };

  const updateMember = (id: string, field: keyof TeamMember, value: string) => {
    setMembers((prev) =>
      prev.map((member) => (member.id === id ? { ...member, [field]: value } : member)),
    );
  };

  const addMember = () => {
    setMembers((prev) =>
      maxMembers && prev.length >= maxMembers
        ? prev
        : [
            ...prev,
            {
              id: `${Date.now()}-${prev.length}`,
              registeredMailId: '',
              name: '',
              organization: '',
              role: '',
            },
          ],
    );
  };

  const removeMember = (id: string) => {
    setMembers((prev) => {
      const next = prev.filter((member) => member.id !== id);
      return next.length >= minMembers ? next : prev;
    });
  };

  const handleSave = async () => {
    if (!canProceed) return;
    setSubmitError('');
    setIsLoading(true);
    try {
      await startRegistration(event.id);
      if (isTeam) await updateTeamMembers(event.id, members);
      await markFormReady(
        event.id,
        requiresDocument ? docType : undefined,
        requiresDocument ? selectedFile : undefined,
      );
      const isFreeEvent = !event.hasRegistrationFee || Number(event.fees || 0) === 0;

      navigate('/event-register', {
        replace: true,
        state: {
          event: parentEvent ?? event,
          parentEvent,
          showPaymentSummary: !isFreeEvent,
          paymentEventId: isFreeEvent ? undefined : event.id,
        },
      });
    } catch (err) {
      console.error('Failed to save registration', err);
      setSubmitError(
        err instanceof Error ? err.message : 'Could not submit registration. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="registration-page-17">
      <div className="registration-page-18">
        <div className="registration-page-19">
          <div className="registration-page-20">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${getCategorySolidBgClass(event.category)}`}
            >
              <CategoryIcon category={event.category} iconClassName="text-white" />
            </div>
            <div>
              <h2 className="registration-page-21">{event.eventName}</h2>
              <span
                className={`mt-1 inline-flex rounded-md px-2.5 py-0.5 text-[11px] font-semibold ${colors.pill}`}
              >
                {event.category}
              </span>
            </div>
          </div>
          <button onClick={() => navigate(-1)} className="registration-page-22" aria-label="Close">
            <X className="registration-page-23" />
          </button>
        </div>

        {/* Step Tracker */}
        <div className="registration-page-24">
          {/* Step 1 */}
          <div
            className={`flex items-center gap-2 ${currentStep >= 1 ? 'text-blue-700' : 'text-slate-500'}`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold border ${
                currentStep > 1
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-blue-100 text-blue-700 border-blue-200'
              }`}
            >
              {currentStep > 1 ? '✓' : '1'}
            </span>
            <span>Event Details</span>
          </div>

          <span className={`h-px w-12 ${currentStep > 1 ? 'bg-blue-500' : 'bg-slate-200'}`} />

          {/* Step 2 (Team Details if isTeam) */}
          {isTeam && (
            <>
              <div
                className={`flex items-center gap-2 ${currentStep >= 2 ? 'text-blue-700' : 'text-slate-500'}`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold border ${
                    currentStep > 2
                      ? 'bg-blue-700 text-white border-blue-700'
                      : currentStep === 2
                        ? 'bg-blue-100 text-blue-700 border-blue-200'
                        : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}
                >
                  {currentStep > 2 ? '✓' : '2'}
                </span>
                <span>Team Details</span>
              </div>
              <span className={`h-px w-12 ${currentStep > 2 ? 'bg-blue-500' : 'bg-slate-200'}`} />
            </>
          )}

          {requiresDocument && (
            <div
              className={`flex items-center gap-2 ${currentStep === maxSteps ? 'text-blue-700' : 'text-slate-500'}`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold border ${
                  currentStep === maxSteps
                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                    : 'bg-slate-100 text-slate-400 border-slate-200'
                }`}
              >
                {isTeam ? 3 : 2}
              </span>
              <span>Document Upload</span>
            </div>
          )}
        </div>

        <div className="registration-page-25">
          <div className="registration-page-26">
            {currentStep === 1 && (
              <>
                <Section title="Event Details">
                  <div className="registration-page-27">
                    <ReadField label="Event Name" value={event.eventName} />
                    <ReadField label="Category" value={event.category} />
                    <ReadField label="Date" value={event.date} />
                    <ReadField label="Venue" value={event.venue} />
                    <ReadField label="Participation" value={event.participation} />
                    <ReadField
                      label="Fees"
                      value={
                        event.hasRegistrationFee ? `₹${event.fees} / ${event.feesUnit}` : 'Free'
                      }
                    />
                  </div>
                </Section>

                {event.coordinators && event.coordinators.length > 0 ? (
                  <Section title="Coordinator Details">
                    <div className="registration-page-28">
                      <ReadField
                        label="Coordinator Name"
                        value={event.coordinators[0].name || '-'}
                      />
                      <ReadField
                        label="Designation"
                        value={event.coordinators[0].designation || '-'}
                      />
                      <ReadField
                        label="Department"
                        value={event.coordinators[0].department || '-'}
                        className="registration-page-29"
                      />
                      <ReadField label="Email" value={event.coordinators[0].email || '-'} />
                    </div>
                  </Section>
                ) : null}
              </>
            )}

            {isTeam && currentStep === 2 && (
              <Section title="Team Details">
                <div className="registration-page-30">
                  <p className="registration-page-31">
                    Team size: <span className="registration-page-32">{event.teamSize}</span>
                  </p>
                  <p className="registration-page-33">
                    Min {minMembers}
                    {maxMembers ? ` - Max ${maxMembers}` : ''}
                  </p>
                </div>
                <div className="registration-page-34">
                  <table className="registration-page-35">
                    <thead className="registration-page-36">
                      <tr>
                        {['#', 'Email', 'Name', 'Organization', 'Role', 'Action'].map((header) => (
                          <th key={header} className="registration-page-37">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="registration-page-38">
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
                {!isTeamValid && (
                  <p className="registration-page-39">
                    Please fill in all team member details to proceed.
                  </p>
                )}
              </Section>
            )}

            {requiresDocument && currentStep === maxSteps && (
              <Section title="Document Upload">
                <div className="registration-page-40">
                  <p className="registration-page-41">
                    Please choose a document type and upload the file to complete registration.
                  </p>
                  <div className="registration-page-42">
                    <select
                      value={docType}
                      onChange={(e) => setDocType(e.target.value)}
                      className="registration-page-43"
                      aria-label="Document type"
                    >
                      <option value="">Select Type</option>
                      {DOCUMENT_TYPES.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                    <label className="registration-page-44">
                      <Upload className="registration-page-45" />
                      Choose File
                      <input
                        type="file"
                        className="registration-page-46"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setFileName(file.name);
                            setSelectedFile(file);
                          } else {
                            setFileName('');
                            setSelectedFile(null);
                          }
                        }}
                      />
                    </label>
                    {fileName && <span className="registration-page-47">{fileName}</span>}
                  </div>
                </div>
              </Section>
            )}
          </div>
        </div>

        <div className="registration-page-48">
          {submitError && <p className="text-sm font-medium text-red-600">{submitError}</p>}
          {currentStep > 1 ? (
            <button
              onClick={() => setCurrentStep((prev) => prev - 1)}
              className="registration-page-49"
            >
              <ArrowLeft className="registration-page-50" />
              Back
            </button>
          ) : (
            <button
              onClick={() =>
                navigate('/event-register', { state: { event: parentEvent ?? event } })
              }
              className="registration-page-51"
            >
              Cancel
            </button>
          )}

          {currentStep < maxSteps ? (
            <button
              onClick={() => setCurrentStep((prev) => prev + 1)}
              disabled={isTeam && currentStep === 2 && !isTeamValid}
              className="registration-page-52"
            >
              Next Step
            </button>
          ) : (
            <button onClick={handleSave} disabled={!canProceed} className="registration-page-53">
              <CheckCircle className="registration-page-54" />
              {canProceed ? 'Submit Registration' : 'Upload File to Submit'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
