CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `google_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`scope` text NOT NULL,
	`ciphertext` text NOT NULL,
	`iv` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sheet_snapshots` (
	`project_id` text NOT NULL,
	`activity_id` text NOT NULL,
	`values_json` text NOT NULL,
	`synced_at` text NOT NULL,
	PRIMARY KEY(`project_id`, `activity_id`)
);
--> statement-breakpoint
CREATE TABLE `sync_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`mode` text NOT NULL,
	`actor` text NOT NULL,
	`source` text NOT NULL,
	`read_at` text NOT NULL,
	`applied` integer NOT NULL,
	`conflicts` integer NOT NULL,
	`invalid` integer NOT NULL,
	`status` text NOT NULL,
	`message` text DEFAULT '' NOT NULL
);
