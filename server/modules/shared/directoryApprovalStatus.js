export const getDirectoryApprovalStatus = (record, ownerId) => {
  if (Number(record.is_active) === 1) return 'Approved';
  if (!record.updated_by || Number(record.updated_by) === Number(ownerId)) return 'Pending';
  return 'Rejected';
};
