.PHONY: help shell build-display build-controller build-headless build-all upload-display upload-controller upload-headless upload-fs web-install web-dev web-build web-preview build-fs install-display install-controller monitor-display monitor-controller format format-web lint-web format-lint-all check-display check-controller check-all clean clean-web dev flash-display flash-controller remote-ports remote-sync-display remote-sync-controller remote-sync remote-flash-display remote-flash-controller remote-flash-fs remote-flash-all remote-monitor-display remote-monitor-controller

# Default target
.DEFAULT_GOAL := help

# Colors for output
CYAN := \033[0;36m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m # No Color

# Remote flashing configuration (override via env or CLI: make remote-flash-display REMOTE_HOST=192.168.1.50)
REMOTE_HOST     ?= rpi3
REMOTE_USER     ?= matt
REMOTE_DIR      ?= ~/gaggimate-bins
DISPLAY_PORT    ?= /dev/ttyACM0
CONTROLLER_PORT ?= /dev/ttyACM1
ESPTOOL         ?= esptool

# Build output paths
DISPLAY_BUILD    := .pio/build/display
CONTROLLER_BUILD := .pio/build/controller

# Flash addresses (from partition tables)
BOOTLOADER_ADDR  := 0x0000
PARTITIONS_ADDR  := 0x8000
FIRMWARE_ADDR    := 0x10000
DISPLAY_FS_ADDR  := 0xC90000

##@ General

help: ## Display this help message
	@echo -e "$(CYAN)GaggiMate Build System$(NC)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "Usage:\n  make $(CYAN)<target>$(NC)\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  $(CYAN)%-28s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(YELLOW)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

shell: ## Enter Nix development shell with all dependencies
	@echo -e "$(GREEN)Entering Nix development environment...$(NC)"
	nix develop

##@ Firmware Build

build-display: ## Build display firmware
	@echo -e "$(GREEN)Building display firmware...$(NC)"
	platformio run -e display

build-controller: ## Build controller firmware
	@echo -e "$(GREEN)Building controller firmware...$(NC)"
	platformio run -e controller

build-headless: ## Build headless display firmware (no screen)
	@echo -e "$(GREEN)Building headless display firmware...$(NC)"
	platformio run -e display-headless

build-all: build-display build-controller ## Build all firmware

##@ Firmware Upload

upload-display: ## Upload firmware to display board (connect display via USB first!)
	@echo -e "$(GREEN)Uploading to display board...$(NC)"
	@echo -e "$(YELLOW)⚠️  Make sure display board is connected via USB$(NC)"
	platformio run -e display -t upload

upload-controller: ## Upload firmware to controller board (connect controller via USB first!)
	@echo -e "$(GREEN)Uploading to controller board...$(NC)"
	@echo -e "$(YELLOW)⚠️  Make sure controller board is connected via USB$(NC)"
	platformio run -e controller -t upload

upload-headless: ## Upload headless firmware to display board
	@echo -e "$(GREEN)Uploading headless firmware...$(NC)"
	@echo -e "$(YELLOW)⚠️  Make sure display board is connected via USB$(NC)"
	platformio run -e display-headless -t upload

##@ Web Interface & Filesystem

web-install: ## Install web UI dependencies
	@echo -e "$(GREEN)Installing web dependencies...$(NC)"
	cd web && npm install

web-dev: ## Start web development server (http://localhost:5173)
	@echo -e "$(GREEN)Starting web dev server...$(NC)"
	cd web && npm run dev

web-build: ## Build web UI for production
	@echo -e "$(GREEN)Building web UI...$(NC)"
	cd web && npm run build

web-preview: web-build ## Preview production web build (http://localhost:4173)
	@echo -e "$(GREEN)Starting web preview server...$(NC)"
	cd web && npm run preview

build-fs: ## Build SPIFFS filesystem (includes web UI)
	@echo -e "$(GREEN)Building SPIFFS filesystem...$(NC)"
	./scripts/build_spiffs.sh

upload-fs: build-fs ## Build and upload SPIFFS filesystem to display board
	@echo -e "$(GREEN)Uploading filesystem to display board...$(NC)"
	@echo -e "$(YELLOW)⚠️  Make sure display board is connected via USB$(NC)"
	platformio run -e display -t uploadfs

##@ Complete Installation

install-display: upload-display upload-fs ## Complete display installation (firmware + filesystem)
	@echo -e "$(GREEN)✓ Display board fully programmed!$(NC)"
	@echo -e "$(YELLOW)You can now disconnect the display board$(NC)"

install-controller: upload-controller ## Complete controller installation (firmware only)
	@echo -e "$(GREEN)✓ Controller board fully programmed!$(NC)"
	@echo -e "$(YELLOW)You can now disconnect the controller board$(NC)"

##@ Monitoring

monitor-display: ## Monitor serial output from display board
	@echo -e "$(GREEN)Monitoring display board (Ctrl+] to exit)...$(NC)"
	platformio device monitor -e display

monitor-controller: ## Monitor serial output from controller board
	@echo -e "$(GREEN)Monitoring controller board (Ctrl+] to exit)...$(NC)"
	platformio device monitor -e controller

##@ Format & Lint

format: ## Format C/C++ code with clang-format
	@echo -e "$(GREEN)Formatting code...$(NC)"
	./scripts/format.sh

format-web: ## Format web code
	@echo -e "$(GREEN)Formatting web code...$(NC)"
	cd web && npm run format

lint-web: ## Lint web code
	@echo -e "$(GREEN)Linting web code...$(NC)"
	cd web && npm run lint

format-lint-all: format format-web lint-web ## Format & Lint All
	@echo -e "$(GREEN)Done!$(NC)"

##@ Static Analysis & Checks

check-display: ## Run static analysis on display firmware
	@echo -e "$(GREEN)Running static analysis on display firmware...$(NC)"
	platformio check -e display

check-controller: ## Run static analysis on controller firmware
	@echo -e "$(GREEN)Running static analysis on controller firmware...$(NC)"
	platformio check -e controller

check-all: check-display check-controller ## Run static analysis on all firmware

##@ Remote Flashing (build locally, flash via remote Pi)

remote-ports: ## List serial ports on the remote Pi
	@echo -e "$(GREEN)Checking serial ports on $(REMOTE_HOST)...$(NC)"
	@ssh $(REMOTE_USER)@$(REMOTE_HOST) "ls -la /dev/ttyACM* 2>/dev/null || echo 'No /dev/ttyACM* devices found'"
	@echo ""
	@echo -e "$(CYAN)Identifying connected chips...$(NC)"
	@ssh $(REMOTE_USER)@$(REMOTE_HOST) '\
		for port in /dev/ttyACM*; do \
			if [ -e "$$port" ]; then \
				echo ""; \
				echo "--- $$port ---"; \
				$(ESPTOOL) --port "$$port" --before no_reset --after no_reset chip-id 2>&1 || echo "  Could not identify chip on $$port"; \
			fi; \
		done'

remote-sync-display: build-display build-fs ## Build display + SPIFFS and sync to remote Pi
	@echo -e "$(GREEN)Building SPIFFS image...$(NC)"
	platformio run -e display -t buildfs
	@echo -e "$(GREEN)Syncing display binaries to $(REMOTE_HOST)...$(NC)"
	@ssh $(REMOTE_USER)@$(REMOTE_HOST) "mkdir -p $(REMOTE_DIR)/display"
	rsync -avz \
		$(DISPLAY_BUILD)/firmware.bin \
		$(DISPLAY_BUILD)/bootloader.bin \
		$(DISPLAY_BUILD)/partitions.bin \
		$(DISPLAY_BUILD)/spiffs.bin \
		$(REMOTE_USER)@$(REMOTE_HOST):$(REMOTE_DIR)/display/
	@echo -e "$(GREEN)Display binaries synced.$(NC)"

remote-sync-controller: build-controller ## Build controller and sync to remote Pi
	@echo -e "$(GREEN)Syncing controller binaries to $(REMOTE_HOST)...$(NC)"
	@ssh $(REMOTE_USER)@$(REMOTE_HOST) "mkdir -p $(REMOTE_DIR)/controller"
	rsync -avz \
		$(CONTROLLER_BUILD)/firmware.bin \
		$(CONTROLLER_BUILD)/bootloader.bin \
		$(CONTROLLER_BUILD)/partitions.bin \
		$(REMOTE_USER)@$(REMOTE_HOST):$(REMOTE_DIR)/controller/
	@echo -e "$(GREEN)Controller binaries synced.$(NC)"

remote-sync: remote-sync-display remote-sync-controller ## Build all and sync to remote Pi

remote-flash-display: remote-sync-display ## Build, sync, and flash display firmware via remote Pi
	@echo -e "$(GREEN)Flashing display firmware on $(REMOTE_HOST) via $(DISPLAY_PORT)...$(NC)"
	ssh $(REMOTE_USER)@$(REMOTE_HOST) "\
		$(ESPTOOL) --chip esp32s3 --port $(DISPLAY_PORT) --baud 921600 \
		write_flash --flash_mode qio --flash_freq 80m --flash_size 16MB \
		$(BOOTLOADER_ADDR) $(REMOTE_DIR)/display/bootloader.bin \
		$(PARTITIONS_ADDR) $(REMOTE_DIR)/display/partitions.bin \
		$(FIRMWARE_ADDR) $(REMOTE_DIR)/display/firmware.bin"
	@echo -e "$(GREEN)Display firmware flashed.$(NC)"

remote-flash-fs: remote-sync-display ## Build, sync, and flash SPIFFS filesystem via remote Pi
	@echo -e "$(GREEN)Flashing SPIFFS filesystem on $(REMOTE_HOST) via $(DISPLAY_PORT)...$(NC)"
	ssh $(REMOTE_USER)@$(REMOTE_HOST) "\
		$(ESPTOOL) --chip esp32s3 --port $(DISPLAY_PORT) --baud 921600 \
		write_flash --flash_mode qio --flash_freq 80m --flash_size 16MB \
		$(DISPLAY_FS_ADDR) $(REMOTE_DIR)/display/spiffs.bin"
	@echo -e "$(GREEN)SPIFFS filesystem flashed.$(NC)"

remote-flash-controller: remote-sync-controller ## Build, sync, and flash controller firmware via remote Pi
	@echo -e "$(GREEN)Flashing controller firmware on $(REMOTE_HOST) via $(CONTROLLER_PORT)...$(NC)"
	ssh $(REMOTE_USER)@$(REMOTE_HOST) "\
		$(ESPTOOL) --chip esp32s3 --port $(CONTROLLER_PORT) --baud 921600 \
		write_flash --flash_mode qio --flash_freq 80m --flash_size 8MB \
		$(BOOTLOADER_ADDR) $(REMOTE_DIR)/controller/bootloader.bin \
		$(PARTITIONS_ADDR) $(REMOTE_DIR)/controller/partitions.bin \
		$(FIRMWARE_ADDR) $(REMOTE_DIR)/controller/firmware.bin"
	@echo -e "$(GREEN)Controller firmware flashed.$(NC)"

remote-flash-all: remote-flash-display remote-flash-fs remote-flash-controller ## Build, sync, and flash everything via remote Pi
	@echo -e "$(GREEN)All firmware flashed on $(REMOTE_HOST).$(NC)"

remote-monitor-display: ## Monitor display serial output on remote Pi (Ctrl-C to exit)
	@echo -e "$(GREEN)Connecting to display serial on $(REMOTE_HOST) (Ctrl-C to exit)...$(NC)"
	ssh $(REMOTE_USER)@$(REMOTE_HOST) "stty -F $(DISPLAY_PORT) 115200 raw -echo && cat $(DISPLAY_PORT)"

remote-monitor-controller: ## Monitor controller serial output on remote Pi (Ctrl-C to exit)
	@echo -e "$(GREEN)Connecting to controller serial on $(REMOTE_HOST) (Ctrl-C to exit)...$(NC)"
	ssh $(REMOTE_USER)@$(REMOTE_HOST) "stty -F $(CONTROLLER_PORT) 115200 raw -echo && cat $(CONTROLLER_PORT)"

##@ Cleanup

clean: ## Clean build artifacts
	@echo -e "$(GREEN)Cleaning build artifacts...$(NC)"
	platformio run -t clean
	rm -rf .pio
	rm -rf data/w
	cd web && rm -rf dist node_modules

clean-web: ## Clean web build artifacts only
	@echo -e "$(GREEN)Cleaning web artifacts...$(NC)"
	rm -rf data/w
	cd web && rm -rf dist

##@ Quick Commands

dev: web-install build-all ## Quick dev setup: install deps and build everything
	@echo -e "$(GREEN)✓ Development environment ready!$(NC)"

flash-display: build-display upload-display upload-fs ## Quick flash display (build + upload everything)
	@echo -e "$(GREEN)✓ Display flashed successfully!$(NC)"

flash-controller: build-controller upload-controller ## Quick flash controller (build + upload)
	@echo -e "$(GREEN)✓ Controller flashed successfully!$(NC)"
