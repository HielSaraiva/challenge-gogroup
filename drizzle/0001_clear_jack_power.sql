CREATE TABLE "demo_cases" (
	"session_id" text NOT NULL,
	"order_id" text NOT NULL,
	"version" integer NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "demo_cases_session_id_order_id_pk" PRIMARY KEY("session_id","order_id")
);
--> statement-breakpoint
ALTER TABLE "demo_cases" ADD CONSTRAINT "demo_cases_session_id_demo_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."demo_sessions"("id") ON DELETE cascade ON UPDATE no action;