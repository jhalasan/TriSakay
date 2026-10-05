import type { AdminRideMessage } from '@trisakay/services';
import { titleCaseLabel } from '../format.ts';
import { formatReportDateTime } from './format.ts';
import type { ReportSection } from './types.ts';

const dash = '—';

function chatText(message: AdminRideMessage): string {
  if (message.kind === 'image') return '[Photo]';
  return message.body?.trim() || dash;
}

/** The ride's chat thread as a report section. Only built when a Supervisor or Admin asked for it with a reason. */
export function chatSection(chat: AdminRideMessage[]): ReportSection {
  if (chat.length === 0) return { heading: 'Chat thread', blocks: [], emptyText: 'There are no messages in this ride’s chat thread.' };
  return {
    heading: 'Chat thread',
    blocks: [
      {
        type: 'table',
        columns: ['Time', 'From', 'Message'],
        widths: [110, 110, '*'],
        rows: chat.map((message) => [
          formatReportDateTime(message.createdAt),
          message.senderName ? `${message.senderName}${message.senderRole ? ` (${titleCaseLabel(message.senderRole)})` : ''}` : dash,
          chatText(message),
        ]),
      },
    ],
  };
}
