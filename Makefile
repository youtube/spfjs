# Copyright 2014 Google Inc. All rights reserved.
#
# Use of this source code is governed by The MIT License.
# See the LICENSE file for details.

MAKEFLAGS = -j 1
NINJA = $(shell command -v ninja || echo vendor/ninja/ninja)
PYTHON = $(shell command -v python || echo _missing_python_)


# Always execute targets.
.PHONY: default all tests demo clean reset
.PHONY: spf debug-spf tracing-spf
.PHONY: bootloader debug-bootloader tracing-bootloader


# Require Ninja.
default all tests demo clean: $(NINJA)
spf debug-spf tracing-spf: $(NINJA)
bootloader debug-bootloader tracing-bootloader: $(NINJA)


# Pass off builds to Ninja.
default:
	@$(NINJA)
clean:
	@$(NINJA) -t clean
all:
	@$(NINJA) all
spf:
	@$(NINJA) spf
debug-spf:
	@$(NINJA) debug-spf
tracing-spf:
	@$(NINJA) tracing-spf
bootloader:
	@$(NINJA) bootloader
debug-bootloader:
	@$(NINJA) debug-bootloader
tracing-bootloader:
	@$(NINJA) tracing-bootloader
tests:
	@$(NINJA) tests
	@echo "Open build/test/runner.html in your browser."
demo:
	@$(NINJA) demo
	@echo "Running demo..."
	@cd build/demo && $(PYTHON) -m app


# Get back to a newly-cloned state.
reset:
	@rm -rf build build.ninja
	@rm -rf vendor/closure-compiler vendor/jasmine vendor/ninja vendor/webpy


# Ensure a build file exists before running Ninja.
# Output a status message when Ninja is run.
$(NINJA) vendor/ninja/ninja: build.ninja
	@echo "Running Ninja..."

# The configure script generates the build file and handles dependencies.
build.ninja: $(PYTHON)
	@$(PYTHON) ./configure.py


# Python is required to run the configure script.
_missing_python_:
	@echo "ERROR: Unable to find python."
	@echo "Please install python and try again."
	@exit 1
