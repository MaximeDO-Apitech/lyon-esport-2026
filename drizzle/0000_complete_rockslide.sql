CREATE TABLE `graphics_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`result_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `graphics_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`template_version` text NOT NULL,
	`name` text NOT NULL,
	`family` text NOT NULL,
	`content_json` text NOT NULL,
	`validation_status` text NOT NULL,
	`resource_revision` text NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `graphics_state` (
	`channel` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`state_json` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `renderer_acks` (
	`renderer_id` text NOT NULL,
	`output` text NOT NULL,
	`revision` integer NOT NULL,
	`applied_at` text NOT NULL,
	PRIMARY KEY(`renderer_id`, `output`)
);
