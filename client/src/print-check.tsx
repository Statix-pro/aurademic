import React from 'react';
import { createRoot } from 'react-dom/client';
import { GuesthousePrintPreview } from './features/guesthouse/GuestHouseBooking';

createRoot(document.getElementById('root')!).render(
  <GuesthousePrintPreview
    bookingId={16}
    applicant={{ name: 'Dr Niranjana S', date: '2026-10-13', department: 'Computer Science and Engineering', mobile: '9790265556' } as never}
    beneficiary={{ beneficiaryType: 'Staff' } as never}
    travel={{ checkInDate: '2026-10-13', checkInTime: '12:00', checkOutDate: '2026-10-14', checkOutTime: '12:00' } as never}
    guests={[{ name: 'Guest Name', organization: 'KSR', city: 'Tiruchengode', state: 'Tamil Nadu', remarks: 'Official Visit', foodVeg: '2', foodNonVeg: '1', roomSingle: '1', roomDouble: '0', roomDeluxe: '0' } as never]}
    foodRows={[]}
  />,
);

const waitForFrame = window.setInterval(() => {
  const frame = document.querySelector<HTMLIFrameElement>('.guesthouse-print-document');
  const printDocument = frame?.contentDocument?.documentElement?.outerHTML;
  if (!printDocument || frame?.contentDocument?.readyState !== 'complete') return;
  window.clearInterval(waitForFrame);
  document.open();
  document.write(`<!doctype html>${printDocument}`);
  document.close();
}, 50);
