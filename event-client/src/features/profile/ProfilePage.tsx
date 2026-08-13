import { Camera, Upload, User, Calendar, ChevronDown, X } from 'lucide-react';
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
  useId,
  type ChangeEvent,
  type ReactNode,
} from 'react';

import { useProfile } from '../../contexts/ProfileContext';
import './ProfilePage.css';

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
];

const SCHOOL_CLASS_OPTIONS = [
  '1st Std',
  '2nd Std',
  '3rd Std',
  '4th Std',
  '5th Std',
  '6th Std',
  '7th Std',
  '8th Std',
  '9th Std',
  '10th Std',
  '11th Std',
  '12th Std',
];
const SPECIALIZATION_OPTIONS = [
  'Mathematics',
  'Science',
  'English',
  'Tamil',
  'Social Science',
  'Computer Science',
  'Other',
];

const TITLES = ['Mr', 'Ms', 'Mrs', 'Dr', 'Prof'];
const GENDERS = ['Male', 'Female', 'Other'];
const YES_NO = ['Yes', 'No'];
const DEGREE_OPTIONS = ['B.E / B.Tech', 'M.E / M.Tech', 'MBA', 'MCA', 'Ph.D', 'Diploma', 'Other'];
const DEPARTMENT_OPTIONS = [
  { value: 'CSE', label: 'Computer Science & Engineering' },
  { value: 'ECE', label: 'Electronics & Communication' },
  { value: 'EEE', label: 'Electrical & Electronics' },
  { value: 'MECH', label: 'Mechanical Engineering' },
  { value: 'CIVIL', label: 'Civil Engineering' },
  { value: 'IT', label: 'Information Technology' },
  { value: 'OTHER', label: 'Other' },
];
const YEAR_OPTIONS = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'PG 1st Year', 'PG 2nd Year'];
const MODE_OPTIONS = ['Full Time', 'Part Time'];
const INSTITUTION_OPTIONS = [
  'Anna University',
  'SRM Institute of Science and Technology',
  'Vellore Institute of Technology',
  'Other',
];
const SCHOOL_OPTIONS = [
  'Government Higher Secondary School',
  'St. Joseph School',
  'National Public School',
  'Other',
];

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className="profile-page-1">{label}</span>
      {children}
    </label>
  );
}

function PillButton({
  label,
  active,
  onClick,
  disabled = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-10 rounded-xl px-5 text-xs font-semibold transition-all border ${
        active
          ? 'bg-[#00558f] border-[#00558f] text-white shadow-sm'
          : 'bg-[#f1f6fa] border-slate-300 text-[#00558f] hover:bg-[#e2eefa]'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      {label}
    </button>
  );
}

function InstitutionBox({
  isSchool = false,
  profession,
  updateProfession,
  disabled = false,
  options,
  onAddClick,
}: {
  isSchool?: boolean;
  profession: any;
  updateProfession: (data: any) => void;
  disabled?: boolean;
  options: string[];
  onAddClick: () => void;
}) {
  const selectId = useId();
  const categoryId = useId();
  const addressId = useId();
  const cityId = useId();
  const stateId = useId();

  return (
    <div className="profile-page-2">
      <div className="profile-page-3">
        <label htmlFor={selectId} className="profile-page-4">
          {isSchool ? 'School Name' : 'Institution'}
        </label>
        <div className="profile-page-5 flex gap-3">
          <div className="relative flex-1">
            <select
              id={selectId}
              className="profile-select-custom w-full"
              value={isSchool ? profession.school || '' : profession.institution || ''}
              disabled={disabled}
              onChange={(e) => {
                const val = e.target.value;
                if (isSchool) {
                  updateProfession({ school: val, institution: val });
                } else {
                  updateProfession({ institution: val });
                }
              }}
            >
              <option value="">{isSchool ? 'Select School' : 'Select Institution'}</option>
              {options.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <ChevronDown className="profile-select-chevron" />
          </div>
          <button
            type="button"
            onClick={onAddClick}
            className="h-10 px-4 text-xs font-semibold rounded-xl bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-800 transition-colors whitespace-nowrap shadow-sm"
          >
            Add New {isSchool ? 'School' : 'Institution'}
          </button>
        </div>

        <div className="profile-page-8">
          <label htmlFor={categoryId} className="profile-page-9">
            Category
          </label>
          <input
            id={categoryId}
            className="profile-input-custom"
            value={profession.institutionCategory || ''}
            disabled={disabled}
            onChange={(e) => updateProfession({ institutionCategory: e.target.value })}
            placeholder="Category"
          />
        </div>
        <div className="profile-page-11">
          <label htmlFor={addressId} className="profile-page-12">
            Address
          </label>
          <input
            id={addressId}
            className="profile-input-custom"
            value={profession.institutionAddress || ''}
            disabled={disabled}
            onChange={(e) => updateProfession({ institutionAddress: e.target.value })}
            placeholder="Address"
          />
        </div>
        <div className="profile-page-14">
          <label htmlFor={cityId} className="profile-page-15">
            City
          </label>
          <input
            id={cityId}
            className="profile-input-custom"
            value={profession.institutionCity || ''}
            disabled={disabled}
            onChange={(e) => updateProfession({ institutionCity: e.target.value })}
            placeholder="City"
          />
        </div>
        <div className="profile-page-17">
          <label htmlFor={stateId} className="profile-page-18">
            State
          </label>
          <input
            id={stateId}
            className="profile-input-custom"
            value={profession.institutionState || ''}
            disabled={disabled}
            onChange={(e) => updateProfession({ institutionState: e.target.value })}
            placeholder="State"
          />
        </div>
      </div>
    </div>
  );
}

function IdCardSection({
  profession,
  handleIdChange,
  idRef,
  disabled = false,
  professionalStatus,
  onStatusChange,
}: {
  profession: any;
  handleIdChange: (e: ChangeEvent<HTMLInputElement>) => void;
  idRef: React.RefObject<HTMLInputElement>;
  disabled?: boolean;
  professionalStatus: 'initial' | 'submitted' | 'editing';
  onStatusChange: (status: 'initial' | 'submitted' | 'editing') => void;
}) {
  return (
    <div className="profile-page-20">
      <div className="profile-page-21">ID Card</div>
      <div className="profile-page-22">
        <button
          type="button"
          onClick={() => idRef.current?.click()}
          disabled={disabled}
          className="profile-page-23"
        >
          <Upload className="profile-page-24" />
          Choose File
        </button>
        {profession.idCard ? (
          <div className="profile-page-25">
            <img src={profession.idCard} alt="ID Card Preview" className="profile-page-26" />
            <span className="profile-page-27">File uploaded</span>
          </div>
        ) : null}
        <input
          ref={idRef}
          type="file"
          accept="image/*"
          className="profile-page-28"
          onChange={handleIdChange}
          disabled={disabled}
          aria-label="Upload ID Card"
        />

        <button
          type="button"
          onClick={() => {
            if (professionalStatus === 'initial') onStatusChange('submitted');
            else if (professionalStatus === 'submitted') onStatusChange('editing');
            else onStatusChange('submitted');
          }}
          className="profile-page-29"
        >
          {professionalStatus === 'initial'
            ? 'Submit'
            : professionalStatus === 'submitted'
              ? 'Edit Now'
              : 'Submit Now'}
        </button>
      </div>
    </div>
  );
}

function calculateAge(dateString: string) {
  if (!dateString) return '';
  const dob = new Date(dateString);
  if (Number.isNaN(dob.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age -= 1;
  return String(age);
}

export default function ProfilePage() {
  const { personal, profession, updatePersonal, updateProfession } = useProfile();

  const [institutions, setInstitutions] = useState(INSTITUTION_OPTIONS);
  const [schools, setSchools] = useState(SCHOOL_OPTIONS);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalIsSchool, setModalIsSchool] = useState(false);
  const [modalFormData, setModalFormData] = useState({
    name: '',
    code: '',
    category: '',
    address: '',
    city: '',
    district: '',
    state: '',
    website: '',
  });

  const handleOpenAddModal = (isSchool: boolean) => {
    setModalIsSchool(isSchool);
    setModalFormData({
      name: '',
      code: '',
      category: '',
      address: '',
      city: '',
      district: '',
      state: '',
      website: '',
    });
    setIsAddModalOpen(true);
  };

  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalFormData.name.trim()) return;

    const newName = modalFormData.name.trim();
    setProfessionalStatus('editing');

    if (modalIsSchool) {
      if (!schools.includes(newName)) {
        setSchools((prev) => [newName, ...prev]);
      }
      updateProfession({
        school: newName,
        institution: newName,
        institutionCategory: modalFormData.category,
        institutionAddress: modalFormData.address,
        institutionCity: modalFormData.city,
        institutionState: modalFormData.state,
      });
    } else {
      if (!institutions.includes(newName)) {
        setInstitutions((prev) => [newName, ...prev]);
      }
      updateProfession({
        institution: newName,
        institutionCategory: modalFormData.category,
        institutionAddress: modalFormData.address,
        institutionCity: modalFormData.city,
        institutionState: modalFormData.state,
      });
    }

    setIsAddModalOpen(false);
  };

  const [showProfessionStep, setShowProfessionStep] = useState(false);
  const [showProfessionDetails, setShowProfessionDetails] = useState(
    () => !!profession.professionType,
  );
  const [personalStatus, setPersonalStatus] = useState<'initial' | 'submitted' | 'editing'>(() => {
    try {
      const stored = localStorage.getItem('ep_personal_status');
      if (stored === 'submitted' || stored === 'editing') return stored;
    } catch (err) {
      void err;
    }
    return personal.firstName ? 'submitted' : 'initial';
  });

  const [professionalStatus, setProfessionalStatus] = useState<'initial' | 'submitted' | 'editing'>(
    () => {
      try {
        const stored = localStorage.getItem('ep_professional_status');
        if (stored === 'submitted' || stored === 'editing') return stored;
      } catch (err) {
        void err;
      }
      return profession.professionType ? 'submitted' : 'initial';
    },
  );

  useEffect(() => {
    try {
      localStorage.setItem('ep_personal_status', personalStatus);
    } catch (err) {
      void err;
    }
  }, [personalStatus]);

  useEffect(() => {
    try {
      localStorage.setItem('ep_professional_status', professionalStatus);
    } catch (err) {
      void err;
    }
  }, [professionalStatus]);

  const photoRef = useRef<HTMLInputElement>(null);
  const idRef = useRef<HTMLInputElement>(null);

  const displayName = useMemo(() => {
    const fullName = [personal.firstName, personal.lastName].filter(Boolean).join(' ').trim();
    if (fullName) return [personal.title, fullName].filter(Boolean).join(' ').trim();
    return 'Your Name';
  }, [personal.firstName, personal.lastName, personal.title]);

  const displayAge = personal.age || calculateAge(personal.dateOfBirth);

  const handlePhotoChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => updatePersonal({ photograph: ev.target?.result as string });
      reader.readAsDataURL(file);
    },
    [updatePersonal],
  );

  const handleIdChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => updateProfession({ idCard: ev.target?.result as string });
      reader.readAsDataURL(file);
    },
    [updateProfession],
  );

  const professionFields = (() => {
    const isSubmitted = professionalStatus === 'submitted';

    switch (profession.professionType) {
      case 'College Student':
        return (
          <div className="profile-page-30">
            <Field label="Degree" className="md:col-span-3">
              <div className="profile-page-32">
                <select
                  className="profile-select-custom"
                  value={profession.degree || ''}
                  onChange={(e) => updateProfession({ degree: e.target.value })}
                  disabled={isSubmitted}
                >
                  <option value="">Select Degree</option>
                  {DEGREE_OPTIONS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <ChevronDown className="profile-select-chevron" />
              </div>
            </Field>
            <Field label="Department" className="profile-page-35">
              <div className="profile-page-36">
                <select
                  className="profile-select-custom"
                  value={profession.department || ''}
                  onChange={(e) => updateProfession({ department: e.target.value })}
                  disabled={isSubmitted}
                >
                  <option value="">Select Department</option>
                  {DEPARTMENT_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="profile-select-chevron" />
              </div>
            </Field>
            <Field label="Year of Study" className="md:col-span-3">
              <div className="profile-page-40">
                <select
                  className="profile-select-custom"
                  value={profession.yearOfStudy || ''}
                  onChange={(e) => updateProfession({ yearOfStudy: e.target.value })}
                  disabled={isSubmitted}
                >
                  <option value="">Select Year</option>
                  {YEAR_OPTIONS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <ChevronDown className="profile-select-chevron" />
              </div>
            </Field>

            <InstitutionBox
              isSchool={false}
              profession={profession}
              updateProfession={updateProfession}
              disabled={isSubmitted}
              options={institutions}
              onAddClick={() => handleOpenAddModal(false)}
            />

            <Field label="Contact Faculty Name" className="profile-page-43">
              <input
                className="profile-page-44"
                value={profession.contactFacultyName || ''}
                onChange={(e) => updateProfession({ contactFacultyName: e.target.value })}
                placeholder="Enter contact faculty name"
                disabled={isSubmitted}
              />
            </Field>
            <Field label="Faculty Mobile" className="profile-page-45">
              <input
                className="profile-page-46"
                value={profession.facultyMobile || ''}
                onChange={(e) => updateProfession({ facultyMobile: e.target.value })}
                placeholder="Enter faculty mobile"
                disabled={isSubmitted}
              />
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
        );
      case 'Faculty Members':
        return (
          <div className="profile-page-47">
            <Field label="Designation" className="profile-page-48">
              <input
                className="profile-page-49"
                value={profession.designation || ''}
                onChange={(e) => updateProfession({ designation: e.target.value })}
                placeholder="Enter designation"
                disabled={isSubmitted}
              />
            </Field>
            <Field label="Department" className="profile-page-50">
              <div className="profile-page-51">
                <select
                  className="profile-page-52"
                  value={profession.department || ''}
                  onChange={(e) => updateProfession({ department: e.target.value })}
                  disabled={isSubmitted}
                >
                  <option value="">Select Department</option>
                  {DEPARTMENT_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="profile-page-53" />
              </div>
            </Field>

            <InstitutionBox
              isSchool={false}
              profession={profession}
              updateProfession={updateProfession}
              disabled={isSubmitted}
              options={institutions}
              onAddClick={() => handleOpenAddModal(false)}
            />

            <IdCardSection
              profession={profession}
              handleIdChange={handleIdChange}
              idRef={idRef}
              disabled={isSubmitted}
              professionalStatus={professionalStatus}
              onStatusChange={setProfessionalStatus}
            />
          </div>
        );
      case 'School Student':
        return (
          <div className="profile-page-54">
            <Field label="Class" className="profile-page-55">
              <div className="profile-page-56">
                <select
                  className="profile-page-57"
                  value={profession.classGrade || ''}
                  onChange={(e) => updateProfession({ classGrade: e.target.value })}
                  disabled={isSubmitted}
                >
                  <option value="">Select Class</option>
                  {SCHOOL_CLASS_OPTIONS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <ChevronDown className="profile-page-58" />
              </div>
            </Field>
            <Field label="Section" className="profile-page-59">
              <input
                className="profile-page-60"
                value={profession.section || ''}
                onChange={(e) => updateProfession({ section: e.target.value })}
                placeholder="Enter section"
                disabled={isSubmitted}
              />
            </Field>
            <Field label="Contact Teacher Name" className="profile-page-61">
              <input
                className="profile-page-62"
                value={profession.teacherCoordinatorName || ''}
                onChange={(e) => updateProfession({ teacherCoordinatorName: e.target.value })}
                placeholder="Enter contact teacher name"
                disabled={isSubmitted}
              />
            </Field>
            <Field label="Teacher Mobile" className="profile-page-63">
              <input
                className="profile-page-64"
                value={profession.teacherCoordinatorContact || ''}
                onChange={(e) => updateProfession({ teacherCoordinatorContact: e.target.value })}
                placeholder="Enter teacher mobile"
                disabled={isSubmitted}
              />
            </Field>

            <InstitutionBox
              isSchool={true}
              profession={profession}
              updateProfession={updateProfession}
              disabled={isSubmitted}
              options={schools}
              onAddClick={() => handleOpenAddModal(true)}
            />

            <IdCardSection
              profession={profession}
              handleIdChange={handleIdChange}
              idRef={idRef}
              disabled={isSubmitted}
              professionalStatus={professionalStatus}
              onStatusChange={setProfessionalStatus}
            />
          </div>
        );
      case 'School Teacher':
        return (
          <div className="profile-page-65">
            <Field label="Designation" className="profile-page-66">
              <input
                className="profile-page-67"
                value={profession.designation || ''}
                onChange={(e) => updateProfession({ designation: e.target.value })}
                placeholder="Enter designation"
                disabled={isSubmitted}
              />
            </Field>
            <Field label="Specialization" className="profile-page-68">
              <div className="profile-page-69">
                <select
                  className="profile-page-70"
                  value={profession.qualification || ''}
                  onChange={(e) => updateProfession({ qualification: e.target.value })}
                  disabled={isSubmitted}
                >
                  <option value="">Select Specialization</option>
                  {SPECIALIZATION_OPTIONS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <ChevronDown className="profile-page-71" />
              </div>
            </Field>
            <Field label="Classes Handling" className="profile-page-72">
              <input
                className="profile-page-73"
                value={profession.subjectHandling || ''}
                onChange={(e) => updateProfession({ subjectHandling: e.target.value })}
                placeholder="Enter classes handling"
                disabled={isSubmitted}
              />
            </Field>

            <InstitutionBox
              isSchool={true}
              profession={profession}
              updateProfession={updateProfession}
              disabled={isSubmitted}
              options={schools}
              onAddClick={() => handleOpenAddModal(true)}
            />

            <IdCardSection
              profession={profession}
              handleIdChange={handleIdChange}
              idRef={idRef}
              disabled={isSubmitted}
              professionalStatus={professionalStatus}
              onStatusChange={setProfessionalStatus}
            />
          </div>
        );
      case 'Research Scholar':
        return (
          <div className="profile-page-74">
            <Field label="Register Number" className="profile-page-75">
              <input
                className="profile-page-76"
                value={profession.registerNumber || ''}
                onChange={(e) => updateProfession({ registerNumber: e.target.value })}
                placeholder="Enter register no."
                disabled={isSubmitted}
              />
            </Field>
            <Field label="Department" className="profile-page-77">
              <input
                className="profile-page-78"
                value={profession.department || ''}
                onChange={(e) => updateProfession({ department: e.target.value })}
                placeholder="Enter department"
                disabled={isSubmitted}
              />
            </Field>
            <Field label="Mode" className="profile-page-79">
              <div className="profile-page-80">
                <select
                  className="profile-page-81"
                  value={profession.mode || ''}
                  onChange={(e) => updateProfession({ mode: e.target.value })}
                  disabled={isSubmitted}
                >
                  <option value="">Select Mode</option>
                  {MODE_OPTIONS.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <ChevronDown className="profile-page-82" />
              </div>
            </Field>
            <Field label="Supervisor Name" className="profile-page-83">
              <input
                className="profile-page-84"
                value={profession.supervisorName || ''}
                onChange={(e) => updateProfession({ supervisorName: e.target.value })}
                placeholder="Enter supervisor name"
                disabled={isSubmitted}
              />
            </Field>

            <InstitutionBox
              isSchool={false}
              profession={profession}
              updateProfession={updateProfession}
              disabled={isSubmitted}
              options={institutions}
              onAddClick={() => handleOpenAddModal(false)}
            />

            <IdCardSection
              profession={profession}
              handleIdChange={handleIdChange}
              idRef={idRef}
              disabled={isSubmitted}
              professionalStatus={professionalStatus}
              onStatusChange={setProfessionalStatus}
            />
          </div>
        );
      case 'Alumni':
        return (
          <div className="profile-page-85">
            <Field label="Register Number" className="profile-page-86">
              <input
                className="profile-page-87"
                value={profession.registerNumber || ''}
                onChange={(e) => updateProfession({ registerNumber: e.target.value })}
                placeholder="Enter Register Number"
                disabled={isSubmitted}
              />
            </Field>
            <Field label="Department" className="profile-page-88">
              <div className="profile-page-89">
                <select
                  className="profile-page-90"
                  value={profession.department || ''}
                  onChange={(e) => updateProfession({ department: e.target.value })}
                  disabled={isSubmitted}
                >
                  <option value="">Select Department</option>
                  {DEPARTMENT_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="profile-page-91" />
              </div>
            </Field>
            <Field label="Graduation Year" className="profile-page-92">
              <input
                className="profile-page-93"
                value={profession.graduationYear || ''}
                onChange={(e) => updateProfession({ graduationYear: e.target.value })}
                placeholder="Graduation Year"
                disabled={isSubmitted}
              />
            </Field>

            <div className="profile-page-94">
              <div className="profile-page-95">Current Profession</div>
            </div>

            <Field label="Designation" className="profile-page-96">
              <input
                className="profile-page-97"
                value={profession.designation || ''}
                onChange={(e) => updateProfession({ designation: e.target.value })}
                placeholder="Enter designation"
                disabled={isSubmitted}
              />
            </Field>
            <Field label="Department" className="profile-page-98">
              <input
                className="profile-page-99"
                value={profession.currentDepartment || ''}
                onChange={(e) => updateProfession({ currentDepartment: e.target.value })}
                placeholder="Enter department"
                disabled={isSubmitted}
              />
            </Field>
            <Field label="Organization" className="profile-page-100">
              <input
                className="profile-page-101"
                value={profession.organization || ''}
                onChange={(e) => updateProfession({ organization: e.target.value })}
                placeholder="Enter organization"
                disabled={isSubmitted}
              />
            </Field>
            <Field label="City" className="profile-page-102">
              <input
                className="profile-page-103"
                value={profession.city || ''}
                onChange={(e) => updateProfession({ city: e.target.value })}
                placeholder="Enter city"
                disabled={isSubmitted}
              />
            </Field>
            <Field label="Website" className="profile-page-104">
              <input
                className="profile-page-105"
                value={profession.website || ''}
                onChange={(e) => updateProfession({ website: e.target.value })}
                placeholder="Enter website"
                disabled={isSubmitted}
              />
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
        );
      case 'Scientist':
      case 'Government Official':
      case 'Industry Professional':
      case 'Other Profession':
        return (
          <div className="profile-page-106">
            <Field label="Designation" className="profile-page-107">
              <input
                className="profile-page-108"
                value={profession.designation || ''}
                onChange={(e) => updateProfession({ designation: e.target.value })}
                placeholder="Enter designation"
                disabled={isSubmitted}
              />
            </Field>
            <Field label="Department" className="profile-page-109">
              <input
                className="profile-page-110"
                value={profession.department || ''}
                onChange={(e) => updateProfession({ department: e.target.value })}
                placeholder="Enter department"
                disabled={isSubmitted}
              />
            </Field>
            <Field label="Organization" className="profile-page-111">
              <input
                className="profile-page-112"
                value={profession.organization || ''}
                onChange={(e) => updateProfession({ organization: e.target.value })}
                placeholder="Enter organization"
                disabled={isSubmitted}
              />
            </Field>
            <Field label="City" className="profile-page-113">
              <input
                className="profile-page-114"
                value={profession.city || ''}
                onChange={(e) => updateProfession({ city: e.target.value })}
                placeholder="Enter city"
                disabled={isSubmitted}
              />
            </Field>
            <Field label="Website" className="profile-page-115">
              <input
                className="profile-page-116"
                value={profession.website || ''}
                onChange={(e) => updateProfession({ website: e.target.value })}
                placeholder="Enter website"
                disabled={isSubmitted}
              />
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
        );
      case 'General Public':
        return (
          <div className="profile-page-117">
            <Field label="Occupation" className="profile-page-118">
              <input
                className="profile-page-119"
                value={profession.occupation || ''}
                onChange={(e) => updateProfession({ occupation: e.target.value })}
                placeholder="Enter Occupation"
                disabled={isSubmitted}
              />
            </Field>
            <Field label="Organization (If any)" className="profile-page-120">
              <input
                className="profile-page-121"
                value={profession.organization || ''}
                onChange={(e) => updateProfession({ organization: e.target.value })}
                placeholder="Enter Organization"
                disabled={isSubmitted}
              />
            </Field>
            <Field label="City" className="profile-page-122">
              <input
                className="profile-page-123"
                value={profession.city || ''}
                onChange={(e) => updateProfession({ city: e.target.value })}
                placeholder="Enter City"
                disabled={isSubmitted}
              />
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
        );
      default:
        return null;
    }
  })();

  return (
    <div className="profile-page-124">
      <div className="profile-page-125">
        <section className="profile-page-126">
          <div className="profile-page-127" />

          <div className="profile-page-128">
            <div className="profile-page-129">
              <div className="profile-page-130">
                {personal.photograph ? (
                  <img src={personal.photograph} alt="Profile" className="profile-page-131" />
                ) : (
                  <User className="profile-page-132" />
                )}
              </div>
              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                className="profile-page-133"
                aria-label="Upload profile photograph"
              >
                <Camera className="profile-page-134" />
              </button>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                className="profile-page-135"
                onChange={handlePhotoChange}
                aria-label="Upload photograph file"
              />
            </div>

            <div className="profile-page-136">
              <h1 className="profile-page-137">{displayName}</h1>
              <p className="profile-page-138">{personal.email || 'email@example.com'}</p>
            </div>

            <div className="profile-page-139">
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

            <div className="profile-page-140">
              <div
                className="profile-page-141"
                style={{ width: showProfessionStep ? '100%' : '48%' }}
              />
            </div>
          </div>
        </section>

        <section className="profile-page-142">
          {!showProfessionStep ? (
            <div className="profile-page-143">
              <div className="profile-page-144">
                <h2 className="profile-page-145">Personal Details</h2>
              </div>

              <fieldset disabled={personalStatus === 'submitted'} className="profile-page-146">
                <div className="profile-page-147">
                  <Field label="Title" className="profile-page-148">
                    <div className="profile-page-149">
                      <select
                        className="profile-page-150"
                        value={personal.title}
                        onChange={(e) => updatePersonal({ title: e.target.value })}
                      >
                        <option value="" />
                        {TITLES.map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                      <ChevronDown className="profile-page-151" />
                    </div>
                  </Field>
                  <Field label="First Name" className="profile-page-152">
                    <input
                      className="profile-page-153"
                      value={personal.firstName}
                      onChange={(e) => updatePersonal({ firstName: e.target.value })}
                      placeholder="First name"
                    />
                  </Field>
                  <Field label="Last Name" className="profile-page-154">
                    <input
                      className="profile-page-155"
                      value={personal.lastName}
                      onChange={(e) => updatePersonal({ lastName: e.target.value })}
                      placeholder="Last name"
                    />
                  </Field>
                </div>

                <div className="profile-page-156">
                  <Field label="Gender" className="profile-page-157">
                    <div className="profile-page-158">
                      {GENDERS.map((item) => (
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
                  <Field label="Differently Abled" className="profile-page-159">
                    <div className="profile-page-160">
                      {YES_NO.map((item) => (
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
                  <Field label="Date of Birth" className="profile-page-161">
                    <div className="profile-page-162">
                      <input
                        type="date"
                        className="profile-page-163"
                        value={personal.dateOfBirth}
                        onChange={(e) =>
                          updatePersonal({
                            dateOfBirth: e.target.value,
                            age: calculateAge(e.target.value),
                          })
                        }
                      />
                      <Calendar className="profile-page-164" />
                    </div>
                  </Field>
                  <Field label="Age" className="profile-page-165">
                    <input
                      className="profile-page-166"
                      value={displayAge}
                      readOnly
                      placeholder="Calculated age"
                    />
                  </Field>
                </div>

                <div className="profile-page-167">
                  <div className="profile-page-168">
                    <h3 className="profile-page-169">Contact Details</h3>
                  </div>
                  <div className="profile-page-170">
                    <Field label="Mobile Number" className="profile-page-171">
                      <input
                        className="profile-page-172"
                        value={personal.mobileNumber}
                        onChange={(e) => updatePersonal({ mobileNumber: e.target.value })}
                        placeholder="Enter mobile no."
                      />
                    </Field>
                    <Field label="WhatsApp Number" className="profile-page-173">
                      <input
                        className="profile-page-174"
                        value={personal.whatsappNumber}
                        onChange={(e) => updatePersonal({ whatsappNumber: e.target.value })}
                        placeholder="Enter WhatsApp no."
                      />
                    </Field>
                    <Field label="Email" className="profile-page-175">
                      <input
                        type="email"
                        className="profile-page-176"
                        value={personal.email}
                        onChange={(e) => updatePersonal({ email: e.target.value })}
                        placeholder="Enter email address"
                      />
                    </Field>
                  </div>
                </div>

                <div className="profile-page-177">
                  <div className="profile-page-178">
                    <h3 className="profile-page-179">Address for Communication</h3>
                  </div>
                  <div className="profile-page-180">
                    <Field label="Address" className="profile-page-181">
                      <input
                        className="profile-page-182"
                        value={personal.address}
                        onChange={(e) => updatePersonal({ address: e.target.value })}
                        placeholder="Enter address line"
                      />
                    </Field>
                    <Field label="City" className="profile-page-183">
                      <input
                        className="profile-page-184"
                        value={personal.city}
                        onChange={(e) => updatePersonal({ city: e.target.value })}
                        placeholder="City"
                      />
                    </Field>
                    <Field label="State" className="profile-page-185">
                      <input
                        className="profile-page-186"
                        value={personal.state}
                        onChange={(e) => updatePersonal({ state: e.target.value })}
                        placeholder="State"
                      />
                    </Field>
                    <Field label="Country" className="profile-page-187">
                      <input
                        className="profile-page-188"
                        value={personal.country}
                        onChange={(e) => updatePersonal({ country: e.target.value })}
                        placeholder="Country"
                      />
                    </Field>
                    <Field label="PIN" className="profile-page-189">
                      <input
                        className="profile-page-190"
                        value={personal.pin}
                        onChange={(e) => updatePersonal({ pin: e.target.value })}
                        placeholder="PIN code"
                      />
                    </Field>
                  </div>
                </div>
              </fieldset>

              <div className="profile-page-191">
                <div className="profile-page-192">
                  <h3 className="profile-page-193">Photograph</h3>
                </div>
                <div className="profile-page-194">
                  <button
                    type="button"
                    onClick={() => photoRef.current?.click()}
                    disabled={personalStatus === 'submitted'}
                    className="profile-page-198"
                  >
                    <Upload className="profile-page-199" />
                    Choose File
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (personalStatus === 'initial') setPersonalStatus('submitted');
                      else if (personalStatus === 'submitted') setPersonalStatus('editing');
                      else setPersonalStatus('submitted');
                    }}
                    className="profile-page-200"
                  >
                    {personalStatus === 'initial'
                      ? 'Submit'
                      : personalStatus === 'submitted'
                        ? 'Edit Now'
                        : 'Submit Now'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="profile-page-201">
              <div className="profile-page-202">
                <h2 className="profile-page-203">Profession Details</h2>
              </div>

              <div className="profile-page-204">
                {PROFESSIONS.map((item) => (
                  <PillButton
                    key={item}
                    label={item}
                    active={profession.professionType === item}
                    onClick={() => {
                      updateProfession({ professionType: item });
                      setShowProfessionDetails(true);
                    }}
                  />
                ))}
              </div>

              {showProfessionDetails && profession.professionType ? (
                <div className="profile-page-205">
                  <div>
                    <div className="profile-page-206">
                      <h4 className="profile-page-207">{profession.professionType} Details</h4>
                    </div>
                    <div>{professionFields}</div>
                  </div>
                </div>
              ) : (
                <div className="profile-page-208">
                  <p className="profile-page-209">Select a profession to enter details.</p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between rounded-xl bg-[#00558f] px-6 py-3 text-white">
              <h3 className="text-base font-bold">
                Add New {modalIsSchool ? 'School' : 'Institution'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-lg p-1 hover:bg-white/20 transition-colors"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleModalSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-[130px_1fr] items-center gap-3">
                <label className="text-sm font-semibold text-slate-700">
                  {modalIsSchool ? 'School Name' : 'Institution Name'}
                </label>
                <input
                  required
                  type="text"
                  className="profile-input bg-white shadow-sm border border-slate-300 rounded-xl h-10 px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  value={modalFormData.name}
                  onChange={(e) => setModalFormData((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-[130px_1fr] items-center gap-3">
                <label className="text-sm font-semibold text-slate-700">
                  {modalIsSchool ? 'UDISE Code' : 'AISHE Code'}
                </label>
                <input
                  type="text"
                  className="profile-input bg-white shadow-sm border border-slate-300 rounded-xl h-10 px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  value={modalFormData.code}
                  onChange={(e) => setModalFormData((prev) => ({ ...prev, code: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-[130px_1fr] items-center gap-3">
                <label className="text-sm font-semibold text-slate-700">Category</label>
                <input
                  type="text"
                  className="profile-input bg-white shadow-sm border border-slate-300 rounded-xl h-10 px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  value={modalFormData.category}
                  onChange={(e) =>
                    setModalFormData((prev) => ({ ...prev, category: e.target.value }))
                  }
                />
              </div>

              <div className="grid grid-cols-[130px_1fr] items-center gap-3">
                <label className="text-sm font-semibold text-slate-700">Address</label>
                <input
                  type="text"
                  className="profile-input bg-white shadow-sm border border-slate-300 rounded-xl h-10 px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  value={modalFormData.address}
                  onChange={(e) =>
                    setModalFormData((prev) => ({ ...prev, address: e.target.value }))
                  }
                />
              </div>

              <div className="grid grid-cols-[130px_1fr] items-center gap-3">
                <label className="text-sm font-semibold text-slate-700">City</label>
                <input
                  type="text"
                  className="profile-input bg-white shadow-sm border border-slate-300 rounded-xl h-10 px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  value={modalFormData.city}
                  onChange={(e) => setModalFormData((prev) => ({ ...prev, city: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-[130px_1fr] items-center gap-3">
                <label className="text-sm font-semibold text-slate-700">District</label>
                <input
                  type="text"
                  className="profile-input bg-white shadow-sm border border-slate-300 rounded-xl h-10 px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  value={modalFormData.district}
                  onChange={(e) =>
                    setModalFormData((prev) => ({ ...prev, district: e.target.value }))
                  }
                />
              </div>

              <div className="grid grid-cols-[130px_1fr] items-center gap-3">
                <label className="text-sm font-semibold text-slate-700">State</label>
                <input
                  type="text"
                  className="profile-input bg-white shadow-sm border border-slate-300 rounded-xl h-10 px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  value={modalFormData.state}
                  onChange={(e) => setModalFormData((prev) => ({ ...prev, state: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-[130px_1fr] items-center gap-3">
                <label className="text-sm font-semibold text-slate-700">Website</label>
                <input
                  type="url"
                  className="profile-input bg-white shadow-sm border border-slate-300 rounded-xl h-10 px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  value={modalFormData.website}
                  onChange={(e) =>
                    setModalFormData((prev) => ({ ...prev, website: e.target.value }))
                  }
                />
              </div>

              <div className="flex justify-center pt-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 text-sm font-bold rounded-xl bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-800 shadow-sm transition-colors"
                >
                  Submit for Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
