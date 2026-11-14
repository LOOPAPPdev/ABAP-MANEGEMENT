CREATE TABLE `activities` (
	`project_id` text NOT NULL,
	`id` text NOT NULL,
	`phase` text NOT NULL,
	`area` text NOT NULL,
	`title` text NOT NULL,
	`objective` text DEFAULT '' NOT NULL,
	`tutorial` text DEFAULT '' NOT NULL,
	`knowledge` text DEFAULT '' NOT NULL,
	`tool` text DEFAULT '' NOT NULL,
	`deliverable` text DEFAULT '' NOT NULL,
	`dependency_id` text,
	`acceptance` text NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`priority` text NOT NULL,
	`owner` text DEFAULT '' NOT NULL,
	`due` text,
	`notes` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	PRIMARY KEY(`project_id`, `id`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `activity_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`activity_id` text NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`from_value` text,
	`to_value` text,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_activity_idx` ON `activity_events` (`project_id`,`activity_id`);--> statement-breakpoint
CREATE TABLE `evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`activity_id` text NOT NULL,
	`kind` text NOT NULL,
	`ref` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `evidence_activity_idx` ON `evidence` (`project_id`,`activity_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);
