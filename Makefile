# Copyright 2014 Google Inc. All rights reserved.
#
# Use of this source code is governed by The MIT License.
# See the LICENSE file for details.

MAKEFLAGS = -j 1
NINJA = $(shell command -v ninja || echo vendor/ninja/ninja)

# Always execute targets.
.PHONY: default all tests demo clean reset
.PHONY: spf debug-spf tracing-spf
.PHONY: bootloader debug-bootloader tracing-bootloader


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
	@cd build/demo && python -m app


# Get back to a newly-cloned state.
reset:
	@git submodule deinit .
	@rm -rf build build.ninja
	@rm -rf vendor/closure-compiler vendor/jasmine


# Builds require Ninja.
default clean all tests demo: $(NINJA)
spf debug-spf tracing-spf: $(NINJA)
bootloader debug-bootloader tracing-bootloader: $(NINJA)

# Ensure a build file exists before actually running Ninja.
$(NINJA): build.ninja

# Generate the build file from the configure script.
build.ninja: vendor/ninja/misc/ninja_syntax.py
	@python ./configure.py

# Build Ninja with itself, if needed.
vendor/ninja/ninja: vendor/ninja/bootstrap.py
	@python vendor/ninja/bootstrap.py

# Use a git submodule to manage Ninja dependencies.
vendor/ninja/bootstrap.py vendor/ninja/misc/ninja_syntax.py:
	@git submodule update --init --force
