import { SpecState } from './state-machine.js';

export const HEARTBEAT_TIMEOUT_MINUTES = 90;
const MILLISECONDS_PER_MINUTE = 60_000;
const READY_STATUS = 'approved';

export const ScanAction = {
  Skip: 'skip',
  Start: 'start',
  Resume: 'resume',
  RestartFailed: 'restart-failed',
  Report: 'report',
};

export function decideScanAction({ specStatus, status, specHash, now, heartbeatTimeoutMinutes = HEARTBEAT_TIMEOUT_MINUTES }) {
  if (specStatus !== READY_STATUS) return { action: ScanAction.Skip, reason: `spec đang '${specStatus || 'không rõ'}', chưa approved` };
  if (!status) return { action: ScanAction.Start, reason: 'chưa triển khai' };
  if (status.state === SpecState.InProgress) return decideInProgress(status, now, heartbeatTimeoutMinutes);
  if (status.state === SpecState.Blocked) {
    return { action: ScanAction.Resume, reason: `thử lại sau blocked: ${status.blockedReason}`, notify: status.reported !== SpecState.Blocked };
  }
  if (status.state === SpecState.Failed && specHash !== status.specHash) {
    return { action: ScanAction.RestartFailed, reason: 'spec.md đã được sửa sau khi failed' };
  }
  if (status.reported !== status.state) return { action: ScanAction.Report, reason: `${status.state}, chưa báo` };
  return { action: ScanAction.Skip, reason: `${status.state}, đã báo` };
}

function decideInProgress(status, now, heartbeatTimeoutMinutes) {
  const ageMinutes = (Date.parse(now) - Date.parse(status.heartbeat)) / MILLISECONDS_PER_MINUTE;
  if (ageMinutes < heartbeatTimeoutMinutes) {
    return { action: ScanAction.Skip, reason: `đang chạy (heartbeat ${Math.round(ageMinutes)} phút trước)` };
  }
  return { action: ScanAction.Resume, reason: `heartbeat quá hạn (${Math.round(ageMinutes)} phút)` };
}
