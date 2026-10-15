CREATE TABLE "usage_counters" (
	"id" text PRIMARY KEY NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "datasets" (
	"id" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_tasks" (
	"session_id" text NOT NULL,
	"key" text NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "demo_tasks_session_id_key_pk" PRIMARY KEY("session_id","key")
);
--> statement-breakpoint
ALTER TABLE "demo_tasks" ADD CONSTRAINT "demo_tasks_session_id_demo_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."demo_sessions"("id") ON DELETE cascade ON UPDATE no action;