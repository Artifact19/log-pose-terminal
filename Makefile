.PHONY: setup sync test api web verify clean

PYTHON := backend/.venv/Scripts/python.exe
PIP := backend/.venv/Scripts/pip.exe
PYTEST := backend/.venv/Scripts/pytest.exe

setup:
	$(PYTHON) -m pip install -r backend/requirements.txt
	cd frontend && npm install

sync:
	$(PYTHON) scripts/sync_notebooks.py

test:
	$(PYTEST) backend/tests -v

api:
	$(PYTHON) -m uvicorn backend.app.main:app --reload --port 8000

web:
	cd frontend && npm run dev

verify:
	$(PYTHON) scripts/verify_system.py

clean:
	rm -rf cache/* artifacts/* ledger.db

