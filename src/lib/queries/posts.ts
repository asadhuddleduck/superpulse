import { db } from "@/lib/db";
import type { IGPost } from "@/lib/types";

export async function upsertPost(post: IGPost, tenantId: string): Promise<void> {
  await db.execute({
    sql: `INSERT OR REPLACE INTO ig_posts
      (id, tenant_id, media_url, thumbnail_url, caption, timestamp, like_count, comments_count, media_type, engagement_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
