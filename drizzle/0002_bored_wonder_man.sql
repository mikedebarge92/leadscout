ALTER TABLE `leads` ADD `is_saved` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `in_discovery` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
UPDATE `leads` SET `is_saved` = 1 WHERE `stage` != 'New';
