// updated_by is set only by a reviewer's decision and cleared on every owner edit, so
// it alone separates Rejected from Pending, matching the admin approval queries.
export const getDirectoryApprovalStatus = (record) => {
  if (Number(record.is_active) === 1) return 'Approved';
  return record.updated_by ? 'Rejected' : 'Pending';
};
