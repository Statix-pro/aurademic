import React from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from '../../../contexts/AuthContext';
import CustomTabs, { TabOption } from '../../../shared/components/ui/CustomTabs';
import { canAccessModuleWorkflow } from '../../../shared/utils/permissionUtils';
import OrganizationApprovalPage from '../organizationApproval/OrganizationApprovalPage';
import ResourcePersonApprovalPage from '../resourcePersonApproval/ResourcePersonApprovalPage';

type DirectoryTab = 'organization' | 'resource-person';

/**
 * One Approvals entry for both directories: the Organization and Resource Person request
 * queues behind a tab switch, kept in the URL (?tab=) so a link opens the right one. A
 * Directory Admin of only one directory sees just that queue.
 */
export default function DirectoryApprovalPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabs: TabOption<DirectoryTab>[] = [
    ...(canAccessModuleWorkflow(user, 'organization_directory')
      ? [{ value: 'organization' as const, label: 'Organization' }]
      : []),
    ...(canAccessModuleWorkflow(user, 'resource_person_directory')
      ? [{ value: 'resource-person' as const, label: 'People' }]
      : []),
  ];
  const requested = searchParams.get('tab');
  const tab = tabs.find((option) => option.value === requested)?.value ?? tabs[0]?.value;

  const switcher =
    tabs.length > 1 ? (
      <CustomTabs
        options={tabs}
        value={tab}
        onChange={(next) => setSearchParams({ tab: next }, { replace: true })}
        ariaLabel="Directory"
        className="mb-3"
      />
    ) : null;

  if (tab === 'organization') return <OrganizationApprovalPage switcher={switcher} />;
  if (tab === 'resource-person') return <ResourcePersonApprovalPage switcher={switcher} />;
  return null;
}
