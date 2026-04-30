import { db } from "@/lib/db";
import type { IGPost } from "@/lib/types";

export async function upsertPost(post: IGPost, tenantId: string): Promise<void> {
  // ON CONFLICT (not INSERT OR REPLACE) is critical: `boost_eligible` and
  // `copyright_music` get set by markPostIneligible() and must survive every
  // scan-posts cycle. INSERT OR REPLACE is DELETE+INSERT in SQLite — it would
  // silently reset those flags on every cycle, causing every copyright Reel to
  // be re-submitted to Meta every 2h and tanking the App Review error rate.
  await db.execute({
    sql: `INSERT INTO ig_posts
      (id, tenant_id, media_url, thumbnail_url, caption, timestamp, like_count, comments_count, media_type, engagement_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        tenant_id        = excluded.tenant_id,
        media_url        = excluded.media_url,
        thumbnail_url    = excluded.thumbnail_url,
        caption          = excluded.caption,
        timestamp        = excluded.timestamp,
        like_count       = excluded.like_count,
        comments_count   = excluded.comments_count,
        media_type       = excluded.media_type,
        engagement_rate  = excluded.engagement_rate
        -- boost_eligible, ineligible_reason, copyright_music intentionally NOT touched
    `,
    args: [
      post.id,
      tenantId,
      post.mediaUrl,
      post.thumbnailUrl,
      post.caption,
      post.timestamp,
      post.likeCount,
      post.commentsCount,
      post.mediaType,
      post.engagementRate,
    ],
  });
}

export async function getPostsByTenant(tenantId: string): Promise<IGPost[]> {
  const result = await db.execute({
    sql: "SELECT * FROM ig_posts WHERE tenant_id = ? ORDER BY timestamp DESC",
    args: [tenantId],
  });

  return result.rows.map(rowToPost);
}

/** Total ig_posts rows for a tenant — used by StatusPanel "posts detected". */
export async function countPostsByTenant(tenantId: string): Promise<number> {
  const result = await db.execute({
    sql: "SELECT COUNT(*) AS n FROM ig_posts WHERE tenant_id = ?",
    args: [tenantId],
  });
  return Number(result.rows[0]?.n ?? 0);
}

export async function getPostById(id: string): Promise<IGPost | null> {
  const result = await db.execute({
    sql: "SELECT * FROM ig_posts WHERE id = ?",
    args: [id],
  });

  if (result.rows.length === 0) return null;
  return rowToPost(result.rows[0]);
}

export async function getUnboostedPosts(tenantId: string): Promise<IGPost[]> {
  const result = await db.execute({
    sql: `SELECT p.* FROM ig_posts p
      LEFT JOIN active_campaigns c ON p.id = c.post_id
      WHERE p.tenant_id = ? AND c.id IS NULL
      ORDER BY p.timestamp DESC`,
    args: [tenantId],
  });

  return result.rows.map(rowToPost);
}

/**
 * Mark a post as ineligible for boosting (e.g. copyright music). Prevents the
 * cron from retrying it on every cycle and burning API calls on guaranteed errors.
 *
 * If `reason` looks like a copyright/music/audio rejection, also flips the
 * `copyright_music` flag so the dashboard can later surface a "re-upload
 * without the song" hint separately from generic ineligibility.
 */
export async function markPostIneligible(
  postId: string,
  reason: string,
): Promise<void> {
  const isCopyright = /copyright|music|audio/i.test(reason) ? 1 : 0;
  await db.execute({
    sql: `
      UPDATE ig_posts
      SET boost_eligible = 0, ineligible_reason = ?, copyright_music = ?
      WHERE id = ?
    `,
    args: [reason, isCopyright, postId],
  });
}

export async function isPostIneligible(postId: string): Promise<boolean> {
  const result = await db.execute({
    sql: `SELECT boost_eligible FROM ig_posts WHERE id = ? LIMIT 1`,
    args: [postId],
  });
  if (result.rows.length === 0) return false;
  return result.rows[0].boost_eligible === 0;
}

function rowToPost(row: Record<string, unknown>): IGPost {
  return {
    id: row.id as string,
    mediaUrl: row.media_url as string,
    thumbnailUrl: row.thumbnail_url as string,
    caption: row.caption as string,
    timestamp: row.timestamp as string,
    likeCount: row.like_count as number,
    commentsCount: row.comments_count as number,
    mediaType: row.media_type as IGPost["mediaType"],
    engagementRate: row.engagement_rate as number,
  };
}
