CREATE TABLE `deleted_projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`code` text,
	`name` text NOT NULL,
	`deleted_by` text NOT NULL,
	`deleted_at` text NOT NULL,
	`counts_json` text NOT NULL
);
