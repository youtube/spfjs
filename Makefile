# Copyright 2014 Google Inc. All rights reserved.
#
# Use of this source code is governed by The MIT License.
# See the LICENSE file for details.

MAKEFLAGS = -j 1
NPM = $(shell command -v npm || echo _missing_npm_)


# Always execute targets.
.PHONY: default all tests demo lint fix clean reset
.PHONY: spf spf-debug spf-trace
.PHONY: boot boot-debug boot-trace
.PHONY: deprecated

# Require npm and show deprecation warning
default all tests demo lint fix dist: deprecated $(NPM)
spf spf-debug spf-trace: deprecated $(NPM)
boot boot-debug boot-trace: deprecated $(NPM)
clean reset: deprecated $(NPM)

# Deprecation warning.
deprecated:
	@echo "Warning: make is deprecated; npm is now required."
	@echo

# Pass off builds to npm.
default:
	@echo "Running the following npm command:"
	@echo "    npm run build"
	@echo "Please switch to calling npm directly."
	@echo
	@$(NPM) install && $(NPM) run build
all:
	@echo "Running the following npm command:"
	@echo "    npm run build-all"
	@echo "Please switch to calling npm directly."
	@echo
	@$(NPM) install && $(NPM) run build-all
spf spf-debug spf-trace:
	@echo "Running the following npm command:"
	@echo "    npm run build-spf"
	@echo "Please switch to calling npm directly."
	@echo
	@$(NPM) install && $(NPM) run build-spf
boot boot-debug boot-trace:
	@echo "Running the following npm command:"
	@echo "    npm run build-boot"
	@echo "Please switch to calling npm directly."
	@echo
	@$(NPM) install && $(NPM) run build-boot
tests:
	@echo "Running the following npm command:"
	@echo "    npm test"
	@echo "Please switch to calling npm directly."
	@echo
	@$(NPM) install && $(NPM) test
demo:
	@echo "Running the following npm command:"
	@echo "    npm start"
	@echo "Please switch to calling npm directly."
	@echo
	@$(NPM) install && $(NPM) start
lint:
	@echo "Running the following npm command:"
	@echo "    npm run lint"
	@echo "Please switch to calling npm directly."
	@echo
	@$(NPM) install && $(NPM) run lint
fix:
	@echo "Running the following npm command:"
	@echo "    npm run fix"
	@echo "Please switch to calling npm directly."
	@echo
	@$(NPM) install && $(NPM) run fix
dist:
	@echo "Running the following npm command:"
	@echo "    npm run dist"
	@echo "Please switch to calling npm directly."
	@echo
	@$(NPM) install && $(NPM) run dist

# Remove build output and files
clean:
	@echo "Running the following npm command:"
	@echo "    npm run clean"
	@echo "Please switch to calling npm directly."
	@echo
	@$(NPM) install && $(NPM) run clean
# Get back to a newly-cloned state.
reset: clean
	@echo "Running the following npm command:"
	@echo "    npm run reset"
	@echo "Please switch to calling npm directly."
	@echo
	@$(NPM) install && $(NPM) run reset

# npm is required.
_missing_npm_:
	@echo "ERROR: Unable to find npm."
	@echo "Please install npm and try again."
	@exit 1
