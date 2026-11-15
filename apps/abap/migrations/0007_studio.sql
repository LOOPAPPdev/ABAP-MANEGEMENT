CREATE TABLE `studio_artifacts` (
	`project_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`notice` text NOT NULL,
	`entry` text NOT NULL,
	`revision` integer NOT NULL,
	`bytes` integer NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`published_by` text NOT NULL,
	`published_at` text NOT NULL,
	PRIMARY KEY(`project_id`, `slug`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `studio_files` (
	`project_id` text NOT NULL,
	`slug` text NOT NULL,
	`path` text NOT NULL,
	`content_type` text NOT NULL,
	`content` text NOT NULL,
	`bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	PRIMARY KEY(`project_id`, `slug`, `path`)
);
--> statement-breakpoint
CREATE TABLE `studio_members` (
	`project_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`invited_by` text NOT NULL,
	`invited_at` text NOT NULL,
	`accepted_at` text,
	`revoked_at` text,
	`revoked_by` text,
	PRIMARY KEY(`project_id`, `email`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `studio_members_email_idx` ON `studio_members` (`email`);