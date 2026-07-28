import { isToday, isWithinWeek, formatDate } from "./utils";
import type { ChatSession } from "@/types";

export interface GroupedSessions {
  today: ChatSession[];
  week: ChatSession[];
  older: ChatSession[];
}

export function groupSessions(sessions: ChatSession[]): GroupedSessions {
  const today: ChatSession[] = [];
  const week: ChatSession[] = [];
  const older: ChatSession[] = [];

  for (const s of sessions) {
    const d = new Date(s.updated_at);
    if (isToday(d)) today.push(s);
    else if (isWithinWeek(d)) week.push(s);
    else older.push(s);
  }

  return { today, week, older };
}
