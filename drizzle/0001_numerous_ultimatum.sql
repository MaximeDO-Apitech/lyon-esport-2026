CREATE INDEX `idx_presets_family_name` ON `graphics_presets` (`family`,`name`);--> statement-breakpoint
CREATE INDEX `idx_renderer_acks_output` ON `renderer_acks` (`output`,`applied_at`);