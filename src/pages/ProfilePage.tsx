import { useCallback, useMemo, useRef, useState, useEffect, type ChangeEvent, type ReactNode } from 'react'
import { Camera, Upload, User, Calendar, ChevronDown } from 'lucide-react'
import { useProfile } from '../context/ProfileContext'

const PROFESSIONS = [
  'College Student',
  'Faculty Members',
  'School Student',
  'School Teacher',
  'Research Scholar',
  'Alumni',
  'Industry Professional',
  'Scientist',
  'Government Official',
  'Other Profession',
  'General Public',
]

const SCHOOL_CLASS_OPTIONS = ['1st Std', '2nd Std', '3rd Std', '4th Std', '5th Std', '6th Std', '7th Std', '8th Std', '9th Std', '10th Std', '11th Std', '12th Std']
const SPECIALIZATION_OPTIONS = ['Mathematics', 'Science', 'English', 'Tamil', 'Social Science', 'Computer Science', 'Other']

const TITLES = ['Mr', 'Ms', 'Mrs', 'Dr', 'Prof']
const GENDERS = ['Male', 'Female', 'Other']
const YES_NO = ['Yes', 'No']
const DEGREE_OPTIONS = ['B.E / B.Tech', 'M.E / M.Tech', 'MBA', 'MCA', 'Ph.D', 'Diploma', 'Other']
const DEPARTMENT_OPTIONS = [
  { value: 'CSE', label: 'Computer Science & Engineering' },
  { value: 'ECE', label: 'Electronics & Communication' },
  { value: 'EEE', label: 'Electrical & Electronics' },
  { value: 'MECH', label: 'Mechanical Engineering' },
  { value: 'CIVIL', label: 'Civil Engineering' },
  { value: 'IT', label: 'Information Technology' },
  { value: 'OTHER', label: 'Other' },
]
const YEAR_OPTIONS = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'PG 1st Year', 'PG 2nd Year']
const SCHOOL_CATEGORY_OPTIONS = ['CBSE', 'ISE', 'Matriculation']
const INSTITUTION_CATEGORY_OPTIONS = ['Engineering', 'Polytechnic', 'Arts & Science', 'Management', 'University']
const MODE_OPTIONS = ['Full Time', 'Part Time']
const INSTITUTION_OPTIONS = ['Anna University', 'SRM Institute of Science and Technology', 'Vellore Institute of Technology', 'Other']
const SCHOOL_OPTIONS = ['Government Higher Secondary School', 'St. Joseph School', 'National Public School', 'Other']
const ORGANIZATION_OPTIONS = ['ISRO', 'DRDO', 'TCS', 'Infosys', 'Government Department', 'Other']

function Field({
  label,
  children,
  className = '',
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label className="text-sm font-semibold text-slate-800">
        {label}
      </label>
      {children}
    </div>
  )
}

function PillButton({
  label,
  active,
  onClick,
  disabled = false,
}: {
  label: string
  active: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-10 rounded-xl px-5 text-xs font-semibold transition-all border ${active
          ? 'bg-[#00558f] border-[#00558f] text-white shadow-sm'
          : 'bg-[#f1f6fa] border-slate-300 text-[#00558f] hover:bg-[#e2eefa]'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      {label}
    </button>
  )
}

function InstitutionBox({
  isSchool = false,
  profession,
  updateProfession,
  disabled = false,
}: {
  isSchool?: boolean
  profession: any
  updateProfession: (data: any) => void
  disabled?: boolean
}) {
  return (
    <div className="md:col-span-12 rounded-2xl border border-blue-100 bg-[#eaf2fb]/60 p-5 shadow-sm">
      <div className="grid gap-x-5 gap-y-4 md:grid-cols-12 items-center">
        <div className="md:col-span-2 text-sm font-bold text-[#00558f]">
          {isSchool ? 'School Name' : 'Institution'}
        </div>
        <div className="md:col-span-10 relative w-full">
          <select
            className="profile-input pr-10 appearance-none bg-white shadow-sm"
            value={isSchool ? profession.school || '' : profession.institution || ''}
            disabled={disabled}
            onChange={e => {
              const val = e.target.value
              if (isSchool) {
                updateProfession({ school: val, institution: val })
              } else {
                updateProfession({ institution: val })
              }
            }}
          >
            <option value="">{isSchool ? 'Select School' : 'Select Institution'}</option>
            {(isSchool ? SCHOOL_OPTIONS : INSTITUTION_OPTIONS).map(item => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00558f] pointer-events-none" />
        </div>

        <div className="md:col-span-2 flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-500">Category</label>
          <input
            className="profile-input bg-white shadow-sm"
            value={profession.institutionCategory || ''}
            disabled={disabled}
            onChange={e => updateProfession({ institutionCategory: e.target.value })}
            placeholder="Category"
          />
        </div>
        <div className="md:col-span-6 flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-500">Address</label>
          <input
            className="profile-input bg-white shadow-sm"
            value={profession.institutionAddress || ''}
            disabled={disabled}
            onChange={e => updateProfession({ institutionAddress: e.target.value })}
            placeholder="Address"
          />
        </div>
        <div className="md:col-span-2 flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-500">City</label>
          <input
            className="profile-input bg-white shadow-sm"
            value={profession.institutionCity || ''}
            disabled={disabled}
            onChange={e => updateProfession({ institutionCity: e.target.value })}
            placeholder="City"
          />
        </div>
        <div className="md:col-span-2 flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-500">State</label>
          <input
            className="profile-input bg-white shadow-sm"
            value={profession.institutionState || ''}
            disabled={disabled}
            onChange={e => updateProfession({ institutionState: e.target.value })}
            placeholder="State"
          />
        </div>
      </div>
    </div>
  )
}

function IdCardSection({
  profession,
  handleIdChange,
  idRef,
  disabled = false,
  professionalStatus,
  onStatusChange,
}: {
  profession: any
  handleIdChange: (e: ChangeEvent<HTMLInputElement>) => void
  idRef: React.RefObject<HTMLInputElement>
  disabled?: boolean
  professionalStatus: 'initial' | 'submitted' | 'editing'
  onStatusChange: (status: 'initial' | 'submitted' | 'editing') => void
}) {
  return (
    <div className="md:col-span-12 border-t border-slate-200 pt-5 mt-2">
      <div className="text-sm font-bold text-[#00558f] mb-3">ID Card</div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => idRef.current?.click()}
          disabled={disabled}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#e2eefa] border border-[#a0c5eb] text-[#00558f] hover:bg-[#d4e7f8] px-5 text-sm font-semibold transition-all shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload className="h-4 w-4 text-[#00558f]" />
          Choose File
        </button>
        {profession.idCard ? (
          <div className="flex items-center gap-2">
            <img src={profession.idCard} alt="ID Card Preview" className="h-10 w-10 rounded-lg object-cover border border-slate-200" />
            <span className="text-xs text-slate-500 font-semibold">File uploaded</span>
          </div>
        ) : null}
        <input ref={idRef} type="file" accept="image/*" className="hidden" onChange={handleIdChange} disabled={disabled} />

        <button
          type="button"
          onClick={() => {
            if (professionalStatus === 'initial') onStatusChange('submitted')
            else if (professionalStatus === 'submitted') onStatusChange('editing')
            else onStatusChange('submitted')
          }}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[#00558f] hover:bg-[#004473] text-white px-5 text-sm font-semibold transition-all shadow-sm ml-auto"
        >
          {professionalStatus === 'initial' ? 'Submit' : professionalStatus === 'submitted' ? 'Edit Now' : 'Submit Now'}
        </button>
      </div>
    </div>
  )
}

function calculateAge(dateString: string) {
  if (!dateString) return ''
  const dob = new Date(dateString)
  if (Number.isNaN(dob.getTime())) return ''
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age -= 1
  return String(age)
}

export default function ProfilePage() {
  const {
    personal,
    profession,
    updatePersonal,
    updateProfession,
  } = useProfile()

  const [showProfessionStep, setShowProfessionStep] = useState(false)
  const [showProfessionDetails, setShowProfessionDetails] = useState(() => !!profession.professionType)
  const [personalStatus, setPersonalStatus] = useState<'initial' | 'submitted' | 'editing'>(() => {
    try {
      const stored = localStorage.getItem('ep_personal_status')
      if (stored === 'submitted' || stored === 'editing') return stored
    } catch {}
    return personal.firstName ? 'submitted' : 'initial'
  })

  const [professionalStatus, setProfessionalStatus] = useState<'initial' | 'submitted' | 'editing'>(() => {
    try {
      const stored = localStorage.getItem('ep_professional_status')
      if (stored === 'submitted' || stored === 'editing') return stored
    } catch {}
    return profession.professionType ? 'submitted' : 'initial'
  })

  useEffect(() => {
    try {
      localStorage.setItem('ep_personal_status', personalStatus)
    } catch {}
  }, [personalStatus])

  useEffect(() => {
    try {
      localStorage.setItem('ep_professional_status', professionalStatus)
    } catch {}
  }, [professionalStatus])

  const photoRef = useRef<HTMLInputElement>(null)
  const idRef = useRef<HTMLInputElement>(null)

  const displayName = useMemo(() => {
    const fullName = [personal.firstName, personal.lastName].filter(Boolean).join(' ').trim()
    if (fullName) return [personal.title, fullName].filter(Boolean).join(' ').trim()
    return 'Your Name'
  }, [personal.firstName, personal.lastName, personal.title])

  const displayAge = personal.age || calculateAge(personal.dateOfBirth)

  const handlePhotoChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => updatePersonal({ photograph: ev.target?.result as string })
    reader.readAsDataURL(file)
  }, [updatePersonal])

  const handleIdChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => updateProfession({ idCard: ev.target?.result as string })
    reader.readAsDataURL(file)
  }, [updateProfession])

  const professionFields = (() => {
    const handleIdChange = (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = ev => updateProfession({ idCard: ev.target?.result as string })
      reader.readAsDataURL(file)
    }

    const isSubmitted = professionalStatus === 'submitted'

    switch (profession.professionType) {
      case 'College Student':
        return (
          <div className="grid gap-x-8 gap-y-4 md:grid-cols-12">
            <Field label="Degree" className="md:col-span-3">
              <div className="relative w-full">
                <select className="profile-input pr-10 appearance-none bg-white shadow-sm" value={profession.degree || ''} onChange={e => updateProfession({ degree: e.target.value })} disabled={isSubmitted}>
                  <option value="">Select Degree</option>
                  {DEGREE_OPTIONS.map(item => <option key={item}>{item}</option>)}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00558f] pointer-events-none" />
              </div>
            </Field>
            <Field label="Department" className="md:col-span-6">
              <div className="relative w-full">
                <select className="profile-input pr-10 appearance-none bg-white shadow-sm" value={profession.department || ''} onChange={e => updateProfession({ department: e.target.value })} disabled={isSubmitted}>
                  <option value="">Select Department</option>
                  {DEPARTMENT_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00558f] pointer-events-none" />
              </div>
            </Field>
            <Field label="Year of Study" className="md:col-span-3">
              <div className="relative w-full">
                <select className="profile-input pr-10 appearance-none bg-white shadow-sm" value={profession.yearOfStudy || ''} onChange={e => updateProfession({ yearOfStudy: e.target.value })} disabled={isSubmitted}>
                  <option value="">Select Year</option>
                  {YEAR_OPTIONS.map(item => <option key={item}>{item}</option>)}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00558f] pointer-events-none" />
              </div>
            </Field>

            <InstitutionBox isSchool={false} profession={profession} updateProfession={updateProfession} disabled={isSubmitted} />

            <Field label="Contact Faculty Name" className="md:col-span-6">
              <input className="profile-input bg-white shadow-sm" value={profession.contactFacultyName || ''} onChange={e => updateProfession({ contactFacultyName: e.target.value })} placeholder="Enter contact faculty name" disabled={isSubmitted} />
            </Field>
            <Field label="Faculty Mobile" className="md:col-span-6">
              <input className="profile-input bg-white shadow-sm" value={profession.facultyMobile || ''} onChange={e => updateProfession({ facultyMobile: e.target.value })} placeholder="Enter faculty mobile" disabled={isSubmitted} />
            </Field>

            <IdCardSection
              profession={profession}
              handleIdChange={handleIdChange}
              idRef={idRef}
              disabled={isSubmitted}
              professionalStatus={professionalStatus}
              onStatusChange={setProfessionalStatus}
            />
          </div>
        )
      case 'Faculty Members':
        return (
          <div className="grid gap-x-8 gap-y-4 md:grid-cols-12">
            <Field label="Designation" className="md:col-span-4">
              <input className="profile-input bg-white shadow-sm" value={profession.designation || ''} onChange={e => updateProfession({ designation: e.target.value })} placeholder="Enter designation" disabled={isSubmitted} />
            </Field>
            <Field label="Department" className="md:col-span-8">
              <div className="relative w-full">
                <select className="profile-input pr-10 appearance-none bg-white shadow-sm" value={profession.department || ''} onChange={e => updateProfession({ department: e.target.value })} disabled={isSubmitted}>
                  <option value="">Select Department</option>
                  {DEPARTMENT_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00558f] pointer-events-none" />
              </div>
            </Field>

            <InstitutionBox isSchool={false} profession={profession} updateProfession={updateProfession} disabled={isSubmitted} />

            <IdCardSection
              profession={profession}
              handleIdChange={handleIdChange}
              idRef={idRef}
              disabled={isSubmitted}
              professionalStatus={professionalStatus}
              onStatusChange={setProfessionalStatus}
            />
          </div>
        )
      case 'School Student':
        return (
          <div className="grid gap-x-8 gap-y-4 md:grid-cols-12">
            <Field label="Class" className="md:col-span-3">
              <div className="relative w-full">
                <select className="profile-input pr-10 appearance-none bg-white shadow-sm" value={profession.classGrade || ''} onChange={e => updateProfession({ classGrade: e.target.value })} disabled={isSubmitted}>
                  <option value="">Select Class</option>
                  {SCHOOL_CLASS_OPTIONS.map(item => <option key={item}>{item}</option>)}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00558f] pointer-events-none" />
              </div>
            </Field>
            <Field label="Section" className="md:col-span-3">
              <input className="profile-input bg-white shadow-sm" value={profession.section || ''} onChange={e => updateProfession({ section: e.target.value })} placeholder="Enter section" disabled={isSubmitted} />
            </Field>
            <Field label="Contact Teacher Name" className="md:col-span-3">
              <input className="profile-input bg-white shadow-sm" value={profession.teacherCoordinatorName || ''} onChange={e => updateProfession({ teacherCoordinatorName: e.target.value })} placeholder="Enter contact teacher name" disabled={isSubmitted} />
            </Field>
            <Field label="Teacher Mobile" className="md:col-span-3">
              <input className="profile-input bg-white shadow-sm" value={profession.teacherCoordinatorContact || ''} onChange={e => updateProfession({ teacherCoordinatorContact: e.target.value })} placeholder="Enter teacher mobile" disabled={isSubmitted} />
            </Field>

            <InstitutionBox isSchool={true} profession={profession} updateProfession={updateProfession} disabled={isSubmitted} />

            <IdCardSection
              profession={profession}
              handleIdChange={handleIdChange}
              idRef={idRef}
              disabled={isSubmitted}
              professionalStatus={professionalStatus}
              onStatusChange={setProfessionalStatus}
            />
          </div>
        )
      case 'School Teacher':
        return (
          <div className="grid gap-x-8 gap-y-4 md:grid-cols-12">
            <Field label="Designation" className="md:col-span-4">
              <input className="profile-input bg-white shadow-sm" value={profession.designation || ''} onChange={e => updateProfession({ designation: e.target.value })} placeholder="Enter designation" disabled={isSubmitted} />
            </Field>
            <Field label="Specialization" className="md:col-span-4">
              <div className="relative w-full">
                <select className="profile-input pr-10 appearance-none bg-white shadow-sm" value={profession.qualification || ''} onChange={e => updateProfession({ qualification: e.target.value })} disabled={isSubmitted}>
                  <option value="">Select Specialization</option>
                  {SPECIALIZATION_OPTIONS.map(item => <option key={item}>{item}</option>)}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00558f] pointer-events-none" />
              </div>
            </Field>
            <Field label="Classes Handling" className="md:col-span-4">
              <input className="profile-input bg-white shadow-sm" value={profession.subjectHandling || ''} onChange={e => updateProfession({ subjectHandling: e.target.value })} placeholder="Enter classes handling" disabled={isSubmitted} />
            </Field>

            <InstitutionBox isSchool={true} profession={profession} updateProfession={updateProfession} disabled={isSubmitted} />

            <IdCardSection
              profession={profession}
              handleIdChange={handleIdChange}
              idRef={idRef}
              disabled={isSubmitted}
              professionalStatus={professionalStatus}
              onStatusChange={setProfessionalStatus}
            />
          </div>
        )
      case 'Research Scholar':
        return (
          <div className="grid gap-x-8 gap-y-4 md:grid-cols-12">
            <Field label="Register Number" className="md:col-span-3">
              <input className="profile-input bg-white shadow-sm" value={profession.registerNumber || ''} onChange={e => updateProfession({ registerNumber: e.target.value })} placeholder="Enter register no." disabled={isSubmitted} />
            </Field>
            <Field label="Department" className="md:col-span-3">
              <input className="profile-input bg-white shadow-sm" value={profession.department || ''} onChange={e => updateProfession({ department: e.target.value })} placeholder="Enter department" disabled={isSubmitted} />
            </Field>
            <Field label="Mode" className="md:col-span-3">
              <div className="relative w-full">
                <select className="profile-input pr-10 appearance-none bg-white shadow-sm" value={profession.mode || ''} onChange={e => updateProfession({ mode: e.target.value })} disabled={isSubmitted}>
                  <option value="">Select Mode</option>
                  {MODE_OPTIONS.map(item => <option key={item}>{item}</option>)}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00558f] pointer-events-none" />
              </div>
            </Field>
            <Field label="Supervisor Name" className="md:col-span-3">
              <input className="profile-input bg-white shadow-sm" value={profession.supervisorName || ''} onChange={e => updateProfession({ supervisorName: e.target.value })} placeholder="Enter supervisor name" disabled={isSubmitted} />
            </Field>

            <InstitutionBox isSchool={false} profession={profession} updateProfession={updateProfession} disabled={isSubmitted} />

            <IdCardSection
              profession={profession}
              handleIdChange={handleIdChange}
              idRef={idRef}
              disabled={isSubmitted}
              professionalStatus={professionalStatus}
              onStatusChange={setProfessionalStatus}
            />
          </div>
        )
      case 'Alumni':
        return (
          <div className="grid gap-x-8 gap-y-4 md:grid-cols-12">
            <Field label="Register Number" className="md:col-span-3">
              <input className="profile-input bg-white shadow-sm" value={profession.registerNumber || ''} onChange={e => updateProfession({ registerNumber: e.target.value })} placeholder="Enter Register Number" disabled={isSubmitted} />
            </Field>
            <Field label="Department" className="md:col-span-6">
              <div className="relative w-full">
                <select className="profile-input pr-10 appearance-none bg-white shadow-sm" value={profession.department || ''} onChange={e => updateProfession({ department: e.target.value })} disabled={isSubmitted}>
                  <option value="">Select Department</option>
                  {DEPARTMENT_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00558f] pointer-events-none" />
              </div>
            </Field>
            <Field label="Graduation Year" className="md:col-span-3">
              <input className="profile-input bg-white shadow-sm" value={profession.graduationYear || ''} onChange={e => updateProfession({ graduationYear: e.target.value })} placeholder="Graduation Year" disabled={isSubmitted} />
            </Field>

            <div className="md:col-span-12 border-t border-slate-200 pt-5 mt-2">
              <div className="text-sm font-bold text-[#00558f] mb-3">Current Profession</div>
            </div>

            <Field label="Designation" className="md:col-span-4">
              <input className="profile-input bg-white shadow-sm" value={profession.designation || ''} onChange={e => updateProfession({ designation: e.target.value })} placeholder="Enter designation" disabled={isSubmitted} />
            </Field>
            <Field label="Department" className="md:col-span-8">
              <input className="profile-input bg-white shadow-sm" value={profession.currentDepartment || ''} onChange={e => updateProfession({ currentDepartment: e.target.value })} placeholder="Enter department" disabled={isSubmitted} />
            </Field>
            <Field label="Organization" className="md:col-span-6">
              <input className="profile-input bg-white shadow-sm" value={profession.organization || ''} onChange={e => updateProfession({ organization: e.target.value })} placeholder="Enter organization" disabled={isSubmitted} />
            </Field>
            <Field label="City" className="md:col-span-3">
              <input className="profile-input bg-white shadow-sm" value={profession.city || ''} onChange={e => updateProfession({ city: e.target.value })} placeholder="Enter city" disabled={isSubmitted} />
            </Field>
            <Field label="Website" className="md:col-span-3">
              <input className="profile-input bg-white shadow-sm" value={profession.website || ''} onChange={e => updateProfession({ website: e.target.value })} placeholder="Enter website" disabled={isSubmitted} />
            </Field>

            <IdCardSection
              profession={profession}
              handleIdChange={handleIdChange}
              idRef={idRef}
              disabled={isSubmitted}
              professionalStatus={professionalStatus}
              onStatusChange={setProfessionalStatus}
            />
          </div>
        )
      case 'Scientist':
      case 'Government Official':
      case 'Industry Professional':
      case 'Other Profession':
        return (
          <div className="grid gap-x-8 gap-y-4 md:grid-cols-12">
            <Field label="Designation" className="md:col-span-4">
              <input className="profile-input bg-white shadow-sm" value={profession.designation || ''} onChange={e => updateProfession({ designation: e.target.value })} placeholder="Enter designation" disabled={isSubmitted} />
            </Field>
            <Field label="Department" className="md:col-span-8">
              <input className="profile-input bg-white shadow-sm" value={profession.department || ''} onChange={e => updateProfession({ department: e.target.value })} placeholder="Enter department" disabled={isSubmitted} />
            </Field>
            <Field label="Organization" className="md:col-span-6">
              <input className="profile-input bg-white shadow-sm" value={profession.organization || ''} onChange={e => updateProfession({ organization: e.target.value })} placeholder="Enter organization" disabled={isSubmitted} />
            </Field>
            <Field label="City" className="md:col-span-3">
              <input className="profile-input bg-white shadow-sm" value={profession.city || ''} onChange={e => updateProfession({ city: e.target.value })} placeholder="Enter city" disabled={isSubmitted} />
            </Field>
            <Field label="Website" className="md:col-span-3">
              <input className="profile-input bg-white shadow-sm" value={profession.website || ''} onChange={e => updateProfession({ website: e.target.value })} placeholder="Enter website" disabled={isSubmitted} />
            </Field>

            <IdCardSection
              profession={profession}
              handleIdChange={handleIdChange}
              idRef={idRef}
              disabled={isSubmitted}
              professionalStatus={professionalStatus}
              onStatusChange={setProfessionalStatus}
            />
          </div>
        )
      case 'General Public':
        return (
          <div className="grid gap-x-8 gap-y-4 md:grid-cols-12">
            <Field label="Occupation" className="md:col-span-3">
              <input className="profile-input bg-white shadow-sm" value={profession.occupation || ''} onChange={e => updateProfession({ occupation: e.target.value })} placeholder="Enter Occupation" disabled={isSubmitted} />
            </Field>
            <Field label="Organization (If any)" className="md:col-span-6">
              <input className="profile-input bg-white shadow-sm" value={profession.organization || ''} onChange={e => updateProfession({ organization: e.target.value })} placeholder="Enter Organization" disabled={isSubmitted} />
            </Field>
            <Field label="City" className="md:col-span-3">
              <input className="profile-input bg-white shadow-sm" value={profession.city || ''} onChange={e => updateProfession({ city: e.target.value })} placeholder="Enter City" disabled={isSubmitted} />
            </Field>

            <IdCardSection
              profession={profession}
              handleIdChange={handleIdChange}
              idRef={idRef}
              disabled={isSubmitted}
              professionalStatus={professionalStatus}
              onStatusChange={setProfessionalStatus}
            />
          </div>
        )
      default:
        return null
    }
  })()

  return (
    <div className="flex-1 overflow-auto bg-[#eaf2fb]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-7 md:px-6">
        <section className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-[24px] bg-gradient-to-br from-white via-[#f3f7fc] to-[#e6effa] text-center shadow-[0_22px_60px_rgba(15,23,42,0.15)] border border-slate-200">
          <div className="absolute inset-x-0 top-0 h-[6.4rem] bg-gradient-to-r from-[#00558f] to-[#007cd6]" />

          <div className="relative flex flex-col items-center pb-4 pt-3">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-slate-900 shadow-lg">
                {personal.photograph ? (
                  <img src={personal.photograph} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-7 w-7 text-blue-200" />
                )}
              </div>
              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#00558f] text-white shadow-lg hover:bg-[#004473]"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </div>

            <div className="mt-3">
              <h1 className="text-base font-bold text-[#00558f]">{displayName}</h1>
              <p className="mt-0.5 text-xs text-slate-500">{personal.email || 'email@example.com'}</p>
            </div>

            <div className="mt-4 flex w-full max-w-[340px] items-center justify-between text-xs font-semibold text-slate-500">
              <button
                type="button"
                onClick={() => setShowProfessionStep(false)}
                className={`flex-1 text-left transition-colors ${!showProfessionStep ? 'text-[#00558f]' : 'text-slate-500'}`}
              >
                Personal Details
              </button>
              <button
                type="button"
                onClick={() => setShowProfessionStep(true)}
                className={`flex-1 text-right transition-colors ${showProfessionStep ? 'text-[#00558f]' : 'text-slate-500'}`}
              >
                Professional Details
              </button>
            </div>

            <div className="mt-2 h-1.5 w-full max-w-[340px] rounded-full bg-slate-200">
              <div
                className="h-1.5 rounded-full bg-[#00558f] transition-all"
                style={{ width: showProfessionStep ? '100%' : '48%' }}
              />
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl rounded-[24px] bg-white p-6 shadow-[0_22px_60px_rgba(15,23,42,0.15)] border border-slate-200 md:p-8">
          {!showProfessionStep ? (
            <div className="flex flex-col gap-6">
              <div className="pb-1">
                <h2 className="text-lg font-bold text-[#00558f]">Personal Details</h2>
              </div>

              <fieldset disabled={personalStatus === 'submitted'} className="flex flex-col gap-6 min-w-0">
                <div className="grid gap-x-7 gap-y-4 md:grid-cols-12">
                  <Field label="Title" className="md:col-span-2">
                    <div className="relative w-full">
                      <select className="profile-input pr-10 appearance-none" value={personal.title} onChange={e => updatePersonal({ title: e.target.value })}>
                        <option value="" />
                        {TITLES.map(item => <option key={item}>{item}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00558f] pointer-events-none" />
                    </div>
                  </Field>
                  <Field label="First Name" className="md:col-span-5">
                    <input className="profile-input" value={personal.firstName} onChange={e => updatePersonal({ firstName: e.target.value })} placeholder="First name" />
                  </Field>
                  <Field label="Last Name" className="md:col-span-5">
                    <input className="profile-input" value={personal.lastName} onChange={e => updatePersonal({ lastName: e.target.value })} placeholder="Last name" />
                  </Field>
                </div>

                <div className="grid gap-x-7 gap-y-4 md:grid-cols-12 items-end">
                  <Field label="Gender" className="md:col-span-4">
                    <div className="flex gap-2.5">
                      {GENDERS.map(item => (
                        <PillButton
                          key={item}
                          label={item}
                          active={personal.gender === item}
                          onClick={() => updatePersonal({ gender: item })}
                          disabled={personalStatus === 'submitted'}
                        />
                      ))}
                    </div>
                  </Field>
                  <Field label="Differently Abled" className="md:col-span-3">
                    <div className="flex gap-2.5">
                      {YES_NO.map(item => (
                        <PillButton
                          key={item}
                          label={item}
                          active={(item === 'Yes') === personal.differentlyAbled}
                          onClick={() => updatePersonal({ differentlyAbled: item === 'Yes' })}
                          disabled={personalStatus === 'submitted'}
                        />
                      ))}
                    </div>
                  </Field>
                  <Field label="Date of Birth" className="md:col-span-3">
                    <div className="relative w-full">
                      <input
                        type="date"
                        className="profile-input pr-10"
                        value={personal.dateOfBirth}
                        onChange={e => updatePersonal({ dateOfBirth: e.target.value, age: calculateAge(e.target.value) })}
                      />
                      <Calendar className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00558f] pointer-events-none" />
                    </div>
                  </Field>
                  <Field label="Age" className="md:col-span-2">
                    <input className="profile-input bg-slate-50 cursor-default" value={displayAge} readOnly placeholder="Calculated age" />
                  </Field>
                </div>

                <div className="mt-2">
                  <div className="pb-1 mb-4">
                    <h3 className="text-lg font-bold text-[#00558f]">Contact Details</h3>
                  </div>
                  <div className="grid gap-x-10 gap-y-4 md:grid-cols-12">
                    <Field label="Mobile Number" className="md:col-span-3">
                      <input className="profile-input" value={personal.mobileNumber} onChange={e => updatePersonal({ mobileNumber: e.target.value })} placeholder="Enter mobile no." />
                    </Field>
                    <Field label="WhatsApp Number" className="md:col-span-3">
                      <input className="profile-input" value={personal.whatsappNumber} onChange={e => updatePersonal({ whatsappNumber: e.target.value })} placeholder="Enter WhatsApp no." />
                    </Field>
                    <Field label="Email" className="md:col-span-6">
                      <input type="email" className="profile-input" value={personal.email} onChange={e => updatePersonal({ email: e.target.value })} placeholder="Enter email address" />
                    </Field>
                  </div>
                </div>

                <div className="mt-2">
                  <div className="pb-1 mb-4">
                    <h3 className="text-lg font-bold text-[#00558f]">Address for Communication</h3>
                  </div>
                  <div className="grid gap-x-7 gap-y-4 md:grid-cols-12">
                    <Field label="Address" className="md:col-span-4">
                      <input className="profile-input" value={personal.address} onChange={e => updatePersonal({ address: e.target.value })} placeholder="Enter address line" />
                    </Field>
                    <Field label="City" className="md:col-span-2">
                      <input className="profile-input" value={personal.city} onChange={e => updatePersonal({ city: e.target.value })} placeholder="City" />
                    </Field>
                    <Field label="State" className="md:col-span-2">
                      <input className="profile-input" value={personal.state} onChange={e => updatePersonal({ state: e.target.value })} placeholder="State" />
                    </Field>
                    <Field label="Country" className="md:col-span-2">
                      <input className="profile-input" value={personal.country} onChange={e => updatePersonal({ country: e.target.value })} placeholder="Country" />
                    </Field>
                    <Field label="PIN" className="md:col-span-2">
                      <input className="profile-input" value={personal.pin} onChange={e => updatePersonal({ pin: e.target.value })} placeholder="PIN code" />
                    </Field>
                  </div>
                </div>
              </fieldset>

              <div className="mt-2">
                <div className="pb-1 mb-4">
                  <h3 className="text-lg font-bold text-[#00558f]">Photograph</h3>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="relative w-[180px]">
                    <select className="profile-input pr-10 appearance-none" aria-label="Photograph type" disabled={personalStatus === 'submitted'}>
                      <option value="">Select Photo Type</option>
                      <option>Passport Size</option>
                      <option>ID Photo</option>
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00558f] pointer-events-none" />
                  </div>
                  <button
                    type="button"
                    onClick={() => photoRef.current?.click()}
                    disabled={personalStatus === 'submitted'}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#e2eefa] border border-[#a0c5eb] text-[#00558f] hover:bg-[#d4e7f8] px-5 text-sm font-semibold transition-all shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Upload className="h-4 w-4 text-[#00558f]" />
                    Choose File
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (personalStatus === 'initial') setPersonalStatus('submitted')
                      else if (personalStatus === 'submitted') setPersonalStatus('editing')
                      else setPersonalStatus('submitted')
                    }}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-[#00558f] hover:bg-[#004473] text-white px-5 text-sm font-semibold transition-all shadow-sm ml-auto"
                  >
                    {personalStatus === 'initial' ? 'Submit' : personalStatus === 'submitted' ? 'Edit Now' : 'Submit Now'}
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="pb-1">
                <h2 className="text-lg font-bold text-[#00558f]">Profession Details</h2>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 pb-6 sm:grid-cols-3 lg:grid-cols-5 border-b border-slate-200">
                {PROFESSIONS.map(item => (
                  <PillButton
                    key={item}
                    label={item}
                    active={profession.professionType === item}
                    disabled={professionalStatus === 'submitted'}
                    onClick={() => {
                      updateProfession({ professionType: item })
                      setShowProfessionDetails(true)
                    }}
                  />
                ))}
              </div>

              {showProfessionDetails && profession.professionType ? (
                <div className="space-y-6">
                  <div>
                    <div className="pb-1 mb-4">
                      <h4 className="text-lg font-bold text-[#00558f]">
                        {profession.professionType} Details
                      </h4>
                    </div>
                    <div>{professionFields}</div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                  <p className="text-sm font-semibold text-slate-500">Select a profession to enter details.</p>
                </div>
              )}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
