import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { generatedCvDraftSchema } from "@/lib/cv-draft";
import { QUESTIONNAIRE_VERSION, type CvQuestionnaireAnswers } from "@/lib/cv-questionnaire";
import { buildCvInsert, createCv, deleteCv, getCv, listCvs, updateCv } from "@/lib/services/cv-repository";
import { createFakeSupabase, type CvRow } from "@/tests/support/fake-supabase";
import type { Json } from "@/db/database.types";

/**
 * Owner scoping for saved CVs (F-02 / S-06).
 *
 * The risk: one account reading, overwriting, or deleting another account's CV. The
 * database enforces this with owner-only RLS policies; the repository adds a second,
 * independent layer by filtering every query on `user_id`. These tests exercise that
 * second layer by running the real repository functions against an in-memory client,
 * so a dropped `.eq("user_id", …)` fails here rather than in production behind RLS.
 *
 * The RLS policies themselves need a live database — see the two-account manual check
 * in `context/foundation/test-plan.md` (R-05).
 */

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

const OWNER_CV_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OWNER_OLDER_CV_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER_CV_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const fixtureDraft = generatedCvDraftSchema.parse(
  JSON.parse(readFileSync("context/changes/generation-export-decision-contract/cv-contract.fixture.json", "utf-8")),
);

const answers: CvQuestionnaireAnswers = {
  fullName: "Ada Lovelace",
  targetRoleOrGoal: "Data Analyst",
  outputLanguage: "en",
  experience: "",
  education: "",
  skillsAndTools: "",
  spokenLanguages: "",
  additionalContext: "",
};

function row(id: string, userId: string, title: string, updatedAt: string): CvRow {
  return {
    id,
    user_id: userId,
    title,
    language: "en",
    draft: fixtureDraft,
    source_snapshot: {
      questionnaireVersion: QUESTIONNAIRE_VERSION,
      answers,
      capturedAt: "2026-06-01T10:00:00.000Z",
    } as unknown as Json,
    created_at: "2026-06-01T10:00:00.000Z",
    updated_at: updatedAt,
  };
}

function seed() {
  return createFakeSupabase([
    row(OWNER_CV_ID, OWNER, "Owner newest", "2026-06-05T10:00:00.000Z"),
    row(OWNER_OLDER_CV_ID, OWNER, "Owner oldest", "2026-06-02T10:00:00.000Z"),
    row(OTHER_CV_ID, OTHER, "Someone else's CV", "2026-06-06T10:00:00.000Z"),
  ]);
}

describe("listCvs", () => {
  it("returns only the caller's rows, newest-updated first", async () => {
    const { client } = seed();

    const owned = await listCvs(client, OWNER);

    expect(owned.map((cv) => cv.id)).toEqual([OWNER_CV_ID, OWNER_OLDER_CV_ID]);
    expect(owned.some((cv) => cv.id === OTHER_CV_ID)).toBe(false);
  });

  it("returns an empty list for an account with no CVs", async () => {
    const { client } = seed();

    expect(await listCvs(client, "33333333-3333-4333-8333-333333333333")).toEqual([]);
  });
});

describe("getCv", () => {
  it("loads the caller's own CV in full", async () => {
    const { client } = seed();

    const cv = await getCv(client, OWNER, OWNER_CV_ID);

    expect(cv?.id).toBe(OWNER_CV_ID);
    expect(cv?.draft.language).toBe("en");
    expect(cv?.sourceSnapshot.questionnaireVersion).toBe(QUESTIONNAIRE_VERSION);
  });

  it("returns null for a CV owned by someone else", async () => {
    const { client } = seed();

    expect(await getCv(client, OTHER, OWNER_CV_ID)).toBeNull();
  });
});

describe("updateCv", () => {
  it("overwrites the caller's own CV", async () => {
    const { client, rows } = seed();

    const updated = await updateCv(client, OWNER, OWNER_CV_ID, { title: "Renamed", draft: fixtureDraft, answers });

    expect(updated?.title).toBe("Renamed");
    expect(rows.find((r) => r.id === OWNER_CV_ID)?.title).toBe("Renamed");
  });

  it("refuses a CV owned by someone else and leaves the row untouched", async () => {
    const { client, rows } = seed();
    const before = rows.map((r) => ({ ...r }));

    const result = await updateCv(client, OTHER, OWNER_CV_ID, {
      title: "Hijacked",
      draft: fixtureDraft,
      answers,
    });

    expect(result).toBeNull();
    expect(rows).toEqual(before);
  });
});

describe("deleteCv", () => {
  it("removes the caller's own CV", async () => {
    const { client, rows } = seed();

    expect(await deleteCv(client, OWNER, OWNER_CV_ID)).toBe(true);
    expect(rows.some((r) => r.id === OWNER_CV_ID)).toBe(false);
  });

  it("refuses a CV owned by someone else and leaves the row in place", async () => {
    const { client, rows } = seed();

    expect(await deleteCv(client, OTHER, OWNER_CV_ID)).toBe(false);
    expect(rows.some((r) => r.id === OWNER_CV_ID)).toBe(true);
  });
});

describe("createCv", () => {
  it("stamps the caller as the owner and ignores any client-supplied owner", async () => {
    const { client, rows } = seed();

    await createCv(client, OWNER, { draft: fixtureDraft, answers });

    const inserted = rows.filter((r) => r.id !== OWNER_CV_ID && r.id !== OWNER_OLDER_CV_ID && r.id !== OTHER_CV_ID);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].user_id).toBe(OWNER);

    // `SaveCvInput` has no owner field by design; even if a payload smuggles one in,
    // the insert row is built from the verified user id passed by the route.
    const smuggled = buildCvInsert(OWNER, { draft: fixtureDraft, answers, user_id: OTHER } as never);
    expect(smuggled.user_id).toBe(OWNER);
  });
});
