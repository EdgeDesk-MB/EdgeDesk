-- Casino cutover (EDGE-47 follow-up): clerk-scope the five casino tables so
-- the hosted desk can hold per-user casino data, and make game names unique
-- per desk instead of globally (two customers can both have "Starburst").
ALTER TABLE "casino_offers" ADD COLUMN "clerk_user_id" text;
ALTER TABLE "casino_offer_series" ADD COLUMN "clerk_user_id" text;
ALTER TABLE "casino_offer_components" ADD COLUMN "clerk_user_id" text;
ALTER TABLE "casino_offer_series_components" ADD COLUMN "clerk_user_id" text;
ALTER TABLE "casino_games" ADD COLUMN "clerk_user_id" text;
ALTER TABLE "casino_games" DROP CONSTRAINT IF EXISTS "casino_games_name_unique";
ALTER TABLE "casino_games" ADD CONSTRAINT "casino_games_user_name" UNIQUE("clerk_user_id", "name");
