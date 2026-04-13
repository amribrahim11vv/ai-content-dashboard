import { nanoid } from "nanoid";
import { kitFailureLogs } from "../db/schema.js";

type LogFailureInput = {
  kitId?: string;
  phase: "generate" | "retry" | "regenerate" | "content_package_chain";
  errorCode: string;
  errorMessage: string;
  correlationId: string;
  modelUsed: string;
  meta?: Record<string, unknown>;
};

export async function logKitFailure(db: any, input: LogFailureInput): Promise<void> {
  await db.insert(kitFailureLogs).values({
    id: nanoid(),
    kitId: input.kitId ?? null,
    phase: input.phase,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    correlationId: input.correlationId,
    modelUsed: input.modelUsed,
    metaJson: JSON.stringify(input.meta ?? {}),
    createdAt: new Date(),
  });
}
