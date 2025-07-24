
-- Table: users_details
CREATE TABLE `users_details` (
  `id` int NOT NULL AUTO_INCREMENT,
  `staffNo` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `hashedDob` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `role` enum('admin','subadmin','user') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `staffNo` (`staffNo`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table: admin_profiles
CREATE TABLE `admin_profiles` (
  `admin_id` int NOT NULL,
  `name` varchar(100) NOT NULL,
  `department` varchar(100) NOT NULL,
  `photo` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `designation` varchar(100) DEFAULT NULL,
  `contacts` json DEFAULT NULL,
  PRIMARY KEY (`admin_id`),
  CONSTRAINT `admin_profiles_ibfk_1` FOREIGN KEY (`admin_id`) REFERENCES `users_details` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: subadmin_profiles
CREATE TABLE `subadmin_profiles` (
  `subadmin_id` int NOT NULL,
  `name` varchar(100) NOT NULL,
  `department` varchar(100) NOT NULL,
  `photo` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `designation` varchar(100) DEFAULT NULL,
  `contacts` json DEFAULT NULL,
  PRIMARY KEY (`subadmin_id`),
  CONSTRAINT `subadmin_profiles_ibfk_1` FOREIGN KEY (`subadmin_id`) REFERENCES `users_details` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: user_profiles
CREATE TABLE `user_profiles` (
  `user_id` int NOT NULL,
  `name` varchar(100) NOT NULL,
  `department` varchar(100) NOT NULL,
  `photo` varchar(255) DEFAULT NULL,
  `designation` varchar(100) DEFAULT NULL,
  `contacts` json DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `user_profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users_details` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: user_complaints
CREATE TABLE `user_complaints` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `description` TEXT NOT NULL,
  `main_issue_id` INT NOT NULL DEFAULT '10',
  `related_issue_id` INT NOT NULL DEFAULT '31',
  `sub_related_issue_id` INT DEFAULT NULL,
  `issue_description_id` INT DEFAULT NULL,
  `priority` ENUM('Low','Medium','High') DEFAULT 'Medium',
  `status` ENUM('Open','Closed','Rejected','Assigned','Pending') DEFAULT NULL,
  `is_ai_resolved` TINYINT(1) DEFAULT '0',
  `assigned_to_id` INT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME DEFAULT NULL,
  `done_by_id` INT DEFAULT NULL,
  `final_sub_related_issue_id` INT DEFAULT NULL,
  `original_main_issue_id` INT DEFAULT '1',
  `severity` VARCHAR(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users_details` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`main_issue_id`) REFERENCES `main_issues` (`id`) ON DELETE SET DEFAULT,
  FOREIGN KEY (`related_issue_id`) REFERENCES `related_issues` (`id`) ON DELETE SET DEFAULT,
  FOREIGN KEY (`sub_related_issue_id`) REFERENCES `sub_related_issues` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`issue_description_id`) REFERENCES `issue_descriptions` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`assigned_to_id`) REFERENCES `users_details` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`done_by_id`) REFERENCES `users_details` (`id`)
);


-- Table: main_issues
CREATE TABLE `main_issues` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: related_issues
CREATE TABLE `related_issues` (
  `id` int NOT NULL AUTO_INCREMENT,
  `main_issue_id` int NOT NULL,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `main_issue_id` (`main_issue_id`),
  CONSTRAINT `related_issues_ibfk_1` FOREIGN KEY (`main_issue_id`) REFERENCES `main_issues` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: sub_related_issues
CREATE TABLE `sub_related_issues` (
  `id` int NOT NULL AUTO_INCREMENT,
  `related_issue_id` int NOT NULL,
  `name` varchar(150) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `related_issue_id` (`related_issue_id`),
  CONSTRAINT `sub_related_issues_ibfk_1` FOREIGN KEY (`related_issue_id`) REFERENCES `related_issues` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: issue_descriptions
CREATE TABLE `issue_descriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sub_related_issue_id` int NOT NULL,
  `description` text NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sub_related_issue_id` (`sub_related_issue_id`),
  CONSTRAINT `issue_descriptions_ibfk_1` FOREIGN KEY (`sub_related_issue_id`) REFERENCES `sub_related_issues` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: issue_solutions
CREATE TABLE `issue_solutions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `issue_description_id` int NOT NULL,
  `step_number` int NOT NULL,
  `step_instruction` text NOT NULL,
  `sub_related_issue_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `issue_description_id` (`issue_description_id`),
  CONSTRAINT `issue_solutions_ibfk_1` FOREIGN KEY (`issue_description_id`) REFERENCES `issue_descriptions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: user_complaints (continued in next cell due to length)

-- Table: subadmin_direct_solutions
CREATE TABLE `subadmin_direct_solutions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `complaint_id` int NOT NULL,
  `subadmin_id` int NOT NULL,
  `solution_text` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `complaint_id` (`complaint_id`),
  KEY `subadmin_id` (`subadmin_id`),
  CONSTRAINT `subadmin_direct_solutions_ibfk_1` FOREIGN KEY (`complaint_id`) REFERENCES `user_complaints` (`id`) ON DELETE CASCADE,
  CONSTRAINT `subadmin_direct_solutions_ibfk_2` FOREIGN KEY (`subadmin_id`) REFERENCES `subadmin_profiles` (`subadmin_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: uncategorized_complaint_solutions
CREATE TABLE `uncategorized_complaint_solutions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `complaint_id` int NOT NULL,
  `subadmin_id` int NOT NULL,
  `main_issue_id` int DEFAULT NULL,
  `related_issue_id` int DEFAULT NULL,
  `sub_related_issue_id` int DEFAULT NULL,
  `issue_description_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `complaint_id` (`complaint_id`),
  KEY `subadmin_id` (`subadmin_id`),
  KEY `main_issue_id` (`main_issue_id`),
  KEY `related_issue_id` (`related_issue_id`),
  KEY `sub_related_issue_id` (`sub_related_issue_id`),
  KEY `issue_description_id` (`issue_description_id`),
  CONSTRAINT `uncategorized_complaint_solutions_ibfk_1` FOREIGN KEY (`complaint_id`) REFERENCES `user_complaints` (`id`),
  CONSTRAINT `uncategorized_complaint_solutions_ibfk_2` FOREIGN KEY (`subadmin_id`) REFERENCES `subadmin_profiles` (`subadmin_id`),
  CONSTRAINT `uncategorized_complaint_solutions_ibfk_3` FOREIGN KEY (`main_issue_id`) REFERENCES `main_issues` (`id`),
  CONSTRAINT `uncategorized_complaint_solutions_ibfk_4` FOREIGN KEY (`related_issue_id`) REFERENCES `related_issues` (`id`),
  CONSTRAINT `uncategorized_complaint_solutions_ibfk_5` FOREIGN KEY (`sub_related_issue_id`) REFERENCES `sub_related_issues` (`id`),
  CONSTRAINT `uncategorized_complaint_solutions_ibfk_6` FOREIGN KEY (`issue_description_id`) REFERENCES `issue_descriptions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: complaint_feedback
CREATE TABLE `complaint_feedback` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `subadmin_id` int NOT NULL,
  `complaint_id` int NOT NULL,
  `label` enum('Excellent','Good','Average','Poor','Very Poor') NOT NULL,
  `comment` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_feedback` (`user_id`,`complaint_id`),
  KEY `subadmin_id` (`subadmin_id`),
  KEY `complaint_id` (`complaint_id`),
  CONSTRAINT `complaint_feedback_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user_profiles` (`user_id`),
  CONSTRAINT `complaint_feedback_ibfk_2` FOREIGN KEY (`subadmin_id`) REFERENCES `subadmin_profiles` (`subadmin_id`),
  CONSTRAINT `complaint_feedback_ibfk_3` FOREIGN KEY (`complaint_id`) REFERENCES `user_complaints` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: ai_resolution_logs
CREATE TABLE `ai_resolution_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `is_resolved` tinyint(1) NOT NULL,
  `session_id` varchar(36) DEFAULT NULL,
  `action` enum('submit_complaint','edit_complaint','delete_complaint','take_complaint','reject_complaint','update_complaint_issues','update_solution','update_issues') DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `ai_resolution_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users_details` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table: pending_complaint_issues
CREATE TABLE `pending_complaint_issues` (
  `id` int NOT NULL AUTO_INCREMENT,
  `complaint_id` int NOT NULL,
  `user_id` int NOT NULL,
  `description` text NOT NULL,
  `solution` text,
  `status` enum('Pending','Approved','Rejected','Solved') DEFAULT 'Pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `complaint_id` (`complaint_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `pending_complaint_issues_ibfk_1` FOREIGN KEY (`complaint_id`) REFERENCES `user_complaints` (`id`) ON DELETE CASCADE,
  CONSTRAINT `pending_complaint_issues_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users_details` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
