-- CreateEnum
CREATE TYPE "PlatformId" AS ENUM ('INSTAGRAM', 'YOUTUBE');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('DRAFT', 'QUEUED', 'POSTED', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "AutomationLevel" AS ENUM ('OFF', 'COLLECT', 'DRAFT', 'REPLY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "hashedApiKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maxCommentAutomationLevel" "AutomationLevel" NOT NULL DEFAULT 'COLLECT',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "PlatformId" NOT NULL,
    "platformAccountId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "credentialRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Composition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commentAutomationLevel" "AutomationLevel",

    CONSTRAINT "Composition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "compositionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "platform" "PlatformId" NOT NULL,
    "platformPostId" TEXT NOT NULL,
    "content" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramPost" (
    "postId" TEXT NOT NULL,
    "mediaProductType" TEXT NOT NULL,

    CONSTRAINT "InstagramPost_pkey" PRIMARY KEY ("postId")
);

-- CreateTable
CREATE TABLE "YouTubePost" (
    "postId" TEXT NOT NULL,
    "privacyStatus" TEXT NOT NULL,

    CONSTRAINT "YouTubePost_pkey" PRIMARY KEY ("postId")
);

-- CreateTable
CREATE TABLE "PostSchedule" (
    "postId" TEXT NOT NULL,
    "commentAutomationLevel" "AutomationLevel",
    "nextPollAfter" TIMESTAMP(3) NOT NULL,
    "pollIntervalSec" INTEGER NOT NULL,
    "emptyPollCount" INTEGER NOT NULL DEFAULT 0,
    "commentVelocity" DOUBLE PRECISION,
    "cursor" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostSchedule_pkey" PRIMARY KEY ("postId")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "platform" "PlatformId" NOT NULL,
    "postId" TEXT NOT NULL,
    "compositionId" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "platformPostId" TEXT NOT NULL,
    "platformCommentId" TEXT,
    "platformParentCommentId" TEXT,
    "platformAccountId" TEXT NOT NULL,
    "isAuthor" BOOLEAN NOT NULL,
    "text" TEXT NOT NULL,
    "platformCreatedAt" TIMESTAMP(3) NOT NULL,
    "status" "CommentStatus" NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "idempotencyKey" TEXT,
    "requestHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_hashedApiKey_key" ON "User"("hashedApiKey");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_userId_platform_platformAccountId_key" ON "SocialAccount"("userId", "platform", "platformAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Post_userId_platform_platformPostId_key" ON "Post"("userId", "platform", "platformPostId");

-- CreateIndex
CREATE INDEX "PostSchedule_nextPollAfter_idx" ON "PostSchedule"("nextPollAfter");

-- CreateIndex
CREATE INDEX "Comment_compositionId_platformCreatedAt_idx" ON "Comment"("compositionId", "platformCreatedAt");

-- CreateIndex
CREATE INDEX "Comment_postId_platformCreatedAt_idx" ON "Comment"("postId", "platformCreatedAt");

-- CreateIndex
CREATE INDEX "Comment_parentCommentId_isAuthor_idx" ON "Comment"("parentCommentId", "isAuthor");

-- CreateIndex
CREATE UNIQUE INDEX "Comment_userId_platform_platformCommentId_key" ON "Comment"("userId", "platform", "platformCommentId");

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Composition" ADD CONSTRAINT "Composition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_compositionId_fkey" FOREIGN KEY ("compositionId") REFERENCES "Composition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramPost" ADD CONSTRAINT "InstagramPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YouTubePost" ADD CONSTRAINT "YouTubePost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostSchedule" ADD CONSTRAINT "PostSchedule_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-appended: Prisma cannot express a partial unique index.
-- Idempotency contract (2.api-surface.md): only client-supplied outbound replies ever
-- carry a key, so this covers ~1 GB instead of the ~64 GB a full unique index would
-- (0.general-plan.md §5.5). If prisma/schema.prisma changes, `npm run prisma:diff`
-- regenerates everything above this line and overwrites this block — re-append it by hand.
CREATE UNIQUE INDEX "Comment_userId_idempotencyKey_partial_key"
    ON "Comment" ("userId", "idempotencyKey")
    WHERE "idempotencyKey" IS NOT NULL;

