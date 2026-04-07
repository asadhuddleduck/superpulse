export interface IGPost {
  id: string;
  mediaUrl: string;
  thumbnailUrl: string;
  caption: string;
  timestamp: string;
  likeCount: number;
  commentsCount: number;
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  engagementRate: number;
}

export interface Campaign {
  id: string;
  postId: string;
  adAccountId: string;
  metaCampaignId: string;
  metaAdsetId: string;
  metaAdId: string;
  status: "ACTIVE" | "PAUSED" | "DELETED";
  dailyBudget: number;
  createdAt: string;
}

export interface CampaignPerformance {
  campaignId: string;
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  profileVisits: number;
  date: string;
}

export interface BoostSettings {
  tenantId: string;
  dailyBudgetCap: number;
  targetRadiusMiles: number;
  autoBoostEnabled: boolean;
}
