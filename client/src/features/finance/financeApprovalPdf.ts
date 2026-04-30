import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDFDocument } from 'pdf-lib';

import KSRCTLogo from '../../shared/assets/images/ksrct_logo.png';
import authenticityUtility from '../../shared/utils/authenticityUtility';
import { formatRowRanges, summarizeLineChanges } from '../../shared/utils/logDiffUtils';

export interface WorkflowTimelineEntry {
  key?: string;
  label: string;
  actor: string;
  email: string;
  timestamp: string;
  stage: string;
  subtitle?: string;
  fullSubtitle?: string;
  decision?: string;
}

export interface FinancePdfBudgetRow {
  category: string;
  head: string;
  amount: string;
}

export interface FinancePdfIncomeRow {
  incomeSource: string;
  contribution: string;
  amount: string;
  status: string;
  remarks: string;
  creditAccount: string;
}

export interface FinancePdfAnnexureRow {
  annexureType: string;
  file: File | null;
  previewUrl: string;
  originalName: string;
  storedName: string;
  filePath: string;
  mimeType: string;
  size: number | null;
}

export const formatDMY = (value: string | Date | null | undefined): string => {
  if (!value) return '';

  let d: Date;
  if (typeof value === 'string') {
    const dateOnlyMatch = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const year = Number(dateOnlyMatch[1]);
      const month = Number(dateOnlyMatch[2]) - 1;
      const day = Number(dateOnlyMatch[3]);
      d = new Date(year, month, day);
    } else {
      d = new Date(value);
    }
  } else {
    d = new Date(value);
  }

  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
};

export const numberToIndianWords = (num: number): string => {
  if (num === 0) return 'Zero rupees only';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six',
    'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
    'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const b = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
    'Sixty', 'Seventy', 'Eighty', 'Ninety',
  ];

  const inWordsBelowThousand = (n: number): string => {
    let str = '';
    if (n > 99) {
      str += a[Math.floor(n / 100)] + ' hundred ';
      n %= 100;
    }
    if (n > 19) {
      str += b[Math.floor(n / 10)]!.toLowerCase() + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += a[n]!.toLowerCase().replace(/^./, (c) => c.toUpperCase()) + ' ';
    }
    return str.trim();
  };

  let n = Math.floor(num);
  let result = '';

  const crore = Math.floor(n / 10000000);
  if (crore) {
    result += inWordsBelowThousand(crore) + ' crore ';
    n %= 10000000;
  }

  const lakh = Math.floor(n / 100000);
  if (lakh) {
    result += inWordsBelowThousand(lakh) + ' lakh ';
    n %= 100000;
  }

  const thousand = Math.floor(n / 1000);
  if (thousand) {
    result += inWordsBelowThousand(thousand) + ' thousand ';
    n %= 1000;
  }

  if (n > 0) {
    result += inWordsBelowThousand(n);
  }

  const titleCased = result.trim()
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .replace(/[A-Z]{2,}/g, (m) => m.charAt(0) + m.slice(1).toLowerCase());

  return titleCased + ' Rupees only';
};

const getWorkflowField = (update: any, keys: string[]) => {
  for (const key of keys) {
    const value = update?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
};

const normalizeWorkflowText = (value: any): string => String(value ?? '').trim();

const parseWorkflowDateMs = (value: any): number | null => {
  const parsed = new Date(value);
  const ms = parsed.getTime();
  return Number.isNaN(ms) ? null : ms;
};

export const formatWorkflowTimestamp = (value: any): string => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).formatToParts(date);

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const day = lookup.day || '00';
  const month = lookup.month || '00';
  const year = lookup.year || '0000';
  const hour = lookup.hour || '00';
  const minute = lookup.minute || '00';
  const second = lookup.second || '00';
  const suffix = String(lookup.dayPeriod || '').toLowerCase();

  return `${day}.${month}.${year}, ${hour}:${minute}:${second} ${suffix}`.trim();
};

export const getCurrentWorkflowTimestamp = (): string => formatWorkflowTimestamp(new Date());

const getWorkflowDecisionLabel = (update: any): string => {
  const decision = String(getWorkflowField(update, ['decision', 'status'])).toLowerCase();
  if (!decision) return '';
  const compactDecision = decision.replace(/[^a-z0-9]/g, '');

  if (compactDecision.includes('resubmit')) return 'Resubmitted';
  if (decision.includes('submit')) return 'Submitted';
  if (decision.includes('approv') || decision === 'completed') return 'Approved';
  if (decision.includes('return')) return 'Returned';
  if (decision.includes('reject')) return 'Rejected';
  if (decision.includes('archiv')) return 'Archived';
  if (decision.includes('update')) return 'Updated';
  return '';
};

const getWorkflowActorLabel = (update: any, fallback = '-'): string => {
  const name = String(getWorkflowField(update, ['userName', 'user_name', 'actorName', 'actor_name'])).trim();
  const email = String(getWorkflowField(update, ['actorEmail', 'actor_email', 'email', 'userEmail', 'user_email'])).trim();

  if (name) return name;
  if (email) return email;
  return fallback;
};

const parseWorkflowDetails = (rawDetails: any): any => {
  if (!rawDetails) return null;
  if (typeof rawDetails === 'object') return rawDetails;
  if (typeof rawDetails === 'string') {
    try {
      return JSON.parse(rawDetails);
    } catch {
      return null;
    }
  }
  return null;
};

const getWorkflowUpdateSummary = (update: any) => {
  const summary = normalizeWorkflowText(getWorkflowField(update, ['summary', 'comment', 'feedback']));
  const details = parseWorkflowDetails(update?.details);
  if (!details) {
    return {
      compact: summary || 'Request updated',
      full: summary || 'Request updated',
    };
  }

  const lines = Array.isArray(details?.lines)
    ? details.lines
    : Array.isArray(details)
      ? details
      : Array.isArray(details?.lineChanges)
        ? details.lineChanges
        : [];
  const proposalChanges = Array.isArray(details?.proposalChanges)
    ? details.proposalChanges.map((change: any) => normalizeWorkflowText(change)).filter(Boolean)
    : [];

  let rowSummary = '';
  let compact = '';
  let full = '';

  if (lines.length > 0) {
    const numericRows = lines
      .map((line: any) => Number(line?.lineNo ?? line?.line_no ?? line?.rowNo ?? line?.row_no))
      .filter((lineNo: number) => Number.isInteger(lineNo) && lineNo > 0);
    const rowNumbers = Array.from(new Set<number>(numericRows)).sort((a, b) => a - b);
    if (rowNumbers.length > 0) {
      rowSummary = `Row No. ${formatRowRanges(rowNumbers)}`;
    }

    const lineSummary = summarizeLineChanges(lines);
    compact = lineSummary.compact;
    full = lineSummary.full;
  }

  if (proposalChanges.length > 0) {
    const proposalSummary = proposalChanges.join('; ');
    compact = [compact, proposalSummary].filter(Boolean).join(' | ');
    full = [full, proposalSummary].filter(Boolean).join(' | ');
  }

  const compactSubtitle = [rowSummary || summary, compact].filter(Boolean).join(' | ');
  const fullSubtitle = [rowSummary || summary, full || compact].filter(Boolean).join(' | ');

  return {
    compact: compactSubtitle || summary || 'Request updated',
    full: fullSubtitle || compactSubtitle || summary || 'Request updated',
  };
};

export const getWorkflowTimeline = (
  updates: any[],
  fallback?: { name: string; email: string; date: string }
): WorkflowTimelineEntry[] => {
  if (!Array.isArray(updates) || updates.length === 0) {
    return fallback
      ? [{
        label: 'Submitted',
        actor: fallback.name || fallback.email || '-',
        email: fallback.email || '',
        timestamp: fallback.date || '',
        stage: '',
      }]
      : [];
  }

  const currentFlowUpdates = updates
    .slice()
    .sort((left, right) => {
      const leftTime = parseWorkflowDateMs(
        getWorkflowField(left, ['decidedAt', 'decided_at', 'createdAt', 'created_at'])
      );
      const rightTime = parseWorkflowDateMs(
        getWorkflowField(right, ['decidedAt', 'decided_at', 'createdAt', 'created_at'])
      );

      // Keep malformed/undated rows at the end so valid history stays chronological.
      if (leftTime === null && rightTime === null) {
        return (Number(left?.id) || 0) - (Number(right?.id) || 0);
      }
      if (leftTime === null) return 1;
      if (rightTime === null) return -1;

      if (leftTime !== rightTime) return leftTime - rightTime;
      return (Number(left?.id) || 0) - (Number(right?.id) || 0);
    });

  const timeline = currentFlowUpdates
    .map((update, idx) => {
      const label = getWorkflowDecisionLabel(update);
      if (!label) return null;
      const decision = String(getWorkflowField(update, ['decision', 'status'])).toLowerCase();
      const entry: WorkflowTimelineEntry = {
        key: `${label.toLowerCase()}-${update?.id || idx}`,
        label,
        actor: getWorkflowActorLabel(update),
        email: String(getWorkflowField(update, ['actorEmail', 'actor_email', 'email', 'userEmail', 'user_email'])).trim(),
        timestamp: formatWorkflowTimestamp(
          getWorkflowField(update, ['decidedAt', 'decided_at', 'createdAt', 'created_at'])
        ),
        stage: String(getWorkflowField(update, ['stage', 'role'])).toLowerCase(),
        decision,
      };

      if (label === 'Updated') {
        const updateSummary = getWorkflowUpdateSummary(update);
        entry.subtitle = updateSummary.compact;
        entry.fullSubtitle = updateSummary.full;
      }

      return entry;
    })
    .filter((item): item is WorkflowTimelineEntry => Boolean(item));

  if (timeline.length === 0 && fallback) {
    return [{
      label: 'Submitted',
      actor: fallback.name || fallback.email || '-',
      email: fallback.email || '',
      timestamp: fallback.date || '',
      stage: '',
    }];
  }

  return timeline;
};

export const formatWorkflowPersonText = (name?: string, mail?: string, timestamp?: string): string => {
  const trimmedName = String(name || '').trim();
  const trimmedMail = String(mail || '').trim();
  const trimmedTime = String(timestamp || '').trim();
  const actorAlreadyHasMail =
    trimmedMail.length > 0 &&
    trimmedName.toLowerCase().includes(trimmedMail.toLowerCase());

  const displayName = trimmedName || '-';
  const displayMail = trimmedMail && !actorAlreadyHasMail ? ` (${trimmedMail})` : '';
  const displayTime = trimmedTime ? ` on ${trimmedTime}` : '';

  return `${displayName}${displayMail}${displayTime}`;
};

export const getSubmittedTimestamp = (
  timeline: WorkflowTimelineEntry[],
  fallbackDate?: string,
  fallbackToCurrent = false
): string => {
  const explicitFallback = String(fallbackDate || '').trim();
  if (explicitFallback) return explicitFallback;

  const submittedEntry = timeline.find((entry) => entry.label === 'Submitted' && String(entry.timestamp || '').trim());
  if (submittedEntry) return submittedEntry.timestamp;

  return fallbackToCurrent ? getCurrentWorkflowTimestamp() : '';
};

const getWorkflowDecisionText = (entry: WorkflowTimelineEntry): string => {
  const stageToken = String(entry.stage || '').toLowerCase();
  if (entry.label === 'Approved') {
    return stageToken.includes('principal') ? 'Approved by' : 'Recommended by';
  }
  return `${entry.label} by`;
};

export const getAnnexureOpenUrl = (row: FinancePdfAnnexureRow, baseUrl: string): string => {
  const sourceUrl = String(row.previewUrl || row.filePath || '').trim();
  if (!sourceUrl) return '';
  if (sourceUrl.startsWith('http') || sourceUrl.startsWith('blob:')) {
    return sourceUrl;
  }
  return `${baseUrl}${sourceUrl}`;
};

const triggerPdfDownload = (bytes: ArrayBuffer | Uint8Array, fileName = 'FinanceApprovalRequest.pdf') => {
  let blobPart: BlobPart;
  if (bytes instanceof Uint8Array) {
    const backingBuffer = bytes.buffer;
    if (backingBuffer instanceof ArrayBuffer) {
      blobPart =
        bytes.byteOffset === 0 && bytes.byteLength === backingBuffer.byteLength
          ? backingBuffer
          : backingBuffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    } else {
      blobPart = bytes.slice().buffer;
    }
  } else {
    blobPart = bytes;
  }

  const blob = new Blob([blobPart], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
};

const mergeAndDownloadPdfWithAnnexures = async (
  mainPdfBuffer: ArrayBuffer,
  annexureFiles: FinancePdfAnnexureRow[],
  baseUrl: string,
  authToken?: string | null,
  fileName = 'FinanceApprovalRequest.pdf'
): Promise<string[]> => {
  const annexures = annexureFiles.filter((row) => String(row.filePath || '').trim());
  if (!annexures.length) {
    triggerPdfDownload(mainPdfBuffer, fileName);
    return [];
  }

  const mergedPdf = await PDFDocument.create();
  const primaryPdf = await PDFDocument.load(mainPdfBuffer);
  const primaryPages = await mergedPdf.copyPages(primaryPdf, primaryPdf.getPageIndices());
  primaryPages.forEach((page) => mergedPdf.addPage(page));

  const skippedFiles: string[] = [];

  for (const annexure of annexures) {
    const fileLabel = String(annexure.originalName || annexure.storedName || annexure.filePath || 'Annexure').trim();
    const annexureUrl = getAnnexureOpenUrl(annexure, baseUrl);
    if (!annexureUrl) {
      skippedFiles.push(fileLabel);
      continue;
    }

    try {
      const annexureBytes = await authenticityUtility.get<ArrayBuffer, ArrayBuffer>(annexureUrl, {
        responseType: 'arraybuffer',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      });
      const lowerName = fileLabel.toLowerCase();
      const mimeType = String(annexure.mimeType || '').toLowerCase();
      const isPdf = mimeType.includes('pdf') || lowerName.endsWith('.pdf');
      const isPng = mimeType.includes('png') || lowerName.endsWith('.png');
      const isJpg = mimeType.includes('jpeg') || mimeType.includes('jpg') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg');

      if (isPdf) {
        const annexurePdf = await PDFDocument.load(annexureBytes);
        const annexurePages = await mergedPdf.copyPages(annexurePdf, annexurePdf.getPageIndices());
        annexurePages.forEach((page) => mergedPdf.addPage(page));
        continue;
      }

      if (isPng || isJpg) {
        const imageBytes = new Uint8Array(annexureBytes);
        const image = isPng
          ? await mergedPdf.embedPng(imageBytes)
          : await mergedPdf.embedJpg(imageBytes);
        const page = mergedPdf.addPage([595.28, 841.89]);
        const width = page.getWidth();
        const height = page.getHeight();
        const fit = image.scaleToFit(width - 40, height - 40);
        page.drawImage(image, {
          x: (width - fit.width) / 2,
          y: (height - fit.height) / 2,
          width: fit.width,
          height: fit.height,
        });
        continue;
      }

      skippedFiles.push(fileLabel);
    } catch {
      skippedFiles.push(fileLabel);
    }
  }

  const mergedBytes = await mergedPdf.save();
  triggerPdfDownload(mergedBytes, fileName);
  return skippedFiles;
};

interface GenerateFinancePdfInput {
  applicantName: string;
  requestDate: string | Date | null | undefined;
  department: string;
  designation: string;
  email: string;
  mobile: string;
  beneficiaryText: string;
  description: string;
  headOfAccountsText: string;
  budgetRows: FinancePdfBudgetRow[];
  showUnplannedBudget: boolean;
  unplannedBudgetAmount: string;
  unplannedBudgetDescription: string;
  totalBudget: number;
  showIncomeSection: boolean;
  incomeRows: FinancePdfIncomeRow[];
  annexureSummary: string;
  approvalHistory: WorkflowTimelineEntry[];
  proposalRef?: string;
  submittedBy: { actor: string; email: string; timestamp: string };
  annexureFiles: FinancePdfAnnexureRow[];
  baseUrl: string;
  authToken?: string | null;
  fileName?: string;
}

export const generateAndDownloadFinancePdf = async (input: GenerateFinancePdfInput): Promise<string[]> => {
  const {
    applicantName,
    requestDate,
    department,
    designation,
    email,
    mobile,
    beneficiaryText,
    description,
    headOfAccountsText,
    budgetRows,
    showUnplannedBudget,
    unplannedBudgetAmount,
    unplannedBudgetDescription,
    totalBudget,
    showIncomeSection,
    incomeRows,
    annexureSummary,
    approvalHistory,
    proposalRef,
    submittedBy,
    annexureFiles,
    baseUrl,
    authToken,
    fileName = 'FinanceApprovalRequest.pdf',
  } = input;

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 12;
  let yPos = 10;
  const tableWidth = pageWidth - margin * 2;

  let compressedLogo: string | null = null;
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = KSRCTLogo;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      setTimeout(resolve, 2000);
    });

    const logoCanvas = document.createElement('canvas');
    const targetSize = 100;
    logoCanvas.width = targetSize;
    logoCanvas.height = targetSize;
    const ctx = logoCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetSize, targetSize);
      ctx.drawImage(img, 0, 0, targetSize, targetSize);
      compressedLogo = logoCanvas.toDataURL('image/jpeg', 0.7);
    }
  } catch {
    // If logo fails, skip it.
  }

  autoTable(pdf, {
    startY: yPos,
    margin: { left: margin, right: margin },
    theme: 'grid',
    tableWidth,
    styles: { fontSize: 9, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.3, valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: tableWidth - 22 - 22, halign: 'center' },
      2: { cellWidth: 22, halign: 'center' },
    },
    body: [[
      { content: '', styles: { minCellHeight: 22 } },
      { content: '', styles: { minCellHeight: 22 } },
      { content: '', styles: { minCellHeight: 22 } },
    ]],
    didDrawCell: (data: any) => {
      if (data.column.index === 0 && data.row.index === 0 && compressedLogo) {
        const logoSize = 15;
        const x = data.cell.x + (data.cell.width - logoSize) / 2;
        const y = data.cell.y + (data.cell.height - logoSize) / 2;
        pdf.addImage(compressedLogo, 'JPEG', x, y, logoSize, logoSize);
      }
      if (data.column.index === 1 && data.row.index === 0) {
        const cellCenterX = data.cell.x + data.cell.width / 2;
        const cellCenterY = data.cell.y + data.cell.height / 2;

        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('K.S.RANGASAMY COLLEGE OF TECHNOLOGY', cellCenterX, cellCenterY - 4, { align: 'center' });

        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.text('(Autonomous)', cellCenterX, cellCenterY + 1, { align: 'center' });
        pdf.text('Tiruchengode - 637 215, Namakkal Dt. Tamil Nadu', cellCenterX, cellCenterY + 6, { align: 'center' });
      }
      if (data.column.index === 2 && data.row.index === 0) {
        const cellCenterX = data.cell.x + data.cell.width / 2;
        const cellCenterY = data.cell.y + data.cell.height / 2;

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.text('FINANCE', cellCenterX, cellCenterY - 2.5, { align: 'center' });

        if (proposalRef) {
          pdf.setFontSize(8);
          pdf.text(proposalRef, cellCenterX, cellCenterY + 2.8, { align: 'center' });
        }
      }
    },
  });

  yPos = (pdf as any).lastAutoTable.finalY + 6;

  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'bold');
  pdf.text('APPLICATION FOR FINANCIAL APPROVAL', pageWidth / 2, yPos, { align: 'center' });
  yPos += 6;

  const formattedDate = requestDate ? formatDMY(requestDate) : '';
  const mainTableBody: any[] = [
    ['Name', applicantName || '', 'Date', formattedDate],
    ['Department', department || '', 'Designation', designation || ''],
    ['Email', email || '', 'Mobile', mobile || ''],
    [{ content: 'Beneficiary', styles: { fontStyle: 'bold' } }, { content: beneficiaryText, colSpan: 3 }],
    [{ content: 'Description', styles: { fontStyle: 'bold' } }, { content: description || '', colSpan: 3 }],
    [
      { content: 'Head of Accounts', styles: { fontStyle: 'bold' } },
      { content: headOfAccountsText },
      { content: 'Annexure', styles: { fontStyle: 'bold' } },
      { content: annexureSummary },
    ],
  ];

  autoTable(pdf, {
    startY: yPos,
    margin: { left: margin, right: margin },
    theme: 'grid',
    tableWidth,
    styles: { fontSize: 10, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.25, valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 34, fontStyle: 'bold' },
      1: { cellWidth: 79 },
      2: { cellWidth: 26, fontStyle: 'bold' },
      3: { cellWidth: tableWidth - 34 - 79 - 26 },
    },
    body: mainTableBody,
  });

  yPos = (pdf as any).lastAutoTable.finalY;

  const budgetTableBody = budgetRows.flatMap((row, index) => {
    const isLastRow = index === budgetRows.length - 1;

    if (showUnplannedBudget && isLastRow) {
      return [
        [
          { content: String(index + 1), rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
          row.category || '',
          row.head || '',
          'Rs. ' + Number(row.amount || 0),
        ],
        [
          { content: `Unplanned Budget: ${unplannedBudgetDescription || ''}`, colSpan: 2, styles: { fontStyle: 'bold', overflow: 'linebreak' } },
          'Rs. ' + Number(unplannedBudgetAmount || 0),
        ]
      ];
    }

    return [[
      String(index + 1),
      row.category || '',
      row.head || '',
      'Rs. ' + Number(row.amount || 0),
    ]];
  });

  budgetTableBody.push([
    { content: 'Total Budget:', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' as const } } as any,
    { content: 'Rs. ' + totalBudget, styles: { fontStyle: 'bold' } },
  ]);

  autoTable(pdf, {
    startY: yPos,
    margin: { left: margin, right: margin },
    theme: 'grid',
    tableWidth,
    styles: {
      fontSize: 10,
      cellPadding: 2,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      valign: 'middle'
    },
    head: [[
      { content: 'S.No', styles: { fontStyle: 'bold', halign: 'center', fillColor: [245, 245, 245] } },
      { content: 'Budget Head', styles: { fontStyle: 'bold', halign: 'center', fillColor: [245, 245, 245] } },
      { content: 'Sub Head', styles: { fontStyle: 'bold', halign: 'center', fillColor: [245, 245, 245] } },
      { content: 'Amount', styles: { fontStyle: 'bold', halign: 'center', fillColor: [245, 245, 245] } },
    ]],
    body: budgetTableBody as any,
    columnStyles: {
      0: { cellWidth: 16, halign: 'center' },
      1: { cellWidth: 68 },
      2: { cellWidth: 68 },
      3: { cellWidth: tableWidth - 16 - 68 - 68, halign: 'right' },
    },
  });

  yPos = (pdf as any).lastAutoTable.finalY;

  const amountInWords = numberToIndianWords(totalBudget)
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .replace(/([A-Z])(?=[A-Z][a-z])/, '$1 ')
    .replace(/[A-Z]{2,}/g, (m) => m.charAt(0) + m.slice(1).toLowerCase());

  autoTable(pdf, {
    startY: yPos,
    margin: { left: margin, right: margin },
    theme: 'grid',
    tableWidth,
    styles: { fontSize: 10, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.25, halign: 'center' },
    body: [['Rupees in Words: ' + amountInWords]],
  });

  yPos = (pdf as any).lastAutoTable.finalY;

  if (showIncomeSection) {
    const incomeTableBody = incomeRows.flatMap((row, index) => ([
      [
        { content: String(index + 1), rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: row.incomeSource || '' },
        { content: row.status || '', styles: { halign: 'center' } },
        { content: 'Rs. ' + Number(row.amount || 0) },
        { content: row.remarks || '' },
      ],
      [
        { content: `Contribution${row.contribution ? ` - ${row.contribution}` : ''}`, colSpan: 1, styles: { fontStyle: 'bold' } },
        { content: `Credit Account: ${row.creditAccount || ''}`, colSpan: 3, styles: { overflow: 'linebreak' } },
      ],
    ]));

    autoTable(pdf, {
      startY: yPos,
      margin: { left: margin, right: margin },
      theme: 'grid',
      tableWidth,
      styles: { fontSize: 10, cellPadding: 2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.25, valign: 'middle' },
      head: [[
        'S.No',
        'Income Source',
        'Status',
        'Amount',
        'Remarks',
      ]],
      headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        0: { cellWidth: 16, halign: 'center' },
        1: { cellWidth: 40, halign: 'center' },
        2: { cellWidth: 30 },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: tableWidth - 16 - 40 - 30 - 30, halign: 'left' },
      },
      body: incomeTableBody as any,
    });

    yPos = (pdf as any).lastAutoTable.finalY;
  }

  const approvalSteps = approvalHistory.filter((entry) =>
    entry.label === 'Approved' &&
    !(totalBudget > 10000 && (String(entry.stage).includes('principal') || String(entry.stage).includes('chairman')))
  );
  const submittedByUi = approvalHistory.find((entry) => entry.label === 'Submitted') || submittedBy;
  const showSeniorApprovalRow = totalBudget > 10000;
  const seniorApprovalRows = showSeniorApprovalRow
    ? [[
      {
        content: 'Principal',
        styles: { halign: 'left', fontStyle: 'bold', minCellHeight: 15, fontSize: 11 },
      },
      {
        content: 'Chairman',
        styles: { halign: 'left', fontStyle: 'bold', minCellHeight: 15, fontSize: 11 },
      },

    ],
    ]
    : [];
  const digitalSignRows: any[] = [
    [{ content: 'Submission and Approval Status', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [245, 245, 245], halign: 'center' } }],
    [{ content: `Submitted by ${formatWorkflowPersonText(submittedByUi.actor, submittedByUi.email, submittedByUi.timestamp)}`, colSpan: 2 }],
    ...approvalSteps.map((entry) => ([
      {
        content: `${getWorkflowDecisionText(entry)} ${formatWorkflowPersonText(entry.actor, entry.email, entry.timestamp)}`,
        colSpan: 2,
      },
    ])),
    ...(approvalHistory.length === 0
      ? [[{ content: 'No approval history available', colSpan: 2 }]]
      : []),
    ...seniorApprovalRows,
  ];

  autoTable(pdf, {
    startY: yPos + 5,
    margin: { left: margin, right: margin },
    theme: 'grid',
    tableWidth,
    styles: { fontSize: 9, cellPadding: 3, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.25 },
    head: [],
    columnStyles: {
      0: { cellWidth: tableWidth / 2, halign: 'left' },
      1: { cellWidth: tableWidth / 2, halign: 'left' },
    },
    body: digitalSignRows,
  });

  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Page ' + i, pageWidth - margin, pdf.internal.pageSize.getHeight() - 6, { align: 'right' });
  }

  const primaryPdfBuffer = pdf.output('arraybuffer');
  return mergeAndDownloadPdfWithAnnexures(primaryPdfBuffer, annexureFiles, baseUrl, authToken, fileName);
};
