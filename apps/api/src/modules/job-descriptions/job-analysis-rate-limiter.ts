import { MongoClient, type Db } from "mongodb";

import type { Environment } from "../../config/environment.js";

export const jobAnalysisRequestsPerHour = 10;
const windowMilliseconds = 60 * 60 * 1_000;

export interface JobAnalysisRateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface JobAnalysisRateLimiter {
  consume(
    userId: string,
    now?: Date,
    operationId?: string,
  ): Promise<JobAnalysisRateLimitResult>;
}

function windowStart(now: Date) {
  return new Date(
    Math.floor(now.getTime() / windowMilliseconds) * windowMilliseconds,
  );
}

function retryAfter(now: Date, startedAt: Date) {
  return Math.max(
    1,
    Math.ceil(
      (startedAt.getTime() + windowMilliseconds - now.getTime()) / 1_000,
    ),
  );
}

export function createMemoryJobAnalysisRateLimiter(): JobAnalysisRateLimiter {
  const buckets = new Map<
    string,
    { count: number; operationIds: Set<string>; startedAt: Date }
  >();
  return {
    async consume(userId, now = new Date(), operationId) {
      const startedAt = windowStart(now);
      const key = `${userId}:${startedAt.toISOString()}`;
      const bucket = buckets.get(key) ?? {
        count: 0,
        operationIds: new Set<string>(),
        startedAt,
      };
      if (!operationId || !bucket.operationIds.has(operationId)) {
        bucket.count += 1;
        if (operationId) bucket.operationIds.add(operationId);
      }
      buckets.set(key, bucket);
      return {
        allowed: bucket.count <= jobAnalysisRequestsPerHour,
        retryAfterSeconds: retryAfter(now, startedAt),
      };
    },
  };
}

interface RateLimitBucket {
  _id: string;
  count: number;
  operationIds?: string[];
  createdAt: Date;
}

export function createMongoJobAnalysisRateLimiter(
  database: Db,
): JobAnalysisRateLimiter {
  const buckets = database.collection<RateLimitBucket>("ai_rate_limits");
  let indexReady: Promise<unknown> | null = null;
  const ensureIndex = () =>
    (indexReady ??= buckets.createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 2 * 60 * 60 },
    ));

  return {
    async consume(userId, now = new Date(), operationId) {
      await ensureIndex();
      const startedAt = windowStart(now);
      const bucket = operationId
        ? await buckets.findOneAndUpdate(
            { _id: `${userId}:${startedAt.toISOString()}` },
            [
              {
                $set: {
                  createdAt: { $ifNull: ["$createdAt", startedAt] },
                  count: {
                    $cond: [
                      {
                        $in: [operationId, { $ifNull: ["$operationIds", []] }],
                      },
                      { $ifNull: ["$count", 0] },
                      { $add: [{ $ifNull: ["$count", 0] }, 1] },
                    ],
                  },
                  operationIds: {
                    $cond: [
                      {
                        $in: [operationId, { $ifNull: ["$operationIds", []] }],
                      },
                      { $ifNull: ["$operationIds", []] },
                      {
                        $concatArrays: [
                          { $ifNull: ["$operationIds", []] },
                          [operationId],
                        ],
                      },
                    ],
                  },
                },
              },
            ],
            { upsert: true, returnDocument: "after" },
          )
        : await buckets.findOneAndUpdate(
            { _id: `${userId}:${startedAt.toISOString()}` },
            {
              $inc: { count: 1 },
              $setOnInsert: { createdAt: startedAt },
            },
            { upsert: true, returnDocument: "after" },
          );
      return {
        allowed:
          (bucket?.count ?? jobAnalysisRequestsPerHour + 1) <=
          jobAnalysisRequestsPerHour,
        retryAfterSeconds: retryAfter(now, startedAt),
      };
    },
  };
}

export function createJobAnalysisRateLimiterRuntime(environment: Environment) {
  if (environment.AUTH_STORAGE !== "mongodb" || !environment.MONGODB_URI) {
    return {
      limiter: createMemoryJobAnalysisRateLimiter(),
      close: async () => {},
    };
  }
  const client = new MongoClient(environment.MONGODB_URI);
  return {
    limiter: createMongoJobAnalysisRateLimiter(
      client.db(environment.MONGODB_DATABASE),
    ),
    close: async () => client.close(),
  };
}
