export type JobStep = "uploading" | "extracting" | "transcribing" | "scoring" | "researching";

export interface JobEvent {
  type: "progress" | "done" | "error";
  step?: JobStep;
  pct?: number;
  label?: string;
  analysisId?: string;
  durationSeconds?: number;
  message?: string;
}

export interface Job {
  id: string;
  status: "pending" | "running" | "done" | "error";
  events: JobEvent[];
  clients: Set<(data: string) => void>;
  createdAt: number;
  analysisId?: string;
  durationSeconds?: number;
  error?: string;
}

const jobs = new Map<string, Job>();

// Prune jobs older than 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [id, job] of jobs.entries()) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}, 60_000);

export function createJob(id: string): Job {
  const job: Job = {
    id,
    status: "pending",
    events: [],
    clients: new Set(),
    createdAt: Date.now(),
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function emitProgress(job: Job, step: JobStep, pct: number, label: string) {
  const event: JobEvent = { type: "progress", step, pct, label };
  job.events.push(event);
  broadcast(job, event);
}

export function emitDone(job: Job, analysisId: string, durationSeconds: number) {
  job.status = "done";
  job.analysisId = analysisId;
  job.durationSeconds = durationSeconds;
  const event: JobEvent = { type: "done", analysisId, durationSeconds };
  job.events.push(event);
  broadcast(job, event);
}

export function emitError(job: Job, message: string) {
  job.status = "error";
  job.error = message;
  const event: JobEvent = { type: "error", message };
  job.events.push(event);
  broadcast(job, event);
}

function broadcast(job: Job, event: JobEvent) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const send of job.clients) {
    send(data);
  }
}

export function addClient(job: Job, send: (data: string) => void) {
  job.clients.add(send);
  // Replay buffered events so late-connecting clients catch up
  for (const event of job.events) {
    send(`data: ${JSON.stringify(event)}\n\n`);
  }
}

export function removeClient(job: Job, send: (data: string) => void) {
  job.clients.delete(send);
}
