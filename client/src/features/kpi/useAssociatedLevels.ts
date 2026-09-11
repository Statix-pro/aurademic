import { useCallback, useState } from 'react';

export const instituteLevels = ['Institute - Level 1', 'Institute - Level 2'];
export const departmentLevels = ['Department - Level 1', 'Department - Level 2'];

interface UseAssociatedLevelsOptions {
  onLevelsRemoved?: (levels: string[]) => void;
}

export const useAssociatedLevels = ({ onLevelsRemoved }: UseAssociatedLevelsOptions = {}) => {
  const [selectedAssociatedLevels, setSelectedAssociatedLevels] = useState<string[]>([]);
  const [isInstitutionalChecked, setIsInstitutionalChecked] = useState(false);
  const [isDepartmentChecked, setIsDepartmentChecked] = useState(false);

  const getAvailableLevelOptions = () => [
    ...(isInstitutionalChecked ? instituteLevels : []),
    ...(isDepartmentChecked ? departmentLevels : []),
  ];

  const handleLevelSelect = (level: string) => {
    if (level && !selectedAssociatedLevels.includes(level)) {
      setSelectedAssociatedLevels((current) => [...current, level]);
    }
  };

  const removeAssociatedLevel = (level: string) => {
    setSelectedAssociatedLevels((current) => current.filter((item) => item !== level));
    onLevelsRemoved?.([level]);
  };

  const handleInstitutionalLevelChange = (checked: boolean) => {
    setIsInstitutionalChecked(checked);
    if (!checked) {
      const removedLevels = selectedAssociatedLevels.filter((level) =>
        instituteLevels.includes(level),
      );
      setSelectedAssociatedLevels((current) =>
        current.filter((level) => !instituteLevels.includes(level)),
      );
      onLevelsRemoved?.(removedLevels);
    }
  };

  const handleDepartmentLevelChange = (checked: boolean) => {
    setIsDepartmentChecked(checked);
    if (!checked) {
      const removedLevels = selectedAssociatedLevels.filter((level) =>
        departmentLevels.includes(level),
      );
      setSelectedAssociatedLevels((current) =>
        current.filter((level) => !departmentLevels.includes(level)),
      );
      onLevelsRemoved?.(removedLevels);
    }
  };

  const reset = useCallback(() => {
    setSelectedAssociatedLevels([]);
    setIsInstitutionalChecked(false);
    setIsDepartmentChecked(false);
  }, []);

  return {
    selectedAssociatedLevels,
    isInstitutionalChecked,
    isDepartmentChecked,
    getAvailableLevelOptions,
    handleLevelSelect,
    removeAssociatedLevel,
    handleInstitutionalLevelChange,
    handleDepartmentLevelChange,
    reset,
  };
};
