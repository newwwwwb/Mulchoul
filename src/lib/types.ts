// DB 행 타입 정의 (명세서 8장 테이블 대응)

import type { DayType } from "../logic/timetable";
import type { Role } from "../logic/roles";

export interface Employee {
  id: string;
  name: string;
  sort_order: number;
}

export interface DailyRecord {
  date: string; // YYYY-MM-DD (KST)
  day_type: DayType;
  first_round_a_role: Role;
  busy_time: number | null;
  busy_time_by: string | null;
  busy_time_at: string | null;
  created_at: string;
}

export interface NumberAssignment {
  date: string;
  number: number;
  employee_id: string;
}

export interface Attendance {
  id: string;
  date: string;
  employee_id: string;
  check_in_at: string;
  is_substitute: boolean;
  substitute_name: string | null;
}

export interface SubstitutePlan {
  id: string;
  date: string;
  employee_id: string;
  substitute_name: string;
  created_at: string;
}

export interface Holiday {
  date: string;
  name: string;
}
