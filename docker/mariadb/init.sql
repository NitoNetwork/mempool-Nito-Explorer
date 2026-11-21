/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19  Distrib 10.6.23-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: mempool_nito
-- ------------------------------------------------------
-- Server version	10.6.23-MariaDB-0ubuntu0.22.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `accelerations`
--

DROP TABLE IF EXISTS `accelerations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `accelerations` (
  `txid` varchar(65) NOT NULL,
  `added` datetime DEFAULT NULL,
  `height` int(10) NOT NULL,
  `pool` smallint(5) unsigned DEFAULT NULL,
  `effective_vsize` int(10) NOT NULL,
  `effective_fee` decimal(65,0) unsigned NOT NULL,
  `boost_rate` float unsigned DEFAULT NULL,
  `boost_cost` decimal(65,0) unsigned NOT NULL,
  `requested` datetime DEFAULT NULL,
  PRIMARY KEY (`txid`),
  KEY `added` (`added`),
  KEY `height` (`height`),
  KEY `pool` (`pool`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `blocks`
--

DROP TABLE IF EXISTS `blocks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `blocks` (
  `height` int(10) unsigned NOT NULL DEFAULT 0,
  `hash` varchar(65) NOT NULL,
  `blockTimestamp` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `size` int(10) unsigned NOT NULL DEFAULT 0,
  `weight` int(10) unsigned NOT NULL DEFAULT 0,
  `tx_count` smallint(5) unsigned NOT NULL DEFAULT 0,
  `coinbase_raw` text DEFAULT NULL,
  `difficulty` double unsigned NOT NULL DEFAULT 0,
  `pool_id` smallint(5) unsigned DEFAULT NULL,
  `fees` decimal(65,0) unsigned NOT NULL DEFAULT 0,
  `fee_span` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`fee_span`)),
  `median_fee` bigint(20) unsigned NOT NULL DEFAULT 0,
  `reward` decimal(65,0) unsigned NOT NULL DEFAULT 0,
  `version` int(10) unsigned NOT NULL DEFAULT 0,
  `bits` int(10) unsigned NOT NULL DEFAULT 0,
  `nonce` bigint(20) unsigned NOT NULL DEFAULT 0,
  `merkle_root` varchar(65) NOT NULL DEFAULT '',
  `previous_block_hash` varchar(65) DEFAULT NULL,
  `avg_fee` decimal(65,0) unsigned NOT NULL DEFAULT 0,
  `avg_fee_rate` bigint(20) unsigned NOT NULL DEFAULT 0,
  `median_timestamp` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `coinbase_address` varchar(100) DEFAULT NULL,
  `coinbase_signature` varchar(500) DEFAULT NULL,
  `coinbase_signature_ascii` varchar(500) DEFAULT NULL,
  `avg_tx_size` double unsigned NOT NULL,
  `total_inputs` int(10) unsigned NOT NULL,
  `total_outputs` int(10) unsigned NOT NULL,
  `total_output_amt` decimal(65,0) unsigned NOT NULL,
  `amounts_version` tinyint unsigned NOT NULL DEFAULT 0,
  KEY `blocks_amounts_version` (`amounts_version`, `height`),
  `fee_percentiles` longtext DEFAULT NULL,
  `median_fee_amt` decimal(65,0) unsigned DEFAULT NULL,
  `segwit_total_txs` int(10) unsigned NOT NULL,
  `segwit_total_size` int(10) unsigned NOT NULL,
  `segwit_total_weight` int(10) unsigned NOT NULL,
  `header` varchar(160) NOT NULL,
  `utxoset_change` int(11) NOT NULL,
  `utxoset_size` int(10) unsigned DEFAULT NULL,
  `total_input_amt` decimal(65,0) unsigned DEFAULT NULL,
  `coinbase_addresses` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`coinbase_addresses`)),
  `first_seen` datetime(6) DEFAULT NULL,
  `definition_hash` varchar(255) DEFAULT '895cf0903e771beb647d0c1356bb4b8f4f123af7',
  `index_version` int(11) NOT NULL DEFAULT 0,
  `stale` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`hash`),
  KEY `pool_id` (`pool_id`),
  KEY `blockTimestamp` (`blockTimestamp`),
  KEY `hash` (`hash`),
  KEY `definition_hash` (`definition_hash`),
  KEY `index_version` (`index_version`),
  KEY `stale` (`stale`),
  KEY `height` (`height`),
  CONSTRAINT `blocks_ibfk_1` FOREIGN KEY (`pool_id`) REFERENCES `pools` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `blocks_audits`
--

DROP TABLE IF EXISTS `blocks_audits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `blocks_audits` (
  `time` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `hash` varchar(65) NOT NULL,
  `height` int(10) unsigned NOT NULL,
  `missing_txs` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`missing_txs`)),
  `added_txs` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`added_txs`)),
  `match_rate` float unsigned NOT NULL,
  `fresh_txs` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT '[]' CHECK (json_valid(`fresh_txs`)),
  `sigop_txs` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT '[]' CHECK (json_valid(`sigop_txs`)),
  `expected_fees` decimal(65,0) unsigned DEFAULT NULL,
  `expected_weight` bigint(20) unsigned DEFAULT NULL,
  `fullrbf_txs` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT '[]' CHECK (json_valid(`fullrbf_txs`)),
  `accelerated_txs` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT '[]' CHECK (json_valid(`accelerated_txs`)),
  `prioritized_txs` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT '[]' CHECK (json_valid(`prioritized_txs`)),
  `version` int(11) NOT NULL DEFAULT 0,
  `unseen_txs` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT '[]' CHECK (json_valid(`unseen_txs`)),
  PRIMARY KEY (`hash`),
  KEY `height` (`height`),
  KEY `version` (`version`),
  KEY `time` (`time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `blocks_prices`
--

DROP TABLE IF EXISTS `blocks_prices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `blocks_prices` (
  `height` int(10) unsigned NOT NULL,
  `price_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`height`),
  KEY `price_id` (`price_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `blocks_summaries`
--

DROP TABLE IF EXISTS `blocks_summaries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `blocks_summaries` (
  `height` int(10) unsigned NOT NULL,
  `id` varchar(65) NOT NULL,
  `transactions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`transactions`)),
  `version` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `height` (`height`),
  KEY `version` (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `blocks_templates`
--

DROP TABLE IF EXISTS `blocks_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `blocks_templates` (
  `id` varchar(65) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `template` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT '[]' CHECK (json_valid(`template`)),
  `version` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `version` (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `channels`
--

DROP TABLE IF EXISTS `channels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `channels` (
  `id` bigint(11) unsigned NOT NULL,
  `short_id` varchar(15) NOT NULL DEFAULT '',
  `capacity` bigint(20) unsigned NOT NULL,
  `transaction_id` varchar(64) NOT NULL,
  `transaction_vout` int(11) NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `created` datetime DEFAULT NULL,
  `status` int(11) NOT NULL DEFAULT 0,
  `closing_transaction_id` varchar(64) DEFAULT NULL,
  `closing_date` datetime DEFAULT NULL,
  `closing_reason` int(11) DEFAULT NULL,
  `node1_public_key` varchar(66) NOT NULL,
  `node1_base_fee_mtokens` bigint(20) unsigned DEFAULT NULL,
  `node1_cltv_delta` int(11) DEFAULT NULL,
  `node1_fee_rate` bigint(11) DEFAULT NULL,
  `node1_is_disabled` tinyint(1) DEFAULT NULL,
  `node1_max_htlc_mtokens` bigint(20) unsigned DEFAULT NULL,
  `node1_min_htlc_mtokens` bigint(20) DEFAULT NULL,
  `node1_updated_at` datetime DEFAULT NULL,
  `node2_public_key` varchar(66) NOT NULL,
  `node2_base_fee_mtokens` bigint(20) unsigned DEFAULT NULL,
  `node2_cltv_delta` int(11) DEFAULT NULL,
  `node2_fee_rate` bigint(11) DEFAULT NULL,
  `node2_is_disabled` tinyint(1) DEFAULT NULL,
  `node2_max_htlc_mtokens` bigint(20) unsigned DEFAULT NULL,
  `node2_min_htlc_mtokens` bigint(20) unsigned DEFAULT NULL,
  `node2_updated_at` datetime DEFAULT NULL,
  `closing_resolved` tinyint(1) DEFAULT 0,
  `source_checked` tinyint(1) DEFAULT 0,
  `closing_fee` bigint(20) unsigned DEFAULT 0,
  `node1_funding_balance` bigint(20) unsigned DEFAULT 0,
  `node2_funding_balance` bigint(20) unsigned DEFAULT 0,
  `node1_closing_balance` bigint(20) unsigned DEFAULT 0,
  `node2_closing_balance` bigint(20) unsigned DEFAULT 0,
  `funding_ratio` float unsigned DEFAULT NULL,
  `closed_by` varchar(66) DEFAULT NULL,
  `single_funded` tinyint(1) DEFAULT 0,
  `outputs` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT '[]' CHECK (json_valid(`outputs`)),
  PRIMARY KEY (`id`),
  KEY `node1_public_key` (`node1_public_key`),
  KEY `node2_public_key` (`node2_public_key`),
  KEY `status` (`status`),
  KEY `short_id` (`short_id`),
  KEY `transaction_id` (`transaction_id`),
  KEY `closing_transaction_id` (`closing_transaction_id`),
  KEY `created` (`created`),
  KEY `capacity` (`capacity`),
  KEY `closing_reason` (`closing_reason`),
  KEY `closing_resolved` (`closing_resolved`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `compact_cpfp_clusters`
--

DROP TABLE IF EXISTS `compact_cpfp_clusters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `compact_cpfp_clusters` (
  `root` binary(32) NOT NULL,
  `height` int(10) NOT NULL,
  `txs` blob DEFAULT NULL,
  `fee_rate` float unsigned DEFAULT NULL,
  PRIMARY KEY (`root`),
  KEY `height` (`height`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `compact_transactions`
--

DROP TABLE IF EXISTS `compact_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `compact_transactions` (
  `txid` binary(32) NOT NULL,
  `cluster` binary(32) DEFAULT NULL,
  PRIMARY KEY (`txid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `difficulty_adjustments`
--

DROP TABLE IF EXISTS `difficulty_adjustments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `difficulty_adjustments` (
  `time` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `height` int(10) unsigned NOT NULL,
  `difficulty` double unsigned NOT NULL,
  `adjustment` float NOT NULL,
  PRIMARY KEY (`height`),
  KEY `time` (`time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `elements_pegs`
--

DROP TABLE IF EXISTS `elements_pegs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `elements_pegs` (
  `block` int(11) NOT NULL,
  `datetime` int(11) NOT NULL,
  `amount` bigint(20) NOT NULL,
  `txid` varchar(65) NOT NULL,
  `txindex` int(11) NOT NULL,
  `bitcoinaddress` varchar(100) NOT NULL,
  `bitcointxid` varchar(65) NOT NULL,
  `bitcoinindex` int(11) NOT NULL,
  `final_tx` int(11) NOT NULL,
  PRIMARY KEY (`txid`,`txindex`),
  KEY `block` (`block`),
  KEY `datetime` (`datetime`),
  KEY `amount` (`amount`),
  KEY `bitcoinaddress` (`bitcoinaddress`),
  KEY `bitcointxid` (`bitcointxid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `federation_peg_scripts`
--

DROP TABLE IF EXISTS `federation_peg_scripts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `federation_peg_scripts` (
  `address` varchar(100) NOT NULL,
  `fedpegscript` text NOT NULL,
  `timelock` int(11) unsigned NOT NULL,
  `blocknumber` int(11) unsigned NOT NULL,
  PRIMARY KEY (`address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `federation_txos`
--

DROP TABLE IF EXISTS `federation_txos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `federation_txos` (
  `txid` varchar(65) NOT NULL,
  `txindex` int(11) NOT NULL,
  `bitcoinaddress` varchar(100) NOT NULL,
  `amount` bigint(20) unsigned NOT NULL,
  `blocknumber` int(11) unsigned NOT NULL,
  `blocktime` int(11) unsigned NOT NULL,
  `unspent` tinyint(1) NOT NULL,
  `lastblockupdate` int(11) unsigned NOT NULL,
  `lasttimeupdate` int(11) unsigned NOT NULL,
  `pegtxid` varchar(65) NOT NULL,
  `pegindex` int(11) NOT NULL,
  `pegblocktime` int(11) unsigned NOT NULL,
  `timelock` int(11) NOT NULL DEFAULT 0,
  `expiredAt` int(11) NOT NULL DEFAULT 0,
  `emergencyKey` tinyint(4) NOT NULL DEFAULT 0,
  PRIMARY KEY (`txid`,`txindex`),
  KEY `bitcoinaddress` (`bitcoinaddress`),
  KEY `unspent` (`unspent`),
  KEY `lastblockupdate` (`lastblockupdate`),
  KEY `blocktime` (`blocktime`),
  KEY `emergencyKey` (`emergencyKey`),
  KEY `expiredAt` (`expiredAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `geo_names`
--

DROP TABLE IF EXISTS `geo_names`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `geo_names` (
  `id` int(11) unsigned NOT NULL,
  `type` enum('city','country','division','continent','as_organization','country_iso_code') NOT NULL,
  `names` text DEFAULT NULL,
  UNIQUE KEY `id` (`id`,`type`),
  KEY `id_2` (`id`),
  KEY `names` (`names`(1024))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `hashrates`
--

DROP TABLE IF EXISTS `hashrates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `hashrates` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `hashrate_timestamp` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `avg_hashrate` double unsigned DEFAULT 0,
  `pool_id` smallint(5) unsigned NOT NULL DEFAULT 0,
  `share` float NOT NULL DEFAULT 0,
  `type` enum('daily','weekly') DEFAULT 'daily',
  PRIMARY KEY (`id`),
  UNIQUE KEY `hashrate_timestamp_pool_id` (`hashrate_timestamp`,`pool_id`),
  KEY `pool_id` (`pool_id`),
  KEY `type` (`type`)
) ENGINE=InnoDB AUTO_INCREMENT=353 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lightning_stats`
--

DROP TABLE IF EXISTS `lightning_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lightning_stats` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `added` timestamp NULL DEFAULT NULL,
  `channel_count` int(11) NOT NULL,
  `node_count` int(11) NOT NULL,
  `total_capacity` double unsigned NOT NULL,
  `tor_nodes` int(11) NOT NULL DEFAULT 0,
  `clearnet_nodes` int(11) NOT NULL DEFAULT 0,
  `unannounced_nodes` int(11) NOT NULL DEFAULT 0,
  `avg_capacity` bigint(20) unsigned NOT NULL DEFAULT 0,
  `avg_fee_rate` int(11) unsigned NOT NULL DEFAULT 0,
  `avg_base_fee_mtokens` bigint(20) unsigned NOT NULL DEFAULT 0,
  `med_capacity` bigint(20) unsigned NOT NULL DEFAULT 0,
  `med_fee_rate` int(11) unsigned NOT NULL DEFAULT 0,
  `med_base_fee_mtokens` bigint(20) unsigned NOT NULL DEFAULT 0,
  `clearnet_tor_nodes` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `added_unique` (`added`),
  KEY `added` (`added`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `node_stats`
--

DROP TABLE IF EXISTS `node_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `node_stats` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `public_key` varchar(66) NOT NULL DEFAULT '',
  `added` timestamp NULL DEFAULT NULL,
  `capacity` bigint(20) unsigned NOT NULL DEFAULT 0,
  `channels` int(11) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `added` (`added`,`public_key`),
  KEY `public_key` (`public_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nodes`
--

DROP TABLE IF EXISTS `nodes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nodes` (
  `public_key` varchar(66) NOT NULL,
  `first_seen` datetime NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `alias` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `alias_search` text DEFAULT NULL,
  `color` varchar(200) NOT NULL,
  `sockets` text DEFAULT NULL,
  `as_number` int(11) unsigned DEFAULT NULL,
  `city_id` int(11) unsigned DEFAULT NULL,
  `country_id` int(11) unsigned DEFAULT NULL,
  `accuracy_radius` int(11) unsigned DEFAULT NULL,
  `subdivision_id` int(11) unsigned DEFAULT NULL,
  `longitude` double DEFAULT NULL,
  `latitude` double DEFAULT NULL,
  `status` tinyint(4) NOT NULL DEFAULT 1,
  `capacity` bigint(20) unsigned DEFAULT NULL,
  `channels` int(11) unsigned DEFAULT NULL,
  `features` text DEFAULT NULL,
  PRIMARY KEY (`public_key`),
  KEY `alias` (`alias`(10)),
  KEY `capacity` (`capacity`),
  KEY `status` (`status`),
  KEY `channels` (`channels`),
  KEY `country_id` (`country_id`),
  KEY `as_number` (`as_number`),
  KEY `first_seen` (`first_seen`),
  FULLTEXT KEY `alias_search` (`alias_search`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nodes_records`
--

DROP TABLE IF EXISTS `nodes_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nodes_records` (
  `public_key` varchar(66) NOT NULL,
  `type` int(10) unsigned NOT NULL,
  `payload` blob NOT NULL,
  UNIQUE KEY `public_key_type` (`public_key`,`type`),
  KEY `public_key` (`public_key`),
  CONSTRAINT `nodes_records_ibfk_1` FOREIGN KEY (`public_key`) REFERENCES `nodes` (`public_key`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `nodes_sockets`
--

DROP TABLE IF EXISTS `nodes_sockets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `nodes_sockets` (
  `public_key` varchar(66) NOT NULL,
  `socket` varchar(100) NOT NULL,
  `type` enum('ipv4','ipv6','torv2','torv3','i2p','dns','websocket') DEFAULT NULL,
  UNIQUE KEY `public_key_socket` (`public_key`,`socket`),
  KEY `public_key` (`public_key`),
  KEY `type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pools`
--

DROP TABLE IF EXISTS `pools`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pools` (
  `id` smallint(5) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `link` varchar(255) NOT NULL,
  `addresses` text NOT NULL,
  `regexes` text NOT NULL,
  `slug` char(50) DEFAULT NULL,
  `unique_id` int(11) NOT NULL DEFAULT -1,
  PRIMARY KEY (`id`),
  KEY `slug` (`slug`),
  KEY `unique_id` (`unique_id`)
) ENGINE=InnoDB AUTO_INCREMENT=271 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `prices`
--

DROP TABLE IF EXISTS `prices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `prices` (
  `time` datetime NOT NULL,
  `USD` float DEFAULT 0,
  `EUR` float DEFAULT 0,
  `GBP` float DEFAULT 0,
  `CAD` float DEFAULT 0,
  `CHF` float DEFAULT 0,
  `AUD` float DEFAULT 0,
  `JPY` float DEFAULT 0,
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `BGN` float DEFAULT -1,
  `BRL` float DEFAULT -1,
  `CNY` float DEFAULT -1,
  `CZK` float DEFAULT -1,
  `DKK` float DEFAULT -1,
  `HKD` float DEFAULT -1,
  `HRK` float DEFAULT -1,
  `HUF` float DEFAULT -1,
  `IDR` float DEFAULT -1,
  `ILS` float DEFAULT -1,
  `INR` float DEFAULT -1,
  `ISK` float DEFAULT -1,
  `KRW` float DEFAULT -1,
  `MXN` float DEFAULT -1,
  `MYR` float DEFAULT -1,
  `NOK` float DEFAULT -1,
  `NZD` float DEFAULT -1,
  `PHP` float DEFAULT -1,
  `PLN` float DEFAULT -1,
  `RON` float DEFAULT -1,
  `RUB` float DEFAULT -1,
  `SEK` float DEFAULT -1,
  `SGD` float DEFAULT -1,
  `THB` float DEFAULT -1,
  `TRY` float DEFAULT -1,
  `ZAR` float DEFAULT -1,
  PRIMARY KEY (`time`),
  UNIQUE KEY `id` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=894 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `state`
--

DROP TABLE IF EXISTS `state`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `state` (
  `name` varchar(100) DEFAULT NULL,
  `number` int(11) DEFAULT NULL,
  `string` varchar(100) DEFAULT NULL,
  UNIQUE KEY `name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `statistics`
--

DROP TABLE IF EXISTS `statistics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `statistics` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `added` datetime NOT NULL,
  `unconfirmed_transactions` int(11) unsigned NOT NULL,
  `tx_per_second` float unsigned NOT NULL,
  `vbytes_per_second` int(10) unsigned NOT NULL,
  `mempool_byte_weight` bigint(20) unsigned NOT NULL,
  `fee_data` longtext NOT NULL,
  `total_fee` decimal(65,0) unsigned DEFAULT NULL,
  `vsize_1` int(11) NOT NULL,
  `vsize_2` int(11) NOT NULL,
  `vsize_3` int(11) NOT NULL,
  `vsize_4` int(11) NOT NULL,
  `vsize_5` int(11) NOT NULL,
  `vsize_6` int(11) NOT NULL,
  `vsize_8` int(11) NOT NULL,
  `vsize_10` int(11) NOT NULL,
  `vsize_12` int(11) NOT NULL,
  `vsize_15` int(11) NOT NULL,
  `vsize_20` int(11) NOT NULL,
  `vsize_30` int(11) NOT NULL,
  `vsize_40` int(11) NOT NULL,
  `vsize_50` int(11) NOT NULL,
  `vsize_60` int(11) NOT NULL,
  `vsize_70` int(11) NOT NULL,
  `vsize_80` int(11) NOT NULL,
  `vsize_90` int(11) NOT NULL,
  `vsize_100` int(11) NOT NULL,
  `vsize_125` int(11) NOT NULL,
  `vsize_150` int(11) NOT NULL,
  `vsize_175` int(11) NOT NULL,
  `vsize_200` int(11) NOT NULL,
  `vsize_250` int(11) NOT NULL,
  `vsize_300` int(11) NOT NULL,
  `vsize_350` int(11) NOT NULL,
  `vsize_400` int(11) NOT NULL,
  `vsize_500` int(11) NOT NULL,
  `vsize_600` int(11) NOT NULL,
  `vsize_700` int(11) NOT NULL,
  `vsize_800` int(11) NOT NULL,
  `vsize_900` int(11) NOT NULL,
  `vsize_1000` int(11) NOT NULL,
  `vsize_1200` int(11) NOT NULL,
  `vsize_1400` int(11) NOT NULL,
  `vsize_1600` int(11) NOT NULL,
  `vsize_1800` int(11) NOT NULL,
  `vsize_2000` int(11) NOT NULL,
  `min_fee` float unsigned DEFAULT NULL,
  `vsize_0` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `added` (`added`)
) ENGINE=InnoDB AUTO_INCREMENT=7138 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- This is a complete schema snapshot. Seed its version so the backend does not
-- mistake an existing, empty state table for a partially initialized database.
INSERT INTO state (name, number, string) VALUES
  ('schema_version', 110, NULL),
  ('last_elements_block', 0, NULL),
  ('last_bitcoin_block_audit', 0, NULL),
  ('last_acceleration_block', 0, NULL);
