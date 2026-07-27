CREATE TABLE `api_credentials` (
	`owner` text NOT NULL,
	`service` text NOT NULL,
	`ciphertext` text NOT NULL,
	`iv` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner`, `service`)
);
