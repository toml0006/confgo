import { z } from "zod";

export const isoDateSchema = z.string().datetime({ offset: true });

export const conferenceInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  locationName: z.string().trim().min(1).max(200),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  topics: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  url: z.string().url().max(500).nullable().optional()
}).refine((value) => new Date(value.startDate).getTime() <= new Date(value.endDate).getTime(), {
  message: "startDate must be before endDate",
  path: ["endDate"]
});

export const mePatchSchema = z.object({
  avatarId: z.number().int().gte(0).lte(47).optional(),
  displayName: z.string().trim().max(50).nullable().optional(),
  photoURL: z.string().url().nullable().optional()
});

export const attendanceSchema = z.object({
  intent: z.enum(["been", "going"])
});

export const devSessionSchema = z.object({
  userId: z.string().trim().min(1)
});

export const sharedConferenceSchema = z.object({
  userIds: z.array(z.string().trim().min(1)).min(1).max(20)
});

