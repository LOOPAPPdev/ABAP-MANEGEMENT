CREATE TABLE `project_models` (
	`project_id` text NOT NULL,
	`id` text NOT NULL,
	`kind` text NOT NULL,
	`template_id` text,
	`title` text NOT NULL,
	`status` text DEFAULT 'rascunho' NOT NULL,
	`data_json` text NOT NULL,
	`source` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	PRIMARY KEY(`project_id`, `id`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
