// Shapes of the files under content/. Contributors edit those files; this is what they must match.
import { z } from "zod";

const id = z.string().regex(/^[a-z0-9-]+$/, "lowercase letters, digits and dashes only");
const option = z.object({ id: z.string().regex(/^[a-e]$/), text: z.string().min(1).max(200) });

export const moduleSchema = z.object({
  id: z.string().regex(/^m\d+$/),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(3),
  minutes: z.number().int().positive(),
});

const questionBase = {
  id,
  q: z.string().min(10).max(600),
  options: z.array(option).min(4).max(5),
  answer: z.union([z.string(), z.array(z.string()).min(2)]),
  explain: z.string().min(20).max(1200),
};

export const moduleQuestionSchema = z.object({ ...questionBase, topic: z.string().min(2) }).strict();
export const examQuestionSchema = z.object({ ...questionBase, objective: z.string().min(3) }).strict();

export const domainSchema = z.object({
  id: z.string().regex(/^d\d+$/),
  name: z.string().min(3),
  weight: z.number().positive(),
  count: z.number().int().positive(),
});

export const blueprintSchema = z.object({
  id: id,
  title: z.string(),
  guide: z.string(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z.number().int().positive(),
  minutes: z.number().int().positive(),
  pass: z.number().int().min(100).max(1000),
  domains: z.array(domainSchema).min(1),
  topicDomains: z.record(z.string(), z.string()),
});

export const setSchema = z.object({
  id: z.string().regex(/^[A-Z]$/),
  name: z.string().min(3),
  items: z.array(z.string()),
});

export const manifestSchema = z.object({
  label: z.string().min(1),
  blueprint: z.string(),
  retiredIds: z.array(z.string()),
});

export type Module = z.infer<typeof moduleSchema>;
export type ModuleQuestion = z.infer<typeof moduleQuestionSchema>;
export type ExamQuestion = z.infer<typeof examQuestionSchema>;
export type Blueprint = z.infer<typeof blueprintSchema>;
export type ExamSet = z.infer<typeof setSchema>;
export type Manifest = z.infer<typeof manifestSchema>;
