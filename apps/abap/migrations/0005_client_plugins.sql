CREATE TABLE `client_plugins` (
	`project_id` text NOT NULL,
	`revision` integer NOT NULL,
	`name` text NOT NULL,
	`version` text NOT NULL,
	`hash` text NOT NULL,
	`files_json` text NOT NULL,
	`generator` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	PRIMARY KEY(`project_id`, `revision`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
