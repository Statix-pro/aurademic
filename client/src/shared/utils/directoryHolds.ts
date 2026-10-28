export interface DirectoryHold {
  name: string;
  status: 'Pending' | 'Rejected' | string;
}

/**
 * Why a directory record cannot be approved yet because of a Specialization a user added from
 * the form (the server's `specializationHolds`; see specializationHoldError in
 * server/modules/shared/directoryLists.js). Empty when nothing holds it.
 */
export const specializationHoldNote = (holds: DirectoryHold[] = []) => {
  if (!holds.length) return '';
  const names = (status: string) =>
    holds
      .filter((hold) => hold.status === status)
      .map((hold) => `"${hold.name}"`)
      .join(', ');
  const rejected = names('Rejected');
  if (rejected) return `Specialization ${rejected} rejected: submitter must remove it`;
  return `Specialization ${names('Pending')} waiting for approval on Directory Lists`;
};
