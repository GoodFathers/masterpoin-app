import {
  bigint,
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"),
  religion: text("religion").notNull().default("islam"),
  phone: text("phone"),
  city: text("city"),
  avatarUrl: text("avatar_url"),
  accessCode: text("access_code").unique(),
  canEditPoints: boolean("can_edit_points").notNull().default(false),
  accessStatus: text("access_status").notNull().default("inactive"),
  timerStartedAt: timestamp("timer_started_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const routines = pgTable("routines", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  category: text("category").notNull().default("produktivitas"),
  religion: text("religion").notNull().default("semua"),
  points: integer("points").notNull().default(40),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const routineLogs = pgTable(
  "routine_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    routineId: integer("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    logDate: text("log_date").notNull(),
    points: integer("points").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("routine_logs_unique_day").on(table.userId, table.routineId, table.logDate)],
);

export const checkIns = pgTable(
  "check_ins",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    checkInDate: text("check_in_date").notNull(),
    mood: text("mood").notNull().default("semangat"),
    note: text("note"),
    points: integer("points").notNull().default(250),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("check_ins_unique_day").on(table.userId, table.checkInDate)],
);

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  detail: text("detail"),
  points: integer("points").notNull(),
  reference: text("reference"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rewards = pgTable("rewards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("voucher"),
  pointsCost: integer("points_cost").notNull(),
  stock: integer("stock").notNull().default(10),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const redemptions = pgTable("redemptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  rewardId: integer("reward_id")
    .notNull()
    .references(() => rewards.id, { onDelete: "cascade" }),
  pointsSpent: integer("points_spent").notNull(),
  status: text("status").notNull().default("diproses"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accessRequests = pgTable("access_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  uniqueCode: text("unique_code").notNull(),
  status: text("status").notNull().default("pending"),
  proofUrl: text("proof_url"),
  proofName: text("proof_name"),
  senderName: text("sender_name"),
  note: text("note"),
  adminNote: text("admin_note"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appMeta = pgTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const matrixMembers = pgTable(
  "matrix_members",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    phase: integer("phase").notNull().default(1), // 1, 2, 3
    level: integer("level").notNull().default(1),
    tingkat: text("tingkat").notNull().default("Training 1"),
    parentId: integer("parent_id"), // upline in matrix
    sponsorId: integer("sponsor_id").references(() => users.id, { onDelete: "set null" }),
    position: integer("position").notNull().default(0), // slot index
    status: text("status").notNull().default("active"),
    directDownlines: integer("direct_downlines").notNull().default(0),
    totalDownlines: integer("total_downlines").notNull().default(0),
    commissionEarned: bigint("commission_earned", { mode: "number" }).notNull().default(0),
    bonusEarned: bigint("bonus_earned", { mode: "number" }).notNull().default(0),
    rewardEarned: text("reward_earned"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("matrix_member_user_phase").on(table.userId, table.phase)],
);

export const matrixTiers = pgTable(
  "matrix_tiers",
  {
    id: serial("id").primaryKey(),
    phase: integer("phase").notNull(), // 1, 2, 3
    level: integer("level").notNull(),
    tingkat: text("tingkat").notNull(),
    userTarget: integer("user_target").notNull(),
    bonusSponsor: bigint("bonus_sponsor", { mode: "number" }).notNull().default(0),
    bonusSpillover: bigint("bonus_spillover", { mode: "number" }).notNull().default(0),
    bonusLevel: bigint("bonus_level", { mode: "number" }).notNull().default(0),
    rewardName: text("reward_name"),
    rewardValue: bigint("reward_value", { mode: "number" }).notNull().default(0),
    checkinMultiplier: integer("checkin_multiplier").notNull().default(100), // percentage (100 = 100%)
    routinePointsBonus: integer("routine_points_bonus").notNull().default(0),
    requirementNote: text("requirement_note"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [uniqueIndex("matrix_tier_phase_level").on(table.phase, table.level)],
);

export const matrixMissions = pgTable("matrix_missions", {
  id: serial("id").primaryKey(),
  phase: integer("phase").notNull().default(1),
  title: text("title").notNull(),
  description: text("description"),
  targetType: text("target_type").notNull().default("downlines"), // downlines, tingkat, checkin, routine
  targetCount: integer("target_count").notNull().default(1),
  rewardPoints: integer("reward_points").notNull().default(1000),
  rewardBonus: integer("reward_bonus").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const matrixUserMissions = pgTable(
  "matrix_user_missions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    missionId: integer("mission_id")
      .notNull()
      .references(() => matrixMissions.id, { onDelete: "cascade" }),
    progress: integer("progress").notNull().default(0),
    isCompleted: boolean("is_completed").notNull().default(false),
    isClaimed: boolean("is_claimed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("matrix_user_mission_unique").on(table.userId, table.missionId)],
);

export type User = typeof users.$inferSelect;
export type MatrixMember = typeof matrixMembers.$inferSelect;
export type MatrixTier = typeof matrixTiers.$inferSelect;
export type MatrixMission = typeof matrixMissions.$inferSelect;
export type MatrixUserMission = typeof matrixUserMissions.$inferSelect;
export type Routine = typeof routines.$inferSelect;
export type CheckIn = typeof checkIns.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Reward = typeof rewards.$inferSelect;
export type Redemption = typeof redemptions.$inferSelect;
export type AccessRequest = typeof accessRequests.$inferSelect;
