CREATE TABLE `leads` (
	`id` text NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`area` text NOT NULL,
	`rating` real NOT NULL,
	`reviews` integer NOT NULL,
	`issue` text NOT NULL,
	`score` integer NOT NULL,
	`phone` text NOT NULL,
	`address` text NOT NULL,
	`website` text,
	`maps_url` text,
	`reason` text NOT NULL,
	`stage` text DEFAULT 'New' NOT NULL,
	`x` integer NOT NULL,
	`y` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`id`, `owner`)
);
--> statement-breakpoint
CREATE INDEX `leads_owner_score_idx` ON `leads` (`owner`,`score`);--> statement-breakpoint
CREATE TABLE `settings` (
	`owner` text PRIMARY KEY NOT NULL,
	`delivery_email` text DEFAULT '' NOT NULL,
	`delivery_hour` integer DEFAULT 8 NOT NULL,
	`daily_limit` integer DEFAULT 10 NOT NULL,
	`area` text DEFAULT 'Sacramento, CA' NOT NULL,
	`radius_miles` integer DEFAULT 5 NOT NULL,
	`category` text DEFAULT 'All local businesses' NOT NULL,
	`min_reviews` integer DEFAULT 10 NOT NULL,
	`updated_at` text NOT NULL
);
