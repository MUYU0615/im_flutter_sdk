
# Simple task runner for repo-local skills
# Usage: make <target> [VAR=VALUE ...]

PY ?= python3
SKILL_CREATOR ?= $(HOME)/.codex/skills/.system/skill-creator

.PHONY: help ws-call ws-wait create-users delete-user \
        contact-establish contact-delete contact-block contact-unblock \
        skills-validate test test-allure test-html test-chat-strict test-chat-discover \
        web-e2e web-wrapper-mapping web-coverage-report \
        android-real-e2e ios-real-e2e web-real-e2e web-real-matrix web-real-report \
        web-real-no-real-api-audit web-real-docs web-real-full-baseline clean

help:
	@echo "Available targets:"
	@echo "  ws-call            MANAGER, CMD [, INFO, DEVICE, TOPIC, EVENT, EVENT_TIMEOUT]"
	@echo "  ws-wait            [DEVICE, TOPIC] (one of CMD or EVENT)"
	@echo "  create-users       USERS='u1 u2' or FROM_FILE=users.json [PASSWORD=1]"
	@echo "  delete-user        USERNAME=u1"
	@echo "  contact-establish  INITIATOR_DEVICE=... PEER_DEVICE=... USER_A=... USER_B=... [REASON=flow]"
	@echo "  contact-delete     INITIATOR_DEVICE=... FRIEND_USER_ID=... [KEEP_CONVERSATION=1]"
	@echo "  contact-block      DEVICE=... USER_ID=..."
	@echo "  contact-unblock    DEVICE=... USER_ID=..."
	@echo "  skills-validate    Validate skill folders under skills/"
	@echo "  test               Run pytest (pass ARGS=... to forward extra args)"
	@echo "  test-allure        Run pytest with --alluredir=out/allure-results"
	@echo "  test-html          Run pytest with HTML report to out/report.html"
	@echo "  web-e2e            Run local relay + Flutter web-server + headless Web regression"
	@echo "  web-wrapper-mapping Run Web wrapper JSON mapping cases via local_adapter"
	@echo "  web-coverage-report Generate Web API coverage markdown report"
	@echo "  android-real-e2e   Run Android real SDK/service E2E cases"
	@echo "  ios-real-e2e       Run iOS real SDK/service E2E cases"
	@echo "  web-real-e2e       Run real Web SDK/service E2E through local relay + headless Web clients"
	@echo "  web-real-matrix    Generate real Web E2E API matrix"
	@echo "  web-real-report    Generate real Web E2E coverage markdown report"
	@echo "  web-real-no-real-api-audit Generate no-real-API audit markdown report"
	@echo "  web-real-docs      Generate real Web matrix/report/audit docs together"
	@echo "  web-real-full-baseline Run full real Web E2E baseline suite (tests/web_real)"

# --- WebSocket calls ---
ws-call:
	@[ -n "$(MANAGER)" ] || { echo "MANAGER is required"; exit 2; }
	@[ -n "$(CMD)" ] || { echo "CMD is required"; exit 2; }
	$(PY) skills/im-ws/scripts/ws_call.py \
	  --manager "$(MANAGER)" --cmd "$(CMD)" \
	  $(if $(INFO),--info-json '$(INFO)') \
	  $(if $(DEVICE),--device "$(DEVICE)") \
	  $(if $(TOPIC),--topic "$(TOPIC)") \
	  $(if $(ID),--id "$(ID)") \
	  $(if $(SEQUENCE),--sequence $(SEQUENCE)) \
	  $(if $(TYPE),--type $(TYPE)) \
	  $(if $(OBJ_ID),--obj-id $(OBJ_ID)) \
	  $(if $(EVENT),--wait-event "$(EVENT)") \
	  $(if $(EVENT_TIMEOUT),--event-timeout $(EVENT_TIMEOUT))

ws-wait:
	@if [ -z "$(CMD)" ] && [ -z "$(EVENT)" ]; then echo "One of CMD or EVENT is required"; exit 2; fi
	$(PY) skills/im-ws/scripts/ws_wait.py \
	  $(if $(DEVICE),--device "$(DEVICE)") \
	  $(if $(TOPIC),--topic "$(TOPIC)") \
	  $(if $(CMD),--cmd "$(CMD)") \
	  $(if $(EVENT),--event "$(EVENT)") \
	  $(if $(TIMEOUT),--timeout $(TIMEOUT))

# --- REST user provisioning ---
create-users:
	@if [ -n "$(USERS)" ]; then \
	  $(PY) skills/im-rest-users/scripts/create_users.py --user $(USERS) $(if $(PASSWORD),--password $(PASSWORD)); \
	elif [ -n "$(FROM_FILE)" ]; then \
	  $(PY) skills/im-rest-users/scripts/create_users.py --from-file $(FROM_FILE); \
	else \
	  echo "USERS='u1 u2' or FROM_FILE=users.json is required"; exit 2; \
	fi

delete-user:
	@[ -n "$(USERNAME)" ] || { echo "USERNAME is required"; exit 2; }
	$(PY) skills/im-rest-users/scripts/delete_user.py --username $(USERNAME)

# --- Contact flows ---
contact-establish:
	@[ -n "$(INITIATOR_DEVICE)" ] || { echo "INITIATOR_DEVICE is required"; exit 2; }
	@[ -n "$(PEER_DEVICE)" ] || { echo "PEER_DEVICE is required"; exit 2; }
	@[ -n "$(USER_A)" ] || { echo "USER_A is required"; exit 2; }
	@[ -n "$(USER_B)" ] || { echo "USER_B is required"; exit 2; }
	$(PY) skills/im-contact-flow/scripts/contact_flow.py establish-friends \
	  --initiator-device $(INITIATOR_DEVICE) --peer-device $(PEER_DEVICE) \
	  --user-a $(USER_A) --user-b $(USER_B) $(if $(REASON),--reason "$(REASON)")

contact-delete:
	@[ -n "$(INITIATOR_DEVICE)" ] || { echo "INITIATOR_DEVICE is required"; exit 2; }
	@[ -n "$(FRIEND_USER_ID)" ] || { echo "FRIEND_USER_ID is required"; exit 2; }
	$(PY) skills/im-contact-flow/scripts/contact_flow.py delete-friend \
	  --initiator-device $(INITIATOR_DEVICE) --friend-user-id $(FRIEND_USER_ID) \
	  $(if $(KEEP_CONVERSATION),--keep-conversation)

contact-block:
	@[ -n "$(DEVICE)" ] || { echo "DEVICE is required"; exit 2; }
	@[ -n "$(USER_ID)" ] || { echo "USER_ID is required"; exit 2; }
	$(PY) skills/im-contact-flow/scripts/contact_flow.py block --device $(DEVICE) --user-id $(USER_ID)

contact-unblock:
	@[ -n "$(DEVICE)" ] || { echo "DEVICE is required"; exit 2; }
	@[ -n "$(USER_ID)" ] || { echo "USER_ID is required"; exit 2; }
	$(PY) skills/im-contact-flow/scripts/contact_flow.py unblock --device $(DEVICE) --user-id $(USER_ID)

# --- Validate skills ---
skills-validate:
	$(PY) $(SKILL_CREATOR)/scripts/quick_validate.py skills/native-auto-test-framework
	$(PY) $(SKILL_CREATOR)/scripts/quick_validate.py skills/im-ws
	$(PY) $(SKILL_CREATOR)/scripts/quick_validate.py skills/im-rest-users
	$(PY) $(SKILL_CREATOR)/scripts/quick_validate.py skills/im-contact-flow
	$(PY) $(SKILL_CREATOR)/scripts/quick_validate.py skills/release-note-case-mapping

# --- Tests ---
test:
	$(PY) -m pytest $(ARGS)

test-allure:
	mkdir -p out/allure-results
	$(PY) -m pytest --alluredir=out/allure-results $(ARGS)

test-html:
	mkdir -p out
	$(PY) -m pytest --html=out/report.html --self-contained-html $(ARGS)

web-e2e:
	$(PY) -m src.tools.web_e2e_runner $(ARGS)

web-wrapper-mapping:
	$(PY) -m src.tools.web_e2e_runner \
	  --web-sdk-mode local_adapter \
	  $(if $(ARGS),$(ARGS),-- tests/web --target-platform web -m wrapper_mapping -q)

web-coverage-report:
	$(PY) -m src.tools.web_coverage_report --strict --markdown \
	  --output docs/agents/web/WEB_API_COVERAGE_REPORT.md

android-real-e2e:
	$(PY) -m src.tools.android_e2e_runner \
	  $(if $(ARGS),$(ARGS),-- tests --target-platform android -m real_e2e -q)

ios-real-e2e:
	$(PY) -m pytest tests --target-platform ios -m real_e2e $(ARGS)

web-real-e2e:
	$(PY) -m src.tools.web_e2e_runner \
	  --web-sdk-mode real_sdk \
	  $(if $(ARGS),$(ARGS),-- tests/web_real --target-platform web -m real_e2e -q)

web-real-matrix:
	$(PY) -m src.tools.web_real_e2e_matrix --strict --markdown \
	  --output docs/agents/web/WEB_REAL_E2E_API_MATRIX.md

web-real-report:
	$(PY) -m src.tools.web_real_e2e_report --strict --markdown \
	  --output docs/agents/web/WEB_REAL_E2E_COVERAGE_REPORT.md

web-real-no-real-api-audit:
	$(PY) -m src.tools.web_real_e2e_no_real_api_audit --strict \
	  --output docs/agents/web/WEB_REAL_E2E_NO_REAL_API_AUDIT.md

web-real-docs: web-real-matrix web-real-report web-real-no-real-api-audit

web-real-full-baseline:
	$(PY) -m src.tools.web_e2e_runner \
	  --run-id web-real-full-baseline \
	  --web-sdk-mode real_sdk \
	  --headless-startup-wait 150 \
	  --startup-timeout 240 \
	  --flutter-timeout 300 \
	  -- tests/web_real --target-platform web -q

# --- Chat test presets ---
test-chat-strict:
	@echo "[Strict] chat suite (CASES_DISCOVER=0)"
	CASES_DISCOVER=0 WS_DEBUG=0 $(PY) -m pytest -q tests/chat -s $(ARGS)

test-chat-discover:
	@echo "[Discover] chat suite (CASES_DISCOVER=1, WS_DEBUG=1)"
	CASES_DISCOVER=1 WS_DEBUG=1 $(PY) -m pytest -q tests/chat -s $(ARGS)

clean:
	rm -rf out
