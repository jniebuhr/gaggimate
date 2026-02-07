.PHONY: help shell build-display build-controller build-headless build-all upload-display upload-controller upload-headless upload-fs web-install web-dev web-build web-preview build-fs install-display install-controller monitor-display monitor-controller format format-web lint-web format-lint-all check-display check-controller check-all clean clean-web dev flash-display flash-controller

# Default target
.DEFAULT_GOAL := help

# Colors for output
CYAN := \033[0;36m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m # No Color

##@ General

help: ## Display this help message
	@echo -e "$(CYAN)GaggiMate Build System$(NC)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "Usage:\n  make $(CYAN)<target>$(NC)\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  $(CYAN)%-20s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(YELLOW)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

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
