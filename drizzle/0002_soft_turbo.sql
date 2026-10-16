CREATE TABLE "demo_daily_plans" (
	"session_id" text NOT NULL,
	"key" text NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "demo_daily_plans_session_id_key_pk" PRIMARY KEY("session_id","key")
);
--> statement-breakpoint
ALTER TABLE "demo_daily_plans" ADD CONSTRAINT "demo_daily_plans_session_id_demo_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."demo_sessions"("id") ON DELETE cascade ON UPDATE no action;