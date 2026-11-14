CREATE TABLE `project_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `project_events_idx` ON `project_events` (`project_id`);--> statement-breakpoint
ALTER TABLE `projects` ADD `code` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `drive_folder_id` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `spreadsheet_id` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `updated_at` text;--> statement-breakpoint
-- Sync mode becomes per project: carry the existing global value over to the default project.
INSERT OR IGNORE INTO `app_settings` (`key`, `value`, `updated_at`, `updated_by`)
SELECT 'sheets.syncMode:default', `value`, `updated_at`, `updated_by` FROM `app_settings` WHERE `key` = 'sheets.syncMode';
