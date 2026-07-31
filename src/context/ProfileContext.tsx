import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { PersonalDetails, ProfessionDetails } from '../types'
import { useAuth } from '../hooks/useAuth'

const STORAGE_KEY = 'ep_profile_v1'

const defaultPersonal: PersonalDetails = {
  title: '', firstName: '', lastName: '', gender: '',
  differentlyAbled: false, dateOfBirth: '', age: '',
  mobileNumber: '', whatsappNumber: '', email: '',
  address: '', city: '', state: '', country: '', pin: '', photograph: null,
}

const defaultProfession: ProfessionDetails = {
  professionType: '', registerNumber: '', degree: '', department: '',
  yearOfStudy: '', classGrade: '', section: '', school: '',
  parentGuardianName: '', parentGuardianContact: '',
  teacherCoordinatorName: '', teacherCoordinatorContact: '',
  designation: '', qualification: '', subjectHandling: '', yearsOfExperience: '',
  mode: '', supervisorName: '', institution: '', institutionCategory: '',
  institutionAddress: '', institutionCity: '', institutionState: '',
  institutionCountry: '', institutionPin: '',
  organization: '', contactFacultyName: '', facultyMobile: '', idCard: null,
  city: '', website: '', graduationYear: '', occupation: '', currentDepartment: '',
}

interface ProfileData {
  personal: PersonalDetails
  profession: ProfessionDetails
}

interface ProfileContextType {
  personal: PersonalDetails
  profession: ProfessionDetails
  updatePersonal: (data: Partial<PersonalDetails>) => void
  updateProfession: (data: Partial<ProfessionDetails>) => void
  profileCompletion: number
  isPersonalComplete: boolean
  isProfessionComplete: boolean
}

const ProfileContext = createContext<ProfileContextType | null>(null)

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const storageKey = user ? `ep_profile_${user.email}` : 'ep_profile_guest'

  const [personal, setPersonal] = useState<PersonalDetails>(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed: ProfileData = JSON.parse(stored)
        return { ...defaultPersonal, ...parsed.personal }
      }
    } catch { }
    return defaultPersonal
  })

  const [profession, setProfession] = useState<ProfessionDetails>(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed: ProfileData = JSON.parse(stored)
        return { ...defaultProfession, ...parsed.profession }
      }
    } catch { }
    return defaultProfession
  })

  // Persist whenever either section changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ personal, profession }))
    } catch { }
  }, [personal, profession, storageKey])

  const updatePersonal = useCallback((data: Partial<PersonalDetails>) => {
    setPersonal(prev => ({ ...prev, ...data }))
  }, [])

  const updateProfession = useCallback((data: Partial<ProfessionDetails>) => {
    setProfession(prev => ({ ...prev, ...data }))
  }, [])

  // Compute completeness
  const isPersonalComplete = !!(
    personal.firstName && personal.lastName && personal.email &&
    personal.mobileNumber && personal.dateOfBirth && personal.gender
  )

  const isProfessionComplete = (() => {
    if (!profession.professionType) return false
    const type = profession.professionType
    if (['College Student', 'Faculty Members', 'School Student', 'School Teacher', 'Research Scholar'].includes(type)) {
      return !!profession.institution
    }
    if (type === 'Alumni') {
      return !!(profession.registerNumber && profession.department && profession.graduationYear)
    }
    if (['Scientist', 'Government Official', 'Industry Professional', 'Other Profession'].includes(type)) {
      return !!profession.organization
    }
    if (type === 'General Public') {
      return !!(profession.occupation && profession.city)
    }
    return true
  })()

  const profileCompletion = (() => {
    const personalFields = [
      personal.firstName, personal.lastName, personal.email,
      personal.mobileNumber, personal.dateOfBirth, personal.gender,
      personal.address, personal.city, personal.state, personal.country, personal.pin,
    ]
    const type = profession.professionType
    let profFields: any[] = []
    if (['College Student', 'Faculty Members', 'School Student', 'School Teacher', 'Research Scholar'].includes(type)) {
      profFields = [profession.professionType, profession.institution, profession.degree || profession.classGrade || profession.registerNumber, profession.department]
    } else if (type === 'Alumni') {
      profFields = [profession.professionType, profession.registerNumber, profession.department, profession.graduationYear]
    } else if (['Scientist', 'Government Official', 'Industry Professional', 'Other Profession'].includes(type)) {
      profFields = [profession.professionType, profession.organization, profession.designation, profession.department]
    } else if (type === 'General Public') {
      profFields = [profession.professionType, profession.occupation, profession.city]
    } else {
      profFields = [profession.professionType]
    }
    const all = [...personalFields, ...profFields]
    const filled = all.filter(Boolean).length
    return Math.round((filled / all.length) * 100)
  })()

  return (
    <ProfileContext.Provider value={{
      personal, profession,
      updatePersonal, updateProfession,
      profileCompletion, isPersonalComplete, isProfessionComplete,
    }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider')
  return ctx
}
