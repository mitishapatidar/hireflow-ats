/**
 * RFC-5545 Compliant iCalendar (.ics) Generator for HireFlow ATS
 */

export interface IcsInviteParams {
  interviewId: string;
  summary: string;
  description: string;
  startTimeUtc: Date;
  durationMinutes: number;
  meetingLink?: string | null;
  organizerName?: string;
  organizerEmail?: string;
  candidateName: string;
  candidateEmail: string;
  sequence?: number;
  status?: 'CONFIRMED' | 'CANCELLED';
  method?: 'REQUEST' | 'CANCEL';
}

/**
 * Format a Date object into RFC-5545 UTC timestamp format (YYYYMMDDTHHMMSSZ)
 */
export function formatIcsUtcDate(date: Date): string {
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Escape text fields according to RFC-5545 section 3.3.11
 */
export function escapeIcsText(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Generate a complete RFC-5545 VCALENDAR string.
 */
export function generateIcsCalendarInvite(params: IcsInviteParams): string {
  const {
    interviewId,
    summary,
    description,
    startTimeUtc,
    durationMinutes,
    meetingLink,
    organizerName = 'Aureva Capital Recruitment',
    organizerEmail = 'recruitment@aurevacapital.com',
    candidateName,
    candidateEmail,
    sequence = 0,
    status = 'CONFIRMED',
    method = 'REQUEST',
  } = params;

  const nowUtc = new Date();
  const endTimeUtc = new Date(startTimeUtc.getTime() + durationMinutes * 60 * 1000);

  const dtstamp = formatIcsUtcDate(nowUtc);
  const dtstart = formatIcsUtcDate(startTimeUtc);
  const dtend = formatIcsUtcDate(endTimeUtc);

  const uid = `interview-${interviewId}@hireflow.aurevacapital.com`;
  const location = meetingLink ? escapeIcsText(meetingLink) : 'Online Video Conference';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HireFlow ATS//Aureva Capital Private Limited//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${location}`,
    `STATUS:${status}`,
    `SEQUENCE:${sequence}`,
    `ORGANIZER;CN="${escapeIcsText(organizerName)}":mailto:${organizerEmail}`,
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;CN="${escapeIcsText(candidateName)}":mailto:${candidateEmail}`,
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n') + '\r\n';
}
