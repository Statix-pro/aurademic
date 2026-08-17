import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

import { useAuth } from './AuthContext';
import { apiFetch } from '../config/api';

import type { PersonalDetails, ProfessionDetails } from '../types';

// ---------------------------------------------------------------------------
// Defaults — used when the DB returns null (first-time visitor) or while loading
// ---------------------------------------------------------------------------

const defaultPersonal: PersonalDetails = {
  title: '',
  firstName: '',
  lastName: '',
  gender: '',
  differentlyAbled: false,
  dateOfBirth: '',
  age: '',
  mobileNumber: '',
  whatsappNumber: '',
  email: '',
  address: '',
  city: '',
  state: '',
  country: '',
  pin: '',
  photograph: null,
};

const defaultProfession: ProfessionDetails = {
  professionType: '',
  registerNumber: '',
  degree: '',
  department: '',
  yearOfStudy: '',
  classGrade: '',
  section: '',
  school: '',
  parentGuardianName: '',
  parentGuardianContact: '',
  teacherCoordinatorName: '',
  teacherCoordinatorContact: '',
  designation: '',
  qualification: '',
  subjectHandling: '',
  yearsOfExperience: '',
  mode: '',
  supervisorName: '',
  institution: '',
  institutionCategory: '',
  institutionAddress: '',
  institutionCity: '',
  institutionState: '',
  institutionCountry: '',
  institutionPin: '',
  organization: '',
  contactFacultyName: '',
  facultyMobile: '',
  idCard: null,
  city: '',
  website: '',
  graduationYear: '',
  occupation: '',
  currentDepartment: '',
};

// ---------------------------------------------------------------------------
// Shape returned by GET /api/participant/profile
// ---------------------------------------------------------------------------
interface ApiProfile extends Partial<PersonalDetails>, Partial<ProfessionDetails> {
  photoPath?: string | null;
  idCardPath?: string | null;
  personalComplete?: boolean;
  professionComplete?: boolean;
}

// ---------------------------------------------------------------------------
// Context types
// ---------------------------------------------------------------------------

interface ProfileContextType {
  personal: PersonalDetails;
  profession: ProfessionDetails;
  /** Update local draft state without persisting — used by field onChange handlers. */
  updatePersonal: (data: Partial<PersonalDetails>) => void;
  /** Update local draft state without persisting — used by field onChange handlers. */
  updateProfession: (data: Partial<ProfessionDetails>) => void;
  /** Persist personal details to the DB. Returns true on success. */
  savePersonal: () => Promise<boolean>;
  /** Persist profession details to the DB. Returns true on success. */
  saveProfession: () => Promise<boolean>;
  profileCompletion: number;
  isPersonalComplete: boolean;
  isProfessionComplete: boolean;
  /** True while a save request is in-flight. */
  isSaving: boolean;
  /** Last save error message, cleared when the next save starts. */
  saveError: string | null;
  /** True while the initial profile is being loaded from the DB. */
  isLoadingProfile: boolean;
}

const ProfileContext = createContext<ProfileContextType | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, refresh: refreshAuth } = useAuth();

  const [personal, setPersonal] = useState<PersonalDetails>({
    ...defaultPersonal,
    firstName: user?.name ?? '',
    email: user?.email ?? '',
  });
  const [profession, setProfession] = useState<ProfessionDetails>(defaultProfession);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // ---------------------------------------------------------------------------
  // Load profile from DB on mount (or when the user changes)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    setIsLoadingProfile(true);

    apiFetch<{ profile: ApiProfile | null }>('/participant/profile')
      .then((data) => {
        if (cancelled) return;

        const p = data.profile;

        if (!p) {
          // No DB row yet — keep defaults, pre-fill name/email from OAuth token.
          setPersonal((prev) => ({
            ...prev,
            firstName: prev.firstName || user.name || '',
            email: prev.email || user.email || '',
          }));
          return;
        }

        // Map the flat API response back into the two context objects.
        setPersonal({
          title: p.title ?? '',
          firstName: p.firstName ?? user.name ?? '',
          lastName: p.lastName ?? '',
          gender: p.gender ?? '',
          differentlyAbled: p.differentlyAbled ?? false,
          dateOfBirth: p.dateOfBirth ?? '',
          age: '', // derived from dateOfBirth on the client, never stored
          mobileNumber: p.mobileNumber ?? '',
          whatsappNumber: p.whatsappNumber ?? '',
          email: p.email ?? user.email ?? '',
          address: p.address ?? '',
          city: p.city ?? '',
          state: p.state ?? '',
          country: p.country ?? '',
          pin: p.pin ?? '',
          photograph: null, // photos are served via photoPath, not as base64
        });

        setProfession({
          professionType: p.professionType ?? '',
          registerNumber: p.registerNumber ?? '',
          degree: (p as any).degree ?? '',
          department: p.department ?? '',
          yearOfStudy: (p as any).yearOfStudy ?? '',
          classGrade: (p as any).classGrade ?? '',
          section: (p as any).section ?? '',
          school: (p as any).school ?? '',
          parentGuardianName: (p as any).parentGuardianName ?? '',
          parentGuardianContact: (p as any).parentGuardianContact ?? '',
          teacherCoordinatorName: (p as any).teacherCoordinatorName ?? '',
          teacherCoordinatorContact: (p as any).teacherCoordinatorContact ?? '',
          designation: p.designation ?? '',
          qualification: (p as any).qualification ?? '',
          subjectHandling: (p as any).subjectHandling ?? '',
          yearsOfExperience: (p as any).yearsOfExperience ?? '',
          mode: (p as any).mode ?? '',
          supervisorName: (p as any).supervisorName ?? '',
          institution: p.institution ?? '',
          institutionCategory: (p as any).institutionCategory ?? '',
          institutionAddress: (p as any).institutionAddress ?? '',
          institutionCity: (p as any).institutionCity ?? '',
          institutionState: (p as any).institutionState ?? '',
          institutionCountry: (p as any).institutionCountry ?? '',
          institutionPin: (p as any).institutionPin ?? '',
          organization: (p as any).organization ?? '',
          contactFacultyName: (p as any).contactFacultyName ?? '',
          facultyMobile: (p as any).facultyMobile ?? '',
          idCard: null, // served via idCardPath, not base64
          city: (p as any).city ?? '',
          website: (p as any).website ?? '',
          graduationYear: (p as any).graduationYear ?? '',
          occupation: (p as any).occupation ?? '',
          currentDepartment: (p as any).currentDepartment ?? '',
        });
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('ProfileContext: failed to load profile', err);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingProfile(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  // ---------------------------------------------------------------------------
  // Local draft update helpers (no network call — just update state)
  // ---------------------------------------------------------------------------

  const updatePersonal = useCallback((data: Partial<PersonalDetails>) => {
    setPersonal((prev) => ({ ...prev, ...data }));
  }, []);

  const updateProfession = useCallback((data: Partial<ProfessionDetails>) => {
    setProfession((prev) => ({ ...prev, ...data }));
  }, []);

  // ---------------------------------------------------------------------------
  // Persist helpers
  // ---------------------------------------------------------------------------

  const savePersonal = useCallback(async (): Promise<boolean> => {
    setSaveError(null);
    setIsSaving(true);

    try {
      await apiFetch('/participant/profile/personal', {
        method: 'PUT',
        body: JSON.stringify(personal),
      });

      // Refresh the auth user so personalComplete / professionComplete are
      // up-to-date everywhere (e.g. the registration gate in EventRegistrationPage).
      await refreshAuth();

      return true;
    } catch (err: any) {
      setSaveError(err?.message ?? 'Could not save personal details');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [personal, refreshAuth]);

  const saveProfession = useCallback(async (): Promise<boolean> => {
    setSaveError(null);
    setIsSaving(true);

    try {
      await apiFetch('/participant/profile/profession', {
        method: 'PUT',
        body: JSON.stringify(profession),
      });

      await refreshAuth();

      return true;
    } catch (err: any) {
      setSaveError(err?.message ?? 'Could not save profession details');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [profession, refreshAuth]);

  // ---------------------------------------------------------------------------
  // Derived completeness — mirrors server's isPersonalComplete / isProfessionComplete
  // ---------------------------------------------------------------------------

  const isPersonalComplete = !!(
    personal.firstName &&
    personal.lastName &&
    personal.email &&
    personal.mobileNumber &&
    personal.dateOfBirth &&
    personal.gender
  );

  const isProfessionComplete = (() => {
    if (!profession.professionType) return false;
    const type = profession.professionType;
    if (
      [
        'College Student',
        'Faculty Members',
        'School Student',
        'School Teacher',
        'Research Scholar',
      ].includes(type)
    ) {
      return !!profession.institution;
    }
    if (type === 'Alumni') {
      return !!(profession.registerNumber && profession.department && profession.graduationYear);
    }
    if (
      ['Scientist', 'Government Official', 'Industry Professional', 'Other Profession'].includes(
        type,
      )
    ) {
      return !!profession.organization;
    }
    if (type === 'General Public') {
      return !!(profession.occupation && profession.city);
    }
    return true;
  })();

  const profileCompletion = (() => {
    const personalFields = [
      personal.firstName,
      personal.lastName,
      personal.email,
      personal.mobileNumber,
      personal.dateOfBirth,
      personal.gender,
      personal.address,
      personal.city,
      personal.state,
      personal.country,
      personal.pin,
    ];
    const type = profession.professionType;
    let profFields: any[] = [];
    if (
      [
        'College Student',
        'Faculty Members',
        'School Student',
        'School Teacher',
        'Research Scholar',
      ].includes(type)
    ) {
      profFields = [
        profession.professionType,
        profession.institution,
        profession.degree || profession.classGrade || profession.registerNumber,
        profession.department,
      ];
    } else if (type === 'Alumni') {
      profFields = [
        profession.professionType,
        profession.registerNumber,
        profession.department,
        profession.graduationYear,
      ];
    } else if (
      ['Scientist', 'Government Official', 'Industry Professional', 'Other Profession'].includes(
        type,
      )
    ) {
      profFields = [
        profession.professionType,
        profession.organization,
        profession.designation,
        profession.department,
      ];
    } else if (type === 'General Public') {
      profFields = [profession.professionType, profession.occupation, profession.city];
    } else {
      profFields = [profession.professionType];
    }
    const all = [...personalFields, ...profFields];
    const filled = all.filter(Boolean).length;
    return Math.round((filled / all.length) * 100);
  })();

  return (
    <ProfileContext.Provider
      value={{
        personal,
        profession,
        updatePersonal,
        updateProfession,
        savePersonal,
        saveProfession,
        profileCompletion,
        isPersonalComplete,
        isProfessionComplete,
        isSaving,
        saveError,
        isLoadingProfile,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
