import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CliError } from '../errors.js';
import { appendEvent, readEvents, readStatus, writeStatus } from './context.js';
import { TaskState } from './state-machine.js';

const DEFAULT_TELEGRAM_API = 'https://api.telegram.org';
const TELEGRAM_MESSAGE_LIMIT = 4000;
const STATE_ICON = { done: '✅', failed: '❌', blocked: '⛔', 'in-progress': '⏳' };
const TASK_LABEL = {
  [TaskState.Done]: 'DONE',
  [TaskState.Failed]: 'FAILED',
  [TaskState.BlockedByPolicy]: 'BLOCKED_BY_POLICY',
  [TaskState.Active]: 'ĐANG LÀM',
  [TaskState.Pending]: 'CHƯA LÀM',
};

export function buildSummary(status, events) {
  const assumptions = events.filter((event) => event.type === 'assumption');
  const skipped = events.filter((event) => event.type === 'skipped-action');
  const lines = [
    `# ${status.project} / ${status.spec} — ${status.state}`,
    '',
    `Branch: \`${status.branch}\` · Worktree: \`${status.worktree}\` · Lượt gọi agent: ${status.agentCalls}`,
    ...(status.blockedReason ? ['', `**Blocked:** ${status.blockedReason}`] : []),
    '',
    '| Task | Tính năng | AC | Trạng thái | Vòng | Branch | Lỗi gần nhất |',
    '|---|---|---|---|---|---|---|',
    ...(status.tasks ?? []).map(
      (task) =>
        `| ${task.id} | ${task.title} | ${task.acs.join(', ')} | ${TASK_LABEL[task.state]} | ${task.round} | ${task.branch ?? ''} | ${oneLine(task.lastFailure)} |`,
    ),
    '',
    `## Giả định agent tự chọn (${assumptions.length})`,
    ...(assumptions.length ? assumptions.map((event) => `- ${event.task ? `${event.task}: ` : ''}${event.detail}`) : ['- Không có']),
    '',
    `## Hành động bị bỏ qua vì bị cấm (${skipped.length})`,
    ...(skipped.length ? skipped.map((event) => `- ${event.detail}`) : ['- Không có']),
    '',
  ];
  return lines.join('\n');
}

export function buildTelegramMessage(status, events) {
  const assumptions = events.filter((event) => event.type === 'assumption').length;
  const lines = [
    `${STATE_ICON[status.state] ?? ''} ${status.project}/${status.spec}: ${status.state}`,
    ...(status.blockedReason ? [`Lý do: ${oneLine(status.blockedReason)}`] : []),
    ...(status.tasks ?? []).map(
      (task) => `  ${task.id} ${task.title}: ${TASK_LABEL[task.state]}${task.round ? ` (vòng ${task.round})` : ''}${task.state === TaskState.Failed ? ` — ${oneLine(task.lastFailure)}` : ''}`,
    ),
    ...(assumptions ? [`Giả định agent tự chọn: ${assumptions} (xem runs/summary.md)`] : []),
  ];
  return lines.join('\n').slice(0, TELEGRAM_MESSAGE_LIMIT);
}

export async function writeSummary(context) {
  const status = await readStatus(context);
  if (!status) throw new CliError('Spec chưa được bắt đầu (thiếu status.json)');
  const events = await readEvents(context.eventsPath);
  await mkdir(path.dirname(context.summaryPath), { recursive: true });
  await writeFile(context.summaryPath, buildSummary(status, events));
  return { status, events };
}

export async function notifyIfChanged(context, env, fetchImpl = fetch) {
  const { status, events } = await writeSummary(context);
  if (status.reported === status.state) return { sent: false, reason: `đã báo trạng thái ${status.state}` };
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new CliError('Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID');
  const apiBase = env.GF_TELEGRAM_API || DEFAULT_TELEGRAM_API;
  const response = await sendTelegram(fetchImpl, `${apiBase}/bot${token}/sendMessage`, {
    chat_id: chatId,
    text: buildTelegramMessage(status, events),
  });
  if (!response.ok) throw new CliError(`Telegram trả HTTP ${response.status}; lần chạy sau sẽ gửi lại`);
  await writeStatus(context, { ...status, reported: status.state });
  await appendEvent(context, { type: 'reported', detail: status.state });
  return { sent: true, state: status.state };
}

async function sendTelegram(fetchImpl, url, payload) {
  try {
    return await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    throw new CliError('Không kết nối được Telegram (lỗi mạng); lần chạy sau sẽ gửi lại');
  }
}

function oneLine(text) {
  return (text ?? '').replace(/\s+/g, ' ').replace(/\|/g, '\\|').slice(0, 200);
}
